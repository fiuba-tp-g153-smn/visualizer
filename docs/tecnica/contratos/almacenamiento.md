---
title: 12.3 Almacenamiento y colas
---

# 12.3 Almacenamiento y colas

Los servicios no comparten base de datos. **Se comunican por un almacén de objetos compatible con S3
y, dentro de `tiles-processor`, por colas de RabbitMQ.** **Es la única página donde se describe el
trazado de claves.**

![Un almacén, cinco buckets: quién escribe y quién lee cada uno](../../imgs/diagrams/almacenamiento-buckets.svg){ .diagram loading=lazy }

## El almacén de objetos

Lo que corre es **SeaweedFS**, con su puerta S3 en el puerto `8333` del contenedor, publicado como
`9000` en el host. **El código habla la API de S3**, **así que el almacén es reemplazable por otro
compatible**.

El script de arranque del almacén **crea tres buckets y las identidades por servicio**: `tiles-data`,
`intersection-data` y `basemap-tiles`. `data-service` crea `api-keys` al arrancar. **Nadie crea
`weather-stations-data`**: el script lo declara como responsabilidad de `data-service`, pero ese
servicio sólo comprueba el de claves.

### Los buckets

| Bucket | Escribe | Lee | Contenido |
|---|---|---|---|
| `tiles-data` | `tiles-processor` | `data-service` | Todos los productos meteorológicos |
| `basemap-tiles` | `data-service` | `data-service` | Respaldo de mapas base de terceros |
| `weather-stations-data` | `data-service` | `data-service` | Instantáneas y padrón de estaciones |
| `api-keys` | `data-service` | `data-service` | Un objeto por clave, nombrado por su hash |
| `intersection-data` | `alerts-service` | `alerts-service` | Capas del IGN simplificadas |

!!! warning "La identidad de lectura tiene permisos de administración"
    La identidad con la que `data-service` accede está documentada como de sólo lectura, pero **lleva
    la acción global `Admin`** además de sus permisos por bucket. Ver [19.2 Datos y secretos](../seguridad/datos-y-secretos.md).

### Trazado de claves de `tiles-data`

| Producto | Plantilla de clave |
|---|---|
| Teselas del ABI | `tiles/goes19/abi/{c13,c09,c02}/{stem}/{z}/{x}/{y}.webp` |
| COG del ABI | `cog/goes19/abi/{c13,c09,c02}/{image_id}.tif` |
| Teselas de GLM | `tiles/goes19/glm/{fed,toe,mfa}/{stem}/{z}/{x}/{y}.webp` |
| COG de GLM | `cog/goes19/glm/{fed,toe,mfa}/{image_id}.tif` |
| Teselas de radar | `tiles/radar/sinarame/{radar_id}/{product_id}/elev{N}/{timestamp}/{z}/{x}/{y}.webp` |
| COG de radar | `cog/radar/sinarame/{radar_id}/{product_id}/elev{N}/{timestamp}.tif` |
| Teselas de WRF | `tiles/wrf-arg4k/{product_id}/{init_tag}/{fxxx}/{z}/{x}/{y}.webp` |
| COG de WRF | `cog/wrf-arg4k/{product_id}/{init_tag}/{fxxx}.tif` y `{fxxx}.{variable}.tif` |
| GeoJSON de WRF | `geojson/wrf-arg4k/{product_id}/{init_tag}/{fxxx}/{layer}.json` |
| Barbas de WRF | `geojson/wrf-arg4k/{product_id}/{init_tag}/{fxxx}/barbs/{z}/{x}/{y}.json` |
| Teselas de ECMWF | `tiles/ecmwf-ifs/total-precipitation/{forecast_ts}/{period_ts}/{z}/{x}/{y}.webp` |
| COG de ECMWF | `cog/ecmwf-ifs/{tp,mslp}/{forecast_ts}/{...}.tif` |
| Isobaras de ECMWF | `geojson/ecmwf-ifs/mean-sea-level-pressure/{forecast_ts}/{image_id}.json` |
| Teselas de GFS | `tiles/gfs/{seg}/{cycle}/{cycle}_{fxxx}/{z}/{x}/{y}.webp` |
| COG de GFS | `cog/gfs/{seg}/{cycle}/{cycle}_{fxxx}.tif` y `{seg}/{cycle}/{variable}/{cycle}_{fxxx}.tif` |
| GeoJSON de GFS | `geojson/gfs/{seg}/{cycle}/{cycle}_{fxxx}_{layer}.json` |
| Barbas de GFS | `geojson/gfs/{seg}/{cycle}/{cycle}_{fxxx}_barbs/{z}/{x}/{y}.json` |
| GRIB cacheado | `grib/ecmwf-ifs/{tp,mslp}/{forecast_ts}.grib`, `grib/gfs/{cycle_ts}/{image_id}.grib2` |

