---
title: Uso general
---

# Uso general

El visualizador es un mapa a pantalla completa con una barra de íconos a la izquierda. Cada ícono
abre un panel; los paneles son el lugar donde se elige qué ver, cómo verlo y qué medir. Esta página
recorre la interfaz y el trabajo con capas.

!!! note "Las capturas de esta guía se están rehaciendo"
    La interfaz cambió sustancialmente respecto de las imágenes que acompañaban a esta guía, así que
    se retiraron en lugar de mostrar una versión que ya no existe. El texto describe la interfaz
    actual.

## La barra lateral

De arriba hacia abajo:

| Ícono | Abre |
|---|---|
| Capas del mapa | El catálogo de capas, las capas activas y la sincronización |
| Avisos a corto plazo | El dibujo de polígonos y la emisión de avisos |
| Herramientas del mapa | Escalas, dato puntual y los indicadores del mapa |
| Explorador | Búsqueda de lugares y selección de mapa base |
| Configuración | Unidades, zona horaria y clave de estaciones |

Debajo de un separador hay dos enlaces más: **Rendimiento y estado**, que lleva al
[panel de estado](panel-de-estado.md), y **Documentación**, que abre estas páginas.

Al pie de esa misma columna están los controles de zoom, con el nivel actual entre el `+` y el `−`.

!!! note "Los controles del mapa se pueden apagar"
    En **Herramientas del mapa ▸ General** hay una casilla por cada indicador: **Controles de zoom**,
    **Escala**, **Coordenadas**, **Líneas de cursor**, **Trópicos y meridianos** y **Atribución**.
    Cada uno también se cierra desde su propia crucecita.

## Navegación del mapa

- **Zoom**: rueda del mouse, o los botones `+` y `−`.
- **Desplazamiento**: arrastrar con el botón izquierdo, o las flechas del teclado.

## Capas

El panel **Capas del Mapa** tiene tres pestañas: **Disponibles**, **Activas** y **Sincronización**.
Las dos últimas muestran entre paréntesis cuántas capas contienen.

### Disponibles

Arriba hay un campo **Buscar capas** que filtra el catálogo entero. El listado se organiza en cinco
grupos, cada uno con sus subgrupos:

| Grupo | Qué contiene |
|---|---|
| Satélite | Canales del instrumento ABI y productos del GLM del GOES-19 |
| Radar | Las estaciones de la red SINARAME, con sus variables y elevaciones |
| Modelos | ECMWF, WRF y GFS |
| Estaciones meteorológicas | Las observaciones de superficie del SMN |
| IGN Argentina | Capas de referencia servidas por WMS |

Un punto de color sobre un grupo o subgroupo indica que tiene capas activas, y sólo aparece mientras
está plegado.

Activar una capa es marcar su casilla. En la mayoría de los subgrupos se pueden activar varias a la
vez; el de estaciones usa botones de opción, porque sólo se muestra una variable por vez.

!!! note "Las capas sin datos aparecen atenuadas"
    Si un producto no tiene períodos disponibles, su fila se muestra apagada. Cada subgrupo tiene un
    botón **Volver a verificar disponibilidad** para volver a consultar.

Por defecto viene activa una sola capa: **Provincia**, del grupo IGN Argentina.

### Activas

Lista lo que está en el mapa, agrupado en tres bloques según el orden de dibujado:

| Bloque | Qué contiene |
|---|---|
| Capas puntuales | Estaciones meteorológicas |
| Capas de referencia | Todas las capas del IGN |
| Capas de datos | Satélite, radar y modelos |

Las capas de referencia se dibujan sobre las de datos, y las puntuales sobre ambas, para que los
límites y las estaciones queden visibles por encima de los productos meteorológicos.

!!! warning "El arrastre reordena sólo dentro de un bloque"
    Se puede arrastrar una capa para cambiar su orden respecto de las de su mismo bloque. El orden
    **entre** bloques es fijo: una capa de datos no se puede llevar por encima de una de referencia.

