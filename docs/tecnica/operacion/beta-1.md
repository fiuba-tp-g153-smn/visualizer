---
title: 14.1 Beta-1, el sistema completo y liviano
---

# 14.1 Beta-1, el sistema completo y liviano

Beta-1 fue preparado para operar los cuatro componentes de MapaSMN en una máquina virtual con 8 GB
de memoria. Mantiene el procesamiento, el almacenamiento, las API, el mapa y la generación de avisos.
La reducción se concentra en la cantidad de workers y en los productos habilitados.

El propósito del perfil es disponer de una instalación completa, reproducible y conectada a las
fuentes reales del SMN. Sus archivos fijan la topología, la selección de productos y las revisiones
de los cuatro componentes. Por este motivo no debe confundirse con el entorno de desarrollo ni con
una ejecución alimentada por el simulador.

## Qué conserva y qué reduce

| Conserva | Reduce |
|---|---|
| Los cuatro componentes | Un worker normal en lugar de dos |
| Los feeds vivos y las descargas públicas | Un worker liviano en lugar de tres |
| RabbitMQ y SeaweedFS | Los productos meteorológicos habilitados |
| Redis, MySQL y los sincronizadores | La cantidad de radares: RMA1, RMA2 y RMA8 |
| Las API de datos, avisos y métricas | Los productos más costosos, incluida la banda 2 |
| El visualizador y esta documentación | La presión concurrente sobre CPU y RAM |

El perfil levanta 12 contenedores:

| Componente | Contenedores |
|---|---:|
| `tiles-processor` | 6: broker, almacén, productor, worker normal, worker liviano y métricas |
| `data-service` | 3: Redis, API y sincronizador |
| `alerts-service` | 2: MySQL y aplicación |
| `visualizer` | 1: nginx con el mapa y esta documentación |

Los archivos que congelan el perfil viven en el repositorio `mapasmn` y en su
submódulo `tiles-processor`:

- `compose.beta-1.yaml` une los cuatro componentes;
- `docker-compose-beta-1.yaml` fija la topología liviana del procesador;
- `docker-compose-beta-1.override.yaml` monta su configuración;
- `settings-beta-1.json` fija fuentes, radares y productos.

Esos archivos se versionan juntos. Una revisión de `mapasmn` identifica el
orquestador y las revisiones exactas de los cuatro submódulos.

## Conectar cada producto con su fuente

Beta-1 busca que todos los productos habilitados reciban datos reales. La instalación no queda
atada a una procedencia única. Cada fuente puede leer una carpeta local o un bucket S3. ECMWF IFS y
GFS admiten además sus proveedores públicos. El operador debe revisar los seis bloques de
`settings-beta-1.json` y elegir la alternativa que corresponda a la infraestructura disponible.

| Fuente | Modo incluido como punto de partida | Alternativas |
|---|---|---|
| GOES-19 ABI | `s3`, bucket público de NOAA | S3 propio o carpeta local |
| GOES-19 GLM | `local` | S3 propio |
| Radar SINARAME | `local` | S3 propio |
| WRF-ARG4K | `local` | S3 propio |
| ECMWF IFS | `external-provider-opendata` | S3 propio o carpeta local |
| GFS | `external-provider-nomads` | S3 propio o carpeta local |

El modo `local` requiere una ruta absoluta en `<PREFIX>_INPUT_DIR` y un bind mount de sólo lectura
en `docker-compose-beta-1.yaml`. El Compose versionado contiene únicamente los tres mounts que
corresponden a su configuración inicial. Al cambiar otra fuente a `local`, se debe agregar su mount.
Al cambiar una fuente local a S3, se debe eliminar el mount que deja de utilizarse.

El modo `s3` define el bucket y sus opciones dentro del bloque `input`. Puede utilizar un nombre de
bucket o una dirección `s3://bucket/prefix`, junto con `s3_endpoint`, `s3_prefix`, `s3_region`,
`s3_secure` y `s3_addressing_style` cuando sean necesarios. Las credenciales se cargan mediante el
par `<PREFIX>_S3_ACCESS_KEY` y `<PREFIX>_S3_SECRET_KEY`. Los dos valores vacíos indican acceso
anónimo; configurar sólo uno hace fallar el arranque.

Los procesos que escriben una carpeta local deben conservar los nombres y marcas temporales que
espera el procesador. Conviene copiar cada archivo con un nombre temporal y renombrarlo cuando esté
completo. El productor examina las fuentes cada cinco minutos, por lo que no necesita reiniciarse
ante un nuevo ingreso.

