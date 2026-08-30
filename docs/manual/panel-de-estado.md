---
title: El panel de estado
---

# El panel de estado

El acceso **Rendimiento y estado** de la barra lateral abre una sección donde el sistema se reporta a
sí mismo. No es una herramienta meteorológica: sirve para responder una pregunta muy concreta —
**¿lo que estoy viendo está actualizado?**

Es la primera parada cuando una capa no aparece, cuando los datos parecen viejos o cuando un aviso
tarda más de lo normal en generarse.

## Las cuatro pestañas

| Pestaña | Qué te dice |
|---|---|
| **Procesamiento** | Si las imágenes se están generando con normalidad. |
| **Caché** | Si los datos ya generados se están sirviendo rápido. |
| **Mapas base** | Si la cartografía de fondo está disponible. |
| **Alertas** | Si la generación de avisos está sana. |

Todas tienen un selector de refresco con las opciones sin refresco, 10, 30 o 60 segundos. Por
defecto son 30.

## Procesamiento

Es la vista del proceso que genera las imágenes de cada producto. Muestra, por tipo de trabajo,
cuántos terminaron bien, cuántos con error, cuántos se descartaron y cuántos se saltearon, junto con
la tasa de error y los tiempos de procesamiento.

También muestra cuánto trabajo hay en espera y qué se está procesando en este preciso momento.

**Cómo leerlo**: una tasa de error baja y trabajos completándose de forma continua es lo normal. Si
ves mucho trabajo acumulado en espera, los datos más recientes de esa familia de productos pueden
estar demorados. Errores sostenidos en un tipo de trabajo explican por qué una capa concreta no tiene
imágenes nuevas.

## Caché

Tiene dos mitades. La primera muestra, por cada familia de productos —satélite, radar, las dos
variantes de ECMWF, WRF y GFS—, cuánto tardó el último ciclo de sincronización, cuántos elementos
procesó y cómo terminó.

La segunda muestra el uso de memoria del sistema de caché, incluido el desglose por familia de
producto, que responde qué está ocupando el espacio.

**Cómo leerlo**: si un dominio hace mucho que no completa un ciclo, ahí está la explicación de una
capa desactualizada.

## Mapas base

El estado de la copia propia de los fondos de mapa, proveedor por proveedor: por dónde va el
recorrido, cuándo terminó la última pasada completa, la tasa de error y si el sistema dejó de
insistir con un proveedor por acumular demasiadas fallas.

**Cómo leerlo**: si el mapa de fondo no carga, mirá acá antes de suponer que es tu conexión.

## Alertas

La vista de la generación de avisos. Muestra, por cada aviso generado, cuánto tardó cada etapa
—intersección, filtrado, renderizado y guardado— y cómo terminó, con el desglose de las fallas.

Aparte muestra la salud del sistema de procesamiento: cuánto trabajo hay en cola, cuántos
procesadores están ocupados y cuántos avisos quedan pendientes. También lista las últimas
actualizaciones semanales de las capas de referencia.

**Cómo leerlo**: si al emitir un aviso te dijo que la cola estaba llena, acá vas a ver por qué. Una
cola con trabajo acumulado y todos los procesadores ocupados significa esperar un momento y
reintentar.

## Cuando un servicio no responde

Si una parte del sistema no contesta, la pestaña conserva los últimos datos que tenía y muestra un
cartel indicándolo, en lugar de quedarse en blanco. Los paneles individuales sin datos muestran su
propio mensaje.

!!! note "Dejarlo abierto en segundo plano sigue consultando"
    El panel no deja de actualizarse por cambiar a otra pestaña del navegador. Sí se detiene si
    cambiás a otra de las cuatro pestañas del propio panel, porque la vista anterior se cierra.
