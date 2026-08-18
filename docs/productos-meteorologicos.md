---
title: Productos meteorológicos
---

# Productos meteorológicos

El catálogo se organiza en cinco grupos. Cuatro traen datos meteorológicos y uno, el del IGN, aporta
el contexto geográfico. Esta página describe qué representa cada producto y para qué sirve.

!!! note "El catálogo es más amplio que lo que se genera hoy"
    Las capas listadas acá son las que la aplicación ofrece. Qué productos se están generando en un
    momento dado lo decide la configuración de `tiles-processor`, así que una capa puede existir en
    el catálogo y aparecer sin datos. Ver [Tiles Processor](servicios/tiles-processor.md).

## Satélite GOES-19

El GOES-19 es el satélite geoestacionario operativo de la NOAA para el sector americano.

### ABI

El *Advanced Baseline Imager* mide radiancia en varias bandas espectrales. De las bandas infrarrojas
se deriva la **temperatura de brillo**, invirtiendo la ley de Planck: la temperatura a la que un
cuerpo negro emitiría la radiancia observada.

| Capa | Longitud de onda | Qué representa |
|---|---|---|
| **Canal 2** | 0,64 µm | Luz visible reflejada. Identificación diurna de nubosidad y estructuras convectivas; se representa como reflectancia, adimensional. Sólo aporta información de día. |
| **Canal 9** | 6,9 µm | Banda de absorción del vapor de agua: humedad y flujos en la troposfera media. Valores más fríos indican más humedad en altura. |
| **Canal 13** | 10,3 µm | Ventana atmosférica limpia: temperatura de los topes nubosos. Topes muy fríos señalan nubes convectivas profundas, típicas de tormentas severas. |

### GLM

El *Geostationary Lightning Mapper* detecta, de día y de noche, los destellos producidos por los
relámpagos. La actividad eléctrica es un indicador robusto de la intensidad de la convección.

| Capa | Qué representa |
|---|---|
| **Flash Extent Density** | Cantidad de relámpagos que atraviesan cada celda de la grilla. |
| **Total Optical Energy** | Energía óptica total detectada. |
| **Minimum Flash Area** | Área mínima de los destellos; áreas menores tienden a asociarse a corrientes ascendentes más vigorosas. |

Los tres se representan en escala logarítmica.

## Radar SINARAME

Los radares de la red SINARAME emiten pulsos de microondas y miden la energía retrodispersada por los
hidrometeoros. Al transmitir en doble polarización permiten inferir no sólo la intensidad de la
precipitación sino también el tipo y la forma de las partículas.

| Variable | Unidad | Qué representa |
|---|---|---|
| **DBZH** | dBZ | Reflectividad horizontal. Es la variable principal para estimar intensidad de precipitación; valores altos indican lluvia intensa o granizo. |
| **ZDR** | dB | Reflectividad diferencial: informa sobre el achatamiento, y por lo tanto el tamaño y la forma, de los hidrometeoros. |
| **VRAD** | m/s | Velocidad radial por efecto Doppler. Revela el campo de viento, las convergencias y las firmas de rotación. |
| **RHOHV** | — | Coeficiente de correlación cruzada. Cercano a 1 con hidrometeoros homogéneos; desciende ante mezclas, granizo o ecos no meteorológicos. |
| **KDP** | °/km | Fase diferencial específica. Sensible al contenido de agua líquida y robusta frente a la atenuación. |

Cada variable está disponible en tres elevaciones de antena, que en la interfaz aparecen como
**Elevaciones**.

## Modelos

A diferencia de satélite y radar, que describen el estado presente de la atmósfera, los modelos son
pronósticos del estado futuro. Sus capas se seleccionan por **corrida**.

### ECMWF

| Capa | Unidad | Qué representa |
|---|---|---|
| **Precipitación total** | mm | Precipitación acumulada prevista. Anticipa magnitud y distribución espacial de la lluvia. |
| **Presión a nivel del mar** | hPa | Isobaras que describen los sistemas sinópticos: centros de baja y alta presión y los gradientes asociados al viento. |

