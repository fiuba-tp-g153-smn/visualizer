---
title: API HTTP
---

# API HTTP

Tres servicios exponen HTTP y el visualizador habla con los tres. Esta página lista sus rutas tal
como están escritas en el código, con sus parámetros y sus códigos de error.

!!! warning "Tres rutas de métricas homónimas en tres hosts"
    `data-service` y `alerts-service` exponen `/metrics/summary`, y `tiles-processor` expone
    `/api/summary` en el puerto `6020`. Son tres APIs distintas con esquemas distintos. Antes de
    depurar una respuesta inesperada conviene confirmar contra qué host se está hablando.

Todas las rutas responden además `422` ante una violación de validación de FastAPI; abajo sólo se
listan los errores propios de cada ruta.

## data-service

Base: `DATA_SERVICE_BASE_URL`, puerto `6006` en el host.

### Generales

| Método | Ruta | Respuesta |
|---|---|---|
| `GET` | `/` | `{"status":"ok","service":"data-service"}` |
| `GET` | `/health` | `{"status":"running"}` |

### Satélite

El router de satélite se queda con la ruta comodín `/products/{product_id}`.

| Método | Ruta | Parámetros | Errores |
|---|---|---|---|
| `GET` | `/products/{product_id}` | — | `404` producto desconocido |
| `GET` | `/products/{product_id}/{instrument_id}` | — | `404` instrumento desconocido |
| `GET` | `/products/{product_id}/{instrument_id}/{channel_id}` | `If-None-Match` | `304`, `404` canal desconocido |
| `GET` | `/products/{p}/{i}/{c}/{tileset_id}/{z}/{x}/{y}.webp` | `If-None-Match` | `304`, `400` zoom fuera de rango, `404` tile inexistente |
| `GET` | `/products/{p}/{i}/{c}/{tileset_id}/point` | `lat`, `lon` | `404` COG ausente o punto sin dato |

### Radar

| Método | Ruta | Parámetros | Errores |
|---|---|---|---|
| `GET` | `/products/radar` | — | — |
| `GET` | `/products/radar/{radar_id}` | — | — |
| `GET` | `/products/radar/{radar_id}/{variable_id}` | — | — |
| `GET` | `/products/radar/{radar_id}/{variable_id}/{elevation_id}` | — | — |
| `GET` | `/products/radar/{radar}/{var}/{elev}/{tileset_id}/{z}/{x}/{y}.webp` | `If-None-Match` | `304`; un tile ausente devuelve `200` transparente |
| `GET` | `/products/radar/{radar}/{var}/{elev}/{tileset_id}/point` | `lat`, `lon` | `404` |

### ECMWF

| Método | Ruta | Parámetros | Errores |
|---|---|---|---|
| `GET` | `/products/ecmwf/total-precipitation` | `If-None-Match` | `304` |
| `GET` | `/products/ecmwf/total-precipitation/{forecast_ts}` | `If-None-Match` | `304`, `404` |
| `GET` | `/products/ecmwf/total-precipitation/{forecast_ts}/{period_ts}/{z}/{x}/{y}.webp` | `If-None-Match` | `304`, `400` zoom fuera de 3–7, `404` |
| `GET` | `/products/ecmwf/total-precipitation/{forecast_ts}/{period_ts}/point` | `lat`, `lon` | `404` |
| `GET` | `/products/ecmwf/mean-sea-level-pressure` | `If-None-Match` | `304` |
| `GET` | `/products/ecmwf/mean-sea-level-pressure/{forecast_ts}` | `If-None-Match` | `304`, `404` |
| `GET` | `/products/ecmwf/mean-sea-level-pressure/{forecast_ts}/{timestamp_ts}.json` | `If-None-Match` | `304`, `404` |
| `GET` | `/products/ecmwf/mean-sea-level-pressure/{forecast_ts}/{timestamp_ts}/point` | `lat`, `lon` | `404` |

La presión a nivel del mar **no tiene endpoint de tiles**: son isobaras en GeoJSON.

### WRF

