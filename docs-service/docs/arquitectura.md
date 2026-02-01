---
title: Arquitectura Interna del Sistema
slug: /arquitectura
---

# Arquitectura Interna del Sistema

## 1. Introducción y Alcance

**Visualizator** es una plataforma de visualización geoespacial de alto rendimiento diseñada para la integración de datos meteorológicos en tiempo real y cartografía base estandarizada. La aplicación permite la superposición de capas raster y vectoriales provenientes de diversas fuentes (WMS, TMS, XYZ), facilitando el análisis de fenómenos atmosféricos sobre un contexto geográfico preciso.

### Objetivos del Sistema

- **Integración Multafuente**: Unificación de servicios WMS (IGN), tiles satelitales (GOES-16/19) y datos de radar.
- **Interoperabilidad**: Adhesión a estándares OGC (Open Geospatial Consortium).
- **Rendimiento**: Renderizado eficiente en cliente utilizando Leaflet.

---

## 2. Arquitectura y Tecnologías

La aplicación está construida sobre un stack moderno orientado a la web:

- **Frontend**: Angular (Framework SPA).
- **Motor de Mapas**: [Leaflet](https://leafletjs.com/) (v1.9.4).
- **Procesamiento de Datos**:
  - Integración nativa de servicios OGC WMS.
  - Soporte para tiles XYZ/TMS estándar.

### Sistemas de Referencia de Coordenadas (CRS)

El sistema opera principalmente bajo el estándar **Web Mercator (EPSG:3857)** para la visualización en pantalla, lo cual garantiza compatibilidad con la mayoría de los proveedores de tiles comerciales y comunitarios.

> [!NOTE]
> Las capas provenientes del IGN (Instituto Geográfico Nacional) y otros servicios WMS son reproyectadas al vuelo o solicitadas directamente en EPSG:3857 para asegurar una correcta alineación espacial.
