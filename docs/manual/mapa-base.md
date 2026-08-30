---
title: El mapa de fondo
---

# El mapa de fondo

El mapa de fondo es la cartografía sobre la que se dibuja todo lo demás: costas, rutas, ciudades,
relieve. No es un dato meteorológico y no afecta a las capas que pongas encima. Es el contexto que
te permite decir *dónde* está pasando lo que estás viendo.

## Cómo se cambia

Está en el panel **Explorador**, pestaña **Mapa base**. Vas a ver una grilla de tarjetas, cada una
con una vista previa. Se cambia con un clic y el cambio se recuerda para la próxima vez.

Por defecto se usa **Argenmap**, la cartografía oficial del Instituto Geográfico Nacional.

## Los ocho fondos disponibles

| Nombre | De dónde viene |
|---|---|
| Argenmap | IGN |
| Argenmap gris | IGN |
| Argenmap oscuro | IGN |
| Argenmap topográfico | IGN |
| Imágenes satelitales Esri | Esri |
| Mapa topográfico Esri | Esri |
| Imágenes satelitales Google | Google |
| Mapa Esri Fondo Oceánico | Esri |

## Cuál conviene según lo que estés mirando

- **Para ubicarte con precisión**: cualquiera de los Argenmap. Son los que traen los nombres de
  lugares y los límites administrativos argentinos con más detalle y mejor actualizados.
- **Para que resalte un producto meteorológico**: las imágenes satelitales. Los colores de nubosidad
  y precipitación contrastan mucho mejor sobre un fondo oscuro.
- **Cuando el fondo compite con la capa**: Argenmap gris o Argenmap oscuro. Si estás mirando una
  capa muy saturada, un fondo neutro evita que los colores se mezclen y te confundan.
- **Para relieve**: los topográficos, cuando la orografía es parte de lo que estás analizando.

!!! note "Dos de ellos no acercan hasta el máximo"
    **Imágenes satelitales Esri** arranca a partir de cierto nivel de alejamiento, y **Mapa
    topográfico Esri** deja de traer más detalle pasado cierto acercamiento: de ahí en adelante
    agranda la última imagen disponible en vez de mostrar más información. Si necesitás mucho
    acercamiento, usá un Argenmap.

## Si el fondo tarda o no carga

El sistema mantiene su propia copia de los fondos de mapa, justamente para que una caída del
proveedor original no te deje sin cartografía. Si aun así ves el mapa en blanco, probá cambiando a
otro proveedor de la grilla: es la comprobación más rápida para saber si el problema es de un
proveedor puntual o de tu conexión.
