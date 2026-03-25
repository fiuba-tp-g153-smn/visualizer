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

| ID                      | Proveedor                      | Tipo | URL Template / Notas                                                                                                      |
| :---------------------- | :----------------------------- | :--- | :------------------------------------------------------------------------------------------------------------------------ |
| **argenmap**            | IGN Argenmap                   | TMS  | `.../tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png` <br /> _Nota: Utiliza esquema TMS con eje Y invertido._ |
| **argenmapGris**        | IGN Argenmap gris              | TMS  | `.../tms/1.0.0/mapabase_gris@EPSG%3A3857@png/{z}/{x}/{-y}.png` <br /> _Nota: Utiliza esquema TMS con eje Y invertido._    |
| **argenmapOscuro**      | IGN Argenmap oscuro            | TMS  | `.../tms/1.0.0/argenmap_oscuro@EPSG%3A3857@png/{z}/{x}/{-y}.png` <br /> _Nota: Utiliza esquema TMS con eje Y invertido._  |
| **argenmapTopografico** | IGN Argenmap topográfico       | TMS  | `.../tms/1.0.0/mapabase_topo@EPSG%3A3857@png/{z}/{x}/{-y}.png` <br /> _Nota: Utiliza esquema TMS con eje Y invertido._    |
| **satellite**           | ESRI World Imagery             | XYZ  | Imágenes satelitales de alta resolución (ArcGIS).                                                                         |
| **topographic**         | ESRI World Physical Map        | XYZ  | Mapa topográfico físico.                                                                                                  |
| **googleSatellite**     | Google Satellite               | XYZ  | Imágenes satelitales de Google Maps.                                                                                      |
| **oceanBase**           | ESRI Ocean World Ocean Base    | XYZ  | Mapa base especializado en fondos oceánicos.                                                                              |

## Selector de Mapas Base

Permite conmutar el fondo cartográfico sin afectar las capas operativas superpuestas.

- **Recomendación para Referencia**: Utilice _Argenmap_ cuando necesite información geográfica detallada.
- **Recomendación para Meteorología**: Utilice _Satellite_ o _Google Satellite_ para resaltar datos de nubes o precipitación con colores brillantes.

## Navegación en el Mapa {#navegacion-en-el-mapa}

- **Zoom**: Rueda del mouse ó controles de la UI (+/-).
- **Desplazamiento**: Arrastrar mapa (Click izquierdo + Drag) o usar las flechas del teclado.
