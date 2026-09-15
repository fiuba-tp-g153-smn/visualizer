---
title: 11.3 Alerts Service
---

# 11.3 Alerts Service

`alerts-service` recibe el polígono dibujado por el pronosticador, calcula su intersección con los
límites administrativos y genera las dos imágenes del aviso. También registra el resultado en la
base utilizada por el circuito operativo del SMN. Esta escritura y la ausencia actual de
autenticación hacen que su exposición requiera una revisión particular. La aplicación contiene una
API, un planificador y un conjunto acotado de workers.

![Generación de un aviso: la API responde en seguida, el trabajo pesado va a una cola acotada](../../imgs/diagrams/alerts-service-generacion.svg){ .diagram loading=lazy }

!!! note "El servicio no emite el aviso"
    Escribe la fila del aviso en la tabla `taviso_temporal`, marcada como no procesada. Un proceso
    del organismo la promueve al registro definitivo y difunde el aviso. El alcance de este
    servicio termina en esa tabla.

## Unidades desplegables

| Contenedor | Imagen | Papel |
|---|---|---|
| `alerts-mysql` | `mysql:8.4` | La base local de avisos. En desarrollo hace también de base del SMN. |
| `alerts-service-container` | Propia | API, planificador semanal, pool de generación y muestreador de métricas, todo en un proceso. |

El contenedor de MySQL arranca con un script propio que crea un usuario de sólo lectura con
límites de conexiones. Está pensado para consultas externas y para leer la tabla definitiva.

## Puertos y conexiones

| Puerto del host | Contenedor | Quién lo necesita |
|---|---|---|
| `${APP_HOST_PORT}` (6007) → `8080` | `alerts-service-container` | El navegador, directamente |
| `3306` | `alerts-mysql` | Nadie del sistema. Se publica igual. |

| Destino | Protocolo | Variables | Para qué |
|---|---|---|---|
| MySQL de avisos | MySQL | `MYSQL_*` | Escribe `taviso_temporal`; lee `departamentos` y `provincia` |
| MySQL de referencia | MySQL | `MYSQL_TAVISO_*` | Sólo lee la tabla `taviso`. Es una segunda conexión. |
| Almacén de objetos | S3 | `S3_ENDPOINT`, `S3_BUCKET_NAME` | Respaldo de las capas simplificadas |
| IGN | WFS sobre HTTPS | `COUNTRY_GEOJSON_URL` y dos más | Contorno del país, departamentos y provincias |

Las dos conexiones a MySQL apuntan por defecto al mismo contenedor local. En un despliegue real,
la segunda apunta a la base del SMN. Nada en el código distingue una cosa de la otra: lo decide
`MYSQL_HOST`. Ver [19.2 Datos y secretos](../seguridad/datos-y-secretos.md).

!!! note "El bucket no tiene nombre en el repositorio"
    `S3_BUCKET_NAME` viene vacío en el archivo de ejemplo. El nombre `intersection-data` es el que
    crea el script de arranque del almacén y el que usa el repositorio de orquestación. Con la
    variable vacía, el respaldo en S3 queda desactivado y el servicio sigue funcionando.

## Qué guarda

| Volumen | Contenido | Copia única |
|---|---|---|
| `mysql_data` | La base de avisos, con `taviso_temporal` | Sí |
| `alerts_service_data` | Las capas del IGN simplificadas por nivel; `history.db`, `jobs.sqlite`, `metrics.sqlite` | Sí para las tres bases; las capas se regeneran desde el IGN |
| `alerts_output` | Los GIF generados, servidos como estáticos bajo `/alerts/` | Sí. Nunca se borran y no hay tope. |

Las tipografías, los logos y el recuadro de referencia van dentro de la imagen. No se montan
desde el host.

## Cuando algo falla

| Dependencia caída | Efecto |
|---|---|
| MySQL de avisos | El arranque espera a que esté sano. En marcha, las rutas que lo tocan responden `500`; la intersección sigue. |
| IGN | Degradado, no fatal. El arranque registra el error y sigue con las capas que tenga en disco. |
| Almacén de objetos | La restauración se salta con un aviso. Las subidas fallan y se registran. |
| Base de referencia del SMN | Se abre al primer uso. Ver el recuadro de abajo. |

!!! warning "Sin verificar: la base de referencia caída"
    La conexión a la tabla `taviso` no tiene `depends_on`, comprobación de salud ni reintento
    visible. No pudo determinarse leyendo el código cómo responde el servicio si esa base no
    contesta en marcha. Lo levanta `src/container.py`, que la construye a demanda.

## Arranque

Hace bastante antes de contestar, y por eso su comprobación de salud declara ocho minutos de
gracia:

1. El punto de entrada corre `alembic upgrade head`. Sin `MANAGE_DB_SCHEMAS`, es una operación
   vacía. Si falla, el contenedor no arranca.
