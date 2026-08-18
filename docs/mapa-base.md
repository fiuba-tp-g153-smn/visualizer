---
title: Mapa base
---

# Mapa base

El mapa base es el fondo cartográfico sobre el que se dibujan las capas meteorológicas y de
referencia. Cambiarlo no afecta a las capas superpuestas: sólo cambia el contexto geográfico.

## Cómo se cambia

Está en el panel **Explorador**, pestaña **Mapa base**. Se muestra una grilla de tarjetas, cada una
con una vista previa del proveedor y su atribución. Por defecto se usa Argenmap, del IGN.

## Proveedores disponibles

| Identificador | Nombre en la interfaz | Origen |
|---|---|---|
| `argenmap` | Argenmap | IGN |
| `argenmapGris` | Argenmap gris | IGN |
| `argenmapOscuro` | Argenmap oscuro | IGN |
| `argenmapTopografico` | Argenmap topográfico | IGN |
| `satellite` | Imágenes satelitales Esri | Esri |
| `topographic` | Mapa topográfico Esri | Esri |
| `googleSatellite` | Imágenes satelitales Google | Google |
| `oceanBase` | Mapa Esri Fondo Oceánico | Esri |

!!! note "Dos de ellos tienen zoom limitado"
    **Imágenes satelitales Esri** arranca en el nivel 3, y **Mapa topográfico Esri** no tiene
    teselas propias más allá del nivel 8: por encima de eso el visor amplía la última disponible en
    lugar de traer más detalle.

## Cuál conviene

- Para **referencia geográfica**, cualquiera de los Argenmap: son los que traen toponimia y límites
  administrativos argentinos con más detalle.
- Para **realzar productos meteorológicos**, las imágenes satelitales: los colores de nubosidad y
  precipitación contrastan mejor sobre un fondo oscuro.
- **Argenmap gris** y **Argenmap oscuro** son útiles cuando la capa de datos ya tiene mucha
  saturación y el fondo compite con ella.

## Detalle técnico

Los cuatro mapas del IGN se sirven con esquema TMS, cuyo eje Y está invertido respecto del esquema
XYZ habitual. En la configuración de la aplicación eso **no** se expresa con un marcador `{-y}` en la
plantilla, sino con una bandera `isTms` que hace que Leaflet aplique la conversión.

!!! warning "Copiar la plantilla sin la bandera invierte los tiles"
    Las plantillas guardadas terminan en `{z}/{x}/{y}.png`. Usarlas tal cual en un cliente Leaflet
    sin activar la opción `tms` produce un mapa con las filas dadas vuelta.

## Respaldo

`data-service` mantiene una copia de los tiles de los proveedores en un bucket propio, de modo que el
sistema tolere una caída del proveedor original. El estado de ese respaldo —qué proveedor va por
dónde, tasa de error y cortacircuitos— se ve en la pestaña **Mapas base** del
[panel de estado](panel-de-estado.md).

Si `data-service` no está disponible al abrir la aplicación, el selector cae a una tabla estática de
proveedores en lugar de quedarse vacío.
