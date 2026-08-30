---
title: Superficie expuesta
---

# Superficie expuesta

Todo lo que un atacante puede alcanzar, y qué le pide el sistema para dejarlo pasar.

## Puertos

Ninguna de las plantillas de despliegue del sistema declara una interfaz de escucha. En Docker, un
mapeo escrito como `9000:8333` se publica en **todas** las interfaces del host. La columna "debería
ser" es la recomendación, no lo que ocurre hoy.

| Puerto | Qué hay detrás | Autenticación | Debería ser |
|---|---|---|---|
| `6010` | Visualizador (archivos estáticos) | Ninguna | Público |
| `6011` | Este sitio de documentación | Ninguna | Público |
| `6006` | API del servicio de datos | Ninguna, salvo estaciones | Público |
| `6007` | API del servicio de avisos | **Ninguna** | Público sólo si se acepta el riesgo |
| `6020` | API de métricas del procesador | Lectura anónima; escritura con clave | Restringido por IP |
| `9000` | API S3 del almacén de objetos | Identidades S3 configuradas | Restringido por IP |
| `8888` | Interfaz de archivos del almacén | **Ninguna** | **Interno** |
| `9333` | Coordinador del almacén | **Ninguna** | **Interno** |
| `23646` | Panel de administración del almacén | Credenciales raíz del almacén | **Interno** |
| `5672` | Broker de mensajes | Usuario y contraseña por variable | **Interno** |
| `15672` | Panel del broker | Usuario y contraseña por variable | **Interno** |
| `6379` | Caché | **Ninguna** | **Interno** |
| `3306` | Base de datos de avisos | Usuario y contraseña | **Interno** |

!!! danger "Los cuatro que hay que cerrar antes de exponer el host"
    - **`8888`, la interfaz de archivos del almacén de objetos.** Da acceso al árbol completo de
      archivos sin firmar ninguna petición. Anula por completo el control por bucket que sí está
      configurado en la API S3 del puerto 9000: quien llegue acá lee, escribe y borra cualquier
      objeto.
    - **`9333`, el coordinador del almacén.** El propio script de arranque lo describe como puerto no
      autenticado.
    - **`6379`, la caché**, en la variante de despliegue en la que se publica. El archivo que la
      define lleva escrito el comentario de que hay que ponerle contraseña y restringir el firewall,
      y ese cambio no está aplicado. Una caché sin contraseña abierta a internet se compromete en
      minutos.
    - **`3306`, la base de datos de avisos.** Los servicios la alcanzan por el nombre de red interno,
      así que publicarla no aporta nada operativamente.

!!! note "La caché sólo se publica en una de las dos variantes"
    En la plantilla que levanta todo en un solo host, la caché **no** publica puertos: es alcanzable
    únicamente desde la red interna del stack. La exposición aparece en la variante pensada para
    correr la caché en un host separado, que es justamente donde debe atravesar la red. El riesgo es
    real en esa variante y no en la otra: conviene verificar cuál se está usando antes de decidir.

!!! warning "El firewall del host puede no alcanzar"
    Docker escribe sus propias reglas de redirección, que se evalúan antes que las de un firewall de
    host configurado de la manera habitual. Un puerto publicado puede quedar accesible aunque el
    firewall parezca decir lo contrario. El control efectivo hay que ponerlo en el firewall del
    proveedor, en el borde, o en la cadena que Docker deja reservada para reglas del operador.

## Rutas HTTP

### Servicio de datos

Alrededor de cuarenta rutas de lectura, **todas anónimas**: teselas de radar, satélite, ECMWF, WRF,
GFS y mapas base, listados de períodos disponibles, consulta de valores puntuales, el estado de
sincronización y las nueve rutas de métricas —incluidas las que reportan el estado interno de la
caché—.

Las únicas rutas con control de acceso son las de estaciones meteorológicas:

| Grupo | Control |
|---|---|
| Lectura de estaciones (5 rutas) | Cabecera con clave de acceso |
| Administración de estaciones (4 rutas) | Cabecera con contraseña de administración, comparada en tiempo constante |

### Servicio de avisos

**Diecisiete rutas, ninguna autenticada.** Incluye la que crea un aviso.

