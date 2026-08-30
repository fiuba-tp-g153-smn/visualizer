---
title: Capacidad y dimensionamiento
---

# Capacidad y dimensionamiento

Qué acota el consumo de cada servicio, qué pasa cuando algo se satura y qué hay que medir antes de
fijar límites. La página no da un tamaño de servidor: da los parámetros con los que calcularlo para
un despliegue concreto.

!!! warning "Ningún contenedor tiene límite de recursos"
    Es el hecho estructural de esta página. No hay límite de memoria ni de CPU declarado en ninguna
    de las plantillas de despliegue del sistema. La única acotación que existe es la memoria máxima
    de la caché, configurada en su propio proceso.

    La consecuencia es que **los servicios no están aislados entre sí**: un trabajador que crece sin
    control no falla él, hace que el sistema operativo elija una víctima, y esa víctima puede ser la
    base de datos o la caché. Poner límites es lo que convierte una falla de un componente en una
    falla de ese componente.

## Procesador de mosaicos

Es el servicio que más recursos consume, porque es el que abre y reproyecta archivos de datos
geoespaciales.

### Qué acota la concurrencia

| Mecanismo | Efecto |
|---|---|
| Cantidad de trabajadores | Cinco contenedores: dos pesados y tres livianos, con colas separadas |
| Concurrencia por trabajador | Dos unidades de trabajo simultáneas por defecto |
| Un subproceso aislado por unidad | Cada unidad corre en su propio proceso, con un tope de 30 minutos |
| Semáforos de acceso al almacén | Acotan las transferencias simultáneas |
| Descarga en flujo a disco | Los archivos grandes no se cargan enteros en memoria |

El subproceso aislado por unidad no es sólo un aislamiento de fallas: es **la estrategia de
recuperación de memoria del sistema**. Las bibliotecas geoespaciales fragmentan el montículo de una
manera que el proceso no devuelve al sistema operativo, así que el proceso se descarta al terminar la
unidad y la memoria vuelve de verdad. Es la razón por la que un trabajador de larga vida no crece
indefinidamente.

### Qué pasa si aparecen muchos datos de golpe

No hay estampida. El descubrimiento está **acotado por ciclo**: cada pasada considera un tope de
imágenes por producto —del orden de dos docenas para satélite y una docena para radar y para los
pasos de modelo—, y la pasada corre cada cinco minutos. Un origen con miles de objetos nuevos produce
**retraso**, no un pico de memoria: el trabajo se procesa en pasadas sucesivas y lo que no llega a
tiempo expira.

El riesgo real no es el volumen sino **un archivo patológico**: uno solo, suficientemente grande o
mal formado, puede inflar el uso de memoria de la biblioteca geoespacial hasta agotar el host. De ahí
que el límite de memoria por contenedor sea la protección que falta.

!!! note "Las colas no tienen control de flujo"
    Los trabajadores toman mensajes de a uno por consulta explícita, y no está configurada la ventana
    de mensajes en vuelo del broker. En la práctica la concurrencia la fija la cantidad de
    trabajadores y su paralelismo interno, no el broker. Es un diseño deliberado —evita que un
    trabajador acapare mensajes que no va a poder procesar— pero significa que el broker no ayuda a
    frenar.

### Para dimensionar

1. Medir el pico de memoria residente de un trabajador procesando el producto más pesado del
   despliegue.
2. Multiplicar por la concurrencia interna del trabajador.
3. Dejar margen, y fijar ahí el límite de memoria del contenedor.
4. Repetir por separado para los trabajadores livianos, que procesan productos más chicos y pueden
   ir bastante más ajustados.

Para cambiar la cantidad de trabajadores no se editan las plantillas a mano: se regeneran con el
script que las produce, que recibe ese número como argumento. Una edición manual sobrevive hasta la
próxima regeneración.

## Servicio de datos

Es el que recibe el tráfico de los usuarios.

| Aspecto | Estado |
|---|---|
| Límite de peticiones por cliente | **No hay ninguno** |
| Costo de una petición que falla en caché | Una consulta a la caché más una al almacén de objetos |
| Transferencias salientes simultáneas | **Sin semáforo** en la descarga de teselas |
| Crecimiento de la caché | No lo controla el atacante: sólo se escribe cuando el almacén responde, y siempre con expiración |

