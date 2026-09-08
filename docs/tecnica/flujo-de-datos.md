---
title: 10. Cómo fluyen los datos
---

# 10. Cómo fluyen los datos

Un dato atraviesa el sistema en cuatro tramos. **Alguien lo descubre y lo encola. Un worker lo procesa
y lo sube al almacén. El servicio de datos lo copia a Redis. El navegador lo pide como tesela.** **Cada
tramo tiene su ritmo y su criterio de reintento.** Este capítulo sigue una unidad de trabajo de punta a
punta.

![Una unidad de trabajo, del descubrimiento a la subida](../imgs/diagrams/tiles-processor-flujo.svg){ .diagram loading=lazy }

## Descubrimiento

Un único contenedor, `tiles-processor-producer`, corre un planificador con el cron `*/5 * * * *`.
**Hace una pasada inmediata al arrancar** y luego una cada cinco minutos. **Un contenedor caído no
recupera los ticks perdidos**: sólo el siguiente. **En cada pasada recorre las
fuentes habilitadas y arma la lista de imágenes pendientes.**

Para no encolar trabajo repetido cruza tres fuentes de verdad:

1. **Los tilesets que ya existen en el bucket**, listados por prefijo.
2. **Las filas en curso** de una base SQLite propia, `processed_images`.
3. **La política de la fuente**: cuántas imágenes hacia atrás mirar y cuántas conservar.

**El trabajo sale como un mensaje JSON.** Lleva el identificador de la imagen, la fuente, la URI de
origen, el prefijo de destino, el recuadro de recorte, el procesador que la atiende, la banda o
producto, y el contador de reintentos. **El productor marca la fila en SQLite antes de publicar.**

## Colas y workers

Hay tres colas de trabajo y una de descarte. **El ruteo depende del producto**, porque los trabajos no
consumen memoria de la misma manera. **La cola pesada existe para que unos pocos trabajos caros no
bloqueen cientos de baratos.** **Una captura de la banda visible del satélite cuesta gigabytes.**
**Un producto de radar cuesta poco, y hay cientos por hora.**

| Cola | Qué lleva | Quién la consume |
|---|---|---|
| `tiles_work_queue` | Lo pesado: GOES-19 ABI, GLM, ECMWF, GFS | Workers `normal`, con prioridad |
| `tiles_radar_light_queue` | Todos los productos de radar | Workers `light`, y `normal` cuando la pesada está vacía |
| `tiles_wrf_light_queue` | Todos los productos de WRF | Igual que la anterior |
| `tiles_dead_letter_queue` | Unidades que agotaron sus reintentos | **Nadie.** Es un depósito para inspección manual |

En producción corren **dos workers normales y tres livianos**. El detalle del ruteo y del ciclo de
vida está en [11.1 Tiles Processor](servicios/tiles-processor.md).

!!! note "El consumo es por *pull*, y el broker no frena nada"
    **Los workers piden un mensaje cuando están listos.** **No hay ventana de mensajes en vuelo
    configurada.** La concurrencia real la fija `WORKER_CONCURRENCY`, dos por worker de fábrica.
    La «prioridad» de la cola pesada es el orden en que el worker consulta las colas, no una
    prioridad del broker.

## Procesamiento

**Cada unidad de trabajo corre en un subproceso aislado.** La razón es la memoria: las bibliotecas
geoespaciales dejan arenas sin devolver, y **terminar el proceso es la única forma confiable de
recuperarlas**. **El worker descarga el archivo crudo en el proceso principal.** **Le pasa al hijo la ruta y
el mensaje serializado.**

Los pasos, con variaciones por producto:

1. Georreferenciación y reproyección a EPSG:4326.
2. Transformación científica propia del producto.
3. Escritura del COG con los valores crudos.
4. Coloreado según la paleta del producto.
5. Pirámide de teselas WebP.
6. Subida al bucket y limpieza del directorio de trabajo.

**El hijo responde por código de salida**: `0` éxito, `2` entrada inservible, `3` apagado solicitado,
`1` cualquier otro error. **Cada subproceso tiene un tope de 30 minutos.**

!!! note "Una excepción al subproceso"
    Los descargadores de GRIB de ECMWF y GFS **corren en el proceso principal del worker**. **Sólo
    descargan y reparten; no abren datos pesados.** El resto de los procesadores sí va a subproceso.

### Reintentos y descarte

**Los reintentos no son reentregas del broker.** Ante un error recuperable, el worker publica un
mensaje nuevo con el contador incrementado en la misma cola, y confirma el original. Con tres
reintentos son **cuatro intentos**. **Agotados, la unidad va a `tiles_dead_letter_queue`.**

| Situación | La fila en SQLite | El mensaje |
|---|---|---|
| Éxito | Se borra | `ack` |
| Entrada inservible | Queda; la recupera el TTL | `ack` |
| Archivo de origen desaparecido | Queda, marcada como error | `ack`, sin reintento ni descarte |
| Descarga transitoria fallida | Se libera | `ack`, sin republicar |
| Pronóstico todavía no publicado | Se libera | `ack`; el productor lo vuelve a descubrir |
| Apagado en curso | Queda | `nack` con reencolado |
| Otro error, quedan reintentos | Queda | Se republica con el contador más uno |
| Otro error, sin reintentos | Queda | Va a la cola de descarte |

## Sincronización y caché

`data-service` corre en dos contenedores de la misma imagen. `APP_ROLE=web` atiende HTTP.
`APP_ROLE=worker` sincroniza. **La estrategia se elige una vez al arrancar**:

- **`full`**, el modo desplegado. Seis bucles recorren el bucket a intervalos fijos y precargan en
  Redis los productos nuevos con sus índices.
- **`on_demand`**. Ningún bucle. Cada lectura resuelve contra Redis y, si falla, contra el bucket.

En `full`, **cada lectura que falla en Redis cae al camino `on_demand`**. **Un desalojo cuesta latencia,
nunca un error.** Ver [11.2 Data Service](servicios/data-service.md).

## Servido de una tesela

![Una tesela, del navegador al bucket](../imgs/diagrams/data-service-tile.svg){ .diagram loading=lazy }

El navegador pide una tesela. **El servicio consulta Redis primero.** **Si no está, va al bucket y recalienta la
caché en segundo plano.**

!!! warning "Una tesela ausente no siempre es un 404"
    La respuesta ante una tesela inexistente **no es uniforme**. Satélite y precipitación de ECMWF
    devuelven `404`. Radar, WRF, GFS y mapas base devuelven `200` con una tesela transparente. Las
    barbas de viento devuelven `200` con una colección vacía. **Un `200` no prueba que el dato
    exista.**

## Mapas base y estaciones

**Dos familias no vienen del procesador.** **Los mapas base los pide el navegador al proveedor**, y el
servicio de datos es el respaldo tesela por tesela. **Las estaciones las trae el sincronizador desde
la API del SMN** cada cinco minutos, y se sirven detrás de una clave.

## Dibujado

El visualizador mantiene el catálogo de capas, el estado de cada capa activa y la línea de tiempo.
**Traduce todo eso a objetos del mapa en el navegador.** Ver [11.4 Visualizer](servicios/visualizer.md).
