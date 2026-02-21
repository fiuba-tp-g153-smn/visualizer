---
slug: /
title: Inicio
sidebar_position: 1
---

# Bienvenido al Visualizador del MapaSMN

Esta es una plataforma de visualización geoespacial diseñada para la integración de datos meteorológicos en tiempo real acorde a la producción de imágenes fuente.

Esta documentación te guiará a través de las funcionalidades, la configuración y el uso avanzado de la herramienta.

## 📖 Explorar la Documentación

### Guía de Uso

Consulta nuestra guía detallada para aprender a utilizar la interfaz.

- **[Uso General](./uso-general.md)**: Información general sobre el uso de la interfaz.
- **[Mapa Base](./mapa-base.md)**: Información sobre los diferentes mapas base disponibles y navegación general del mapa.
- **[Productos Meteorológicos](./productos-meteorologicos.md)**: Aprende a activar, desactivar y organizar la información en el mapa.

<div style={{ display: 'flex', justifyContent: 'center', margin: '30px 0' }}>
  <video autoPlay loop muted playsInline width="100%" style={{ borderRadius: '5px', maxHeight: '600px' }}>
    <source src={require('./videos/ejemplo-de-uso.webm').default} type="video/webm" />
    Tu navegador no soporta este video.
  </video>
</div>

## Funcionalidades Principales

Visualizer integra múltiples fuentes de datos para ofrecer un contexto geográfico preciso:

- **Mapas Base**: Soporte para tiles del mapa base con proveedores de tiles incluyendo ArgenMAP (IGN), OpenStreetMap, CartoDB y capas satelitales de ESRI.
- **Capas Meteorológicas**: Visualización de imágenes del satélite GOES-19.
- **Datos del IGN**: Integración con servicios WMS del IGN (Instituto Geográfico Nacional) para visualizar límites, hidrografía y rutas de Argentina.
- **Interacción Avanzada**: Control de opacidad y orden de capas (Z-Index) para análisis personalizados.

### Información Técnica

Para desarrolladores y especialistas GIS (Geographic Information System):

- [Arquitectura del Sistema](./arquitectura.md)

---

> **Nota**: Para reportar problemas o sugerir mejoras, por favor contacta al equipo de desarrollo.
