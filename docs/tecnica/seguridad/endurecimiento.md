---
title: Endurecimiento
---

# Endurecimiento previo al despliegue

La lista concreta de cambios, ordenada por severidad. Cada punto dice **qué está mal hoy**, **qué
hacer** y **de qué tipo de cambio se trata**: casi todos son de configuración o de despliegue, no de
código.

Los tres primeros bloqueos son los que impiden recomendar un despliegue expuesto tal como está.

## Bloqueantes

### 1. Resolver quién puede crear un aviso

**Hoy**: la ruta que crea un aviso no pide credencial alguna y termina insertando una fila en la base
operativa del SMN.

**Antes que nada**, hay que responder una pregunta que no se puede contestar desde estos
repositorios: **¿la promoción de esa fila al registro definitivo es desatendida?** Si lo es, una
petición anónima equivale a un aviso oficial y el puerto no puede publicarse en ninguna condición.

**Qué hacer**, en orden de preferencia:

1. No publicar ese puerto en internet: dejarlo accesible sólo desde la red donde trabajan los
   pronosticadores, por VPN o por lista de direcciones.
2. Poner autenticación delante, en el proxy inverso, si hace falta acceso remoto. Es la solución más
   rápida y no toca el código.
3. Agregar autenticación al servicio. Es lo correcto a mediano plazo, y arrastra la corrección del
   origen cruzado del punto 3.

*Tipo de cambio: despliegue, o código si se elige la tercera opción.*

### 2. Cerrar los puertos de infraestructura

**Hoy**: el almacén de objetos publica su interfaz de archivos y su coordinador **sin autenticación**,
el broker publica su panel, la base de datos de avisos publica el puerto de MySQL, y en la variante de
despliegue distribuido la caché se publica sin contraseña.

**Qué hacer**:

- Quitar los mapeos de puertos que no hacen falta —la base de datos y el panel del broker no se
  necesitan desde fuera del host—.
- Los que sí tienen que salir, publicarlos con dirección de escucha explícita en la interfaz interna
  en lugar de en todas.
- Ponerle contraseña a la caché **y a la vez** corregir el registro de la cadena de conexión, que hoy
  la escribiría completa en el log de arranque.
- Aplicar el filtrado en el firewall del proveedor o en la cadena reservada al operador, **no** en el
  firewall del host configurado de la manera habitual: las reglas que escribe Docker se evalúan
  antes.

*Tipo de cambio: configuración de despliegue.*

### 3. Quitarle a la base del SMN los permisos de esquema

**Hoy**: el árbol de migraciones —que incluye revisiones que vacían tablas y eliminan la de avisos— se
ejecuta al arrancar si una variable de entorno está activada, y el archivo de variables de ejemplo la
trae activada.

**Qué hacer**: crear el usuario de base de datos **sin permisos de DDL**. Así, aunque la variable
quede mal configurada, la operación destructiva no puede ejecutarse. Apagar la variable es necesario
pero no suficiente: depende de que nadie se equivoque, una vez, en un archivo de configuración.

*Tipo de cambio: permisos de base de datos, del lado del organismo.*

## Importantes

### 4. Corregir el origen cruzado del servicio de avisos

**Hoy**: origen permitido `*` junto con credenciales habilitadas.

**Qué hacer**: restringir el origen a la dirección real del visualizador. Es obligatorio antes de
agregar cualquier forma de autenticación por sesión; hoy no hay sesión que robar, pero la
configuración quedaría abierta justo cuando empiece a importar.

*Tipo de cambio: una línea de código.*

### 5. Desactivar la documentación interactiva de las APIs en producción

**Hoy**: los dos servicios en Python publican su esquema y su interfaz de exploración sin
restricción, y uno de ellos nombra ahí la variable de la que sale su contraseña de administración.

**Qué hacer**: desactivarla cuando el entorno es de producción.

*Tipo de cambio: una línea por servicio.*

### 6. Agregar cabeceras de seguridad

**Hoy**: el servidor web del visualizador sólo emite cabeceras de caché.

**Qué hacer**: agregar política de contenido, control de enmarcado, bloqueo de adivinación de tipo,
política de referente, política de permisos y transporte estricto; y desactivar la firma de versión
del servidor. La política de contenido hay que escribirla contemplando los destinos externos que la
aplicación usa —proveedores de mapas de fondo, servicios del IGN, tipografías— que están listados en
[Datos y secretos](datos-y-secretos.md).

*Tipo de cambio: configuración del servidor web.*

### 7. Poner límites de recursos a los contenedores

**Hoy**: **ninguno** de los contenedores del sistema declara límite de memoria ni de CPU. Un
trabajador procesando un archivo patológico puede consumir toda la memoria del host y hacer que el
sistema operativo mate a la base de datos o a la caché.

**Qué hacer**: declarar memoria y CPU por contenedor, empezando por los trabajadores del procesador,
que son los que más consumen y los que procesan entrada externa.