!!! danger "Un llamante anónimo puede insertar una fila de aviso en la base del SMN"
    La ruta de creación acepta un polígono y un código de fenómeno sin credencial alguna, y termina
    insertando una fila en la tabla intermedia de la base operativa del organismo, marcada como no
    procesada. Un servicio externo del SMN es el que la promueve a la tabla definitiva.

    **Si esa promoción es desatendida, una petición anónima equivale a un aviso oficial.** Ese
    servicio no forma parte de estos repositorios, así que desde acá no se puede determinar; es la
    primera pregunta que hay que responder antes de publicar este puerto.

Dos rutas de intersección geométrica no tienen límite de tamaño de polígono y ejecutan el cálculo en
el mismo hilo que atiende las peticiones: un polígono suficientemente grande o degenerado bloquea el
servicio entero. La ruta de creación sí valida el tamaño, pero sólo del contorno exterior.

### API de métricas del procesador

Lectura anónima de todas las métricas de procesamiento. La única ruta protegida es la de importación,
que exige una clave por cabecera, la compara en tiempo constante y falla cerrado si la clave no está
configurada.

### Visualizador

Archivos estáticos. **No hay ningún `proxy_pass`**: no es un proxy abierto, pero tampoco agrupa a los
demás servicios. Es la razón por la que el navegador termina hablando con cuatro puertos distintos.

## Documentación interactiva de las APIs

Los dos servicios en Python publican sus rutas de documentación interactiva y su esquema de API sin
restricción. Le entregan a un atacante el catálogo completo de rutas y parámetros sin necesidad de
adivinar. En uno de los dos, además, la descripción del propio esquema nombra la cabecera de
administración y la variable de entorno de la que sale su contraseña.

Desactivarlas en producción es un cambio de una línea por servicio.

## Origen cruzado

Los tres servicios responden con origen permitido `*`.

| Servicio | Origen | Credenciales | Consecuencia |
|---|---|---|---|
| Datos | `*` | No | Aceptable: la autenticación que tiene es por cabecera, no por cookie. |
| Métricas | `*` | No | Aceptable con la misma lógica. |
| **Avisos** | `*` | **Sí** | Cualquier página web que visite un usuario puede hacer que su navegador ejecute operaciones contra el servicio. |

El caso del servicio de avisos es el que hay que corregir: permitir credenciales junto con origen
comodín es una combinación que los navegadores rechazan en el caso general, y que acá se sostiene
sólo porque no hay sesión que robar. En cuanto se agregue autenticación —que es lo que hay que
hacer— la configuración pasa a ser un agujero directo.

## Cabeceras de seguridad

El servidor web que publica el visualizador **no emite ninguna cabecera de seguridad**. Las únicas
que agrega son de caché. Faltan todas las habituales: política de contenido, control de enmarcado,
bloqueo de adivinación de tipo, política de referente, política de permisos y transporte estricto.
Tampoco está desactivada la firma de versión del servidor.

Es de las cosas más baratas de arreglar y está enteramente del lado del despliegue.

## El sitio de documentación dentro de la aplicación

La aplicación embebe este sitio en un marco del **mismo origen** y sin atributo de aislamiento. Es
deliberado: el marco necesita ser del mismo origen para que la aplicación pueda sincronizar la URL
con la página que se está leyendo.

La consecuencia es que **el contenido de la documentación está dentro del límite de confianza de la
aplicación**. Cualquier script que llegue a servirse desde este sitio puede leer el almacenamiento
del navegador, incluida la clave de acceso a estaciones. Hoy el contenido se compila dentro de la
imagen a partir del repositorio, así que el riesgo es de cadena de suministro, no de entrada de
usuario. Pero es una decisión de diseño que conviene tener registrada: aislar el marco rompe la
sincronización de URL, así que las dos cosas no se pueden tener a la vez sin rehacer ese mecanismo.

## Lo que no se encontró

Vale tanto como lo anterior, para no gastar esfuerzo donde no hace falta:

- Sin inyección de SQL: las consultas de tiempo de ejecución están parametrizadas.
- Sin ejecución de comandos: no se usa shell en ninguna invocación de subproceso.
- Sin traversal de rutas desde las fuentes externas de datos.
- Sin secretos incrustados en el paquete que descarga el navegador.
- Sin verificación TLS desactivada en las llamadas salientes.
- Sin trazas de error ni rutas internas devueltas al cliente.
