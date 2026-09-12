---
title: 14.1 Beta-1, el sistema completo y liviano
---

# 14.1 Beta-1, el sistema completo y liviano

Beta-1 es el perfil para **operar los cuatro componentes de Mapas SMN en una
sola VM de 8 GB de RAM**, sin convertir el sistema en una demostración.
**Procesa datos meteorológicos reales** y conserva el almacén, las colas, las
API, el mapa y la emisión de avisos. **Lo que reduce es el trabajo simultáneo y
el catálogo activo del procesador.**

!!! info "El espíritu de Beta-1"
    **Un sistema chico, completo y conectado a la operación real.** Es una
    configuración explícita y versionada: todos despliegan la misma topología,
    los mismos productos y las mismas revisiones. **No es el stack de
    desarrollo y no usa datos ficticios**, y no toca los archivos generales de
    producción.

## Qué conserva y qué reduce

| Conserva | Reduce |
|---|---|
| Los cuatro componentes | Un worker normal en lugar de dos |
| Los feeds vivos y las descargas públicas | Un worker liviano en lugar de tres |
| RabbitMQ y SeaweedFS | Los productos meteorológicos habilitados |
| Redis, MySQL y los sincronizadores | La cantidad de radares: RMA1, RMA2 y RMA8 |
| Las API de datos, avisos y métricas | Los productos más costosos, incluida la banda 2 |
| El visualizador y esta documentación | La presión concurrente sobre CPU y RAM |

El perfil levanta **12 contenedores**:

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

**Esos archivos se versionan juntos.** Una revisión de `mapasmn` identifica el
orquestador **y las revisiones exactas de los cuatro submódulos**.

## Las fuentes son reales

Beta-1 toma GOES-19, ECMWF y GFS directamente de sus fuentes públicas. **Las
fuentes internas del organismo entran por el sistema de archivos**:

| Fuente | Directorio observado en la VM | Productos activos |
|---|---|---|
| GLM | `tiles-processor/data/goes19-glm/` | FED |
| Radar SINARAME | `tiles-processor/data/radar-sinarame/` | Seis productos de RMA1, RMA2 y RMA8 |
| WRF-ARG4K | `tiles-processor/data/wrf-arg4k/` | Colmax y Ráfagas |

Esos tres directorios se montan como `/app/data/{goes19-glm,radar-sinarame,wrf-arg4k}` en el
productor y los workers. **La integración prevista es que los sistemas que ya
reciben los datos vivos los repliquen allí.** **El productor examina los
directorios cada cinco minutos** y encola lo nuevo: **no hace falta reiniciarlo
ante cada ingreso.**

**El feed debe conservar los nombres, marcas temporales y estructura esperados
por el procesador.** Para no exponer archivos incompletos, escribir cada archivo
con un nombre temporal dentro del mismo sistema de archivos y renombrarlo al
terminar la copia. **El renombre es atómico; una copia directa al nombre final
no lo es.**

