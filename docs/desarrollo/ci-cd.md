---
title: CI/CD y despliegue
---

# CI/CD y despliegue

Nueve workflows de GitHub Actions cubren los cuatro repositorios. Todos comparten la misma forma de
despliegue —un webhook de Coolify— pero conviven dos generaciones de configuración con diferencias
reales en qué se verifica y qué se fija por versión.

![Cadena de entrega, del push a main hasta los contenedores](../imgs/diagrams/despliegue.svg){ .diagram loading=lazy }

## Los workflows

| Repositorio | Workflow | Disparador | Qué hace |
|---|---|---|---|
| `tiles-processor` | `ci.yml` | Push y pull request | Lockfile, escaneo de secretos, y —suprimidos— lint, tipos y pruebas |
| `tiles-processor` | `deploy.yml` | Push a `main` | Llama a `ci.yml` y despliega |
| `tiles-processor` | `security.yml` | Semanal y push a `main` | Trivy, sólo informe |
| `data-service` | `test.yml` | Push y pull request | Escaneo de secretos y pruebas |
| `data-service` | `deploy.yml` | Push a `main` | Pruebas, Trivy y despliegue |
| `alerts-service` | `test.yml` | Push y pull request | Escaneo de secretos y pruebas |
| `alerts-service` | `deploy.yml` | Push a `main` | Pruebas, Trivy y despliegue |
| `visualizer` | `test.yml` | Push y pull request | Escaneo de secretos y pruebas no bloqueantes |
| `visualizer` | `deploy.yml` | Push a `main` | Pruebas, Trivy y despliegue |

## Qué bloquea de verdad un despliegue

Esta es la parte que conviene leer con atención, porque la intención aparente y el efecto real no
coinciden.

!!! warning "En `tiles-processor` la compuerta de CI está en verde por construcción"
    Los trabajos `lint`, `type-check` y `unit-tests` llevan `if: false` con un comentario que los
    marca como suprimidos temporalmente. El trabajo agregador declara `if: always()`, así que corre
    igual, y su condición de fallo recorre los resultados buscando literalmente `failure` o
    `cancelled`. Un trabajo salteado reporta `skipped`, que no coincide con ninguno de los dos, de
    modo que la compuerta pasa. El workflow de despliegue depende de esa compuerta, y por lo tanto
    despliega. Lo único que efectivamente verifica ese repositorio es `poetry check --lock` y el
    escaneo de secretos.

!!! warning "Trivy no bloquea ningún despliegue en ningún repositorio"
    En los tres repositorios de la generación anterior, el trabajo de escaneo de imagen **no** figura
    entre las dependencias del trabajo de despliegue: corre en paralelo. Un hallazgo crítico pone el
    workflow en rojo *después* de que la aplicación ya se desplegó. En `tiles-processor` el escaneo
    vive directamente en otro workflow. El único escáner que puede detener una entrega es gitleaks.

Resumiendo qué compuerta es efectiva:

| Repositorio | Bloquea el despliegue |
|---|---|
| `tiles-processor` | Lockfile y secretos |
| `data-service` | Secretos y pruebas |
| `alerts-service` | Secretos y pruebas |
| `visualizer` | Secretos solamente; las pruebas son no bloqueantes |

## La secuencia de despliegue

Idéntica en los cuatro repositorios:

1. GET al webhook de despliegue con un token bearer, con un tope de 30 segundos.
2. Validación de la respuesta y extracción del identificador del despliegue.
3. Sondeo del estado hasta 600 segundos. Hay dos retrocesos: en el camino normal el intervalo crece
   de a 2 segundos hasta un techo de 10; ante errores de la API se duplica y se aborta tras tres
   fallos seguidos.
4. Chequeo de salud de la aplicación durante 60 segundos, cada 3.
5. Ante fallo, un paso condicional vuelca los registros.

!!! note "Dos salidas blandas"
    Si el chequeo de salud agota su tiempo, el trabajo termina en éxito de todos modos. Y un
    despliegue marcado como reinicio se saltea los chequeos por completo. En ambos casos, un workflow
    verde no prueba que la aplicación haya quedado sana.

### Secretos

| Nombre | Para qué |
|---|---|
| `COOLIFY_DEPLOY_HOOK` | URL del webhook |
| `COOLIFY_DEPLOY_TOKEN` | Token bearer del webhook |
| `COOLIFY_BASE_URL` | Base de la API para el sondeo |
| `COOLIFY_READ_TOKEN` | Token de lectura de despliegues y aplicaciones |

## Dos generaciones conviviendo

| Aspecto | `tiles-processor` | Los otros tres |
|---|---|---|
| Workflows | `ci.yml` + `deploy.yml` + `security.yml` | `test.yml` + `deploy.yml` |
| Acción de checkout | v7 | v4 |
| gitleaks | 8.30.1, fijado por versión y suma SHA-256 | Descargado desde la última publicación, sin verificar |
| Trivy | 0.72.0, fijado por versión y suma | 0.70.0, descargado sin verificar |
| Escaneo de vulnerabilidades | Workflow propio, semanal | Dentro del despliegue |
| Entorno de Poetry | Cacheado con una acción compuesta | Instalado en cada corrida |

!!! note "Poetry se fija en las imágenes pero no en CI"
    Los `Dockerfile` fijan Poetry 2.3.2. Los tres workflows de la generación anterior lo instalan con
    `pip install poetry` sin restricción de versión, de modo que la versión de CI puede desplazarse
    sola respecto de la de las imágenes.

## Construcción de las imágenes

| Repositorio | Etapas |
|---|---|
| `tiles-processor` | Dos, sobre la imagen de GDAL |
| `data-service` | Dos, sobre `python:3.13-slim-trixie` |
| `alerts-service` | Dos, con `entrypoint.sh` que migra antes de arrancar |
| `visualizer` | Tres: documentación, compilación y nginx |

!!! warning "El orden de las etapas del visualizador es funcional"
    La documentación compilada se copia a `public/docs-site` **después** de `COPY . .`, para que el
    contexto no la tape, y **antes** de `npm run build`, para que el glob de recursos de
    `angular.json` la incluya. Invertir cualquiera de las dos relaciones produce una imagen sin
    documentación, y sin error. La etapa de documentación además copia `hooks/`, referenciado desde
    `mkdocs.yml`: sin ese directorio la compilación falla.

Ver [Despliegue e infraestructura](../arquitectura/despliegue.md) para la topología, y
[Pruebas y calidad](pruebas.md) para el detalle de las suites.

!!! warning "Sin verificar"
    Tres cuestiones de la configuración de entrega no pudieron resolverse leyendo los repositorios:

    - El comentario que acompaña a `if: false` en los tres trabajos suprimidos de `tiles-processor`
      dice «temporal» pero no referencia ningún issue ni fecha, así que no hay forma de saber qué
      condición los reactivaría ni desde cuándo están apagados.
    - La protección de rama del repositorio no vive en el árbol de código, de modo que no se pudo
      comprobar si la compuerta de CI está efectivamente exigida como verificación obligatoria.
    - El archivo de excepciones de Trivy de `data-service` tiene entradas cuya fecha de vencimiento
      ya pasó. No se verificó qué hace Trivy con una excepción vencida: si vuelve a reportar esas
      vulnerabilidades o si las sigue ignorando.
