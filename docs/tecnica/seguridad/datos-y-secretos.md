---
title: Datos y secretos
---

# Datos y secretos

Qué información maneja el sistema, dónde queda guardada, quién puede leerla y hacia dónde sale.

## Clasificación de los datos

| Dato | Sensibilidad | Dónde vive |
|---|---|---|
| Productos meteorológicos procesados | Pública. Derivada de fuentes abiertas. | Almacén de objetos |
| Observaciones de estaciones | Pública, pero detrás de una clave del organismo | Caché y almacén |
| **Avisos emitidos** | **Integridad crítica.** Su falsificación tiene consecuencias fuera del sistema. | Base de datos operativa del SMN |
| Borradores de polígonos | Baja | Navegador del usuario |
| Métricas operativas | Baja de por sí, útil para reconocimiento | Bases locales de cada servicio |
| Credenciales de infraestructura | Alta | Variables de entorno |
| Clave de estaciones del usuario | Media | Almacenamiento del navegador, en texto plano |

El sistema **no maneja datos personales**. No hay usuarios, no hay cuentas, no hay registro de quién
hizo qué. Eso simplifica mucho el análisis de privacidad, y a la vez es la razón de que no exista
trazabilidad: no hay forma de saber quién generó un aviso.

## La clave de estaciones

Es la única credencial que el sistema le pide al usuario final, y su manejo merece atención:

- La escribe el usuario en el panel de configuración. **No viene compilada en la aplicación** ni se
  obtiene de un servidor.
- Se guarda en el almacenamiento del navegador **en texto plano**.
- Se envía en cada petición como cabecera, a un origen distinto del de la aplicación.
- Es **por navegador y por máquina**. No hay distribución central ni rotación: cambiar la clave
  implica que cada persona la vuelva a cargar a mano.
- Cualquier script que se ejecute en el origen de la aplicación puede leerla. Eso incluye el
  contenido de este sitio de documentación, que se sirve dentro del mismo origen y sin aislamiento.

No es un secreto de alto valor, pero es el que más manos toca y el que no tiene ningún mecanismo de
revocación.

## Inventario de credenciales

Sólo los nombres de las variables; los valores viven fuera del repositorio.

| Credencial | Quién la usa | Alcance |
|---|---|---|
| Usuario y contraseña del broker | Productor, todos los trabajadores y la API de métricas | **La misma para todos** |
| Identidad raíz del almacén de objetos | Arranque del almacén y su panel de administración | Total |
| Identidad de acceso a buckets | Trabajadores y servicio de datos | Ver más abajo |
| Clave de la API de métricas | Sólo la ruta de importación | Escritura de métricas |
| Contraseña de administración de estaciones | Rutas administrativas del servicio de datos | Esas rutas |
| Usuario y contraseña de la base de avisos | Servicio de avisos | Ver más abajo |
| Credenciales de la API del SMN | Servicio de datos | Lectura de observaciones |
| Secretos del despliegue continuo | Sólo los flujos de integración | Disparar despliegues |

### Dos alcances más amplios de lo que parecen

**La identidad con la que el servicio de datos accede al almacén de objetos está documentada como de
sólo lectura, pero está configurada con permisos de administrador globales.** El comentario y la
configuración no coinciden, y lo que manda es la configuración.

**Un único par de credenciales cubre los cuatro buckets del servicio de datos, con permiso de
escritura y borrado, incluido el bucket donde se guardan las claves de estaciones.** El contenedor que
atiende peticiones públicas puede, con las credenciales que ya tiene, escribir y borrar el propio
almacén de claves que usa para autenticar. Separar esa identidad en una de sólo lectura para las
teselas y otra acotada para las claves es un cambio de configuración, no de código.

### El permiso de esquema sobre la base del SMN

La variable que habilita las migraciones de esquema es el único guardián entre este sistema y las
operaciones destructivas sobre la base del organismo. Con ella activada, el arranque del servicio
ejecuta el árbol completo de migraciones, que incluye revisiones que **vacían tablas de departamentos
y provincias** y que **eliminan la tabla de avisos**.

!!! danger "El archivo de ejemplo la trae activada"
    El archivo de variables de ejemplo la entrega habilitada, porque está pensado para desarrollo y
    lo dice en sus propios comentarios. Copiarlo a producción sin revisar esa línea, apuntando a la
    base del organismo, ejecuta DDL destructivo sobre un sistema que no es de este proyecto.

    La protección correcta no es recordar apagarla: es **que el usuario de base de datos no tenga
    permisos de esquema**. Así la variable falla cerrado aunque quede mal configurada.

## Registro de eventos