| Método | Ruta | Parámetros | Errores |
|---|---|---|---|
| `GET` | `/products/wrf/{product_id}` | `If-None-Match` | `304` |
| `GET` | `/products/wrf/{product_id}/{init_tag}` | `If-None-Match` | `304`, `404` |
| `GET` | `/products/wrf/{product_id}/{init_tag}/{fxxx}/point` | `lat`, `lon` | `404` |
| `GET` | `/products/wrf/{product_id}/{init_tag}/{fxxx}/secondary/{variable}/point` | `lat`, `lon` | `404` |
| `GET` | `/products/wrf/{product_id}/{init_tag}/{fxxx}/{layer}.json` | `If-None-Match` | `304`, `404` |
| `GET` | `/products/wrf/{product_id}/{init_tag}/{fxxx}/barbs/{z}/{x}/{y}.json` | `If-None-Match` | `304`, `400` zoom no permitido; ausencia devuelve `200` con colección vacía |
| `GET` | `/products/wrf/{product_id}/{init_tag}/{fxxx}/{z}/{x}/{y}.webp` | `If-None-Match` | `304`, `400` zoom fuera de 4–9; ausencia devuelve `200` transparente |

### GFS

Mismas formas que WRF, con `{cycle}` en lugar de `{init_tag}`.

| Método | Ruta | Errores |
|---|---|---|
| `GET` | `/products/gfs/{product_id}` | `304`, `404` producto desconocido |
| `GET` | `/products/gfs/{product_id}/{cycle}` | `304`, `404` |
| `GET` | `/products/gfs/{product_id}/{cycle}/{fxxx}/point` | `404` |
| `GET` | `/products/gfs/{product_id}/{cycle}/{fxxx}/secondary/{variable}/point` | `404` |
| `GET` | `/products/gfs/{product_id}/{cycle}/{fxxx}/{layer}.json` | `304`, `404` |
| `GET` | `/products/gfs/{product_id}/{cycle}/{fxxx}/barbs/{z}/{x}/{y}.json` | `304`, `400` |
| `GET` | `/products/gfs/{product_id}/{cycle}/{fxxx}/{z}/{x}/{y}.webp` | `304`, `400` zoom fuera de 3–7 |

!!! note "GFS usa dos ETag"
    Las rutas de tiles y de barbas de GFS emiten un ETag distinto según haya acierto o falta. Si
    ambos fueran iguales, un cliente que cacheó un hueco lo revalidaría contra sí mismo y recibiría
    `304` para siempre.

### Mapas base

| Método | Ruta | Errores |
|---|---|---|
| `GET` | `/basemap/providers` | — |
| `GET` | `/basemap/{provider_id}/{z}/{x}/{y}.png` | `304`, `404` proveedor desconocido, `503` sin configurar; ausencia devuelve `200` transparente |

### Estaciones meteorológicas

**Todas** requieren la cabecera `X-API-Key`.

| Método | Ruta | Parámetros | Errores |
|---|---|---|---|
| `GET` | `/weather-stations/latest` | — | `401`, `503` |
| `GET` | `/weather-stations/tilesets` | — | `401`, `503` |
| `GET` | `/weather-stations/stations` | — | `401`, `503` |
| `GET` | `/weather-stations/station/{station_id}/series` | `hours` (48 por defecto) | `401`, `422`, `503` |
| `GET` | `/weather-stations/{tileset_id}` | `grace_period_hours` (0–48) | `401`, `400`, `404`, `503` |

Las de administración usan `X-Admin-Password` en lugar de `X-API-Key`:

| Método | Ruta | Éxito | Errores |
|---|---|---|---|
| `POST` | `/weather-stations/admin/keys` | `201` con el secreto **una única vez** | `401`, `503`, `500` |
| `POST` | `/weather-stations/admin/keys/add-custom` | `201` | `401`, `409` secreto ya en uso, `503`, `500` |
| `GET` | `/weather-stations/admin/keys` | `200`, sin secretos | `401`, `503`, `500` |
| `DELETE` | `/weather-stations/admin/keys/{key_id}` | `204` | `401`, `404`, `503`, `500` |

### Métricas

| Método | Ruta | Parámetros |
|---|---|---|
| `GET` | `/metrics/summary` | — |
| `GET` | `/metrics/sync/status` | — |
| `GET` | `/metrics/sync/history` | `hours` (24), `bucket` (`hour`\|`day`\|`10min`), `domain` |
| `GET` | `/metrics/sync/cycles` | `hours` (24), `domain`, `limit` (200), `since`, `before` |
| `GET` | `/metrics/redis/memory` | — |
| `GET` | `/metrics/redis/memory/history` | `hours` (168), `domain` |
| `GET` | `/metrics/redis/info` | `live` (falso) |
| `GET` | `/metrics/redis/info/history` | `hours` (168) |
| `GET` | `/metrics/basemap/providers` | — |
| `GET` | `/sync/status` | — (reemplazada por `/metrics/sync/status`) |

## alerts-service

