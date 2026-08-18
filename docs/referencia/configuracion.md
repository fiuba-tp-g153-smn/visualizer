---
title: Configuración y variables
---

# Configuración y variables

Cada servicio se configura por dos vías: variables de entorno para lo específico del despliegue y
lo secreto, y un `settings.json` versionado para las políticas de producto. Esta página documenta
**nombres y formas**, nunca valores.

!!! warning "Los `.env` reales no se leen ni se copian"
    Los repositorios contienen archivos `.env` con credenciales de verdad. La fuente de esta página
    es `.env.example` en cada uno. Ningún valor real aparece acá ni debe aparecer.

## tiles-processor

| Variable | ¿Requerida? | Para qué | Forma |
|---|---|---|---|
| `LOG_LEVEL` | Sí | Nivel de registro | Cadena |
| `DATA_DIR` | Sí | Raíz de datos dentro del contenedor | Ruta absoluta |
| `S3_TILES_DATA_ENDPOINT` | Sí | Puerta de enlace S3 | `host:puerto` |
| `S3_TILES_DATA_PORT` | Sí | Puerto publicado del almacén | Entero |
| `S3_TILES_DATA_SECURE` | No | HTTP o HTTPS | Booleano |
| `S3_TILES_DATA_BUCKET_NAME` | Sí | Bucket principal | Nombre |
| `S3_INTERSECTION_DATA_BUCKET_NAME` | Sí | Bucket de capas de avisos | Nombre |
| `S3_BASEMAP_BUCKET_NAME` | Sí | Bucket de mapas base | Nombre |
| `S3_ROOT_USER` / `S3_ROOT_PASSWORD` | Sí | Administración de SeaweedFS | Cadena / secreto |
| `S3_TILES_DATA_TILES_PROCESSOR_USER` / `_PASSWORD` | Sí | Identidad de escritura | Cadena / secreto |
| `S3_TILES_DATA_DATA_SERVICE_USER` / `_PASSWORD` | Sí | Identidad de lectura | Cadena / secreto |
| `S3_INTERSECTION_DATA_ALERTS_SERVICE_USER` / `_PASSWORD` | Sí | Identidad de `alerts-service` | Cadena / secreto |
| `S3_UPLOAD_CONCURRENCY` | No (32) | Tamaño del pool de subida | Entero |
| `RABBITMQ_HOST` | Sí | Host del broker | Nombre de host |
| `RABBITMQ_PORT` / `RABBITMQ_MGMT_PORT` | Sí | AMQP y panel | Entero |
| `RABBITMQ_USER` / `RABBITMQ_PASSWORD` | Sí | Credenciales | Cadena / secreto |
| `RABBITMQ_QUEUE` | Sí | Cola pesada | Nombre |
| `RABBITMQ_RADAR_LIGHT_QUEUE` / `RABBITMQ_WRF_LIGHT_QUEUE` | No | Colas livianas | Nombre |
| `RABBITMQ_DLQ` / `RABBITMQ_DLX` | Sí | Cola e intercambio de descarte | Nombre |
| `WORKER_TYPE` | No (`normal`) | Tipo de worker | `normal` \| `light` |
| `WORKER_CONCURRENCY` | No (2) | Unidades en vuelo por worker | Entero ≥ 1 |
| `WORKER_ID` | No (hostname) | Atribución en métricas | Cadena |
| `JOB_TTL_MINUTES` | Sí | Vencimiento de una unidad en curso | Entero |
| `HEALTH_PORT` | No (8080) | Puerto del servidor de salud | Entero |
| `METRICS_API_PORT` | No (6020) | Puerto de la API de métricas | Entero |
| `METRICS_API_KEY` | No | Clave de `POST /api/import` | Secreto |
| `ECMWF_TP_SMOOTHING_RESOLUTION_DEG` | No (0.01) | Remuestreo de precipitación; 0 lo desactiva | Grados |
| `GFS_TILE_SMOOTHING_RESOLUTION_DEG` | No (0.01) | Ídem para GFS | Grados |
| `ECMWF_OPENDATA_SOURCES` | No | Espejos en orden de preferencia | Lista separada por comas |
| `GFS_SUBSET_ENDPOINT` | Sí si GFS está activo | Endpoint de recorte GRIB | URL |
| `GDAL_CACHEMAX` | No | Tope de caché de GDAL | Megabytes |
| `CPL_VSIL_CURL_CACHE_SIZE` | No | Tope de caché de lectura remota | Bytes |
| `{RADAR,GLM_FOLDER,WRF,GOES19}_S3_ACCESS_KEY` / `_SECRET_KEY` | No | Credenciales de los buckets de entrada; sin definir, acceso anónimo | Secreto |

