---
title: 11.1 Tiles Processor
---

# 11.1 Tiles Processor

`tiles-processor` es el motor de generación. **Descarga datos meteorológicos crudos, los transforma y
deposita teselas WebP, COG y GeoJSON en el bucket `tiles-data`.** Es un sistema productor-consumidor
sobre RabbitMQ, y **el componente que más memoria consume**. No expone ninguna API de datos: **su
única salida es el bucket**.

![Tres colas, dos tipos de worker: el ruteo depende del producto](../../imgs/diagrams/tiles-processor-colas.svg){ .diagram loading=lazy }

## Unidades desplegables

La producción completa usa **nueve contenedores**. [Beta-1](../operacion/beta-1.md) conserva los mismos
roles con seis: omite un worker normal y dos livianos. Todos viven en la misma red de Compose.

| Contenedor | Imagen | Papel |
|---|---|---|
| `tiles-processor-rabbitmq` | `rabbitmq:4.2.9-management` | El broker. Tres colas de trabajo, una de descarte. |
| `tiles-processor-seaweedfs` | `chrislusf/seaweedfs:4.45` | El almacén de objetos. **Crea los buckets al arrancar.** |
| `tiles-processor-producer` | Propia | Descubre imágenes nuevas cada cinco minutos y las encola. |
| `tiles-processor-worker1`, `worker2` | Propia | `WORKER_TYPE=normal`. Atienden la cola pesada primero. |
| `tiles-processor-worker-light1..3` | Propia | `WORKER_TYPE=light`. Sólo las colas de radar y WRF. |
| `tiles-processor-metrics-api` | Propia | API de métricas en `6020`. Alimenta el panel de estado. |

**La imagen propia es una sola.** **El primer argumento del comando elige el modo**: `producer`,
`worker`, `metrics-api` o `migrate`. Las migraciones de las bases locales **corren en proceso al
arrancar** cada modo, serializadas con un bloqueo de archivo. **No hay un contenedor de migración
aparte.**

!!! note "`settings.json` viaja dentro de la imagen"
    **En producción ningún contenedor monta el archivo.** **Cambiar un producto habilitado exige
    reconstruir la imagen.** La plantilla de desarrollo tampoco lo monta. Beta-1 es la excepción:
    monta `settings-beta-1.json` como sólo lectura en productor, workers y métricas para congelar el
    perfil sin reemplazar la configuración general.

## Puertos

| Puerto del host | Contenedor | Qué es | Quién lo necesita |
|---|---|---|---|
| `${S3_TILES_DATA_PORT}` (9000) → `8333` | `seaweedfs` | API S3 | `data-service` y `alerts-service`, **desde el host** |
| `8888`, `9333`, `23646` | `seaweedfs` | Filer, coordinador y panel de administración | Nadie en operación normal |
| `${RABBITMQ_PORT}` (5672) | `rabbitmq` | AMQP | Nadie fuera del stack |
| `${RABBITMQ_MGMT_PORT}` (15672) | `rabbitmq` | Panel del broker | Quien opera |
| `${METRICS_API_PORT:-6020}` | `metrics-api` | Métricas | **El navegador**, directamente |

Producer y workers levantan un servidor de salud en `8080` **que nunca se publica**. **Lo consulta sólo
el healthcheck del contenedor.**

!!! warning "`RABBITMQ_PORT` es dos cosas a la vez"
    La misma variable es el puerto publicado en el host **y** el puerto al que se conectan los
    clientes dentro de la red de compose. Cambiarla para mover el puerto del host **rompe la conexión
    interna**. Ver [15. Distribuir el sistema](../operacion/distribucion.md).

## Con quién habla

| Destino | Protocolo | Para qué |
|---|---|---|
| Bucket público `noaa-goes19` de NOAA | S3 anónimo | Imágenes ABI de GOES-19 |
| Espejos de ECMWF y NOMADS de NOAA | HTTPS | GRIB de modelos globales |
| `/app/data/radar_h5`, `/app/data/wrf_nc`, `/app/data/glm_h5` | **Sistema de archivos** | Radar, WRF y GLM en `mode: "local"` |
| `rabbitmq:5672` | AMQP | Colas, por nombre de servicio |
| `seaweedfs:8333` | S3 | Subida de productos, por nombre de servicio |

Las tres fuentes locales **no llegan por una API del procesador**. En una instalación operativa, los
procesos del organismo que reciben los feeds vivos escriben en esos directorios. `data-simulator`
puede hacerlo con capturas históricas sólo cuando se arma un laboratorio sin feeds. **Es un
acoplamiento de disco, no de puerto.** Ver [13. Topología de red](../operacion/topologia.md).

