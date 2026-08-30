---
title: Topología de red
---

# Topología de red

Cómo están cableados los cuatro stacks entre sí. Es lo primero que hay que entender para decidir
dónde poner un firewall, y tiene una particularidad que sorprende: **no hay una red compartida entre
los stacks**.

![Los cuatro stacks y la costura que los une](../../imgs/diagrams/topologia-red.svg){ .diagram loading=lazy }

## Las redes

Cada stack define su propia red de compose. La única declarada como externa es la del servicio de
datos, y la usan sólo sus tres archivos de despliegue —la variante todo en uno, la que corre sólo la
aplicación y la que corre sólo la caché—. Hay que crearla a mano una vez antes del primer arranque.

Dentro de un stack, los contenedores se alcanzan por su nombre de servicio. **Entre stacks, no.**

## La costura: el tráfico entre stacks pasa por el host

El servicio de datos alcanza al almacén de objetos del procesador de mosaicos **saliendo al host y
volviendo a entrar** por un puerto publicado, mediante un nombre especial que resuelve a la dirección
de la puerta de enlace del host.

Esto tiene tres consecuencias prácticas:

1. **El puerto del almacén de objetos tiene que estar publicado**, aunque los dos stacks corran en la
   misma máquina. No es una exposición decorativa: es la vía por la que el sistema funciona.
2. **Filtrarlo rompe el arranque, no sólo el tráfico.** El servicio de datos comprueba el almacén al
   arrancar y, en producción, aborta si no responde dentro del tiempo límite. El resultado es un
   contenedor en ciclo de reinicio, no un servicio degradado. Si después de aplicar reglas de
   firewall el servicio de datos no levanta, este es el primer lugar donde mirar.
3. **El filtrado tiene que ser por dirección de origen**, no por cierre del puerto: hay que permitir
   al host y bloquear el resto.

La alternativa limpia es unir los dos stacks a una red de compose común y apuntar el servicio de datos
al nombre interno del almacén. Es un cambio de configuración y elimina de raíz un puerto publicado.

## Puertos

El mapa completo, con qué debería ser alcanzable desde dónde, está en
[Superficie expuesta](../seguridad/superficie.md). El resumen operativo:

| Deben ser alcanzables desde el navegador del usuario | Deben ser alcanzables sólo desde el host | No deberían salir del host |
|---|---|---|
| Visualizador, documentación, servicio de datos, servicio de avisos, API de métricas | API S3 del almacén de objetos | Interfaz de archivos y coordinador del almacén, panel del broker, base de datos, caché |

!!! warning "Publicar sólo el visualizador no alcanza"
    El servidor web del visualizador **no hace de proxy** hacia ningún otro servicio. El navegador
    del usuario llama por su cuenta al servicio de datos, al de avisos y al de métricas. Si se
    publica únicamente el puerto del visualizador, la aplicación carga y queda vacía.

    Si se quiere una única entrada, hay que agregar el proxy en el borde y apuntar las variables de
    dirección de la aplicación a esas rutas. Es un cambio de configuración de compilación del
    visualizador más reglas en el proxy inverso.

!!! danger "Las reglas de Docker se evalúan antes que las del firewall del host"
    Docker inserta sus propias reglas de redirección. Un puerto publicado puede quedar accesible
    aunque el firewall del host, configurado de la manera habitual, parezca cerrarlo. El control
    efectivo va en el firewall del proveedor de infraestructura, en el borde, o en la cadena que
    Docker deja reservada para reglas del operador.

## Orden de arranque

Cada stack declara sus dependencias internas con comprobación de salud, así que dentro de un stack el
orden se respeta solo. Entre stacks no hay coordinación:

- El **procesador de mosaicos** tiene que estar arriba antes que el servicio de datos, porque este
  último comprueba el almacén de objetos al arrancar y aborta si no responde.
- El **servicio de avisos** aplica migraciones antes de levantar su API y aborta si fallan.
- El **visualizador** no depende de nadie para arrancar: es estático. Si los servicios no están, carga
  igual y muestra los estados vacíos.

## Volúmenes

| Volumen | Contiene | Nota |
|---|---|---|
| Datos del almacén de objetos | Las teselas generadas | **Respaldar junto con el índice**: por separado no sirven |
| Índice del almacén de objetos | El árbol de archivos | Ídem |
| Base de datos de avisos | Avisos y capas de referencia | Copia única |
| Bases locales del servicio de avisos | Historial, trabajos y métricas | Copia única, sobrevive al redespliegue |
| Datos de trabajo del procesador | Archivos crudos pendientes | Se vuelven a descargar |
| Caché | Nada propio | Se repuebla sola |

## Despliegue mínimo y despliegue completo

No hace falta levantar todo para tener el mapa funcionando.

**Mínimo — mapa sin avisos:**

- Procesador de mosaicos, con su almacén de objetos y su broker.
- Servicio de datos, con su caché.
- Visualizador.

**Completo**, agrega:

- Servicio de avisos, con su base de datos, y acceso a la base operativa y a la API del SMN.

El visualizador degrada de forma razonable si falta el servicio de avisos: el panel correspondiente
queda inutilizable, el resto del mapa funciona. Lo que no tolera es la falta del servicio de datos,
que es de donde salen todas las capas.

## Tareas programadas

| Qué | Cada cuánto | Dónde corre |
|---|---|---|
| Descubrimiento de datos nuevos en las fuentes | Cada 5 minutos | Productor del procesador de mosaicos |
| Ciclos de sincronización de caché | Continuo, por dominio | Sincronizador del servicio de datos |
| Refresco de capas de referencia del IGN | Semanal, domingos de madrugada | Servicio de avisos |

!!! warning "Sin verificar: la llegada de radar, WRF y descargas eléctricas"
    Tres de las fuentes están configuradas como locales y no se encontró en los repositorios el
    mecanismo por el que esos archivos llegan al volumen de trabajo del procesador. Si llegan por
    red —una transferencia programada, un montaje remoto, un servicio del organismo—, ese canal no
    figura en este mapa y hay que agregarlo a las reglas de firewall. Es la única pregunta abierta de
    esta página, y hay que resolverla con el equipo antes de cerrar el perímetro.