No se registran credenciales, con una excepción que hoy es latente:

- **La cadena de conexión de la caché se registra completa al arrancar.** Hoy no contiene contraseña
  porque la caché no tiene ninguna. En el momento en que se le agregue una —que es exactamente lo
  que hay que hacer— esa contraseña va a quedar escrita en los registros de arranque de dos
  contenedores. Hay que corregir las dos cosas juntas.
- El script de arranque del almacén de objetos **pasa credenciales como argumentos de línea de
  comandos**, con lo que quedan visibles para cualquiera que pueda listar procesos dentro de ese
  contenedor.
- El servicio de avisos **registra el polígono completo del usuario** en nivel informativo, y el texto
  de la excepción de un trabajo fallido queda legible desde una ruta pública de métricas.
- La clave de la API de métricas se registra únicamente como "configurada" o "sin configurar", nunca
  su valor.

## Persistencia y copias de respaldo

| Volumen | Qué contiene | Si se pierde |
|---|---|---|
| Datos del almacén de objetos y su índice | Todas las teselas generadas | Se regenera reprocesando, pero es la mayor parte del trabajo del sistema. **Los dos volúmenes hay que respaldarlos juntos**: el índice sin los datos no sirve. |
| Base de datos de avisos | Los avisos y las capas de referencia | Pérdida definitiva |
| Bases locales del servicio de avisos | Historial, trabajos y métricas | Pérdida definitiva |
| Datos de trabajo del procesador | Archivos crudos aún sin procesar | Se vuelven a descargar |
| Caché | Nada propio | Se repuebla sola |

!!! warning "Nada de esto tiene respaldo automático"
    No hay ninguna tarea de copia de respaldo en los repositorios. Las bases locales del servicio de
    avisos sobreviven a un redespliegue porque están en volúmenes nombrados, pero eso no es un
    respaldo: no protege contra el borrado del volumen ni contra la corrupción.

## Salidas hacia afuera

La lista para escribir una regla de egreso. Sin estos destinos el sistema no funciona.

### Desde los servidores

| Destino | Para qué |
|---|---|
| Buckets públicos de NOAA en AWS | Imágenes de satélite y descargas eléctricas. Acceso anónimo. |
| Servicio de datos de ECMWF y sus réplicas | Salidas del modelo europeo |
| Servidor de modelos de NOAA | Salidas del modelo global |
| API del SMN | Observaciones de estaciones |
| Registro de estaciones del SMN | Catálogo de estaciones |
| Servicios del IGN | Capas de referencia y búsqueda de lugares |
| Base de datos operativa del SMN | Escritura de avisos y lectura de referencia |
| Registros de imágenes de contenedores | Sólo en el despliegue |

### Desde el navegador del usuario

Esto es lo que se suele pasar por alto: **el navegador no habla sólo con el visualizador**.

| Destino | Para qué |
|---|---|
| Servicio de datos, de avisos y de métricas | Todos los datos de la aplicación, directo y sin proxy |
| Servicios de teselas del IGN, Esri y Google | Los mapas de fondo, **directo al proveedor** |
| Servicio de búsqueda de lugares | El buscador del panel explorador |
| Fuentes tipográficas de Google | Tipografía de la interfaz |

Si el puesto de trabajo tiene egreso restringido, hay que permitir todos estos destinos o la
aplicación queda a medias. No hay analítica ni scripts de terceros.

!!! warning "Dos salidas por HTTP sin cifrar"
    El registro de estaciones del SMN se descarga por HTTP plano. Es información pública, así que el
    riesgo no es de confidencialidad sino de integridad: quien pueda interceptar ese tráfico puede
    alterar el catálogo de estaciones que el sistema ingiere.

    Además, los valores por defecto de las direcciones del servicio de avisos y del de métricas son
    HTTP sobre `localhost`. En producción tienen que apuntar a HTTPS, o el navegador va a bloquear
    esas peticiones por contenido mixto.

!!! note "El valor por defecto de la API del SMN es el entorno de prueba"
    La variable correspondiente apunta al entorno de test del organismo. Es una decisión sensata para
    un valor por defecto, pero hay que revisarla explícitamente al desplegar en producción.

## Imágenes de contenedor

El archivo que excluye contenido del contexto de compilación del visualizador **tiene comentadas las
líneas que excluirían los archivos de variables de entorno**. Un archivo de entorno presente en el
directorio al compilar termina copiado dentro de una capa intermedia de la imagen. No llega a la
imagen final, que sólo lleva el paquete compilado y la configuración del servidor web, pero conviene
destapar esas líneas: es un renglón y elimina la clase de error entera.