!!! note "Dos variables usadas que no están en el ejemplo"
    `RABBITMQ_HOST` es obligatoria en el código pero falta en `.env.example`; la aporta la compose.
    Lo mismo pasa con las credenciales de los buckets de entrada, que la compose interpola aunque el
    ejemplo no las liste.

### `settings.json`

Es la configuración de producto: no lleva secretos y se monta de sólo lectura.

| Clave | Controla |
|---|---|
| `timezone` | Zona del scheduler |
| `bounds` | Recuadro de recorte en EPSG:4326 |
| `scheduler.discovery_cron` | Cadencia del descubrimiento (`*/5 * * * *`) |
| `metrics.enabled` / `metrics.max_rows` | Registro de métricas y tope de filas |
| `sources.<fuente>.products.*` | Qué productos se generan |
| `sources.<fuente>.input.mode` | `local` o `s3` |
| `sources.<fuente>.zoom_levels` | Rango de zoom, con la forma `"MIN-MAX"` |
| `sources.<fuente>.retention_days` | Días de retención, entero u objeto por tipo |
| `sources.{radar,wrf}.light_queue` | Qué productos van a las colas livianas |
| `sources.radar.stations` | Lista blanca o negra de estaciones |

## data-service

| Variable | ¿Requerida? | Para qué | Forma |
|---|---|---|---|
| `APP_HOST_PORT` | No (6006) | Puerto publicado | Entero |
| `APP_ENV` | No | Entorno | `development` \| `production` |
| `LOG_LEVEL` | No | Nivel de registro | Cadena |
| `APP_ROLE` | No (`all`) | Reparto API/sincronizador | `web` \| `worker` \| `all` |
| `WEB_CONCURRENCY` | No | Workers de uvicorn | Entero |
| `WORKER_CONCURRENCY` | No | Concurrencia de sincronización | Entero |
| `REDIS_URL` | Sí | Caché | URL de Redis |
| `S3_TILES_DATA_ENDPOINT` y credenciales | Sí | Lectura del bucket de productos | `host:puerto`, secretos |
| `S3_BASEMAP_BUCKET_NAME` | Sí | Bucket de mapas base | Nombre |
| `S3_WEATHER_STATIONS_BUCKET_NAME` | Sí | Bucket de estaciones | Nombre |
| `S3_API_KEYS_BUCKET_NAME` | Sí | Bucket de claves | Nombre |
| `SMN_API_BASE_URL` | Sí | API de estaciones del SMN | URL |
| `SMN_API_USERNAME` / `SMN_API_PASSWORD` | Sí | Credenciales de esa API | Cadena / secreto |
| `SMN_API_TOKEN_SETTLING_DELAY_SECONDS` | No (0) | Espera tras renovar el token | Segundos |
| `SMN_API_LOG_REQUESTS` | No (falso) | Diagnóstico de peticiones salientes | Booleano |
| `SMN_STATIONS_REGISTRY_URL` | Sí | Registro canónico de estaciones | URL |
| `WEATHER_STATIONS_ADMIN_PASSWORD` | Sí para administración | Cabecera `X-Admin-Password` | Secreto |
| `BASEMAP_<PROVEEDOR>_URL` | Sí | Plantilla por proveedor, ocho en total | Plantilla XYZ o TMS |

!!! note "El comentario de `SMN_API_LOG_REQUESTS` quedó viejo"
    `.env.example` advierte que la opción escribe en el log el JWT y la contraseña. El cliente
    **redacta** ambos antes de registrarlos. Sigue siendo una opción de diagnóstico ruidosa que no
    corresponde dejar encendida en producción, pero no filtra credenciales.

## alerts-service