## Qué guarda

| Volumen | Montado en | Contenido | Copia única |
|---|---|---|---|
| `s3_data` | `/data` del almacén | **Todas las teselas y COG del sistema** | Sí |
| `seaweedfs_filerldb2` | `/data/filerldb2` del almacén | El índice de archivos del almacén | **Sí, y hay que respaldarlo junto con `s3_data`** |
| `tiles_data` | `/app/data` de producer, workers y métricas | Crudos de radar, WRF y GLM; `progress_tracker.db`; `metrics.db` | Sí para las métricas |
| `rabbitmq_data` | `/var/lib/rabbitmq` | Colas y mensajes pendientes | No: el productor vuelve a publicar |

En producción completa, **las siete unidades de aplicación comparten `tiles_data`**; en Beta-1 son
cuatro. Es un volumen local —un bind mount en Beta-1—, no una carpeta de red. **Esa es la razón por la
que producer y workers tienen que estar en la misma máquina.**

## Cuando algo falla

| Dependencia caída | Productor y workers | API de métricas |
|---|---|---|
| RabbitMQ | Reintentan la conexión y **el proceso muere**; `restart: unless-stopped` lo levanta. | Sigue arriba; reporta las profundidades de cola como nulas. |
| SeaweedFS | **El worker muere al arrancar**: necesita crear el bucket y aplicar la retención. | No la usa. |
| Fuente externa (NOAA, ECMWF) | La pasada de esa fuente falla y se registra. Las demás siguen. | — |
| Un archivo patológico | El subproceso crece hasta el tope de 30 minutos o hasta que el sistema operativo lo mata. **No hay límite de memoria declarado.** | — |

## Arranque

1. `rabbitmq` y `seaweedfs` arrancan sin dependencias. El almacén **crea los buckets** `tiles-data`,
   `intersection-data` y `basemap-tiles` antes de declararse sano.
2. Producer y workers esperan a que **los dos** estén sanos. Cada uno migra sus bases locales,
   conecta al broker y levanta su servidor de salud.
3. Cada worker aplica al bucket **las reglas de retención** de `settings.json`, una por prefijo.
4. El productor hace **una pasada inmediata** y luego una cada cinco minutos.
5. `metrics-api` sólo espera al broker.

## Salud

| Contenedor | Comprobación | Gracia |
|---|---|---|
| `rabbitmq` | Diagnóstico propio del broker | 15 s |
| `seaweedfs` | Marca de buckets creados **y** respuesta del coordinador | 30 s |
| Producer y workers | `GET /health` en `8080`, `200` si el broker está conectado | 15 s |
| `metrics-api` | `GET /health` en `6020` | 15 s |

## Qué produce

Qué se genera lo decide el archivo de configuración, con un interruptor por producto y una lista de
estaciones de radar. La producción completa usa `settings.json`. **Beta-1 usa
`settings-beta-1.json`**: apaga la banda visible, dos productos de descargas, ocho de diez productos
WRF, la presión de ECMWF y los niveles altos de GFS, y limita el radar a RMA1, RMA2 y RMA8. **Conviene
leer el archivo del perfil desplegado, no dar por sentado el catálogo.**

| Fuente | Productos posibles | Salida | Prefijo del bucket |
|---|---|---|---|
| GOES-19 ABI | Bandas 13, 9 y 2 | Teselas + COG | `tiles/band_*`, `cog/band_*` |
| GOES-19 GLM | Densidad de destellos, energía óptica, área mínima | Teselas + COG | `tiles/glm_*`, `cog/glm_*` |
| Radar SINARAME | Diez variables por radar, tres elevaciones | Teselas + COG | `tiles/radar/`, `cog/radar/` |
| WRF-ARG4K | Diez productos | Teselas, COG, contornos y barbas | `tiles/wrf/`, `cog/wrf/`, `geojson/wrf/` |
| ECMWF | Precipitación total; presión a nivel del mar | Teselas + COG; sólo isobaras GeoJSON | `tiles/models/ecmwf/`, `geojson/models/ecmwf/` |
| GFS | Presión a nivel del mar; 500 y 250 hPa | COG + GeoJSON; teselas en altura | `tiles/models/gfs/`, `geojson/models/gfs/` |

Las variables de radar y su subvolumen de origen:

| Producto | Subvolumen | Unidad |
|---|---|---|
| `DBZH`, `ZH`, `TH`, `RHOHV`, `ZDR`, `KDP`, `PHIDP` | 01 | dBZ, dBZ, dBZ, —, dB, °/km, ° |
| `DBZH_450KM` | **04** | dBZ |
| `VRAD`, `WRAD` | **02** | m/s |

