---
title: Data Service
---

# Data Service

`data-service` es el intermediario entre el almacén de objetos y el visualizador. Expone una API REST
de lectura sobre los productos que genera `tiles-processor`, mantiene una caché en Redis para servir
tiles con baja latencia, y además incorpora por cuenta propia dos dominios que no vienen del
pipeline: los mapas base y las estaciones meteorológicas de superficie.

![Resolución de una petición de tile](../imgs/diagrams/data-service-tile.svg){ .diagram loading=lazy }

## Una imagen, dos contenedores

La misma imagen corre dos veces con distinto `APP_ROLE`.

| Rol | Qué arranca |
|---|---|
| `web` | Sólo el lado de lectura: Redis, migraciones, estrategias de lectura, y **todos** los routers |
| `worker` | Todo lo anterior **más** los seis bucles de sincronización, el scraper de mapas base, el de estaciones y el colector de métricas de Redis |
| `all` | Equivalente a `worker`; es el valor por defecto |

!!! warning "El reparto de `APP_ROLE` es fácil de romper"
    Los routers se montan **en todos los roles**, así que un contenedor mal configurado sigue
    respondiendo HTTP y el error no salta a la vista. Si ambos contenedores quedan en `web`, nada
    sincroniza: Redis nunca se llena, los tiles salen siempre por el camino lento del bucket y el
    historial de `/metrics/*` deja de crecer. Si el contenedor de la API queda en `worker`, atiende
    peticiones mientras compite consigo mismo por CPU. Un valor que no sea uno de los tres hace
    fallar el arranque.

## Estrategias de caché

La estrategia se elige una sola vez al arrancar, desde `settings.json` o `SYNC_MODE`.

- **`full`** — es el modo desplegado. Seis bucles de fondo recorren el almacén a intervalos fijos y
  precargan en Redis los productos nuevos junto con sus índices. Cada estrategia `full` delega su
  camino de fallo a la variante `on_demand`, de modo que un desalojo de Redis cuesta latencia pero
  nunca un error.
- **`on_demand`** — no se levanta ningún bucle. Cada lectura resuelve Redis, después el bucket, y
  recalienta la caché con lo que encontró.

### Los dominios de sincronización

| Dominio | Qué retiene |
|---|---|
| `satellite` | Ventana temporal por antigüedad |
| `radar` | Ventana temporal por antigüedad |
| `ecmwf_tp` / `ecmwf_mslp` | Las 2 corridas más recientes |
| `wrf` | Las 3 inicializaciones más recientes |
| `gfs` | Los 2 ciclos más recientes |

Los mapas base y las estaciones tienen sus propios ciclos, mucho más lentos.

## Superficie HTTP

El detalle completo, con parámetros y códigos de error, está en [API HTTP](../referencia/api.md).
En resumen:

| Familia | Para qué |
|---|---|
| `GET /products/{product_id}` y descendientes | Configuración del producto, listado de tilesets, tiles `.webp`, consultas puntuales y superposiciones GeoJSON |
| `GET /basemap/providers`, `GET /basemap/{provider_id}/{z}/{x}/{y}.png` | Mapas base propios y respaldados |
| `GET /weather-stations/*` | Estaciones: última instantánea, listados, registro y series por estación |
| `GET /metrics/*` | Lo que alimenta las pestañas Caché y Mapas base del tablero |
| `GET /health` | Sonda de salud; es la que consulta el visualizador |

!!! warning "El orden en que se montan los routers es funcional"
    El router de satélite se queda con la ruta comodín `/products/{product_id}`, así que los routers
    de radar, WRF, GFS y ECMWF tienen que montarse **antes**. Invertir ese orden hace que
    `/products/radar` se resuelva como si `radar` fuera un producto satelital. Lo mismo pasa dentro de
    estaciones: `/weather-stations/{tileset_id}` se declara al final, y por eso una petición a
    `/weather-stations/admin` sin segmento adicional la atrapa esa ruta y no el router de
    administración.

### Consultas puntuales

Además de tiles, el servicio permite pedir el valor numérico de una variable en un punto. Abre el COG
correspondiente directamente en el almacén, con lecturas por rango, y devuelve el valor real en su
unidad sin descargar el archivo entero.

## Autenticación

Sólo dos familias de rutas están protegidas, y de formas distintas.

| Rutas | Mecanismo |
|---|---|
| Las cinco de lectura de `/weather-stations/` | Cabecera `X-API-Key` |
| Las cuatro de `/weather-stations/admin/` | Cabecera `X-Admin-Password`, comparada con `hmac.compare_digest` |

Las claves se guardan **sólo como hash**: el bucket de claves contiene un objeto por clave, nombrado
con el SHA-256 del secreto. El secreto en claro se devuelve una única vez, al crearlo, y no se
almacena.

!!! warning "El control de clave se puede apagar por configuración"
    Existe un interruptor que desactiva por completo la verificación de `X-API-Key`. Con él en falso,
    las cinco rutas de lectura de estaciones quedan abiertas sin que nada más cambie.

Todo lo demás es público y CORS está completamente abierto: es el único middleware de la aplicación.

## Los buckets propios

Tres buckets pertenecen enteramente a este servicio; `tiles-processor` no los toca.

| Bucket | Contenido |
|---|---|
| `basemap-tiles` | Respaldo de los mapas base de terceros |
| `weather-stations-data` | Instantáneas horarias y el registro de estaciones |
| `api-keys` | Un objeto por clave, nombrado por su hash |

## Estaciones meteorológicas

El servicio se autentica contra la API del SMN con un JWT que refresca una sola vez ante un 401, con
un candado que evita la estampida cuando varias peticiones fallan a la vez. Descarga el registro
canónico de estaciones, guarda instantáneas periódicas y precomputa las series por estación para que
el visualizador no tenga que agregarlas.

El punto de rocío no viene de la fuente: se calcula por la aproximación de Magnus-Tetens a partir de
temperatura y humedad relativa, y se computa **en la lectura**, no al guardar la instantánea.

!!! note "El comentario sobre `SMN_API_LOG_REQUESTS` en `.env.example` está desactualizado"
    Dice que la variable escribe en el log las cabeceras con el JWT y el cuerpo de autenticación con
    la contraseña. El cliente **redacta** ambos antes de registrarlos, y la propia línea de aviso
    aclara que las credenciales van redactadas. Aun así es una opción de diagnóstico ruidosa y no
    corresponde dejarla encendida en producción.

## Mapas base

Un scraper recorre los proveedores configurados y respalda sus tiles en `basemap-tiles`, para que el
sistema tolere una caída del proveedor. Lleva un cursor persistente en SQLite, reintenta con
retroceso, y tiene un cortacircuitos por tasa de error con una escalera de enfriamiento.

## Comandos

| Comando | Qué hace |
|---|---|
| `make install` | Instala dependencias con Poetry |
| `make up` / `make prod` | Compose de desarrollo / producción |
| `make redis` + `make data` | Producción repartida sobre una red externa |
| `make local` | uvicorn con recarga, sin Docker |
| `make test` | Construye `Dockerfile.run_test` y corre pytest adentro |
| `make clean` | Baja ambos stacks y borra volúmenes |
| `make precommit` | `pre-commit run --all-files` |
