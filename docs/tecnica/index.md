---
title: Documentación técnica
---

# Documentación técnica

MapaSMN es un sistema de visualización y aviso por condiciones temporales extremas. Toma datos
meteorológicos crudos de satélite, radar y modelos numéricos, los convierte en tiles de mapa y capas
vectoriales, los sirve por HTTP y los dibuja sobre un mapa interactivo donde un pronosticador puede,
además, trazar un polígono y emitir un aviso a corto plazo.

Esta mitad de la documentación está escrita para quien tiene que **desplegar, operar o auditar** el
sistema, no para quien lo usa. Describe la arquitectura, los contratos entre componentes, la
topología de red, el procedimiento de puesta en marcha y el análisis de seguridad.

No incluye código. Está pensada para que alguien de infraestructura pueda levantar el sistema en su
propia red, modificarlo y decidir si es seguro exponerlo.

!!! danger "Si vas a exponerlo a una red, empezá por acá"
    El sistema **no autentica al llamante** en prácticamente ninguna ruta, y las plantillas de
    despliegue publican en todas las interfaces varios puertos que no deberían salir del host. Es
    desplegable, pero no tal cual: los cambios necesarios están en
    [Endurecimiento](seguridad/endurecimiento.md).

![Contexto del sistema MapaSMN: los cuatro servicios y sus fronteras externas](../imgs/diagrams/sistema-contexto.svg){ .diagram loading=lazy }

## Los cuatro servicios

El sistema son cuatro repositorios independientes, cada uno con su propio ciclo de vida, su propio
`Dockerfile` y su propio despliegue. No comparten base de datos ni código: se comunican por un
almacén de objetos compatible con S3 y por HTTP.

| Servicio | Rol | Stack |
|---|---|---|
| `tiles-processor` | Descarga los datos crudos y produce tiles WebP, GeoTIFF optimizados para la nube (COG) y capas GeoJSON. | Python 3.12, RabbitMQ, SeaweedFS, GDAL/rasterio/xarray, APScheduler |
| `data-service` | API de lectura. Sincroniza lo que produce `tiles-processor`, lo cachea en Redis y lo sirve al visualizador. | Python 3.13, FastAPI, Redis, S3 |
| `alerts-service` | Intersección geográfica del polígono de un aviso y generación del ACP. | Python 3.13, FastAPI, GeoPandas/Shapely, arquitectura hexagonal |
| `visualizer` | La aplicación web: mapa, capas, línea de tiempo, avisos y tableros de estado. | Angular 21, Leaflet, Angular Material, nginx |

## Por qué un almacén de objetos en el medio

La generación de productos es asíncrona y periódica; el consumo es sincrónico y bajo demanda. Poner
un almacén compatible con S3 entre ambos desacopla los dos ritmos: `tiles-processor` escribe cuando
termina de procesar y `data-service` lee cuando un usuario mira el mapa, sin que ninguno tenga que
esperar al otro ni compartir un sistema de archivos.

!!! note "El almacén es SeaweedFS"
    El almacén desplegado es **SeaweedFS** (`chrislusf/seaweedfs`), expuesto por su puerta de enlace
    S3. El código está escrito contra la API de S3, de modo que el almacén concreto es
    intercambiable; algunos comentarios del repositorio nombran otras implementaciones compatibles
    como alternativa posible, pero lo que corre es SeaweedFS.
    Ver [Almacenamiento y colas](contratos/almacenamiento.md).

## Las colas son internas

RabbitMQ existe solamente dentro de `tiles-processor`, para coordinar su esquema productor-consumidor.
Ningún otro servicio publica ni consume de esas colas. Ver
[Tiles Processor](servicios/tiles-processor.md).

## Qué habla con qué

| Origen | Destino | Por dónde |
|---|---|---|
| `tiles-processor` | `data-service` | Bucket `tiles-data` del almacén de objetos |
| `visualizer` | `data-service` | HTTP: `/products/*`, `/basemap/*`, `/weather-stations/*`, `/metrics/*` |
| `visualizer` | `alerts-service` | HTTP: `/intersect/*`, `/alerts/*`, `/metrics/*` |
| `visualizer` | `tiles-processor` | HTTP: `/api/*` de la API de métricas, puerto `6020` |
| `alerts-service` | Base MySQL del SMN | Tabla intermedia `taviso_temporal` |
| `visualizer` | IGN | WMS directo desde el navegador |

El visualizador es el único que habla con tres backends distintos, y los tres exponen una ruta de
métricas de nombre parecido en hosts diferentes. Ver [API HTTP](contratos/api.md).

## Cómo está organizada

### Arquitectura

- [Decisiones de arquitectura](decisiones.md) — por qué el sistema está armado así, y qué se paga por
  cada decisión.
- [Flujo de datos](flujo-de-datos.md) — el recorrido completo de un dato, de la fuente al navegador.
- [Los servicios](servicios/tiles-processor.md) — cada uno por dentro.

### Contratos

- [API HTTP](contratos/api.md) — todas las rutas, sus parámetros y sus errores.
- [Configuración y variables](contratos/configuracion.md) — qué hay que configurar y qué significa.
- [Almacenamiento y colas](contratos/almacenamiento.md) — cómo se organizan los buckets y las colas.

### Operación

- [Topología de red](operacion/topologia.md) — cómo están cableados los stacks y dónde va el firewall.
- [Puesta en marcha](operacion/puesta-en-marcha.md) — levantarlo desde cero.
- [Despliegue e infraestructura](operacion/despliegue.md) — dónde corre cada cosa y cómo llega ahí.
- [Entrega continua](operacion/entrega-continua.md) — del push a los contenedores.
- [Calidad](operacion/calidad.md) — qué se verifica automáticamente y qué no.
- [Observabilidad](operacion/observabilidad.md) — qué se mide y dónde se guarda.
- [Capacidad y dimensionamiento](operacion/capacidad.md) — qué acota el consumo y qué medir.

### Seguridad

- [Modelo de amenazas](seguridad/index.md) — activos, límites de confianza y atacantes.
- [Superficie expuesta](seguridad/superficie.md) — puerto por puerto y ruta por ruta.
- [Datos y secretos](seguridad/datos-y-secretos.md) — qué información maneja y hacia dónde sale.
- [Endurecimiento](seguridad/endurecimiento.md) — la lista de cambios previos al despliegue.
