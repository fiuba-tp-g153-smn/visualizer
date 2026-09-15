---
title: 19. Seguridad
---

# 19. Seguridad

Esta sección describe los datos, puertos y operaciones que deben considerarse antes de incorporar
MapaSMN a una red. El análisis parte del comportamiento actual del código y de las plantillas, sin
suponer controles externos que no se encuentran versionados. La revisión se actualizó en septiembre
de 2026.

!!! warning "Resumen para quien no va a leer el resto"
    El sistema no tiene ningún concepto de identidad, sesión ni autorización. Salvo las rutas de
    estaciones y una ruta de escritura de métricas, todo lo que expone es anónimo. Y tal como están
    las plantillas, varios puertos de infraestructura se publican en todas las interfaces.
    Es desplegable, pero no tal cual. Lo que hay que cambiar está en [19.3 Endurecimiento](endurecimiento.md).

![Límites de confianza](../../imgs/diagrams/seguridad-limites.svg){ .diagram loading=lazy }

| Sub-capítulo | Qué responde |
|---|---|
| [19.1 Superficie expuesta](superficie.md) | Puerto por puerto y ruta por ruta: qué es alcanzable y qué pide credenciales |
| [19.2 Datos y secretos](datos-y-secretos.md) | Qué información maneja, dónde vive, quién puede leerla y hacia dónde sale |
| [19.3 Endurecimiento](endurecimiento.md) | La lista concreta de cambios previos al despliegue, por severidad |

## Los activos

En orden de gravedad:

1. La capacidad de emitir un aviso. Es de integridad, no de confidencialidad: un aviso falso
   atribuido al SMN tiene consecuencias fuera del sistema.
2. El acceso de escritura a la base del SMN. Incluye alterar o destruir datos ajenos.
3. La disponibilidad del visualizador durante un evento severo.
4. La clave de estaciones, la única credencial que el sistema le pide al usuario.
5. La integridad de los datos mostrados. Un producto manipulado induce una decisión equivocada.

Los datos meteorológicos en sí no son un activo. Provienen de fuentes públicas.

## Los límites de confianza

Tres cruces importan.

Del navegador a los servicios. Es el límite principal y hoy no filtra nada. El navegador no
habla sólo con el visualizador: llama por su cuenta al servicio de datos, al de avisos y al de
métricas. El proxy con TLS que los agrupa en producción no está en los repositorios.

De la zona publicada a la zona interna. El almacén, el broker, la caché y la base deberían estar
sólo de este lado. Tal como están las plantillas, sus puertos salen a todas las interfaces.

Del sistema a la infraestructura del SMN. Es el único límite donde el sistema pide permiso. El
alcance de las credenciales con que se accede a la base operativa es la decisión de seguridad más
importante del despliegue.

## El modelo de atacante

| Atacante | Qué puede hacer hoy |
|---|---|
| Anónimo en internet, con los servicios publicados | Insertar una fila de aviso en la base del SMN. Leer todas las métricas. Llenar el disco generando imágenes. Provocar escrituras sin tope en el bucket de mapas base. Leer el catálogo de rutas en la documentación interactiva. |
| Anónimo en la red interna, con sólo el borde publicado | Lo mismo, más leer, escribir y borrar el almacén de objetos entero por el filer sin autenticación, y la caché. |
| Un sitio web cualquiera que la víctima visite | Los tres servicios responden con origen `*`. Sin sesión que robar, hoy no gana nada; el día que se agregue autenticación por sesión, sí. |
| Quien consiga publicar contenido en este sitio | Corre en el mismo origen que la aplicación, sin aislamiento: puede leer el almacenamiento del navegador, incluida la clave de estaciones. |
| Un contenedor comprometido | Todos corren como `root`, ninguno tiene límites de recursos, y todos los procesos del procesador comparten las credenciales del broker. |

## Lo que el sistema sí hace bien

- No hay inyección de SQL. Todas las consultas en ejecución están parametrizadas.
- No hay ejecución de comandos. Ningún subproceso usa intérprete de shell.
- No hay traversal de rutas desde datos externos.
- No hay secretos en el paquete del navegador. Se inyectan seis URL, un puerto y una bandera.
- Las comparaciones de credenciales son en tiempo constante donde existen.
- La verificación TLS nunca está desactivada en las llamadas salientes.

Una afirmación de la versión anterior de esta página ya no se sostiene: los errores sí pueden
filtrar detalle interno. Las rutas de intersección devuelven el texto de la excepción, incluida la
ruta de un archivo ausente. Ver [19.1 Superficie expuesta](superficie.md).

El problema de este sistema no es la calidad del código. Fue construido asumiendo una red de
confianza, y nunca se le agregó la capa de control de acceso que un despliegue expuesto necesita.
