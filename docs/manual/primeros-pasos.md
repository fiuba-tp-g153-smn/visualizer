---
title: 2. Primeros pasos
---

# 2. Primeros pasos

La aplicación abre con un mapa que ocupa toda la ventana y una barra de iconos
sobre el margen izquierdo. El mapa concentra el trabajo geográfico. La barra da
acceso a las capas, las herramientas, los avisos y la configuración.

![La ventana: barra lateral, panel y mapa](../imgs/diagrams/ventana-anatomia.svg){ .diagram loading=lazy }

![La ventana al abrir la aplicación por primera vez](../imgs/manual/02-ventana.png){ .doc-figure loading=lazy }

En la captura, el número 1 identifica la barra lateral, el 2 los controles de
zoom y el 3 la atribución del mapa base.

## La barra lateral

Cada icono abre un panel. La aplicación mantiene un solo panel abierto y lo
cierra cuando el usuario presiona la cruz, vuelve a seleccionar el mismo icono
o elige otro panel.

| Icono | Panel | Uso |
|---|---|---|
| Capas | Capas del mapa | Seleccionar satélite, radar, modelos, estaciones y cartografía de referencia. |
| Triángulo | Avisos a corto plazo | Dibujar el área afectada y generar un aviso. |
| Herramientas | Herramientas del mapa | Configurar indicadores, escalas y consulta puntual. |
| Mapa | Explorador | Buscar un lugar y elegir el mapa base. |
| Ajustes | Configuración | Definir unidades, zona horaria y acceso a estaciones. |

Debajo de estos paneles se encuentran los accesos a [Rendimiento y
estado](panel-de-estado.md) y a la documentación. Al pie aparecen los controles
de zoom. El número entre los botones indica el nivel actual.

![El panel Capas del mapa, abierto desde la barra lateral](../imgs/manual/02-panel-capas.png){ .doc-figure loading=lazy }

Todos los paneles comparten la misma organización. La captura marca el título
con el número 1, las pestañas con el 2 y el botón de cierre con el 3.

## Movimiento y búsqueda

La rueda del mouse o los botones de zoom acercan y alejan la vista. Para mover
el mapa se arrastra con el botón izquierdo. La aplicación inicia centrada en la
Argentina, con nivel de zoom 4, y no conserva la posición entre sesiones.

La pestaña Buscar del Explorador permite ir a una localidad, un departamento o
una provincia. La búsqueda comienza a partir de tres caracteres y utiliza el
servicio del IGN. Desde el engranaje se puede seleccionar OpenStreetMap y elegir
si un área se representa como polígono o como marcador. Un clic sobre el
resultado centra el mapa. El botón derecho elimina la marca.

## El mapa base

El mapa base aporta el contexto cartográfico sobre el cual se dibujan las capas
meteorológicas. No forma parte del árbol de capas. Se selecciona en Explorador,
dentro de la pestaña Mapa base, y la elección queda guardada en el navegador.

![La grilla de mapas base del Explorador](../imgs/manual/02-mapa-base.png){ .doc-figure loading=lazy }

<video preload="none" loop muted playsinline title="Cambiar el mapa de fondo"
       width="100%" poster="../../videos/02-cambiar-mapa-base-poster.webp"
       style="max-height: 500px">
  <source src="../../videos/02-cambiar-mapa-base.webm" type="video/webm" />
  Tu navegador no soporta este video.
</video>

| Mapa | Proveedor | Último nivel disponible |
|---|---|---|
| Argenmap | IGN | Todo el rango |
| Argenmap gris | IGN | Todo el rango |
| Argenmap oscuro | IGN | Todo el rango |
| Argenmap topográfico | IGN | Todo el rango |
| Imágenes satelitales Esri | Esri | 17 |
| Mapa topográfico Esri | Esri | 8 |
| Imágenes satelitales Google | Google | Todo el rango |
| Mapa Esri Fondo Oceánico | Esri | 16 |

Argenmap es la opción inicial. La aplicación admite zoom hasta el nivel 18. Si
el proveedor termina antes, agranda su última imagen y el resultado pierde
nitidez.

El navegador solicita primero cada imagen al proveedor del mapa. Cuando esa
consulta falla, el sistema intenta recuperar la copia almacenada. Si un mapa
base queda vacío, cambiar de tarjeta permite distinguir una falla del proveedor
de un problema general de la aplicación.

## Indicadores sobre el mapa

La pestaña General de Herramientas del mapa controla seis ayudas visuales.

![Herramientas del mapa ▸ General, con los seis indicadores](../imgs/manual/02-indicadores.png){ .doc-figure loading=lazy }

En la captura están activas la escala, las coordenadas y la atribución. La
casilla marcada con el número 4 controla los botones de zoom.

| Indicador | Estado inicial |
|---|---|
| Controles de zoom | Activo |
| Escala | Inactivo |
| Coordenadas | Inactivo |
| Líneas de cursor | Inactivo |
| Trópicos y meridianos | Inactivo |
| Atribución | Activo |

La escala, las coordenadas y la atribución también tienen un botón de cierre.
Las líneas de cursor y los trópicos sólo se desactivan desde la casilla del
panel.

## Configuración

El panel Configuración contiene las pestañas Unidades, SMN y Atajos.

![Configuración ▸ Unidades, con sus cuatro ajustes](../imgs/manual/02-configuracion.png){ .doc-figure loading=lazy }

Los números de la captura corresponden a estas opciones:

1. Temperatura en grados Celsius o Kelvin. El valor inicial es Celsius.
2. Velocidad del viento en kilómetros por hora o nudos. El valor inicial es nudos.
3. Zona horaria HOA o UTC. El valor inicial es HOA.
4. Precisión decimal entre 0 y 3. El valor inicial es 2.

!!! warning "Hora oficial argentina"
    HOA corresponde a UTC-3 durante todo el año. No depende de la zona horaria
    de la computadora. Cada hora de la interfaz muestra el sufijo HOA o UTC
    según la opción seleccionada.

La pestaña SMN administra la clave requerida por las capas de estaciones. El
diálogo valida la clave antes de guardarla. Una vez registrada, el usuario puede
cambiarla o eliminarla. Sin una clave válida, las capas de estaciones no se
pueden activar. El [capítulo 4.4](productos/estaciones.md) describe este acceso.

La pestaña Atajos todavía no contiene opciones y muestra el texto "A
desarrollar".

## Datos guardados en el navegador

La aplicación conserva las capas activas, su orden y opacidad, las elevaciones y
corridas seleccionadas, el mapa base, los indicadores, las unidades y la zona
horaria. También guarda la clave de estaciones, los polígonos dibujados, las
preferencias de búsqueda y consulta, y los avisos que el usuario decidió
ocultar.

La posición del mapa no forma parte de este estado. Cada apertura comienza en la
vista inicial. Si el mapa presenta información inesperada, conviene revisar la
pestaña Activas del panel Capas del mapa, ya que puede haber recuperado una capa
de la sesión anterior.

El estado pertenece a la combinación de computadora y navegador. Otra máquina o
un perfil distinto inicia con la configuración de fábrica, que utiliza Argenmap
y mantiene activa solamente la capa Provincia.
