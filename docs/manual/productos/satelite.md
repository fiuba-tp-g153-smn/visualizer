---
title: Satélite
---

# Satélite

El GOES-19 es el satélite que la NOAA opera para el continente americano. Es **geoestacionario**:
gira junto con la Tierra, siempre sobre el mismo punto del ecuador, así que mira siempre la misma
porción del planeta. Eso es lo que permite tener una secuencia de imágenes del mismo lugar cada pocos
minutos, que es exactamente lo que hace falta para seguir una tormenta.

Lleva dos instrumentos que aportan capas a la aplicación: el **ABI**, que toma imágenes, y el
**GLM**, que detecta relámpagos.

## ABI: las imágenes

El ABI mide la energía que llega desde la atmósfera en distintas longitudes de onda. De las
longitudes infrarrojas se deduce una **temperatura de brillo**: la temperatura que tendría que tener
un cuerpo para emitir esa cantidad de energía. Como en la troposfera hace más frío cuanto más alto
se está, esa temperatura funciona en la práctica como una medida de altura: **cuanto más frío se ve
un tope de nube, más alto está**.

Ese es el razonamiento que hay detrás de casi todo el uso operativo del satélite.

| Capa | Qué está mirando | Cómo se lee |
|---|---|---|
| **Canal 2** | Luz visible reflejada | Es, esencialmente, una foto. Muestra la nubosidad con mucho detalle y textura durante el día. **De noche no sirve**: sin sol no hay luz que reflejar. |
| **Canal 9** | Vapor de agua en la troposfera media | No muestra nubes sino humedad en altura. Los tonos más fríos indican más humedad. Sirve para ver el flujo en niveles medios: dónde entra aire húmedo y dónde hay aire seco. |
| **Canal 13** | Temperatura de los topes de nube | El caballo de batalla. Los topes muy fríos señalan nubes convectivas profundas, típicas de las tormentas severas. Funciona igual de bien de día que de noche. |

!!! note "Si tenés que elegir una sola, elegí el canal 13"
    Está disponible las veinticuatro horas y responde la pregunta más importante: dónde hay
    convección profunda. El canal 2 aporta detalle y textura de día, y el canal 9 aporta el contexto
    de humedad; los dos complementan al 13, no lo reemplazan.

### Qué buscar en el infrarrojo

- **Un tope que se enfría rápido** entre imágenes consecutivas es una corriente ascendente que se
  está intensificando. Animar la capa es la única forma de verlo.
- **Un área extensa y uniformemente muy fría** suele ser un sistema convectivo organizado y de larga
  vida, no una celda aislada.
- **El borde del área fría** indica hacia dónde se está expandiendo el yunque, que muchas veces
  anticipa la dirección de propagación del sistema.

## GLM: la actividad eléctrica

El GLM detecta los destellos ópticos que producen los relámpagos, de día y de noche. Su valor está
en que la actividad eléctrica es un indicador muy confiable de que la convección es intensa: para
que una nube se electrifique hace falta una corriente ascendente vigorosa moviendo hielo en su
interior.

| Capa | Qué mide | Para qué sirve |
|---|---|---|
| **Flash Extent Density** | Cuántos relámpagos atraviesan cada celda de la grilla | La más directa: dónde y cuánto está descargando. |
| **Total Optical Energy** | La energía óptica total detectada | Distingue mucha actividad débil de pocos relámpagos muy energéticos. |
| **Minimum Flash Area** | El área mínima de los destellos | Los destellos más chicos tienden a asociarse a corrientes ascendentes más vigorosas. |

Las tres se dibujan en escala logarítmica, porque la actividad eléctrica varía en órdenes de
magnitud: sin esa compresión, una sola celda muy activa dejaría a todo lo demás en cero visual.

!!! note "La combinación más informativa"
    Canal 13 con descargas encima. El infrarrojo te muestra todas las nubes altas y frías; las
    descargas te dicen cuál de ellas está realmente activa **ahora**. Un tope frío sin actividad
    eléctrica suele ser un yunque residual que ya no representa peligro; el mismo tope con descargas
    intensas es otra cosa completamente distinta.

## Una limitación que conviene tener presente

El satélite ve la atmósfera **desde arriba**. Ve muy bien los topes de las nubes y muy mal lo que
pasa debajo de ellos. Una tormenta puede tener un tope espectacular y estar dejando poca
precipitación en superficie, o al revés. Para saber qué está llegando al suelo hay que mirar el
[radar](radar.md) y las [estaciones](estaciones.md).
