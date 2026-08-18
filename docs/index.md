---
title: Inicio
---

# Documentación de MapaSMN

MapaSMN es un sistema de visualización y aviso por condiciones temporales extremas. Integra datos de
satélite, radar meteorológico y modelos numéricos sobre un mapa interactivo, y le da al pronosticador
las herramientas para analizarlos y para emitir un aviso a corto plazo.

Esta documentación tiene dos mitades: una **guía de uso** para quien opera el visualizador, y una
**referencia técnica** para quien desarrolla o mantiene el sistema.

## Guía de uso

- [Uso general](uso-general.md) — la interfaz, las capas, la animación y las herramientas.
- [Mapa base](mapa-base.md) — los ocho fondos cartográficos disponibles y cuál conviene.
- [Productos meteorológicos](productos-meteorologicos.md) — qué representa cada capa y para qué sirve.
- [Avisos a corto plazo](alertas.md) — dibujar un área, verificar departamentos y emitir un ACP.
- [Panel de estado](panel-de-estado.md) — cómo leer los tableros de salud del sistema.

## Qué ofrece el visualizador

- **Satélite GOES-19**: tres canales del ABI y los tres productos de descargas eléctricas del GLM.
- **Radar SINARAME**: las variables polarimétricas de la red, en tres elevaciones.
- **Modelos numéricos**: ECMWF, WRF en su configuración regional argentina, y GFS.
- **Estaciones de superficie**: las observaciones del SMN, con histórico por estación.
- **Capas de referencia del IGN**: límites, hidrografía, infraestructura y más, por WMS.
- **Animación** de cualquier capa temporal, con reproducción sincronizada entre capas.
- **Consulta puntual** del valor numérico real de una variable en un punto del mapa.
- **Avisos a corto plazo**: trazado de polígonos, intersección con departamentos y generación de las
  imágenes oficiales.

## Referencia técnica

- [Arquitectura](arquitectura/index.md) — los cuatro servicios y cómo se comunican.
- [Servicios](servicios/tiles-processor.md) — cada uno por dentro.
- [API HTTP](referencia/api.md) — todas las rutas, sus parámetros y sus errores.
- [Puesta en marcha local](desarrollo/entorno-local.md) — cómo levantarlo.

---

Para reportar un problema o sugerir una mejora, contactá al equipo de desarrollo.