2. Limpia temporales huérfanos.
3. Reconcilia las capas en disco con el bucket. Lo que no coincide con el nombre canónico se
   borra.
4. Descarga del IGN y simplifica los niveles que falten, en un subproceso.
5. Construye los índices de departamentos y provincias y dos cachés de dibujo.
6. Migra sus bases SQLite y recién entonces atiende HTTP.

## Salud

`GET /health` responde `{"status":"running"}` sin comprobar nada más. El contenedor lo consulta
cada 30 s, con 3 reintentos y 8 minutos de gracia para el primer arranque.

!!! warning "El tiempo de gracia al apagar es más corto que el drenado"
    La plantilla da un minuto para apagar. El servicio intenta drenar su cola durante 160 s.
    Un apagado con trabajos en curso puede cortar una generación a medias.

## Cómo se agranda

| Parámetro | Valor | Dónde |
|---|---|---|
| Workers de generación | 2 | `alerts.job.workers` en `settings.json` |
| Tamaño de la cola | 16 | `alerts.job.queue_maxsize` |
| Tiempo límite de un trabajo | 150 s | `alerts.job.timeout_seconds` |
| Renders simultáneos | 2 | En el código, no configurable |
| Tiempo límite del render | 120 s | En el código, no configurable |

Cuando la cola está llena, la creación responde `503` en el acto, con el texto
`Alert generation queue is full, try again later`. No se crea ningún trabajo. Esos números
definen cuántos avisos simultáneos tolera el sistema en un evento severo.

![Estados de un trabajo de generación](../../imgs/diagrams/alerts-service-estados.svg){ .diagram loading=lazy }

Los dos tiempos límite se enciman: el render vence primero, así que un render lento se reporta
como `generation_failed` y no como `timeout`.

!!! warning "El control de admisión no cubre la intersección"
    Las dos rutas de intersección corren en el mismo hilo que atiende las peticiones y sin límite
    de tamaño. Un polígono grande bloquea el servicio entero. Es el punto de saturación más
    fácil de alcanzar. Ver [19.3 Endurecimiento](../seguridad/endurecimiento.md).

## Niveles de detalle

Las capas del IGN se simplifican de antemano, por nivel, y se versionan por fecha y tolerancia.
La API acepta `detail_level` de 1 a 5. Existe un nivel 7 interno para la caché de arranque.

| Nivel | Tolerancia | Uso |
|---|---|---|
| 1 | 0.2 | API, el más grueso |
| 5 | 0.01 | API, valor por defecto |
| 7 | 0.005 | Interno |

Los departamentos tienen una única tolerancia, `0.005`. Cambiar una tolerancia en `settings.json`
dispara una purga completa y una nueva descarga del IGN. Cada capa vive en memoria mientras se use,
con 30 minutos de expiración por inactividad; un barrido cada 60 s la limpia.

## Catálogo de fenómenos

El catálogo está en el código: 28 entradas con códigos dispersos entre 1 y 92. El código 50 no
tiene texto y se rechaza como fenómeno inválido, así que 27 son utilizables. La aplicación filtra
las entradas sin texto antes de mostrarlas.

## Tareas programadas

Una sola tarea del planificador: el refresco de capas, con el cron `0 3 * * 0`, los domingos a las
03:00 UTC. Aparte corren dos bucles: el muestreador de métricas cada 60 s y el supervisor de
workers cada 30 s.

## Bases de datos

| Base | Motor | Contenido | Esquema |
|---|---|---|---|
| La de `MYSQL_DATABASE` | MySQL | `taviso_temporal` (propia), `taviso` (del SMN), `departamentos`, `provincia` | Alembic, sólo con `MANAGE_DB_SCHEMAS` |
| `jobs.sqlite` | SQLite | `alert_jobs`, historial durable de trabajos | Alembic |
| `metrics.sqlite` | SQLite | `processor_samples` y `alert_jobs` | Alembic |
| `history.db` | SQLite | `job_runs`, una fila por refresco semanal | Ninguno: la crea el adaptador, sin poda |

!!! danger "`MANAGE_DB_SCHEMAS` no va en producción"
    Con la variable activada, el arranque ejecuta el árbol completo de migraciones contra
    `MYSQL_HOST`. Una revisión trunca `departamentos` y `provincia` con las comprobaciones de
    clave foránea apagadas, y otra renombra `taviso` a `taviso_temporal`. El archivo de ejemplo
    la trae activada. Ver [19.3 Endurecimiento](../seguridad/endurecimiento.md).

## Comandos

| Comando | Qué hace |
|---|---|
| `make up` / `make prod` | Compose de desarrollo / producción |
| `make down` / `make clean` | Baja los stacks / borra volúmenes |
| `make test` | Pruebas dentro de Docker |
