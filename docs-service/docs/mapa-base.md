---
sidebar_position: 3
---

# Mapa Base

## Tabla de Contenidos

1. [Proveedores Disponibles](#proveedores-disponibles)
2. [Selector de Mapas Base](#selector-de-mapas-base)
3. [Navegación en el Mapa](#navegacion-en-el-mapa)

Los mapas base proporcionan el contexto geográfico.

## Proveedores Disponibles

| ID              | Proveedor           | Tipo | URL Template / Notas                                                                                                      |
| :-------------- | :------------------ | :--- | :------------------------------------------------------------------------------------------------------------------------ |
| **argenmap**    | IGN ArgenMAP        | TMS  | `.../tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png` <br /> _Nota: Utiliza esquema TMS con eje Y invertido._ |
| **osm**         | OpenStreetMap       | XYZ  | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`                                                                      |
| **satellite**   | ESRI World Imagery  | XYZ  | Imágenes satelitales de alta resolución (ArcGIS).                                                                         |
| **cartoDB**     | CartoDB Positron    | XYZ  | Mapa base minimalista claro, ideal para superposición de datos.                                                           |
| **cartoDBDark** | CartoDB Dark Matter | XYZ  | Versión oscura, optimizada para visualización de datos brillantes (ej. radar/fuego).                                      |

## Selector de Mapas Base

Permite conmutar el fondo cartográfico sin afectar las capas operativas superpuestas.

- **Recomendación para Referencia**: Utilice _ArgenMAP_ o _OpenStreetMap_ cuando necesite información geográfica detallada.
- **Recomendación para Meteorología**: Utilice _Satellite_ o _CartoDB Dark Matter_ para resaltar datos de nubes o precipitación con colores brillantes.

## Navegación en el Mapa {#navegacion-en-el-mapa}

- **Zoom**: Rueda del mouse ó controles de la UI (+/-).
- **Desplazamiento**: Arrastrar mapa (Click izquierdo + Drag) o usar las flechas del teclado.
