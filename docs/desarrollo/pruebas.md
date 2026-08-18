---
title: Pruebas y calidad
---

# Pruebas y calidad

Los cuatro repositorios tienen suite de pruebas, pero no todos las hacen valer igual. Esta página
documenta qué existe, cómo se corre y —lo que más se malinterpreta— qué bloquea de verdad un
despliegue.

## Las suites

| Repositorio | Ubicación | Archivos | Pruebas | Cómo se corre | ¿Bloquea el despliegue? |
|---|---|---|---|---|---|
| `tiles-processor` | `tests/` | 59 | 644 | `make test` (pytest en el host) | **No** |
| `data-service` | `tests/`, `tests/application/` | 50 | 715 | `make test` (Docker) | Sí |
| `alerts-service` | `tests/unit/`, `tests/application/` | 28 | 181 | `make test` (Docker) | Sí |
| `visualizer` | `*.spec.ts` junto al código | 46 | 445 | `npm test` (Vitest) | **No** |

Los conteos salen de contar archivos versionados y definiciones de prueba en ellos.

!!! warning "En `tiles-processor` las pruebas no corren en CI"
    Los trabajos `lint`, `type-check` y `unit-tests` de su workflow llevan `if: false` con un
    comentario que los marca como suprimidos temporalmente. El trabajo agregador que hace de compuerta
    sigue pasando porque sólo falla ante resultados `failure` o `cancelled`, y un trabajo salteado
    reporta `skipped`, que no es ninguno de los dos. El resultado es que la compuerta queda en verde
    y el despliegue sigue adelante. Lo único que realmente se verifica en ese repositorio es la
    coherencia del lockfile y el escaneo de secretos.

!!! warning "En `visualizer` las pruebas nunca bloquean"
    El paso que corre `npm run test` lleva `continue-on-error: true`, así que una prueba en rojo se
    ve en el registro del workflow pero no detiene nada.

## Cómo correr cada una

### tiles-processor

```
make test
```

Corre pytest directamente en el host, así que hace falta un entorno virtual activado con las
dependencias instaladas. Es el único de los tres repositorios en Python que no usa Docker para las
pruebas.

### data-service y alerts-service

```
make test
```

Construyen `Dockerfile.run_test` y corren pytest adentro, con los informes montados en `reports/`.

!!! note "El camino local y el de CI no son el mismo"
    `make test` usa Docker, pero CI **no**: instala las dependencias con Poetry directamente sobre el
    runner y corre pytest ahí. Los dos caminos difieren en detalles de instalación y en que CI no
    monta el `settings.json` en `/config`. Una prueba que dependa de ese archivo puede pasar local y
    fallar en CI, o al revés.

### visualizer

```
npm test
```

Vitest, con los archivos de prueba junto al código que ejercitan.

## Aislamiento

`data-service` y `alerts-service` corren con los sockets deshabilitados salvo hacia `127.0.0.1`, de
modo que una prueba que intente salir a la red falla en lugar de colgarse o de depender de un
servicio externo. `alerts-service` además usa modo asincrónico automático.

`tiles-processor` no tiene configuración de pytest en su manifiesto: no deshabilita sockets y resuelve
las importaciones insertando la ruta en `sys.path` desde su `conftest.py`.

!!! note "El marcador `not skip` no excluye nada hoy"
    El comando de `tiles-processor` filtra por `-m "not skip"`, pero ningún repositorio usa ese
    marcador. Hay dos usos de `skipif`, que es otra cosa y no se ve afectada por el filtro.

## Cobertura

Se mide en los repositorios de Python y se emite en `reports/`, en formato de término y HTML. En el
visualizador no se mide en absoluto.

!!! note "No hay umbral en ninguna parte"
    Ningún repositorio configura un mínimo de cobertura. La cobertura se informa, no se exige.

## Análisis estático

| Herramienta | tiles-processor | data-service | alerts-service | visualizer |
|---|---|---|---|---|
| `black` | pre-commit | pre-commit | pre-commit | — |
| `pylint` | pre-commit | pre-commit | pre-commit | — |
| `mypy` | pre-commit | pre-commit | pre-commit | — |
| Prettier | — | — | — | Configurado, no instalado |
| CI que lo exija | Suprimido | No | No | No |

Los tres repositorios en Python comparten el mismo gancho:

```
make precommit
```

que equivale a `pre-commit run --all-files`.

!!! warning "El análisis estático está configurado pero no se exige en ningún lado"
    En los tres repositorios en Python las herramientas corren sólo desde pre-commit, es decir en la
    máquina de quien programa y sólo si instaló el gancho. En `tiles-processor` los trabajos de CI
    que las ejecutaban están suprimidos; en los otros dos nunca existieron. El visualizador declara
    configuración de Prettier en su `package.json` pero el paquete no está instalado, y no tiene ni
    pre-commit ni trabajo de formato en CI.

!!! note "Las versiones fijadas de `pylint` y `mypy` no se respetan"
    Sus ganchos de pre-commit usan `language: system`, lo que hace que se ejecute la versión del
    entorno virtual en lugar de la revisión fijada en la configuración. Sólo `black` corre la versión
    que declara.

## Referencias muertas

Dos apuntadores del repositorio ya no resuelven, y conviene saberlo antes de perseguirlos:

- `alerts-service` define un objetivo `make test-api` que apunta a un archivo de pruebas de
  integración que fue eliminado.
- `visualizer` declara un directorio de fixtures como recurso de compilación en `angular.json`, pero
  ese directorio no existe.

Ver [CI/CD y despliegue](ci-cd.md) para el detalle de qué workflow ejecuta cada cosa.
