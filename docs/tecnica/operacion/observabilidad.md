---
title: 18. Observabilidad y verificación
---

# 18. Observabilidad y verificación

Qué mide el sistema de sí mismo, dónde lo guarda y qué comprueba antes de que un cambio llegue a
producción. **Ningún tablero vive en el backend**: cada servicio expone una API de métricas y el
panel de estado del visualizador las dibuja.

![Tres APIs de métricas, un solo panel](../../imgs/diagrams/observabilidad.svg){ .diagram loading=lazy }

!!! warning "Tres rutas de resumen con el mismo nombre en tres hosts"
    `/api/summary` en `6020`, `/metrics/summary` en `6006` y `/metrics/summary` en `6007` **son tres
    APIs distintas con esquemas distintos**. **Al depurar, lo primero es confirmar contra qué host se
    habla.**

## Qué mide cada servicio

### tiles-processor

**Una fila por unidad de trabajo terminada en `job_metrics`**: tipo, resultado, worker, tiempos de
descarga y proceso, y un desglose por etapa.

| Ruta en `6020` | Qué devuelve |
|---|---|
| `GET /api/summary` | Agregado por tipo: conteos por resultado, tasa de error, promedios y percentil 95 |
| `GET /api/jobs` | Las filas crudas, con filtros |
| `GET /api/throughput`, `GET /api/timeseries` | Conteos y duraciones por bucket de tiempo |
| `GET /api/live` | Profundidad de las colas y unidades en curso |
| `GET /api/export`, `POST /api/import` | Volcado e ingesta; **la importación es la única ruta autenticada** |

**`/api/live` se degrada en lugar de fallar**: con el broker caído, las profundidades vuelven en
`null`. **Las lee por AMQP, no por el panel de administración.** `queues.light` no es una cola real,
sino la suma de radar y WRF.

### data-service

Cada ciclo de sincronización deja una fila en `sync_cycles`: dominio, duración, objetos, errores y
resultado. Un colector de fondo **muestrea la memoria de Redis por dominio** recorriendo el espacio de
claves, **porque Redis no ofrece ese desglose**.

**El estado real de la sincronización está en `GET /sync/status`**, por dominio.
`/metrics/summary` y `/metrics/sync/status` leen una clave global de Redis **que ningún código
escribe** y devuelven los valores por defecto de su modelo. **Es una discrepancia verificada, no una
pregunta abierta.**

### alerts-service

Por trabajo, la duración de cada etapa y su resultado en `jobs.sqlite`. **Un muestreador cada 60 s
escribe en `processor_samples` la salud del pool**: cola, workers ocupados y avisos pendientes.

## Dónde se guarda cada cosa

| Base | Servicio | Retención |
|---|---|---|
| `metrics.db` | `tiles-processor` | Tope de filas, podado cada hora por el productor |
| `progress_tracker.db` | `tiles-processor` | Ventana temporal, `JOB_TTL_MINUTES` |
| `metrics.sqlite` | `data-service` | 14 días y un tope de filas |
| `jobs.sqlite`, `metrics.sqlite` | `alerts-service` | Se podan en cada escritura y cada tick |
| `history.db` | `alerts-service` | **Ninguna.** Una fila por refresco semanal; crece para siempre |

**Todas viven en el volumen del contenedor.** **Nada las exporta a un sistema de monitoreo externo.**

## Salud de los procesos

| Contenedor | Comprobación | Qué prueba |
|---|---|---|
| Producer y workers | `GET /health` en `8080`, nunca publicado | Que el broker esté conectado |
| `metrics-api` | `GET /health` en `6020` | Que el proceso responda |
| `data-service-api` y `-sync` | `GET /health` en `8080` | **Sólo que el proceso responda.** No comprueba Redis ni el almacén |
| `alerts-service` | `GET /health`, con **8 minutos de gracia** | Sólo que el proceso responda |
| `visualizer` | Conexión TCP al puerto 80 | Que nginx escuche |

## El panel de estado

La sección `/status` del visualizador tiene cuatro pestañas. **Procesamiento** lee `6020`; **Caché**
y **Mapas base** leen `6006`; **Alertas** lee `6007`. El refresco es configurable entre sin
refresco, 10, 30 y 60 s, con 30 por defecto. Cómo leerlo está en el
[manual](../../manual/panel-de-estado.md).

**El sondeo no se detiene con la pestaña del navegador oculta.** **Sólo se corta al cambiar de pestaña
dentro de `/status`.**

## Monitoreo de infraestructura

Por fuera hay un nivel de infraestructura: **Prometheus, Grafana y Uptime Kuma**, para consumo por
servidor y disponibilidad. Ese nivel es independiente y **no está en los repositorios**: nada del
sistema lo referencia, salvo un envío opcional de métricas del almacén a un Pushgateway, apagado por
defecto.

## Qué se verifica antes de desplegar

Los cuatro repositorios tienen suite de pruebas. **No todos la hacen valer**, y la diferencia no se
ve mirando la compuerta.

| Repositorio | Archivos | Pruebas | Cómo se corre | Bloquea el despliegue |
|---|---|---|---|---|
| `tiles-processor` | 62 | 710 | `make test`, dentro de Docker; `make test-host` en el host | **No** |
| `data-service` | 51 | 725 | `make test`, dentro de Docker | Sí |
| `alerts-service` | 32 | 206 | `make test`, dentro de Docker | Sí |
| `visualizer` | 48 | 457 | `npm test` | **No** |

**Los conteos son archivos versionados y definiciones de prueba**, contados el 8 de septiembre de 2026.

!!! warning "En `tiles-processor` las pruebas no corren en CI, y en `visualizer` no bloquean"
    Los trabajos de lint, tipos y pruebas del procesador llevan `if: false`; **la compuerta los cuenta
    como aprobados**. El paso de pruebas del visualizador lleva `continue-on-error`. Ver
    [17. Despliegue y entrega continua](despliegue.md).

**El camino local y el de CI no son el mismo.** `make test` usa Docker; CI instala las dependencias
sobre el runner y corre pytest ahí, sin montar `settings.json`. **Una prueba que dependa de ese
archivo puede pasar en un lado y fallar en el otro.**

### Aislamiento y cobertura

`data-service` y `alerts-service` corren con los sockets deshabilitados salvo hacia `127.0.0.1`.
**`tiles-processor` no declara esa configuración**: **sus pruebas pueden salir a internet**. La cobertura
se mide en los tres de Python y se informa en `reports/`; **ningún repositorio exige un mínimo**. **El
visualizador no la mide.**

### Análisis estático

`black`, `pylint` y `mypy` existen en los tres repositorios de Python **sólo como ganchos de
pre-commit**: corren en la máquina de quien programa, si instaló el gancho. **Ningún workflow los exige.**
Los ganchos de `pylint` y `mypy` usan la versión del entorno virtual, no la fijada. El visualizador
declara configuración de Prettier **sin tener el paquete instalado**.

### Referencias muertas

- `alerts-service` define `make test-api` apuntando a un archivo de pruebas que ya no existe.
- `visualizer` declara en `angular.json` un directorio de fixtures que no existe.