Dos particularidades importantes:

**Los mapas base no se cachean.** Están configurados para relevo directo, así que **cada petición de
mapa base se traduce en una petición al proveedor externo**. Está acotada por un plazo de respuesta de
pocos segundos, un semáforo de ocho en paralelo y agrupación de peticiones idénticas, pero es la ruta
que más tráfico saliente genera por usuario.

**Las consultas de valor puntual ocupan un hilo** del pool de ejecución mientras hacen una lectura
parcial del archivo remoto, sin tiempo límite configurado en la biblioteca geoespacial. Es la ruta con
más potencial de acumular peticiones si el almacén se pone lento.

La memoria de la caché está fijada en su propio proceso, con expulsión por vencimiento. Es el único
componente del sistema con un tope real.

!!! warning "La caché caída no se degrada, falla"
    El sistema tiene respaldo para cuando un dato **no está** en la caché: va al almacén de objetos.
    Pero no tiene manejo para cuando la caché **no responde**: en ese caso la petición termina en
    error en vez de caer al almacén. Es una diferencia importante para calcular disponibilidad, y es
    el arreglo de mayor rendimiento por esfuerzo del servicio.

## Servicio de avisos

Es el único servicio con control de admisión explícito, y conviene entenderlo porque es visible para
el usuario.

| Parámetro | Valor por defecto |
|---|---|
| Trabajadores de generación | 2 |
| Tamaño máximo de la cola | 16 |
| Tiempo límite por trabajo | 150 segundos |
| Tiempo límite de renderizado | 120 segundos |

**Cuando la cola está llena, el servicio rechaza inmediatamente** en lugar de bloquear. Es el mensaje
de "cola llena" que ve el pronosticador al intentar emitir. Es el comportamiento correcto —rechazar
rápido es mejor que aceptar y no cumplir—, pero significa que el dimensionamiento de estos cuatro
números define directamente cuántos avisos simultáneos tolera el sistema en un evento severo.

!!! warning "El control de admisión no cubre las rutas de intersección"
    La cola y los trabajadores protegen la generación de avisos. Las rutas de consulta de
    departamentos no pasan por ahí: se ejecutan en el mismo hilo que atiende las peticiones, sin
    límite de tamaño de entrada. Es a la vez el punto de saturación más fácil de alcanzar y el que
    ningún parámetro de esta tabla acota.

### Crecimiento de disco

**Las imágenes generadas no se borran nunca.** No hay retención, ni tope, ni tarea de limpieza. El
volumen crece de forma monótona con cada aviso generado, y los archivos se sirven públicamente.

Hay además una colisión de nombres a tener en cuenta: los nombres se derivan del reloj del servidor
con resolución de un segundo, y hay dos trabajadores. Dos avisos generados en el mismo segundo pueden
pisarse.

## Almacenamiento

El volumen del almacén de objetos crece con la cantidad de productos habilitados y con la retención
por prefijo. Al dimensionar conviene tener presente que el catálogo de la aplicación es más amplio
que lo que se genera en un despliegue dado: **la configuración decide qué productos se procesan**, y
esa decisión es el factor que más mueve el consumo de disco y de CPU.

Antes de estimar espacio hay que responder qué productos se van a habilitar y con cuánta retención;
la tabla de días por prefijo está en
[Almacenamiento y colas](../contratos/almacenamiento.md).

## Qué medir para dimensionar de verdad

Este sistema no trae valores de referencia publicados, así que hay que obtenerlos del propio
despliegue. Lo mínimo:

1. Pico de memoria de un trabajador por tipo de producto habilitado.
2. Duración de una unidad de trabajo por tipo de producto.
3. Tasa de aciertos de caché del servicio de datos, que determina cuánto tráfico llega al almacén.
4. Crecimiento diario en disco del almacén de objetos con la configuración elegida.
5. Peticiones simultáneas en el pico operativo, que en esta aplicación coincide con el evento severo,
   es decir, exactamente cuando más importa.

Los tres primeros salen de las métricas que el propio sistema ya expone; ver
[Observabilidad](observabilidad.md).
