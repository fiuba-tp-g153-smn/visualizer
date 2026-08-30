---
title: Puesta en marcha
---

# Puesta en marcha

Cómo levantar el sistema, en una máquina de laboratorio o en un servidor propio. Está escrito para
alguien que no participó del desarrollo.

!!! danger "Antes de exponerlo a una red"
    Las plantillas de despliegue publican en todas las interfaces varios puertos de infraestructura
    que no deberían salir del host, y ningún servicio autentica al llamante. Levantar el sistema y
    exponerlo son dos decisiones distintas: la segunda requiere leer
    [Endurecimiento](../seguridad/endurecimiento.md) primero.

## Qué hay que decidir antes de empezar

| Decisión | Dónde impacta |
|---|---|
| **Qué productos meteorológicos se van a generar** | Es el factor que más mueve el consumo de CPU y de disco. El catálogo de la aplicación es más amplio que lo que un despliegue suele generar. |
| **Uno o varios hosts** | Hay plantillas para todo junto y para separar la caché en otra máquina. |
| **Si se despliega el servicio de avisos** | Es el único que necesita credenciales del SMN y acceso a su base operativa. Sin él, el mapa funciona igual. |
| **Cuántos trabajadores de procesamiento** | Se fija regenerando las plantillas, no editándolas. |

## Requisitos

| Herramienta | Para qué |
|---|---|
| Docker y Docker Compose | Todo. Es el único requisito para correr el sistema. |
| Python 3.12 | Sólo para trabajar sobre el procesador de mosaicos fuera de contenedor |
| Python 3.13 | Ídem para el servicio de datos y el de avisos |
| Node 24 y npm 11 | Ídem para el visualizador |
| Poetry 2.3.2 | Dependencias de los tres servicios en Python |

Las versiones de Python **no son uniformes** entre servicios: el procesador va por 3.12 y los otros
dos por 3.13. Sólo importa si se trabaja fuera de contenedor.

## Variables de entorno

Cada repositorio trae un archivo de variables de ejemplo, que es la fuente de verdad de qué hay que
configurar. La lista completa, con el significado de cada una, está en
[Configuración y variables](../contratos/configuracion.md).

!!! danger "El archivo de ejemplo del servicio de avisos está pensado para desarrollo"
    Trae habilitada la variable que permite ejecutar migraciones de esquema. Apuntada a la base
    operativa del SMN, el arranque ejecutaría DDL destructivo sobre un sistema que no pertenece a
    este proyecto. Revisá esa línea antes de copiar el archivo, y sobre todo asegurate de que el
    usuario de base de datos **no tenga permisos de esquema**, que es la protección que no depende de
    que nadie se olvide.

## Orden de arranque

El sistema tolera cualquier orden, pero para llegar a ver datos conviene este:

1. **Procesador de mosaicos.** Levanta el broker, el almacén de objetos, el productor, los
   trabajadores y la API de métricas. Es el primero porque los demás dependen de que el almacén
   exista.
2. **Servicio de datos.** Comprueba el almacén de objetos al arrancar y, en producción, **aborta si no
   responde**. Si queda en ciclo de reinicio, empezá por ahí.
3. **Servicio de avisos.** Independiente de los dos anteriores.
4. **Visualizador.** No depende de nadie para arrancar; sin los otros carga igual, vacío.

## Levantar cada stack

### Procesador de mosaicos

```
make up
```

Levanta el broker, el almacén de objetos, el productor, los trabajadores y la API de métricas. El
panel del broker queda en el puerto `15672` y la API de métricas en el `6020`.

Para cambiar la cantidad de trabajadores hay que **regenerar** las plantillas:

```
./scripts/generate-compose.sh --dev --light 3 2
```

!!! warning "No editar las plantillas a mano"
    Las dos plantillas de este repositorio son artefactos generados por ese script. Un cambio manual
    sobrevive hasta la próxima regeneración. Tené en cuenta además que la plantilla de producción
    versionada **difiere de lo que el script produce hoy**: fija versiones de imagen más nuevas y
    publica puertos adicionales del almacén de objetos. Regenerar revierte esas diferencias, así que
    conviene comparar antes y después.

### Servicio de datos

```
make up
```

Levanta la caché y los dos contenedores de la aplicación. La API queda en el puerto `6006`.

Hay una variante repartida, útil para reiniciar la aplicación sin tocar la caché, o para correr la
caché en otro host:

```
make redis
make data
```

Las dos comparten una red externa que **hay que crear a mano la primera vez**.

!!! warning "La variante repartida publica la caché sin contraseña"
    Es la que expone el puerto de la caché para que se pueda alcanzar desde otra máquina. El archivo
    lleva escrito el aviso de que hay que ponerle contraseña y restringir el firewall, y ese cambio
    no está aplicado. Si usás esta variante, aplicalo antes de levantar.

