---
title: Panel de estado
---

# Panel de estado

El enlace **Rendimiento y estado** de la barra lateral abre `/status`, la sección donde el sistema se
reporta a sí mismo. Son cuatro pestañas, cada una alimentada por un servicio distinto.

| Pestaña | Qué muestra | De dónde sale |
|---|---|---|
| **Procesamiento** | El pipeline de generación de tiles | `tiles-processor` |
| **Caché** | La sincronización y el uso de Redis | `data-service` |
| **Mapas base** | El respaldo de mapas base de terceros | `data-service` |
| **Alertas** | La generación de avisos | `alerts-service` |

Todas tienen un selector de refresco con las opciones sin refresco, 10, 30 o 60 segundos; por defecto
son 30.

## Procesamiento

Es la vista del pipeline de `tiles-processor`. Muestra el agregado por tipo de trabajo —cuántos
terminaron bien, cuántos con error, cuántos fueron a la cola de descarte y cuántos se saltearon—, la
tasa de error, los tiempos promedio y el percentil 95, y una línea de tiempo de los trabajos
recientes.

También muestra la profundidad de las colas y qué unidades están en curso en este momento.

!!! note "Si RabbitMQ no responde, las colas aparecen sin dato"
    La vista se degrada en lugar de fallar: las profundidades quedan vacías con un aviso de
    reintento, y el resto de la información se sigue mostrando.

## Caché

Es la vista de `data-service`. Tiene dos mitades.

La primera es la **sincronización**: por cada dominio —satélite, radar, las dos variantes de ECMWF,
WRF y GFS— cuánto tardó el último ciclo, cuántos objetos procesó, cuántos errores tuvo y cómo
terminó, más el historial de ciclos.

La segunda es **Redis**: memoria usada, fragmentación, claves expiradas y desalojadas, aciertos y
fallos de caché, y —lo más útil para diagnosticar— el desglose de memoria por dominio, que responde
qué producto está ocupando el espacio.

## Mapas base

Muestra el estado del respaldo de mapas base, proveedor por proveedor: por dónde va el recorrido,
cuándo terminó la última pasada completa, la tasa de error, y si el cortacircuitos está abierto por
demasiados fallos seguidos.

## Alertas

Es la vista de `alerts-service`. Muestra, por trabajo de generación, la duración de cada etapa
—intersección, filtrado, renderizado y persistencia— y su resultado, con el desglose de fallos.

Aparte muestra la salud del pool de procesamiento: profundidad de la cola, workers ocupados,
reinicios de worker y avisos pendientes. También lista las corridas recientes del refresco semanal de
capas del IGN.

## Cuando un servicio no responde

Si un backend no contesta, la pestaña conserva los últimos datos que tenía y muestra un cartel
indicando que el servicio no responde, en lugar de vaciarse. Los paneles individuales sin datos
muestran su propio texto de vacío.

!!! note "El sondeo no se detiene al cambiar de pestaña del navegador"
    Dejar el panel abierto en una pestaña de fondo lo mantiene consultando. Sí se detiene al cambiar
    a otra de las cuatro pestañas del panel, porque la vista anterior se destruye.

El detalle de qué mide cada servicio y dónde lo guarda está en
[Observabilidad](arquitectura/observabilidad.md).