La presión a nivel del mar se dibuja como isobaras vectoriales, no como una capa de imágenes.

### WRF

El WRF en su configuración regional para el territorio argentino, con salidas horarias.

| Capa | Unidad | Qué representa |
|---|---|---|
| **Colmax** | dBZ | Máximo vertical de la reflectividad simulada: dónde y con qué intensidad el modelo desarrolla convección. |
| **Ráfagas en superficie** | kt | Ráfagas a 10 metros, con barbas de viento y un contorno de referencia operativo para daño por viento. |
| **Humedad específica 900 hPa** | g/kg | Vapor de agua en capas bajas con el viento en ese nivel: la alimentación de humedad disponible para la convección. |
| **Precipitación 1h** | mm | Acumulado horario pronosticado, con isobaras y barbas de superficie como contexto. |
| **MUCAPE** | J/kg | Energía potencial convectiva de la parcela más inestable: cuantifica la inestabilidad termodinámica. |
| **Agua precipitable** | mm | Integral del vapor de agua en toda la columna. |
| **Jet capas bajas** | kt | Viento en 850 hPa. El jet en capas bajas transporta calor y humedad desde latitudes tropicales. |
| **Cortante niveles bajos** | kt | Variación del viento entre niveles bajos: condiciona la organización de las tormentas y su potencial rotatorio. |
| **CAPE-BRN** | J/kg | CAPE acompañado de contornos del número de Richardson volumétrico, que relaciona inestabilidad con cortante. |
| **Granizo** | — | Parámetro de granizo severo, con contornos de diámetro máximo pronosticado. |

### GFS

| Capa | Qué representa |
|---|---|
| **Presión a nivel del mar** | Isobaras y espesor entre niveles. Sin capa de imágenes: es puramente vectorial. |
| **500 hPa** | Viento, alturas geopotenciales, isotermas y barbas en el nivel medio. |
| **250 hPa** | Viento y alturas geopotenciales en niveles altos, donde se ubica la corriente en chorro. |

## Estaciones meteorológicas

Las observaciones de superficie de la red del SMN se dibujan como marcadores puntuales. Se muestra
una variable por vez:

**Temperatura**, **Punto de rocío**, **Sensación térmica**, **Humedad**, **Presión**,
**Visibilidad** y **Viento**.

El punto de rocío no viene medido: se calcula a partir de la temperatura y la humedad relativa.
Cuantifica el contenido absoluto de humedad del aire y es un buen indicador de la energía disponible
para la convección.

!!! note "El detalle de una estación se abre con el botón derecho"
    Haciendo clic derecho sobre un marcador se abre una ficha con la observación actual y un gráfico.
    Desde su pie se accede al histórico completo de las últimas 48 horas, con gráficos, resumen y la
    tabla de observaciones.

Estas capas requieren una clave de acceso, que se carga en **Configuración ▸ SMN**.

## IGN Argentina

Capas de referencia servidas por WMS desde la infraestructura de datos espaciales del IGN, repartidas
en siete subgrupos:

| Subgrupo | Contenido |
|---|---|
| Límites | Límite interdepartamental o de partido, límite internacional |
| Administrativo | Localidad, sublocalidad, gobierno local, provincia |
| Territorial | Área de montaña |
| Infraestructura | Aeródromo, aeropuerto, helipuerto, red vial nacional |
| Hidrografía | Corriente de agua, ferrocarril |
| Defensa y seguridad | Cuartel de bomberos, pasos de fronteras internacionales |
| Otros | Línea de transmisión eléctrica, central eléctrica, centro de esquí |

Se dibujan por encima de las capas de datos para que los límites queden visibles. La única activa por
defecto es **Provincia**.

!!! warning "Sin verificar"
    La cadencia de actualización del ABI del GOES-19 (del orden de 10 minutos entre capturas) no
    está declarada en ninguno de los cuatro repositorios: el productor descubre capturas nuevas
    contra el bucket de origen y la aplicación sólo fija cuántos cuadros anima. El valor proviene de
    la documentación del instrumento, no del código de este sistema.