### Servicio de avisos

```
make up
```

Levanta la base de datos y la aplicación, que queda en el puerto `6007`.

!!! warning "El primer arranque tarda varios minutos"
    Antes de responder, el servicio descarga las capas de referencia del IGN, las simplifica en los
    niveles de detalle y construye tres cachés locales. Por eso su comprobación de salud declara ocho
    minutos de gracia. Un contenedor que parece colgado en el primer arranque probablemente esté
    simplificando geometrías.

### Visualizador

```
make up
```

Levanta un contenedor de desarrollo con recarga en caliente en el puerto `4201`. Antes arranca un
contenedor de un solo uso que compila la documentación.

Para producción, la imagen sirve el paquete compilado con un servidor web propio.

!!! warning "Las direcciones de los servicios se hornean en la compilación"
    El visualizador no lee configuración en tiempo de ejecución: las direcciones del servicio de
    datos, del de avisos y del de métricas se incrustan al compilar. Cambiar cualquiera de ellas
    **obliga a reconstruir la imagen**. Es el error de despliegue más frecuente de este sistema:
    editar un archivo de entorno y reiniciar el contenedor no cambia nada.

## Verificar que quedó bien

En orden, y sin usar la aplicación:

1. **El almacén de objetos responde** en su puerto de API S3 desde el host.
2. **El panel del broker muestra las colas** de trabajo y la de descartes.
3. **La API de métricas del procesador** devuelve trabajos procesados, y su cantidad crece con el
   tiempo. Si queda en cero después de un ciclo completo, el productor no está descubriendo datos.
4. **El servicio de datos responde su ruta de estado de sincronización** y muestra ciclos completados
   por dominio.
5. **El servicio de avisos responde**, ya pasada la ventana de simplificación inicial.
6. **El visualizador carga** y su panel de estado muestra las cuatro pestañas con datos.

El panel de estado de la aplicación es la verificación de extremo a extremo más rápida: si sus cuatro
pestañas traen datos, los cuatro servicios están vivos y comunicados. Cómo leerlo está en el
[manual de usuario](../../manual/panel-de-estado.md).

## Fallas frecuentes en el primer arranque

| Síntoma | Causa habitual |
|---|---|
| El servicio de datos reinicia en ciclo | No alcanza el almacén de objetos. Recordá que lo alcanza **saliendo al host**, así que una regla de firewall puede romperlo aunque los dos stacks estén en la misma máquina. Ver [Topología de red](topologia.md). |
| El servicio de datos no levanta y la red no existe | La red externa hay que crearla a mano antes del primer arranque. |
| El servicio de avisos parece colgado varios minutos | Está simplificando las capas de referencia. Es esperable en el primer arranque. |
| El mapa carga vacío | El navegador no alcanza al servicio de datos. El visualizador **no hace de proxy**: publicar sólo su puerto no alcanza. |
| Cambié una variable del visualizador y no pasa nada | Hay que reconstruir la imagen: esas variables se hornean al compilar. |
| Las capas existen pero aparecen atenuadas | No hay datos generados todavía para ese producto, o no está habilitado en la configuración del procesador. |
| Un contenedor muere sin dejar rastro | Probablemente lo mató el sistema operativo por memoria. No hay límites declarados; ver [Capacidad](capacidad.md). |

## Trabajar sobre esta documentación

Desde el repositorio del visualizador:

```
make docs-serve
```

Levanta una vista previa con recarga automática. La compilación real es:

```
make docs
```

Las dos usan la misma imagen fijada de MkDocs Material. **No hay entorno virtual de Python para la
documentación** y no debe agregarse: el sitio se construye dentro de esa imagen tanto en local como
en la etapa correspondiente de la imagen de la aplicación, y las dos rutas tienen que producir lo
mismo.

!!! warning "La compilación es estricta"
    Un enlace roto o una página ausente del índice de navegación no son advertencias: hacen fallar la
    compilación. Es deliberado, porque una página fuera del índice queda invisible en el sitio
    publicado.

### Diagramas

Los diagramas se escriben en D2 y se renderizan a SVG, que **se versionan**:

```
make diagrams
```

La compilación de la documentación no depende de ese objetivo a propósito: D2 no está instalado ni en
integración continua ni en la etapa que construye el sitio, y agregarlo ataría la documentación a una
cadena de herramientas adicional sin ninguna ventaja. Los SVG son artefactos versionados; el objetivo
existe para regenerarlos con un comando y no a mano.

Los SVG viven bajo el árbol de imágenes para que el mecanismo de invalidación de caché les estampe el
hash de su contenido, que es lo que permite servir ese árbol como inmutable.