`{seg}` toma los valores `mslp`, `500hpa` y `250hpa`.

!!! warning "Los prefijos están duplicados a mano en los dos lados"
    `tiles-processor` los declara en su configuración de ciclo de vida y `data-service` los repite
    como literales. **No hay paquete compartido.** Cambiar uno sin el otro no rompe nada visible:
    el productor sigue escribiendo y el lector deja de encontrar lo nuevo.

### Otros buckets

| Bucket | Plantilla |
|---|---|
| `basemap-tiles` | `basemap/{provider_id}/{z}/{x}/{y}.png` |
| `weather-stations-data` | `weather-stations/snapshots/{AAAA}/{MM}/{DD}/{HH}/{marca}.json` más un `.meta.json`; padrón en `weather-stations/stations.json` |
| `api-keys` | `keys/{sha256 del secreto}.json` |
| `intersection-data` | `pais_simple_L{nivel}_T{tolerancia}_{AAAAMMDD}.geojson`, `departamentos_simple_T0p005_{AAAAMMDD}.geojson` |

**Las claves de `intersection-data` son planas.** **La tolerancia se escribe con `p` en lugar del punto.**

### Retención

La expiración son reglas de ciclo de vida de S3, una por prefijo, que cada worker aplica al arrancar.
La tabla de días está en [11.1 Tiles Processor](../servicios/tiles-processor.md). **No hay regla
comodín**: **un prefijo sin regla no expira nunca**.

## Las colas

RabbitMQ es interno a `tiles-processor`. **Ningún otro servicio lo usa.**

| Cola | Contenido |
|---|---|
| `tiles_work_queue` | Trabajo pesado: ABI, GLM, ECMWF, GFS |
| `tiles_radar_light_queue` | Todos los productos de radar |
| `tiles_wrf_light_queue` | Todos los productos de WRF |
| `tiles_dead_letter_queue` | Unidades que agotaron sus reintentos |

**Las tres colas de trabajo son durables.** Se declaran con el intercambio de descarte `tiles_dlx`, un
`direct` durable cuya clave de ruteo es el nombre de la cola de descarte. **No declaran prioridad ni
vencimiento**: la «prioridad» de la cola pesada es el orden en que un worker las consulta. **Los
mensajes son persistentes.**

### El mensaje

| Campo | Contenido |
|---|---|
| `work_unit_id` | Identificador único de la unidad |
| `image_id` | Identificador de la imagen de origen |
| `data_source_id` | Fuente que la descubrió |
| `source_uri` | De dónde se descarga |
| `output_prefix` | Prefijo de destino en el bucket |
| `bounds` | Recuadro de recorte |
| `processor_id` | Qué procesador la atiende |
| `band_id` | Banda o producto |
| `created_at` | Marca de creación |
| `retry_count`, `max_retries` | Intento actual, desde 0; tope, 3 |

!!! note "Nadie consume la cola de descarte"
    **No hay ningún consumidor de `tiles_dead_letter_queue`.** **Es un depósito para inspección manual
    desde el panel del broker, no una cola de reproceso.**

## Bases locales

**Ninguna se comparte entre servicios.** **Todas viven en el volumen del contenedor que las usa.**

| Base | Servicio | Tablas | Esquema |
|---|---|---|---|
| `progress_tracker.db` | `tiles-processor` | `processed_images` | Alembic |
| `metrics.db` | `tiles-processor` | `job_metrics` | Alembic |
| `metrics.sqlite` | `data-service` | `sync_cycles`, `redis_memory_samples`, `redis_info_samples` | Alembic |
| `basemap_scraper_state.sqlite` | `data-service` | El cursor del recorrido de mapas base | Propio |
| `jobs.sqlite` | `alerts-service` | `alert_jobs` | Alembic |
| `metrics.sqlite` | `alerts-service` | `processor_samples`, `alert_jobs` | Alembic |
| `history.db` | `alerts-service` | `job_runs` | **Ninguno**: la crea el adaptador |
| La de `MYSQL_DATABASE` | `alerts-service` | `taviso_temporal`, `taviso`, `departamentos`, `provincia` | Alembic, **sólo con `MANAGE_DB_SCHEMAS`** |

!!! warning "SQLite exige disco local"
    **Las bases usan WAL, que no funciona sobre NFS ni SMB.** Y **los procesos que las comparten tienen
    que estar en el mismo host**: el bloqueo entre migraciones concurrentes es un `flock` sobre el
    sistema de archivos. **Es una de las razones por las que producer y workers no se separan.** Ver
    [15. Distribuir el sistema](../operacion/distribucion.md).
