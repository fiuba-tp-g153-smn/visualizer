---
title: Decisiones de arquitectura
---

# Decisiones de arquitectura

Por qué el sistema está armado como está. Cada decisión trae su contexto, lo que se resolvió y lo que
se paga por haberlo resuelto así. Es la página que conviene leer antes de proponer un cambio
estructural: varias de estas decisiones parecen arbitrarias hasta que se conoce el problema que
resuelven.

## Cuatro servicios independientes en lugar de uno

**Contexto.** Los cuatro componentes tienen ritmos y perfiles de recurso muy distintos: uno procesa
archivos geoespaciales pesados por lotes, otro atiende peticiones cortas, otro hace cálculo
geométrico bajo demanda y otro es una aplicación de navegador.

**Decisión.** Cuatro repositorios independientes, con su propio ciclo de vida y su propio despliegue.
No comparten base de datos ni código. El acoplamiento es por almacén de objetos y por HTTP.

**Consecuencia.** Cada uno escala y se despliega solo, y un problema de memoria en el procesamiento no
afecta la latencia de la API. A cambio, no hay refactorización atómica entre servicios: un cambio de
contrato requiere coordinar dos repositorios, y hay duplicación deliberada de código de
infraestructura.

## Un almacén de objetos como costura principal

**Contexto.** La generación de productos es asíncrona y periódica; el consumo es sincrónico y bajo
demanda.

**Decisión.** Un almacén compatible con S3 en el medio. El procesador escribe cuando termina; el
servicio de datos lee cuando un usuario mira el mapa.

**Consecuencia.** Los dos ritmos quedan desacoplados sin compartir sistema de archivos ni base de
datos. El costo es que el almacén se vuelve el único punto de falla compartido, y que su
disponibilidad condiciona el arranque del servicio de datos.

**Lo que se compró además**: el código está escrito contra la API de S3, no contra una implementación
concreta, así que el almacén es intercambiable. Lo que corre es SeaweedFS.

## Las colas son internas a un solo servicio

**Contexto.** Sería tentador usar el broker como bus de integración entre los cuatro servicios.

**Decisión.** El broker existe **solamente** dentro del procesador de mosaicos, para coordinar su
esquema productor-consumidor. Ningún otro servicio publica ni consume de esas colas.

**Consecuencia.** El contrato entre servicios queda en dos lugares únicamente —el almacén de objetos y
HTTP—, que son mucho más fáciles de razonar, inspeccionar y reemplazar que una topología de colas
compartida. El broker es un detalle interno de un servicio, no una pieza del sistema.

## Los trabajadores toman trabajo, no lo reciben

**Contexto.** Un trabajador que procesa archivos geoespaciales puede tardar minutos en una sola
unidad, con consumos de memoria muy dispares.

**Decisión.** Los trabajadores piden un mensaje explícitamente cuando están listos, en lugar de que el
broker se los empuje. La ventana de mensajes en vuelo no está configurada.

**Consecuencia.** Ningún trabajador acapara mensajes que no va a poder procesar, y el reparto se
adapta solo a la velocidad real de cada uno. A cambio, el broker no aporta control de flujo: la
concurrencia la fija enteramente la cantidad de trabajadores y su paralelismo interno.

## Un subproceso aislado por unidad de trabajo

**Contexto.** Las bibliotecas geoespaciales fragmentan el montículo de una manera que el proceso no
devuelve al sistema operativo. Un trabajador de larga vida crecería sin parar aunque no tuviera
ninguna fuga de memoria propia.

**Decisión.** Cada unidad de trabajo corre en su propio subproceso, con tiempo límite, y el proceso se
descarta al terminar.

**Consecuencia.** La memoria vuelve de verdad al sistema, y de paso una unidad que falla
catastróficamente no se lleva puesto al trabajador. El costo es el arranque de un proceso por unidad,
despreciable frente al tiempo de procesamiento.

Es la decisión menos evidente del sistema y la que más conviene no deshacer sin entender el motivo.

## Reintentos en la aplicación, no en el broker

**Contexto.** El mecanismo de reentrega del broker reintenta sin dejar rastro de cuántas veces lo
hizo.

**Decisión.** Un fallo se maneja volviendo a publicar el mensaje con su contador de intentos
incrementado, y al agotarse pasa a una cola de descarte.

**Consecuencia.** La cantidad de intentos es visible e inspeccionable, y el descarte es explícito. El
sistema puede reportar cuántos trabajos se descartaron, que es justamente lo que se mira en el panel
de estado.

## Una imagen con dos roles para el servicio de datos

