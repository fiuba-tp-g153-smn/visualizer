---
title: Puesta en marcha local
---

# Puesta en marcha local

Cada repositorio se levanta por su cuenta con Docker Compose y un `Makefile`. No hace falta instalar
Python ni Node en el host para correr los servicios, aunque sí para algunas tareas puntuales.

!!! note "Hay un meta-repositorio que levanta todo junto"
    Existe un repositorio aparte que incorpora los cuatro servicios como submódulos de git y los
    orquesta como un único proyecto de Compose, con un `.env` centralizado. Es la vía recomendada
    para levantar el sistema completo; lo que sigue describe cada repositorio por separado.

## Requisitos

| Herramienta | Para qué |
|---|---|
| Docker y Docker Compose | Todo |
| Python 3.12 | `tiles-processor` fuera de Docker |
| Python 3.13 | `data-service` y `alerts-service` fuera de Docker |
| Node 24 y npm 11 | `visualizer` fuera de Docker |
| Poetry 2.3.2 | Dependencias de los tres servicios en Python |

Las versiones de Python **no son uniformes**: `tiles-processor` va por 3.12 y los otros dos por 3.13.

## Orden de arranque

El sistema tolera que los servicios arranquen en cualquier orden, pero para ver datos conviene:

1. `tiles-processor`, que levanta RabbitMQ y SeaweedFS y empieza a producir.
2. `data-service`, que necesita el bucket poblado para tener algo que sincronizar.
3. `alerts-service`, independiente de los dos anteriores.
4. `visualizer`, que necesita a los otros para mostrar algo.

## tiles-processor

```
make up
```

Levanta RabbitMQ, SeaweedFS, el producer, los workers y la API de métricas. El panel de RabbitMQ
queda en el puerto `15672` y la API de métricas en el `6020`.

Para cambiar la cantidad de workers hay que regenerar las compose:

```
./scripts/generate-compose.sh --dev --light 3 2
```

!!! warning "No editar las compose a mano"
    `docker-compose.yaml` y `docker-compose-dev.yaml` son artefactos generados por ese script. Un
    cambio manual sobrevive hasta la próxima regeneración.

Las pruebas de este repositorio corren **en el host**, no en Docker, así que necesitan un entorno
virtual activado:

```
make test
```

## data-service

```
make up
```

Levanta Redis y los dos contenedores de la aplicación. La API queda en el puerto `6006`.

Hay una variante repartida, útil cuando se quiere reiniciar la aplicación sin tocar Redis:

```
make redis
make data
```

Ambas comparten una red externa que hay que crear a mano la primera vez.

Para correr sin Docker, con recarga automática:

```
make local
```

## alerts-service

```
make up
```

Levanta MySQL y la aplicación, que queda en el puerto `6007`.

!!! warning "El primer arranque tarda varios minutos"
    Antes de responder, el servicio descarga las capas del IGN, las simplifica en los cinco niveles
    de detalle y construye tres cachés. Por eso su healthcheck declara ocho minutos de gracia. Un
    contenedor que parece colgado en el primer arranque probablemente esté simplificando geometrías.

En desarrollo se puede habilitar `MANAGE_DB_SCHEMAS` para que Alembic cree el esquema MySQL local.
En producción esa variable **no** se define.

## visualizer

```
make up
```

Levanta un contenedor de desarrollo con recarga en caliente en el puerto `4201`. Antes arranca un
contenedor de un solo uso que construye la documentación.

Para trabajar sin Docker:

```
npm install
make docs
npm start
```

!!! note "`make docs` es obligatorio antes del primer `npm start`"
    La documentación se compila a `public/docs-site`, que está en `.gitignore`. Si nunca se corrió,
    la ruta `/docs` de la aplicación devuelve 404. No hace falta repetirlo salvo que se editen las
    páginas.

Las variables del visualizador se hornean en la compilación, así que cambiar cualquiera de ellas
obliga a reconstruir. Ver [Configuración y variables](../referencia/configuracion.md).

## Trabajar sobre la documentación

Desde `apps/visualizer`:

```
make docs-serve
```

Levanta una vista previa con recarga automática en `http://localhost:8000`. La compilación real es:

```
make docs
```

Ambas usan la imagen fijada `squidfunk/mkdocs-material:9.7.7`. **No hay entorno virtual de Python
para la documentación** y no debe agregarse: el sitio se construye dentro de esa imagen tanto en
local como en la etapa `docs` del `Dockerfile`, y las dos rutas tienen que producir lo mismo.

!!! warning "La compilación es `--strict`"
    Un enlace roto o una página ausente del `nav` no son advertencias: hacen fallar la compilación.
    Es deliberado, porque una página fuera del `nav` queda invisible en el sitio publicado.

### Diagramas

Los diagramas se escriben en D2 bajo `diagrams/` y se renderizan a SVG bajo `docs/imgs/diagrams/`,
que **se versionan**:

```
make diagrams
```

`make docs` no depende de ese objetivo a propósito: D2 no está instalado ni en CI ni en la etapa
`docs` de la imagen, y agregarlo ataría la compilación de la documentación a una cadena de
herramientas de Go sin ninguna ventaja. Los SVG son artefactos versionados; el objetivo existe para
regenerarlos con un comando y no a mano.

Los SVG viven bajo `imgs/` para que el hook de invalidación de caché les estampe el hash del
contenido, que es justamente lo que permite a nginx servir ese árbol como inmutable.
