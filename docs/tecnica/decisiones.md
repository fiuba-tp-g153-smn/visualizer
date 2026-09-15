---
title: 9. Decisiones de arquitectura
---

# 9. Decisiones de arquitectura

Las decisiones de arquitectura responden a dos condiciones del proyecto. Los cuatro componentes
tienen cargas y ritmos distintos, mientras que el procesamiento geoespacial puede utilizar varios
gigabytes de memoria por trabajo. Este capítulo registra las soluciones adoptadas y los costos que
introduce cada una.

![Qué decisión obliga a cuál: dos raíces y lo que cada una fuerza](../imgs/diagrams/decisiones-mapa.svg){ .diagram loading=lazy }

## Cuatro servicios independientes

Los componentes tienen ritmos distintos. Uno procesa archivos pesados por lotes. Otro
atiende peticiones cortas. Otro hace cálculo geométrico bajo demanda. Otro corre en el navegador.

Cuatro repositorios y cuatro imágenes, con contratos explícitos entre ellos. No
comparten base de datos ni código. Cada componente puede desplegarse solo; el meta-repositorio
`mapasmn` puede además fijar las cuatro revisiones y desplegarlas como una unidad.

Cada uno escala y puede entregarse solo. Un problema de memoria en el procesamiento
no afecta la latencia de la API. A cambio, un cambio de contrato exige coordinar dos repositorios.
Cuando se usa `mapasmn`, actualizar el puntero de cada submódulo convierte esa coordinación en una
versión integrada y reproducible.

## Un perfil integrado para una máquina chica

La autonomía de los componentes no resuelve por sí sola cómo instalar el sistema
completo en una VM con 8 GB ni qué combinación de productos cabe allí.

Beta-1 conserva los cuatro componentes y las fuentes reales, pero fija un worker normal,
uno liviano y un catálogo reducido en archivos propios. `mapasmn` los levanta con un solo `.env` y un
solo proyecto Compose.

La versión desplegada queda explícita y el camino inicial se reduce a un único
procedimiento. El perfil no escala automáticamente ni impone límites de memoria: habilitar productos
o workers fuera de él invalida el dimensionamiento. Ver [14.1 Beta-1](operacion/beta-1.md).

## Un almacén de objetos como costura

La generación es asíncrona y periódica. El consumo es sincrónico y bajo demanda.

Un almacén compatible con S3 en el medio. El procesador escribe cuando termina. El
servicio de datos lee cuando alguien mira el mapa.

Los dos ritmos quedan desacoplados sin compartir disco ni base. El costo es que
el almacén es el único punto de falla compartido. Su disponibilidad condiciona el arranque del
servicio de datos, que lo comprueba antes de responder.

Lo que corre es SeaweedFS. El código habla la API de S3, así que el almacén es reemplazable por
otro compatible. Ver [12.3 Almacenamiento y colas](contratos/almacenamiento.md).

## El broker es interno a un solo servicio

Sería tentador usar el broker como bus entre los cuatro servicios.

RabbitMQ existe solamente dentro de `tiles-processor`, para su esquema
productor-consumidor. Nadie más publica ni consume.

El contrato entre servicios vive en dos lugares: el almacén y HTTP. Son fáciles
de inspeccionar y de reemplazar. El broker es un detalle de un servicio, no una pieza del sistema.

## HTTP directo desde el navegador

El visualizador se sirve como archivos estáticos.

El navegador llama directamente al servicio de datos, al de avisos y al de métricas.
El servidor web del visualizador no hace de proxy.

No hay un componente extra en el camino de cada tesela. El costo es operativo:
hay que publicar tres puertos además del visualizador, y las direcciones se fijan al compilar.

## Un subproceso por unidad de trabajo

Las bibliotecas geoespaciales fragmentan el montículo. El proceso no devuelve esa
memoria al sistema operativo. Un worker de larga vida crecería sin fin, aun sin fugas propias.

Cada unidad de trabajo corre en un subproceso con tiempo límite. El proceso se
descarta al terminar.

La memoria vuelve de verdad. Una unidad que revienta no se lleva al worker. El costo
es arrancar un proceso por unidad, despreciable frente al procesamiento.

Es la decisión menos evidente del sistema. No hay que deshacerla sin entender el motivo. Hay una
excepción documentada: los descargadores de GRIB corren en el proceso principal, porque sólo
descargan. Ver [11.1 Tiles Processor](servicios/tiles-processor.md).

## Colas pesadas y colas livianas

Una captura de la banda visible del satélite cuesta gigabytes. Un producto de radar
cuesta poco y hay cientos por hora.

