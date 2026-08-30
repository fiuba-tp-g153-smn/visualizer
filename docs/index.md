---
title: Inicio
---

# Documentación de MapaSMN

MapaSMN es un sistema de visualización y aviso por condiciones meteorológicas extremas. Integra
datos de satélite, radar y modelos numéricos sobre un mapa interactivo, y le da al pronosticador las
herramientas para analizarlos y para emitir un aviso a corto plazo.

Esta documentación está dividida en dos mitades independientes. Cada una está escrita para un lector
distinto, y no hace falta leer la otra.

<div class="grid cards" markdown>

-   ### :material-book-open-variant: [Manual de usuario](manual/index.md)

    **Para quien usa la aplicación.**

    Qué es cada cosa en pantalla, qué significa cada producto meteorológico y cómo interpretarlo,
    cómo animar, cómo medir y cómo emitir un aviso.

    Sin requisitos técnicos previos.

    [Empezar por acá](manual/index.md)

-   ### :material-server-network: [Documentación técnica](tecnica/index.md)

    **Para quien lo despliega, lo opera o lo audita.**

    La arquitectura, los contratos entre servicios, la topología de red, el procedimiento de puesta
    en marcha, y el análisis de seguridad del sistema.

    Orientada a infraestructura, no a desarrollo.

    [Ir a la referencia técnica](tecnica/index.md)

</div>

## Qué hace el sistema

- **Satélite GOES-19**: tres canales del instrumento de imágenes y los tres productos de descargas
  eléctricas.
- **Radar SINARAME**: las variables polarimétricas de la red, en tres elevaciones.
- **Modelos numéricos**: ECMWF, WRF en su configuración regional argentina, y GFS.
- **Estaciones de superficie**: las observaciones del SMN, con histórico por estación.
- **Capas de referencia del IGN**: límites, hidrografía, infraestructura y más.
- **Animación** de cualquier capa temporal, con reproducción sincronizada entre capas.
- **Consulta puntual** del valor numérico real de una variable en un punto del mapa.
- **Avisos a corto plazo**: trazado de polígonos, intersección con departamentos y generación de las
  imágenes oficiales.

## Cómo elegir

| Si querés… | Andá a |
|---|---|
| Entender qué muestra una capa | [Manual ▸ los productos](manual/index.md) |
| Saber cómo se emite un aviso | [Manual ▸ avisos](manual/avisos.md) |
| Levantar el sistema en tu propia red | [Técnica ▸ puesta en marcha](tecnica/operacion/puesta-en-marcha.md) |
| Saber qué puertos expone y qué queda autenticado | [Técnica ▸ superficie expuesta](tecnica/seguridad/superficie.md) |
| Evaluar si es seguro desplegarlo | [Técnica ▸ seguridad](tecnica/seguridad/index.md) |
| Consultar una ruta HTTP o una variable de entorno | [Técnica ▸ contratos](tecnica/contratos/api.md) |

---

Para reportar un problema o sugerir una mejora, contactá al equipo de desarrollo.