El contrato general de cada fuente está en
[Tiles Processor](../servicios/tiles-processor.md#con-quién-habla). Los
registros del productor son la primera evidencia de que un archivo fue
descubierto; la profundidad de las colas y los trabajos terminados aparecen
luego en la API de métricas.

!!! note "El simulador es una alternativa de laboratorio"
    `data-simulator` reproduce capturas históricas cuando no existen feeds
    vivos. No forma parte del despliegue Beta-1 previsto. Si el organismo
    entrega datos reales, conectarlos directamente evita introducir otra pieza
    y conserva sus tiempos y contenido originales.

## Antes de empezar

La VM necesita:

- Linux y 8 GB de RAM;
- Docker Engine y Docker Compose 2.20 o posterior;
- Git, `make`, un shell POSIX y `envsubst` de GNU gettext;
- espacio para datos crudos, objetos procesados, Redis y MySQL;
- acceso saliente a las fuentes públicas, IGN y la API del SMN;
- conectividad con cada bucket, proveedor o carpeta elegida para los productos activos.

En Debian o Ubuntu, la parte que no trae Docker se instala con:

```sh
sudo apt-get install -y git make gettext-base
```

## 1. Clonar la versión

```sh
git clone --recurse-submodules git@github.com:fiuba-tp-g153-smn/mapasmn.git
cd mapasmn
```

Si el repositorio ya existía:

```sh
git submodule update --init --recursive
```

Ese comando respeta las revisiones fijadas. No usar `make update` en una
VM operativa: ese target mueve los submódulos a la punta de sus ramas y sirve
para preparar una nueva versión, no para reproducir una existente.

## 2. Configurar una sola vez

```sh
make setup
```

El comando crea el `.env` de la raíz y deriva los cuatro `.env` internos. Sólo
se edita el de la raíz. Como mínimo:

```dotenv
APP_ENV=production
DEV_PASSWORD=<una-clave-larga-y-aleatoria>

SMN_API_USERNAME=<usuario>
SMN_API_PASSWORD=<clave>
SMN_API_BASE_URL=<endpoint-asignado-por-el-SMN>

DATA_SERVICE_BASE_URL=https://data.example.org
ALERTS_SERVICE_BASE_URL=https://alerts.example.org
METRICS_SERVICE_BASE_URL=https://metrics.example.org
DOCS_URL=/docs-site

GOES19_GLM_INPUT_DIR=/srv/mapasmn/input/goes19-glm
RADAR_SINARAME_INPUT_DIR=/srv/mapasmn/input/radar-sinarame
WRF_ARG4K_INPUT_DIR=/srv/mapasmn/input/wrf-arg4k
```

Las bases URL se incorporan al visualizador durante la construcción. Deben
ser alcanzables desde el navegador, no solamente desde la VM. Si una persona
abre el mapa desde otra computadora, `localhost` apunta a esa computadora y
rompe las consultas.

Después de guardar el archivo:

```sh
make setup
```

`MANAGE_DB_SCHEMAS=true` permite preparar el MySQL local incluido en Beta-1.
Contra una base institucional, esa variable habilita DDL sobre un esquema
ajeno: revisarla antes del primer arranque.

## 3. Conectar los feeds

Con la configuración inicial, Docker Compose requiere las tres carpetas correspondientes a GLM,
radar y WRF. Las rutas deben ser absolutas y existir antes del arranque:

```sh
sudo mkdir -p /srv/mapasmn/input/goes19-glm
sudo mkdir -p /srv/mapasmn/input/radar-sinarame
sudo mkdir -p /srv/mapasmn/input/wrf-arg4k
```

Antes del arranque se debe comprobar cada fuente, incluidas las que usan S3 o un proveedor externo.
En el caso de una carpeta, el proceso que alimenta los datos debe poder escribir y Docker debe poder
leer. En el caso de S3, conviene probar la lista del bucket con las mismas credenciales que utilizará
el contenedor.

Los feeds pueden conectarse después de levantar el stack, pero sus capas permanecerán vacías hasta
que finalice el primer ciclo de procesamiento. Un arranque sano no demuestra que todas las fuentes
estén conectadas; esa comprobación se realiza en los registros del productor y en las métricas.

## 4. Levantar

```sh
make beta1
```

El comando:

1. vuelve a derivar los `.env`;
2. crea la red externa de `data-service` si no existe;
3. construye las cuatro imágenes de aplicación;
4. levanta el proyecto definido por `compose.beta-1.yaml`.

La primera construcción tarda varios minutos. `alerts-service` suma hasta ocho
minutos en su primer arranque, mientras prepara las capas administrativas.

## 5. Verificar

Con los puertos de ejemplo:

```sh
curl -f http://<vm>:6006/health
curl -f http://<vm>:6006/sync/status
curl -f http://<vm>:6007/health
curl -f http://<vm>:6020/health
curl -f http://<vm>:6010/
```

Después:

1. abrir el visualizador en `http://<vm>:6010`;
2. abrir su panel de estado;
3. confirmar que las cuatro pestañas responden;
4. revisar que el productor descubra los feeds locales;
5. esperar que crezca la cantidad de trabajos completados;
6. comprobar una capa de cada fuente conectada.

La documentación compilada está en `http://<vm>:6010/docs-site/`: no existe un
contenedor ni un puerto separado para ella.

| Síntoma | Comprobación |
|---|---|
| El mapa carga vacío | Las URL compiladas apuntan a nombres alcanzables desde el navegador |
| Radar, GLM o WRF no aparecen | El feed escribe en el directorio correcto y el productor descubre los nombres |
| Datos y avisos responden pero el panel no | `METRICS_SERVICE_BASE_URL` y el puerto `6020` son alcanzables |
| Datos reinicia | SeaweedFS responde por el puerto `9000` del host |
| Avisos tarda en estar sano | Esperar la preparación inicial de capas, hasta ocho minutos |

## Operar y actualizar

```sh
make beta1-down
docker compose -f compose.beta-1.yaml ps
docker compose -f compose.beta-1.yaml logs -f producer worker1 worker-light1
```

`beta1-down` elimina contenedores y redes del proyecto, y conserva los
volúmenes. Para desplegar una nueva revisión fijada por `mapasmn`:

```sh
git pull --ff-only
git submodule update --init --recursive
make beta1
```

Antes de actualizar, registrar el commit actual de `mapasmn`. Volver a ese
commit y repetir `git submodule update --init --recursive` restaura las cuatro
revisiones anteriores.

## Actualizar una instalación anterior

El cambio de nombres de septiembre de 2026 modificó en conjunto las rutas de S3, las rutas HTTP, las
claves de `settings.json`, las credenciales de entrada y los nombres internos de las carpetas. La
actualización requiere desplegar revisiones compatibles de `tiles-processor`, `data-service` y
`visualizer`. Si se actualiza un solo componente, el procesador escribe en lugares que el servicio de
datos no lee o el navegador solicita rutas que todavía no existen.

Los objetos almacenados con los nombres anteriores no se migran. SeaweedFS conserva el vencimiento
asignado cuando se escribió cada objeto y los elimina según la retención original. Durante el corte,
el historial de animación queda vacío y se completa nuevamente a medida que llegan productos. Las 24
capturas de GOES-19 requieren cerca de cuatro horas.

Las carpetas físicas del host pueden conservar sus nombres anteriores. La nueva variable puede
apuntar, por ejemplo, a una carpeta llamada `radar_h5`. Dentro del contenedor siempre se monta como
`/app/data/radar-sinarame`. También se deben cambiar los pares de credenciales antiguos por
`GOES19_ABI_S3_*`, `GOES19_GLM_S3_*`, `RADAR_SINARAME_S3_*`, `WRF_ARG4K_S3_*` y
`ECMWF_IFS_S3_*`.

En Coolify no se deben utilizar variables como origen o destino de un volumen. Su analizador puede
rechazarlas o convertirlas en volúmenes administrados vacíos. El Compose de producción del
procesador usa rutas absolutas literales por este motivo. Beta-1 corre con Docker Compose directo y
mantiene las variables para que cada instalación elija sus carpetas.

## El límite de los 8 GB

La selección Beta-1 fue medida por el equipo por debajo de 8 GB. Es un perfil
de carga, no una cuota impuesta por Docker: los contenedores todavía no tienen
límites de memoria. Habilitar otros productos, agregar workers o recibir un
archivo patológico cambia ese resultado.

Mientras se valida una instalación nueva, observar el consumo del host, los
reinicios y los trabajos que estaban activos. Las consideraciones completas
están en [Capacidad y dimensionamiento](capacidad.md).

## Antes de exponerlo

Beta-1 simplifica el despliegue, no agrega autenticación ni un perímetro de
seguridad. Las plantillas publican puertos de base, broker y almacén en todas
las interfaces. En una VM conectada a Internet:

1. cambiar la contraseña de ejemplo;
2. publicar las cuatro URL de navegador detrás de un proxy inverso con TLS;
3. cerrar `3306`, `5672`, `8888`, `9000`, `9333`, `15672` y `23646` al exterior;
4. limitar especialmente la API de avisos;
5. aplicar la lista de [Endurecimiento](../seguridad/endurecimiento.md).

Levantar Beta-1 y autorizar su exposición son dos tareas distintas.
