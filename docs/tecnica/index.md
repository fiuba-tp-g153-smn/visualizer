---
title: Documentación técnica
---

# Documentación técnica

MapaSMN es un sistema de visualización y aviso por condiciones meteorológicas extremas. **Toma datos
crudos de satélite, radar y modelos numéricos, los convierte en teselas de mapa y los sirve por HTTP.**
Sobre ese mapa, un pronosticador dibuja un polígono y emite un aviso a corto plazo.

Esta mitad está escrita para **quien tiene que instalar, conectar, dimensionar y proteger el
sistema**. No describe código. Describe unidades desplegables, puertos, volúmenes, contratos y
fallas. Quien lo use como herramienta tiene su propio [manual](../manual/index.md).

!!! danger "Si se va a exponer a una red, empezar por el capítulo 19"
    **Ningún servicio autentica al llamante**, salvo las rutas de estaciones y una ruta de escritura
    de métricas. Las plantillas de despliegue **publican en todas las interfaces** varios puertos
    que no deberían salir del host. El sistema se puede desplegar, pero no tal cual.
    Los cambios están en [Endurecimiento](seguridad/endurecimiento.md).

![Contexto del sistema: los cuatro servicios y lo que cruza cada frontera](../imgs/diagrams/sistema-contexto.svg){ .diagram loading=lazy }

## Los cuatro servicios

Son **cuatro repositorios independientes**, con su propia imagen y su propio despliegue. **No
comparten base de datos ni código.** Se comunican por un almacén de objetos compatible con S3 y por
HTTP.

| Servicio | Qué hace | Unidades desplegables | Escucha en |
|---|---|---|---|
| `tiles-processor` | Descarga los datos crudos y produce teselas WebP, COG y GeoJSON en el bucket `tiles-data`. | `rabbitmq`, `seaweedfs`, `producer`, `worker1`, `worker2`, `worker-light1..3`, `metrics-api` | `6020` (métricas), `9000` (S3), `5672`, `15672`, `8888`, `9333`, `23646` |
| `data-service` | Sincroniza `tiles-data` en Redis y sirve teselas, mapas base y estaciones al navegador. | `redis`, `data-service-api`, `data-service-sync` | `6006` |
| `alerts-service` | Interseca el polígono con el territorio y genera el aviso con sus dos imágenes. | `alerts-mysql`, `alerts-service-container` | `6007`, `3306` |
| `visualizer` | La aplicación web y este sitio, servidos por nginx. | `visualizer-container` | `6010` |

**Los puertos son los valores de ejemplo** de cada `.env.example`. **Todos se publican en todas las
interfaces** tal como están escritas las plantillas; el capítulo 19.1 dice cuáles deben cerrarse.

## Qué habla con qué

**El diagrama de arriba muestra las fronteras.** Lo que importa para operar es **qué mecanismo cruza
cada una**:

| Origen | Destino | Mecanismo |
|---|---|---|
| `tiles-processor` | `data-service` | El bucket `tiles-data`. Uno escribe, el otro lee. No hay HTTP entre ellos. |
| Navegador | `data-service`, `alerts-service`, `metrics-api` | HTTP directo. **El visualizador no hace de proxy.** |
| `alerts-service` | Base MySQL del SMN | Una fila en la tabla `taviso_temporal`. |
| `data-service` | API del SMN, IGN, Esri, Google | HTTP saliente, para estaciones y respaldo de mapas base. |
| `alerts-service` | IGN | WFS saliente, para los límites administrativos. |

**El broker de mensajes es interno** a `tiles-processor`. **Redis es interno** a `data-service`.
Ninguno de los dos cruza una frontera entre servicios.

## Cómo está organizada esta mitad

**Los capítulos van de lo general a lo concreto.** **Se pueden leer en orden o entrar por el problema.**

| Si hay que… | Ir a |
|---|---|
| Entender por qué está armado así | [9. Decisiones de arquitectura](decisiones.md) |
| Seguir un dato de la fuente al navegador | [10. Cómo fluyen los datos](flujo-de-datos.md) |
| Conocer cada servicio por dentro, como unidad desplegable | [11. Los servicios](servicios/index.md) |
| Consultar una ruta, una variable o un prefijo del bucket | [12. Contratos entre servicios](contratos/index.md) |
| Decidir dónde va el firewall | [13. Topología de red](operacion/topologia.md) |
| Levantarlo por primera vez | [14. Puesta en marcha](operacion/puesta-en-marcha.md) |
| Repartirlo en más de una máquina | [15. Distribuir el sistema](operacion/distribucion.md) |
| Dimensionar RAM, CPU y disco | [16. Capacidad y dimensionamiento](operacion/capacidad.md) |
| Saber cómo llega un cambio a producción | [17. Despliegue y entrega continua](operacion/despliegue.md) |
| Saber qué se mide y qué se verifica | [18. Observabilidad y verificación](operacion/observabilidad.md) |
| Decidir si es seguro exponerlo | [19. Seguridad](seguridad/index.md) |

## Convenciones

- **Nombres de contenedores, puertos, variables, colas y buckets** aparecen tal como están en el
  código, en `monoespaciado`. Un nombre que no aparece así es una descripción, no un identificador.
- **Los comandos son los que teclea quien opera.** No hay fragmentos de código de aplicación.
- **Nunca se muestra un valor secreto.** La fuente de cada variable es el `.env.example` de su
  repositorio.
- Lo que no pudo verificarse leyendo el código lleva un recuadro **Sin verificar** con la pregunta
  abierta.