*Tipo de cambio: configuración de despliegue. Ver [Capacidad](../operacion/capacidad.md) para los
valores.*

### 8. Acotar el alcance de las credenciales del almacén de objetos

**Hoy**: la identidad que el servicio de datos usa está documentada como de sólo lectura pero
configurada con permisos de administrador; y un mismo par de credenciales, con permiso de escritura y
borrado, cubre los cuatro buckets, incluido el que guarda las claves de estaciones.

**Qué hacer**: una identidad de sólo lectura para servir teselas, y otra acotada al bucket de claves,
usada únicamente por las rutas que lo necesitan.

*Tipo de cambio: configuración del almacén.*

### 9. Acotar las rutas de intersección geométrica

**Hoy**: dos rutas aceptan un polígono sin límite de tamaño y hacen el cálculo geométrico en el mismo
hilo que atiende las peticiones. Un polígono suficientemente grande bloquea el servicio completo.

**Qué hacer**: limitar la cantidad de vértices en la entrada —la ruta de creación ya lo hace, con lo
que hay precedente— y mover el cálculo fuera del hilo de atención.

*Tipo de cambio: código.*

## Higiene

### 10. Ejecutar los contenedores sin privilegios

Ninguna de las imágenes del sistema cambia de usuario: todos los procesos corren como `root` dentro
de su contenedor, incluido el servidor web. Agregar un usuario sin privilegios a cada imagen, y
considerar sistema de archivos de sólo lectura y descarte de capacidades donde se pueda.

### 11. Separar las credenciales del broker

Productor, trabajadores y API de métricas comparten **el mismo usuario y contraseña**. Comprometer
cualquiera de ellos entrega el control del broker, incluida la posibilidad de inyectar unidades de
trabajo arbitrarias. Conviene una identidad por rol, con permisos acotados a las colas que cada uno
necesita.

### 12. Reactivar las verificaciones de integración continua

En el procesador de mosaicos, los pasos de análisis estático, verificación de tipos y pruebas
unitarias están **desactivados con una marca temporal**, y la compuerta final los da por aprobados. El
análisis de vulnerabilidades y el de secretos sí corren y bloquean. Reactivar los tres pasos, o al
menos que la compuerta no los cuente como exitosos mientras estén apagados.

### 13. Fijar las imágenes base

Las imágenes están fijadas por etiqueta, no por resumen criptográfico. Dos etiquetas se mueven solas
—la del servidor web del visualizador y la de la etapa de compilación—, con lo que dos compilaciones
del mismo commit pueden producir imágenes distintas. Fijar por resumen donde importe la
reproducibilidad.

Hay además dos dependencias fuera del archivo de bloqueo del procesador: una que se instala siempre
en su última versión y otra que se toma directamente de la punta de un repositorio. Las dos son
puntos de entrada de cadena de suministro.

### 14. Cerrar los detalles menores

- Destapar las líneas que excluyen los archivos de variables de entorno del contexto de compilación
  del visualizador.
- Dejar de registrar el polígono completo del usuario, y de exponer el texto de las excepciones en la
  ruta pública de métricas.
- Poner una política de retención a las imágenes generadas por el servicio de avisos: hoy **no se
  borran nunca** y no hay tope, así que peticiones repetidas llenan el volumen.
- Descargar el registro de estaciones por HTTPS en lugar de HTTP.
- Revisar que la dirección de la API del SMN no siga apuntando al entorno de prueba.
- Agregar `restart:` a los servicios de larga vida que no lo declaran en las plantillas de desarrollo.

## Lista de verificación

Para ir tildando antes de exponer el sistema.

- [ ] Se determinó si la promoción de un aviso a registro definitivo es desatendida
- [ ] El puerto del servicio de avisos no es alcanzable desde internet, o tiene autenticación delante
- [ ] La interfaz de archivos y el coordinador del almacén de objetos no salen del host
- [ ] El panel del broker no sale del host
- [ ] El puerto de la base de datos no sale del host
- [ ] La caché tiene contraseña, y la cadena de conexión ya no se registra completa
- [ ] El filtrado está en el firewall del proveedor o en la cadena del operador, no sólo en el del host
- [ ] El usuario de base de datos del SMN no tiene permisos de esquema
- [ ] La variable que habilita las migraciones está desactivada en producción
- [ ] El origen cruzado del servicio de avisos está restringido
- [ ] La documentación interactiva de las APIs está desactivada
- [ ] El servidor web emite las cabeceras de seguridad
- [ ] Todos los contenedores tienen límite de memoria y de CPU
- [ ] Las identidades del almacén de objetos están acotadas por bucket y por operación
- [ ] Hay una tarea de respaldo para los volúmenes de datos y del índice del almacén, tomados juntos
- [ ] Hay una tarea de respaldo para la base de avisos y las bases locales
- [ ] Está definida la retención de las imágenes generadas
- [ ] La lista de egreso permite todos los destinos, incluidos los que llama el navegador
