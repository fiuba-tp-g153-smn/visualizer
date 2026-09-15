---
title: 1. Inicio
---

# 1. Inicio

MapaSMN es un sistema de visualización meteorológica y generación de Avisos a
muy Corto Plazo desarrollado para el Servicio Meteorológico Nacional. La
aplicación reúne imágenes satelitales, radares, modelos numéricos, estaciones de
superficie y cartografía de referencia sobre un mismo mapa. El pronosticador
puede comparar esas fuentes, seguir su evolución y dibujar el área que dará
origen a un aviso.

![De los datos crudos al aviso](imgs/diagrams/vista-general.svg){ .diagram loading=lazy }

El sistema procesa los datos crudos antes de mostrarlos. El `tiles-processor`
genera las capas, el `data-service` las publica y el `visualizer` las presenta en
el navegador. Cuando el usuario prepara un aviso, el `alerts-service` calcula
qué departamentos quedan afectados y genera las imágenes que requiere el
circuito del SMN.

La documentación se divide según la tarea de quien la consulta.

<div class="grid cards" markdown>

-   ### :material-book-open-variant: [Manual de usuario](manual/index.md)

    Describe la ventana de trabajo, las capas disponibles, la animación, la
    consulta puntual y la generación de avisos. Está dirigido al usuario de la
    aplicación y no presupone conocimientos sobre su infraestructura.

    [Abrir el manual](manual/index.md)

-   ### :material-server-network: [Documentación técnica](tecnica/index.md)

    Explica la arquitectura, los contratos entre componentes, el despliegue, la
    operación y las medidas necesarias antes de exponer el sistema.

    [Abrir la documentación técnica](tecnica/index.md)

</div>

## Alcance del sistema

MapaSMN permite visualizar los canales ABI y los productos GLM de GOES-19, seis
variables de los radares SINARAME, los modelos ECMWF IFS, WRF-ARG4K y GFS, y las
observaciones de superficie del SMN. A estos datos se suman los mapas base y las
capas de referencia publicadas por el Instituto Geográfico Nacional.

Las capas temporales pueden animarse de forma individual o sincronizada. La
consulta puntual recupera el valor numérico de una capa en una coordenada. Para
la generación de avisos, el usuario dibuja el polígono afectado, revisa los
departamentos intersectados y solicita las dos imágenes oficiales.

## Recorridos recomendados

| Necesidad | Sección |
|---|---|
| Identificar una capa o un producto | [4. Qué muestra cada producto](manual/productos/index.md) |
| Emitir un aviso | [6. Emitir un aviso a corto plazo](manual/avisos.md) |
| Instalar el sistema | [14. Puesta en marcha](tecnica/operacion/puesta-en-marcha.md) |
| Instalar Beta-1 en una VM de 8 GB | [14.1 Beta-1](tecnica/operacion/beta-1.md) |
| Distribuir los componentes | [15. Distribuir el sistema](tecnica/operacion/distribucion.md) |
| Revisar los puertos publicados | [19.1 Superficie expuesta](tecnica/seguridad/superficie.md) |
| Consultar una ruta o variable | [12. Contratos entre servicios](tecnica/contratos/index.md) |

MapaSMN genera el aviso y sus imágenes, pero no realiza la difusión. El circuito
operativo del SMN completa la información y publica el ACP.