**Contexto.** El mismo servicio tiene que atender peticiones con latencia baja y, a la vez, ejecutar
ciclos de sincronización que consumen CPU.

**Decisión.** Una sola imagen que se despliega como dos contenedores con roles distintos, elegidos por
variable de entorno.

**Consecuencia.** La latencia de las peticiones no compite con la CPU de la sincronización, sin
duplicar código ni cadena de compilación.

## El servicio de avisos no escribe directamente el aviso definitivo

**Contexto.** La base de datos donde vive el aviso pertenece al SMN, no a este sistema.

**Decisión.** El servicio escribe en una tabla intermedia, marcada como no procesada. Un servicio del
propio organismo la promueve al registro definitivo.

**Consecuencia.** El límite de responsabilidad queda explícito: este sistema propone, el organismo
dispone. Es también la razón por la que el sistema no difunde avisos.

!!! danger "El punto que hay que verificar antes de exponer nada"
    Esa separación protege el sistema **si la promoción no es desatendida**. Si lo es, la distinción
    entre proponer y disponer desaparece, y como la ruta que crea el aviso no pide credencial alguna,
    una petición anónima equivale a un aviso oficial. Es la primera pregunta de
    [Endurecimiento](seguridad/endurecimiento.md).

## Arquitectura hexagonal en el servicio de avisos

**Contexto.** Es el servicio con más integraciones externas: una base de datos que no controla, una
API de terceros, un almacén de objetos, generación de imágenes.

**Decisión.** Puertos y adaptadores, con la lógica de negocio aislada de todas ellas.

**Consecuencia.** Las integraciones son sustituibles y comprobables por separado, que es exactamente
lo que hace falta cuando la mitad de lo que te rodea pertenece a otro. Es más estructura de la que un
servicio de este tamaño necesitaría si no tuviera esas fronteras.

## La configuración del visualizador se hornea al compilar

**Contexto.** El visualizador es una aplicación de navegador servida como archivos estáticos.

**Decisión.** Las direcciones de los servicios se incrustan en el paquete durante la compilación, en
lugar de leerse en tiempo de ejecución desde un servidor de configuración.

**Consecuencia.** No hace falta ningún servicio de configuración ni una petición extra al arrancar la
aplicación, y **ningún secreto puede terminar en el navegador por accidente**, porque lo único que se
inyecta son direcciones. El costo es real y sorprende a quien despliega por primera vez: **cambiar una
dirección obliga a reconstruir la imagen**.

## Sin Kubernetes

**Contexto.** Cuatro stacks, un puñado de contenedores, un equipo chico.

**Decisión.** Docker Compose sobre servidores, detrás de un proxy inverso, con despliegue disparado
por webhook desde integración continua.

**Consecuencia.** La operación es entendible por una sola persona y no hay plano de control que
mantener. A cambio no hay reprogramación automática ni escalado horizontal: si un host se cae, hay que
intervenir.

## La documentación viaja dentro de la aplicación

**Contexto.** Este sitio tiene que estar disponible junto a la aplicación, sin infraestructura extra.

**Decisión.** Se compila dentro de la imagen del visualizador y se sirve desde el mismo servidor web,
en el mismo origen, embebido en un marco.

**Consecuencia.** Un solo artefacto para desplegar, y la documentación nunca queda desfasada respecto
de la versión de la aplicación. El costo está en el mismo origen: el contenido del sitio queda dentro
del límite de confianza de la aplicación, con acceso al almacenamiento del navegador. Aislarlo
rompería la sincronización de la URL con la página que se está leyendo.

## Los diagramas se versionan renderizados

**Contexto.** Los diagramas se escriben en un lenguaje de texto que requiere su propia herramienta
para renderizarse.

**Decisión.** Los SVG resultantes se versionan, y la compilación de la documentación no depende de la
herramienta.

**Consecuencia.** Ni la integración continua ni la etapa que construye el sitio necesitan instalar una
cadena de herramientas adicional. El costo es tener que acordarse de regenerar al editar un diagrama,
mitigado con un objetivo del Makefile.

## Las plantillas de despliegue del procesador son generadas

**Contexto.** La cantidad de trabajadores es un parámetro de dimensionamiento que cambia entre
despliegues, y cada trabajador es un bloque casi idéntico.

**Decisión.** Un script genera las plantillas a partir de esa cantidad.

**Consecuencia.** Cambiar el dimensionamiento es un comando en vez de una edición repetitiva y
propensa a errores. El costo es que **una edición manual se pierde en la próxima regeneración**, y hoy
la plantilla versionada difiere de lo que el script produce.