Cada bloque tiene un botón para desactivar de una vez todas sus capas.

### Controles de una capa

Cada fila tiene un botón para mostrar u ocultar su escala de colores, uno para expandirla, y —en la
pestaña Activas— uno para desactivarla. Al expandirla aparecen, según el tipo de capa:

- **Opacidad**: un deslizador con el porcentaje al lado.
- **Elevaciones**: para radar, cuál de las tres elevaciones mostrar.
- **Corridas**: para modelos, qué corrida de pronóstico usar.
- **Consulta** y **Tolerancia**: para estaciones, si mostrar la observación **Más reciente** o una
  **Específico**, y con cuánta holgura horaria.
- **Período**: los controles de animación.

!!! note "Ya no hay un botón separado de animación"
    En versiones anteriores un ícono aparte desplegaba la configuración de animación. Ahora un único
    control de expansión muestra la opacidad y el período juntos.

## Animación

Dentro de **Período** están:

- El **selector de cantidad de imágenes**, cuyas opciones dependen de la capa.
- El **intervalo**, en segundos por imagen, entre 0,1 y 10.
- La marca de tiempo de la imagen que se está viendo.
- El botón de reproducción, un botón **Ir a la imagen más reciente** y un deslizador para moverse
  entre imágenes.

Las capas de observación animan las **últimas** N imágenes; las de pronóstico, las **primeras** N.

!!! warning "Las marcas de tiempo se muestran en hora local"
    Por defecto los horarios se muestran en la zona horaria de la máquina, no en UTC. Para verlos en
    UTC hay que cambiar **Zona horaria** en el panel **Configuración**. Es un cambio importante
    respecto de versiones anteriores de esta guía, que documentaban UTC como único formato.

Un botón de recarga permite volver a pedir los períodos disponibles; de todos modos se actualizan
solos cada 10 segundos.

## Sincronización

La pestaña **Sincronización** permite reproducir varias capas a la vez con sus tiempos alineados. Se
eligen las capas a sincronizar y el sistema busca una correspondencia temporal entre ellas.

Cuando una capa está sincronizada, su propio control de período muestra la marca **Sincronizado** y
su deslizador queda deshabilitado: manda la sincronización. El botón de reproducción de esa capa pasa
a ofrecer **Desconectar de sincronización**.

!!! note "Si no se pueden alinear, no se reproduce"
    Si las capas elegidas no tienen períodos en común, o si sus tiempos no se pueden hacer coincidir
    dentro de la tolerancia, el panel lo dice y bloquea la reproducción en lugar de mostrar imágenes
    de instantes distintos como si fueran simultáneas.

## Herramientas

El panel **Herramientas del mapa** tiene tres pestañas:

- **General**: las casillas de los indicadores del mapa.
- **Escalas**: activa el panel flotante de escalas de color y lista las variables activas que tienen
  una configurada.
- **Dato puntual**: activa la consulta de valores puntuales. Al hacer clic en el mapa devuelve el
  valor numérico real de cada capa activa en ese punto, con su unidad. Se puede elegir si el
  resultado aparece en un **Panel fijo** o **Junto al marcador**.

## Configuración

- **Unidades**: temperatura en **Celsius** o **Kelvin**, viento en **km/h** o **Nudos**, y la
  cantidad de decimales.
- **Zona horaria**: **Hora local** o **UTC**.
- **SMN**: la clave de acceso al servicio de estaciones, que se guarda en el navegador.
- **Atajos**: por ahora es un espacio reservado; no hay atajos configurables.

## Qué se recuerda entre sesiones

El navegador guarda las capas activas con su opacidad y su orden, el mapa base elegido, las
preferencias de unidades y zona horaria, y la clave de estaciones.

!!! note "La sesión previa gana sobre los valores por defecto"
    Al volver a entrar, el mapa no arranca con la configuración de fábrica sino con la última que se
    usó.