El contrato general de cada fuente está en
[Tiles Processor](../servicios/tiles-processor.md#con-quién-habla). **Los
registros del productor son la primera evidencia de que un archivo fue
descubierto**; la profundidad de las colas y los trabajos terminados aparecen
luego en la API de métricas.

!!! note "El simulador es una alternativa de laboratorio"
    `data-simulator` reproduce capturas históricas cuando no existen feeds
    vivos. **No forma parte del despliegue Beta-1 previsto.** Si el organismo
    entrega datos reales, conectarlos directamente evita introducir otra pieza
    y conserva sus tiempos y contenido originales.

## Antes de empezar

La VM necesita:

- Linux y 8 GB de RAM;
- Docker Engine y Docker Compose 2.20 o posterior;
- Git, `make`, un shell POSIX y `envsubst` de GNU gettext;
- espacio para datos crudos, objetos procesados, Redis y MySQL;
- acceso saliente a las fuentes públicas, IGN y la API del SMN;
- conectividad desde los feeds internos hacia los tres directorios de entrada.

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

**Ese comando respeta las revisiones fijadas.** **No usar `make update` en una
VM operativa**: ese target mueve los submódulos a la punta de sus ramas y sirve
para preparar una nueva versión, no para reproducir una existente.

## 2. Configurar una sola vez

```sh
make setup
```

El comando crea el `.env` de la raíz y deriva los cuatro `.env` internos. **Sólo
se edita el de la raíz.** Como mínimo:

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
```

**Las bases URL se incorporan al visualizador durante la construcción.** **Deben
ser alcanzables desde el navegador**, no solamente desde la VM. Si una persona
abre el mapa desde otra computadora, `localhost` apunta a esa computadora y
rompe las consultas.

Después de guardar el archivo:

```sh
make setup
```

`MANAGE_DB_SCHEMAS=true` permite preparar el MySQL local incluido en Beta-1.
**Contra una base institucional, esa variable habilita DDL sobre un esquema
ajeno**: revisarla antes del primer arranque.

## 3. Conectar los feeds

Crear los directorios si el mecanismo de réplica todavía no lo hizo:

```sh
mkdir -p tiles-processor/data/goes19-glm
mkdir -p tiles-processor/data/radar-sinarame
mkdir -p tiles-processor/data/wrf-arg4k
```

Configurar luego el replicador institucional para escribir en ellos. Comprobar
antes del arranque que el usuario que alimenta los datos puede escribir y que
Docker puede leerlos.

**Los feeds pueden conectarse antes o después de levantar el stack.** Si llegan
después, las capas correspondientes aparecerán cuando termine el primer ciclo de
procesamiento.

## 4. Levantar

```sh
make beta-1
```

El comando:

1. vuelve a derivar los `.env`;
2. crea la red externa de `data-service` si no existe;
3. construye las cuatro imágenes de aplicación;
4. levanta el proyecto definido por `compose.beta-1.yaml`.

La primera construcción tarda varios minutos. `alerts-service` suma **hasta ocho
minutos en su primer arranque**, mientras prepara las capas administrativas.

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

La documentación compilada está en `http://<vm>:6010/docs-site/`: **no existe un
contenedor ni un puerto separado para ella**.

| Síntoma | Comprobación |
|---|---|
| El mapa carga vacío | Las URL compiladas apuntan a nombres alcanzables desde el navegador |
| Radar, GLM o WRF no aparecen | El feed escribe en el directorio correcto y el productor descubre los nombres |
| Datos y avisos responden pero el panel no | `METRICS_SERVICE_BASE_URL` y el puerto `6020` son alcanzables |
| Datos reinicia | SeaweedFS responde por el puerto `9000` del host |
| Avisos tarda en estar sano | Esperar la preparación inicial de capas, hasta ocho minutos |

## Operar y actualizar

```sh
make beta-1-down
docker compose -f compose.beta-1.yaml ps
docker compose -f compose.beta-1.yaml logs -f producer worker1 worker-light1
```

`beta-1-down` elimina contenedores y redes del proyecto, **y conserva los
volúmenes**. Para desplegar una nueva revisión fijada por `mapasmn`:

```sh
git pull --ff-only
git submodule update --init --recursive
make beta-1
```

Antes de actualizar, registrar el commit actual de `mapasmn`. Volver a ese
commit y repetir `git submodule update --init --recursive` **restaura las cuatro
revisiones anteriores**.

## El límite de los 8 GB

La selección Beta-1 fue medida por el equipo por debajo de 8 GB. **Es un perfil
de carga, no una cuota impuesta por Docker:** los contenedores todavía no tienen
límites de memoria. Habilitar otros productos, agregar workers o recibir un
archivo patológico cambia ese resultado.

Mientras se valida una instalación nueva, **observar el consumo del host, los
reinicios y los trabajos que estaban activos**. Las consideraciones completas
están en [Capacidad y dimensionamiento](capacidad.md).

## Antes de exponerlo

Beta-1 simplifica el despliegue, **no agrega autenticación ni un perímetro de
seguridad**. Las plantillas publican puertos de base, broker y almacén en todas
las interfaces. En una VM conectada a Internet:

1. cambiar la contraseña de ejemplo;
2. publicar las cuatro URL de navegador detrás de un proxy inverso con TLS;
3. cerrar `3306`, `5672`, `8888`, `9000`, `9333`, `15672` y `23646` al exterior;
4. limitar especialmente la API de avisos;
5. aplicar la lista de [Endurecimiento](../seguridad/endurecimiento.md).

**Levantar Beta-1 y autorizar su exposición son dos tareas distintas.**
