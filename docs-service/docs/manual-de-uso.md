# Documentación Técnica: Visualizator

Esta guía técnica proporciona una referencia detallada sobre la arquitectura, estándares geoespaciales y capacidades funcionales de la aplicación **Visualizator**. Este documento está dirigido a desarrolladores, especialistas SIG (Sistemas de Información Geográfica) y meteorólogos que requieran comprender la integración de datos y la operación avanzada del sistema.

## Tabla de Contenidos

1. [Introducción y Alcance](#1-introduccion-y-alcance)
2. [Arquitectura y Tecnologías](#2-arquitectura-y-tecnologias)
3. [Catálogo de Datos y Proveedores](#3-catalogo-de-datos-y-proveedores)
   - [3.1. Proveedores de Mapas Base](#31-proveedores-de-mapas-base-basemaps)
   - [3.2. Capas Meteorológicas y Geoespaciales](#32-capas-meteorologicas-y-geoespaciales)
4. [Guía de Uso de la Interfaz](#4-guia-de-uso-de-la-interfaz)
   - [4.1. Control de Capas](#41-control-de-capas-layer-control)
   - [4.2. Selector de Mapas Base](#42-selector-de-mapas-base)
   - [4.3. Navegación en el Mapa](#43-navegacion-en-el-mapa)
5. [Buenas Prácticas de Rendimiento](#5-buenas-practicas-de-rendimiento)
6. [Referencias y Estándares](#6-referencias-y-estandares)

## 1. Introducción y Alcance {#1-introduccion-y-alcance}

**Visualizator** es una plataforma de visualización geoespacial de alto rendimiento diseñada para la integración de datos meteorológicos en tiempo real y cartografía base estandarizada. La aplicación permite la superposición de capas raster y vectoriales provenientes de diversas fuentes (WMS, TMS, XYZ), facilitando el análisis de fenómenos atmosféricos sobre un contexto geográfico preciso.

### Objetivos del Sistema

- **Integración Multafuente**: Unificación de servicios WMS (IGN), tiles satelitales (GOES-16/19) y datos de radar.
- **Interoperabilidad**: Adhesión a estándares OGC (Open Geospatial Consortium).
- **Rendimiento**: Renderizado eficiente en cliente utilizando Leaflet.

---

## 2. Arquitectura y Tecnologías {#2-arquitectura-y-tecnologias}

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

---

## 3. Catálogo de Datos y Proveedores {#3-catalogo-de-datos-y-proveedores}

La aplicación implementa una arquitectura flexible de proveedores de mapas base y capas superpuestas. A continuación se detallan las configuraciones técnicas.

### 3.1. Proveedores de Mapas Base (Basemaps) {#31-proveedores-de-mapas-base-basemaps}

Los mapas base proporcionan el contexto geográfico. La aplicación soporta protocolos `XYZ` y `TMS`.

| ID              | Proveedor           | Tipo | URL Template / Notas                                                                                                      |
| :-------------- | :------------------ | :--- | :------------------------------------------------------------------------------------------------------------------------ |
| **argenmap**    | IGN ArgenMAP        | TMS  | `.../tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png` <br /> _Nota: Utiliza esquema TMS con eje Y invertido._ |
| **osm**         | OpenStreetMap       | XYZ  | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`                                                                      |
| **satellite**   | ESRI World Imagery  | XYZ  | Imágenes satelitales de alta resolución (ArcGIS).                                                                         |
| **cartoDB**     | CartoDB Positron    | XYZ  | Mapa base minimalista claro, ideal para superposición de datos.                                                           |
| **cartoDBDark** | CartoDB Dark Matter | XYZ  | Versión oscura, optimizada para visualización de datos brillantes (ej. radar/fuego).                                      |

> [!IMPORTANT]
> **ArgenMAP y TMS**: El servicio de ArgenMAP se consume utilizando el protocolo TMS (Tile Map Service), lo cual requiere una inversión en la coordenada `Y` (`{-y}` en Leaflet o `(2^zoom - 1) - y` manual) para mapear correctamente las tiles en una grilla XYZ estándar.

### 3.2. Capas Meteorológicas y Geoespaciales {#32-capas-meteorologicas-y-geoespaciales}

Las capas operativas se organizan en grupos lógicos.

#### A. Satélite (GOES-R Series)

Imágenes provenientes de los satélites geoestacionarios GOES-19 (East).

- **Protocolo**: Tiles XYZ o WMS (según implementación de backend).
- **Productos**: ABI (Advanced Baseline Imager).
- **Resolución Temporal**: Actualización cuasi-real (~10-15 min).

#### B. Radar Meteorológico

Datos de reflectividad (dBZ) compuestos de la red de radares.

- **Uso**: Detección de precipitación y tormentas severas.
- **Visualización**: Paleta de colores estándar de reflectividad meteorológica.

#### C. IGN Argentina (WMS)

Integración de la Infraestructura de Datos Espaciales (IDE) de Argentina a través de servicios WMS estándar.

- **Grupos de Capas**:
  - **Límites**: Límites políticos y administrativos.
  - **Hidrografía**: Cursos de agua, espejos de agua.
  - **Vías de Comunicación**: Rutas, caminos, vías férreas.
  - **Infraestructura y Asentamientos**.
  - **Topografía y Relieve**.

---

## 4. Guía de Uso de la Interfaz {#4-guia-de-uso-de-la-interfaz}

### 4.1. Control de Capas (Layer Control) {#41-control-de-capas-layer-control}

El panel de capas permite la gestión de visibilidad y opacidad.

1.  Acceda al menú lateral **Capas**.
2.  Las capas están agrupadas por categoría (Satélite, Radar, IGN).
3.  **Activación**: Checkbox para prender/apagar.
4.  **Orden (Z-Index)**: Las capas se apilan según el orden en el árbol de configuración. Las capas puntuales o lineales (ej. rutas) suelen renderizarse sobre las capas base o raster (ej. satélite) para mantener visibilidad.

### 4.2. Selector de Mapas Base {#42-selector-de-mapas-base}

Permite conmutar el fondo cartográfico sin afectar las capas operativas superpuestas.

- **Recomendación para Meteorología**: Utilice _CartoDB Dark Matter_ o _Satellite_ para resaltar datos de nubes o precipitación con colores brillantes.
- **Recomendación para Referencia**: Utilice _ArgenMAP_ o _OpenStreetMap_ cuando necesite toponimia detallada y rutas.

### 4.3. Navegación en el Mapa {#43-navegacion-en-el-mapa}

- **Zoom**: Rueda del mouse o controles +/-.
- **Pan**: Arrastrar mapa (Click izquierdo + Drag).
- **Inspección (GetFeatureInfo)**: _Disponible en capas WMS soportadas_. Al hacer clic en un elemento del mapa, se consulta al servidor WMS por los atributos del feature en esa coordenada.

---

## 5. Buenas Prácticas de Rendimiento {#5-buenas-practicas-de-rendimiento}

Para garantizar una experiencia fluida, especialmente en dispositivos con recursos limitados:

1.  **Limitar Capas Activas**: Activar múltiples capas WMS simultáneamente puede saturar las peticiones de red. Desactive las capas que no esté utilizando.
2.  **Zoom Apropiado**: Las capas vectoriales densas (ej. catastro o hidrografía detallada) pueden tardar en cargar en niveles de zoom muy alejados (escala global). Acérquese a la zona de interés para mejorar la velocidad de carga.

---

## 6. Referencias y Estándares {#6-referencias-y-estandares}

- **OGC WMS**: [OpenGIS Web Map Service Implementation Specification](https://www.ogc.org/standards/wms)
- **EPSG:3857**: [Proyección Web Mercator - EPSG.io](https://upsg.io/3857)
- **Visualizator Repository**: Documentación interna y código fuente.