| Variable | ¿Requerida? | Para qué | Forma |
|---|---|---|---|
| `APP_HOST_PORT` | No (6007) | Puerto publicado | Entero |
| `APP_ENV` / `LOG_LEVEL` | No | Entorno y registro | Cadena |
| `SETTINGS_FILE` | Sí | Ruta del `settings.json` | Ruta absoluta |
| `DATA_DIR` | No | Raíz de datos | Ruta |
| `COUNTRY_GEOJSON_URL` | No | WFS del contorno del país | URL |
| `DEPARTMENTS_GEOJSON_URL` | No | WFS de departamentos | URL |
| `PROVINCES_GEOJSON_URL` | No | WFS de provincias | URL |
| `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET_NAME` / `S3_SECURE` | Sí | Respaldo de capas | `host:puerto`, secretos, nombre, booleano |
| `MYSQL_HOST` / `_PORT` / `_DATABASE` / `_USER` / `_PASSWORD` | Sí | Base de avisos | Cadena / entero / secreto |
| `MYSQL_READONLY_USER` / `_PASSWORD` | Sí | Usuario de sólo lectura | Cadena / secreto |
| `MYSQL_READONLY_MAX_CONNECTIONS` / `_PER_HOUR` | No | Límites de ese usuario | Entero |
| `MYSQL_TAVISO_*` | Sí | Base externa de sólo lectura | Cadena / secreto |
| `MANAGE_DB_SCHEMAS` | No | Habilita las migraciones MySQL | Booleano |
| `OUTPUT_DIR` | Sí | Dónde se escriben los GIF | Ruta |
| `ALERT_CACHE_DIR` | Sí | Dónde viven los índices pre-calculados | Ruta |
| `JOBS_DB_PATH` / `METRICS_DB_PATH` | No | Rutas de las bases SQLite | Ruta |

!!! warning "`MANAGE_DB_SCHEMAS` no va en producción"
    Habilitarla ejecuta DDL contra la base operativa del SMN, incluida una revisión que trunca dos
    tablas de correo con las comprobaciones de clave foránea desactivadas. En producción el esquema
    lo gestiona el DBA del organismo.

### `settings.json`

Las claves están agrupadas por área. El servicio las aplana internamente al cargarlas, de modo que
los nombres de los atributos en código no llevan la jerarquía.

| Clave | Controla |
|---|---|
| `layer.update_cron` | Cron del refresco de capas (`0 3 * * 0`) |
| `layer.cache_ttl_minutes` | Expiración por inactividad de la caché de geometrías |
| `alerts.detail_level` | Nivel de detalle usado al construir la caché de arranque |
| `alerts.job.workers` | Workers del pool de generación |
| `alerts.job.queue_maxsize` | Tamaño de la cola de generación |
| `alerts.job.timeout_seconds` | Tiempo límite de un trabajo completo |
| `alerts.job.shutdown_seconds` | Margen para drenar la cola al apagar |
| `alerts.supervisor.interval_seconds` | Cadencia del supervisor de workers |
| `metrics.enabled` | Si se registran métricas |
| `metrics.sample_interval_seconds` | Cadencia del muestreador |
| `metrics.retention_days` / `metrics.max_rows` | Retención de las métricas |
| `detail_level_tolerances` | Tolerancia de simplificación por nivel de detalle |
| `departments_simplify_tolerance` | Tolerancia única de la capa de departamentos |
| `ign_simplify_tolerance` | Tolerancia de simplificación de las capas del IGN usadas al renderizar |

## visualizer

!!! warning "Son variables de compilación, no de ejecución"
    Llegan al bundle por el `DefinePlugin` de webpack. Cambiar cualquiera obliga a **recompilar**:
    reiniciar el contenedor no alcanza. Además, en la compose sólo los `args:` llegan al bundle de
    producción; los `environment:` con los mismos nombres no.

| Variable | Para qué | Forma |
|---|---|---|
| `DATA_SERVICE_BASE_URL` | Base de `data-service` | URL |
| `ALERTS_SERVICE_BASE_URL` | Base de `alerts-service` | URL |
| `METRICS_SERVICE_BASE_URL` | Base de la API de métricas de `tiles-processor` | URL |
| `SMN_API_PROMPT_FOR_TOKEN` | Si se pide la clave de estaciones al usuario | Booleano |
| `APP_HOST_PORT` | Puerto publicado | Entero |
| `DOCS_URL` | De dónde carga el iframe de documentación | Ruta o URL |
| `IGN_PLACE_SEARCH_URL` | Búsqueda de lugares del IGN | URL |
| `NOMINATIM_SEARCH_URL` | Búsqueda alternativa | URL |

!!! note "Los valores de reserva no coinciden con el ejemplo"
    `custom-webpack.config.js` define reservas para el caso de que una variable no esté definida, y
    tres de ellas discrepan con `.env.example`: la base de `data-service`, la de `alerts-service` y
    el puerto de la aplicación. Una compilación sin variables no apunta a donde sugiere el ejemplo.
