---
title: Modelos de pronóstico
---

# Modelos de pronóstico

El satélite y el radar te muestran lo que **está pasando**. Los modelos numéricos te muestran lo que
**va a pasar**.

Un modelo toma el estado actual de la atmósfera, lo divide en una grilla tridimensional y resuelve
las ecuaciones de la física para calcular cómo evoluciona esa grilla paso a paso hacia adelante. El
resultado es un pronóstico: una serie de campos, uno por cada hora futura.

Cada vez que un modelo se ejecuta se llama **corrida**. Las corridas se lanzan a horas fijas y cada
una parte de las observaciones disponibles hasta ese momento. En el control de cada capa de modelo
podés elegir de qué corrida tomar los datos: la más reciente incorpora la información más nueva, y
es casi siempre la que conviene.

!!! note "Un pronóstico es un escenario, no un dato"
    Los modelos aciertan la situación general mucho mejor que el detalle. Que un modelo ponga una
    tormenta sobre una ciudad a las 18:00 no significa que vaya a estar exactamente ahí a esa hora;
    significa que las condiciones para que ocurra algo así están dadas en esa zona y en ese entorno
    horario. Usá el modelo para anticipar y priorizar, y la observación para confirmar.

## Los tres modelos

| Modelo | Alcance | Para qué se usa acá |
|---|---|---|
| **ECMWF** | Global | El panorama general: sistemas de presión y precipitación acumulada. |
| **WRF** | Regional, configurado para el territorio argentino, con salidas horarias | El detalle: es el que se usa para anticipar convección severa. |
| **GFS** | Global | Estructura de la atmósfera en altura. |

La diferencia entre un modelo global y uno regional es la resolución. Un modelo global cubre todo el
planeta con una grilla más gruesa; un modelo regional cubre sólo una porción, pero con celdas mucho
más chicas, y por eso puede representar fenómenos más pequeños, como una tormenta individual.

## ECMWF

| Capa | Unidad | Cómo se lee |
|---|---|---|
| **Precipitación total** | mm | Cuánta lluvia acumulada se espera y dónde. Da la magnitud y la distribución espacial del evento. |
| **Presión a nivel del mar** | hPa | Las isobaras: los centros de alta y baja presión y sus gradientes. Donde las isobaras están más juntas, el viento es más fuerte. |

La presión a nivel del mar se dibuja como líneas, no como una capa de imagen, así que se puede
superponer sobre cualquier otra cosa sin taparla.

## WRF

Es el modelo de mayor detalle y el que aporta más capas. Vale la pena entender qué pregunta responde
cada una, porque juntas describen los tres ingredientes de una tormenta severa: **inestabilidad**,
**humedad** y **cortante**.

### Lo que el modelo pronostica que va a ocurrir

| Capa | Unidad | Cómo se lee |
|---|---|---|
| **Colmax** | dBZ | El máximo vertical de reflectividad simulada. Es lo más parecido a "el radar del futuro": dónde y con qué intensidad el modelo desarrolla convección. La capa más directa de todas. |
| **Precipitación 1h** | mm | El acumulado hora por hora, con isobaras y viento de superficie como contexto. |
| **Ráfagas en superficie** | kt | Las ráfagas a 10 metros, con barbas de viento y un contorno de referencia operativo para daño por viento. |
| **Granizo** | — | Un parámetro de granizo severo, con contornos del diámetro máximo pronosticado. |

### Los ingredientes: por qué ocurriría

| Capa | Unidad | Cómo se lee |
|---|---|---|
| **MUCAPE** | J/kg | La energía disponible para la convección, calculada sobre la parcela de aire más inestable. Es la medida de **cuánto combustible** hay. Valores altos indican una atmósfera capaz de sostener corrientes ascendentes fuertes. |
| **Humedad específica 900 hPa** | g/kg | El vapor de agua en capas bajas, con el viento en ese nivel. Es **la alimentación**: sin humedad entrando, la inestabilidad no se traduce en tormentas. |
| **Agua precipitable** | mm | Todo el vapor de agua de la columna, integrado. Indica el potencial de lluvias abundantes. |
| **Jet capas bajas** | kt | El viento en 850 hPa. Es el mecanismo que transporta calor y humedad desde el norte; un jet intenso suele preceder a los eventos organizados. |
| **Cortante niveles bajos** | kt | Cuánto cambia el viento con la altura en niveles bajos. Es lo que determina si las tormentas se **organizan** o colapsan sobre sí mismas, y condiciona su potencial rotatorio. |
| **CAPE-BRN** | J/kg | La energía convectiva acompañada de contornos del número de Richardson volumétrico, que relaciona la inestabilidad con la cortante. Ayuda a anticipar qué **tipo** de tormenta favorece el entorno. |

!!! note "Inestabilidad sola no alcanza"
    Mucha CAPE con poca cortante tiende a dar tormentas fuertes pero desorganizadas y de vida corta.
    CAPE moderada con cortante fuerte puede dar sistemas organizados, mucho más duraderos y
    peligrosos. Por eso las dos capas se miran juntas, y por eso existe una capa que directamente las
    combina.

## GFS

Aporta la estructura de la atmósfera en altura, que es donde se define la organización de los
sistemas.

| Capa | Cómo se lee |
|---|---|
| **Presión a nivel del mar** | Isobaras y espesor entre niveles. El espesor es un indicador de la temperatura media de la capa: sirve para ubicar frentes y masas de aire. |
| **500 hPa** | Viento, alturas geopotenciales, isotermas y barbas en niveles medios. Es el nivel donde se leen las vaguadas y las cuñas que dirigen los sistemas. |
| **250 hPa** | Viento y alturas en niveles altos, donde está la corriente en chorro. La posición del chorro condiciona dónde se favorece el ascenso. |

Estas capas son vectoriales —líneas y barbas, sin imagen de fondo—, así que se pueden superponer
sobre satélite o radar sin ocultarlos.

## Una forma de trabajar

Una secuencia razonable para una jornada con potencial de tiempo severo:

1. **GFS en 500 hPa** para ubicar el sistema que va a gobernar el día.
2. **ECMWF** para el panorama de presión y precipitación acumulada.
3. **WRF, ingredientes**: MUCAPE y humedad en capas bajas para saber dónde está el combustible, y
   cortante para saber si se va a organizar.
4. **WRF, Colmax** para ver dónde y cuándo el modelo efectivamente dispara la convección.
5. **Satélite y radar** para confirmar si está ocurriendo, y dónde exactamente respecto de lo
   pronosticado.

Ese último paso es el que importa a la hora de [emitir un aviso](../avisos.md): el aviso se dibuja
sobre lo observado, con el modelo como guía de hacia dónde va.