Tres colas de trabajo y dos tipos de worker. Los trabajos caros van a una cola
propia, que sólo atienden los workers pesados.

El sistema no tiene que limitar la concurrencia global al peor caso. Sin las colas
livianas, no alcanzaría a drenar el volumen de radar y WRF.

## Los workers toman trabajo, no lo reciben

Una unidad puede tardar minutos, con memoria muy dispar.

Cada worker pide un mensaje cuando está listo. No hay ventana de mensajes en vuelo
configurada en el broker.

Nadie acapara trabajo que no puede procesar. A cambio, el broker no frena nada:
la concurrencia la fija la cantidad de workers y su paralelismo interno.

## Reintentos en la aplicación, no en el broker

La reentrega del broker no deja rastro de cuántas veces reintentó.

Un fallo vuelve a publicar el mensaje con su contador incrementado. Agotado el
contador, el mensaje va a una cola de descarte.

La cantidad de intentos es visible y el descarte es explícito. El panel de estado
puede contar cuántos trabajos se descartaron.

## Una imagen con dos roles

El servicio de datos tiene que responder con baja latencia y, a la vez, sincronizar.

Una sola imagen, dos contenedores. `APP_ROLE=web` atiende HTTP. `APP_ROLE=worker`
sincroniza.

La latencia no compite con la CPU de la sincronización. Los dos roles pueden
estar en máquinas distintas sin cambiar la imagen. Ver [15. Distribuir el sistema](operacion/distribucion.md).

## El aviso no se escribe en el registro definitivo

La base donde vive el aviso pertenece al SMN.

El servicio escribe en una tabla intermedia, marcada como no procesada. Un proceso del
organismo la promueve al registro definitivo.

Este sistema propone; el organismo dispone. Es también la razón por la que el
sistema no difunde avisos.

!!! danger "Lo que hay que verificar antes de exponer nada"
    Esa separación protege sólo si la promoción no es desatendida. La ruta que crea el aviso
    no pide credencial alguna. Si la promoción es automática, una petición anónima equivale a un
    aviso oficial. Es la primera pregunta de [19.3 Endurecimiento](seguridad/endurecimiento.md).

## La configuración del visualizador se hornea al compilar

El visualizador es una aplicación de navegador servida como estáticos.

Las direcciones de los servicios se incrustan en el paquete durante la compilación.

No hace falta un servicio de configuración. Ningún secreto puede terminar en el
navegador, porque sólo se inyectan direcciones. El costo sorprende a quien despliega por primera
vez: cambiar una dirección obliga a reconstruir la imagen.

## Docker Compose sobre un VPS, sin Kubernetes

Cuatro componentes, un puñado de contenedores, un equipo chico. Y un requisito duro:
memoria siempre disponible. Una máquina efímera no sirve para este procesamiento.

Compose sobre un servidor virtual siempre activo, detrás de un proxy inverso. Los
componentes pueden desplegarse por webhook de forma independiente; Beta-1 usa el proyecto integrado
de `mapasmn` en una VM de 8 GB.

La operación cabe en una persona. No hay reprogramación automática ni escalado
horizontal: si el host cae, hay que intervenir. Las plantillas nacieron para una máquina; el
capítulo 15 explica qué cuesta repartirlas.

## Las plantillas del procesador son generadas

La cantidad de workers cambia entre despliegues, y cada worker es un bloque casi
idéntico.

Un script genera las plantillas a partir de esa cantidad.

Cambiar el dimensionamiento es un comando. El costo: una edición manual se pierde
en la próxima regeneración. Hoy la plantilla versionada de producción difiere de lo que el
script produce. Ver [11.1 Tiles Processor](servicios/tiles-processor.md).

## La documentación viaja dentro de la aplicación

Este sitio tiene que estar junto a la aplicación, sin infraestructura extra.

Se compila dentro de la imagen del visualizador y se sirve desde el mismo servidor web,
en el mismo origen, embebido en un marco.

Un solo artefacto para desplegar. La documentación nunca queda desfasada de la
versión de la aplicación. El costo: el contenido del sitio queda dentro del límite de confianza de la
aplicación. Ver [19.1 Superficie expuesta](seguridad/superficie.md).

## Los diagramas se versionan renderizados

Los diagramas se escriben como texto y necesitan una herramienta para renderizarse.

Cada diagrama es un archivo fuente colocado a mano, más su SVG y su PNG versionados.
La compilación del sitio no depende de la herramienta.

Ni la integración continua ni la imagen del visualizador instalan nada extra. El
costo es acordarse de regenerar al editar, con un objetivo del Makefile que lo hace de una vez.
