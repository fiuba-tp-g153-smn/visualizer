---
sidebar_position: 4
---

# Productos Meteorológicos

## Tabla de Contenidos

1. [Capas de Datos](#capas-de-datos)
   - [Satélite (GOES-19)](#a-satelite-goes-19-abi-advanced-baseline-imager)
2. [Capas de Referencia](#capas-de-referencia)
   - [IGN Argentina](#ign-argentina-wms)

Las capas operativas se organizan en grupos lógicos para facilitar el análisis de fenómenos atmosféricos.

Hay dos tipos de capas: **Capas de Datos** y **Capas de Referencia**. Las primeras son las que se utilizan para el análisis de fenómenos meteorológicos y las segundas son las que se utilizan para ubicar geográficamente estos fenómenos.

## Capas de Datos

### A. Satélite (GOES-19) ABI (Advanced Baseline Imager) {/* #a-satelite-goes-19-abi-advanced-baseline-imager */}

Imágenes provenientes de los satélites geoestacionarios GOES-19.

- **Resolución Temporal**: Actualización cuasi-real (~10min).

#### Canales Disponibles

| Canal             | Tipo          | Longitud de Onda | Uso Principal                                                                                                       |
| :---------------- | :------------ | :--------------- | :------------------------------------------------------------------------------------------------------------------ |
| **Canal&nbsp;9**  | Vapor de Agua | 6.9 μm           | **Humedad Atmosférica**. Visualiza flujos de humedad en la troposfera media. Fundamental para dinámica atmosférica. |
| **Canal&nbsp;13** | Infrarrojo    | 10.3 μm          | **Continuo**. Estimación de temperatura de topes nubosos y superficie. Monitoreo de tormentas 24hs.                 |

## Capas de Referencia

### IGN Argentina (WMS)

Integración de la Infraestructura de Datos Espaciales (IDE) de Argentina a través de servicios WMS estándar.

- **Grupos de Capas**:
  - **Límites**: Límites políticos y administrativos.
  - **Hidrografía**: Cursos de agua, espejos de agua.
  - **Vías de Comunicación**: Rutas, caminos, vías férreas.
  - **Infraestructura y Asentamientos**.
  - **Topografía y Relieve**.