Base: `ALERTS_SERVICE_BASE_URL`, puerto `6007` en el host.

| Método | Ruta | Parámetros y cuerpo | Éxito | Errores |
|---|---|---|---|---|
| `GET` | `/` | — | `200` | — |
| `GET` | `/health` | — | `200` | — |
| `POST` | `/intersect/country` | `detail_level` 1–5 (5 por defecto); cuerpo GeoJSON | `200` FeatureCollection | `400` geometría inválida, `500` capa ausente |
| `POST` | `/intersect/departments` | Cuerpo GeoJSON | `200` `{departments: [...]}` | `400`, `500` |
| `GET` | `/intersect/layer-refresh-history` | `limit` (20, 1–100) | `200` | — |
| `POST` | `/alerts` | `{phenomenon_code: 1–92, geojson}` | **`202`** `AlertJobAccepted` | `413` polígono demasiado grande, `400` fenómeno inválido, `503` cola llena |
| `GET` | `/alerts/jobs/{job_id}` | — | `200` `AlertJobStatus` | `404` identificador desconocido |
| `GET` | `/alerts/phenomena` | — | `200` | `500` |
| `GET` | `/alerts/limits` | — | `200` `{max_vertex_count}` | `500` |
| `GET` | `/alerts/pending` | `since_id`, `If-None-Match` | `200` con `ETag`, o `304` | `500` |
| `GET` | `/alerts` | `since_id`, `If-None-Match` | `200` con `ETag`, o `304` | `500` |
| `GET` | `/alerts/{filename}` | — | `200` GIF | `404` |
| `GET` | `/metrics/summary` | `hours` (24) | `200` | — |
| `GET` | `/metrics/jobs` | `hours` (24), `limit` (200, hasta 5000) | `200` | — |
| `GET` | `/metrics/jobs/history` | `hours` (168), `bucket` (`hour`\|`day`) | `200` | — |
| `GET` | `/metrics/processor/history` | `hours` (168) | `200` | — |
| `GET` | `/metrics/layers` | `limit` (20, 1–200) | `200` | — |

!!! warning "El cuerpo del 413 no tiene `detail`"
    Cuando el polígono excede el límite de vértices, la respuesta es un `413` cuyo cuerpo es
    literalmente `{"max_vertex_count": N}`, sin la clave `detail` que usan el resto de los errores de
    FastAPI. Un cliente que asuma `detail` no encontrará el mensaje.

!!! note "El ETag de `/alerts` no expira solo"
    `/alerts/pending` calcula su ETag como `"<cantidad>-<id máximo>"`, así que detecta tanto altas
    como bajas. `/alerts` usa sólo el id máximo: no se invalida cuando un aviso vence, únicamente
    cuando aparece uno nuevo.

### Formatos de fecha

`start_datetime` y `end_datetime` de `AlertSummary` son ISO-8601 en UTC con `Z` final y precisión de
segundos. En cambio **todas** las marcas de tiempo de `/metrics/*` son cadenas sin ese tratamiento, y
el límite inferior de la ventana se serializa con desplazamiento `+00:00` en lugar de `Z`.

## tiles-processor — API de métricas

Base: `METRICS_SERVICE_BASE_URL`, puerto `6020`. Ver
[Observabilidad](../arquitectura/observabilidad.md).

| Método | Ruta | Parámetros | Autenticación |
|---|---|---|---|
| `GET` | `/` | — | — |
| `GET` | `/health` | — | — |
| `GET` | `/api/summary` | `hours` | — |
| `GET` | `/api/jobs` | `limit` (50, 0–1000), `offset`, `type`, `outcome`, `hours`, `since`, `before` | — |
| `GET` | `/api/throughput` | `bucket` (`hour`\|`day`\|`10min`), `hours` | — |
| `GET` | `/api/timeseries` | `bucket`, `hours` | — |
| `GET` | `/api/live` | — | — |
| `GET` | `/api/export` | `hours` | — |
| `POST` | `/api/import` | Cuerpo `MetricsExport` | **`X-API-Key`** |

!!! warning "Sin `METRICS_API_KEY` la importación responde 503, no 401"
    Si la variable queda vacía, la ruta de escritura falla cerrada con `503`. Es deliberado: sin
    clave configurada no hay forma de autorizar, así que la ruta se declara indisponible en lugar de
    rechazar credenciales.

Además, `/api/jobs?limit=0` significa «sin límite» sólo cuando hay una ventana temporal que acote la
consulta; sin ella se recorta en silencio a 1000 filas.