!!! note "Las elevaciones son índices, no ángulos"
    Los tres barridos publicados son los índices `0`, `1` y `2` del archivo. **El ángulo real sólo
    queda en el registro.** **`DBZH_450KM` tiene un solo barrido**, así que sólo publica `elev0`.

## Memoria

!!! warning "La banda 2 es la que dimensiona la máquina"
    La malla de disco completo de la banda 2 tiene 21696 × 21696 puntos. Decodificarla a punto
    flotante de 64 bits costaría del orden de 3,7 GB. **El procesador la carga como enteros de 16
    bits, promedia bloques de 4 × 4 y recién entonces aplica escala.** **Además baja el paralelismo de
    GDAL a 1.** Aun así, es el trabajo más caro del sistema. Los números para dimensionar están en
    [16. Capacidad](../operacion/capacidad.md).

## Retención

**Cada worker aplica al arrancar una regla de ciclo de vida de S3 por prefijo**, tomada de
`settings.json`.

| Prefijos | Días |
|---|---|
| `tiles/band_`, `cog/band_`, `tiles/glm_`, `cog/glm_`, `tiles/radar`, `cog/radar` | 1 |
| `tiles/wrf`, `cog/wrf`, `geojson/wrf`, `tiles/models/ecmwf`, `cog/models/ecmwf`, `geojson/models/ecmwf` | 2 |
| `grib/models/ecmwf`, `tiles/models/gfs`, `cog/models/gfs`, `geojson/models/gfs`, `grib/models/gfs` | 1 |

!!! warning "Cambiar la retención no toca lo ya escrito"
    **SeaweedFS estampa el vencimiento al escribir.** **Modificar `retention_days` sólo afecta a los
    objetos futuros.**

## Estado y deduplicación

![Ciclo de vida de una unidad de trabajo](../../imgs/diagrams/tiles-processor-estados.svg){ .diagram loading=lazy }

**Una tabla SQLite, `processed_images`, evita encolar dos veces la misma imagen.** **El productor marca
la fila antes de publicar.** El worker la pasa a `PROCESSING` al tomarla, lo que rearma el TTL. **Al
terminar bien, la fila se borra.**

**Dos limpiezas la mantienen sana, ambas en el productor.** Las filas en `PROCESSING` más viejas que
`JOB_TTL_MINUTES` se borran en cada tick. Las filas en `IN_PROGRESS` vencidas se recuperan **sólo si
las tres colas están vacías**, para no confundir un arranque en frío con trabajo huérfano.

## Cómo se agranda

En producción completa, **la cantidad de workers se cambia regenerando la plantilla**, no editándola:

```
./scripts/generate-compose.sh --light 3 2
```

**Dos workers normales y tres livianos es el dimensionamiento de producción completa.** Beta-1 fija
uno de cada tipo en su propia plantilla. Cada worker procesa dos unidades a la vez
(`WORKER_CONCURRENCY`).

!!! warning "La plantilla versionada difiere de lo que el script produce"
    La plantilla de producción **fue editada a mano** después de generarla. Regenerarla hoy
    **perdería** las versiones fijadas de imagen, los puertos extra del almacén, el volumen del
    índice, las credenciales de los buckets de entrada, los ajustes de concurrencia y los tiempos de
    gracia al apagar. **Antes de regenerar, comparar los dos archivos.**

## Comandos

| Comando | Qué hace |
|---|---|
| `make up` / `make prod` | Compose de desarrollo / producción |
| `make metrics-api` | Sólo la API de métricas |
| `make test` | Pruebas **dentro de Docker** |
| `make test-host` | Pruebas en el host, con el entorno virtual activo |
| `make clean` | Borra los volúmenes del proyecto |
| `./scripts/generate-compose.sh [--dev] [--light N] <workers>` | Regenera las plantillas |

## Discrepancias verificadas

Tres cosas del repositorio confunden y ya están resueltas:

- La guía de migraciones describe un contenedor `migrate` de un solo uso. **Ese contenedor no
  existe**; cada modo migra en proceso al arrancar. **La guía es la que quedó vieja.**
- El script de arranque del almacén menciona una variable `TILE_LIFECYCLE_RETENTION_DAYS`. **No
  existe**; la retención sale de `settings.json`. Es un nombre viejo en un comentario.
- Existe una comprobación de salud por archivo de latido. **Nada la invoca** y nada escribe el
  archivo: es código muerto. **Las comprobaciones reales son las HTTP de arriba.**

La poda de la base de métricas corre con un cron fijo, `0 * * * *`, escrito en el código. **No es
configurable**; sólo lo es el tope de filas, `metrics.max_rows`.
