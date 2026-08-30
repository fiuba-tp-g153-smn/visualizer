---
title: Trabajar con capas
---

# Trabajar con capas

Todo lo que se ve sobre el mapa es una **capa**. Una imagen de satélite es una capa, la
reflectividad de un radar es otra, los límites provinciales son otra. El trabajo cotidiano consiste
en encender las que te interesan, apilarlas en el orden correcto y ajustar su transparencia hasta
que la combinación diga algo.

El panel **Capas del mapa** tiene tres pestañas: **Disponibles**, **Activas** y **Sincronización**.
Las dos últimas indican entre paréntesis cuántas capas contienen.

## Disponibles: elegir qué ver

Arriba de todo hay un buscador que filtra el catálogo completo. Es la forma más rápida de llegar a
una capa cuando ya sabés cómo se llama.

El catálogo se organiza en cinco grupos:

| Grupo | Qué contiene |
|---|---|
| **Satélite** | Las imágenes del GOES-19 y sus productos de actividad eléctrica. |
| **Radar** | Las estaciones de radar del país, con sus variables y elevaciones. |
| **Modelos** | Los pronósticos numéricos: ECMWF, WRF y GFS. |
| **Estaciones meteorológicas** | Las observaciones de superficie. |
| **IGN Argentina** | Capas de referencia geográfica. |

Encender una capa es marcar su casilla. En casi todos los subgrupos podés encender varias a la vez.
El de estaciones es la excepción: usa botones de opción, porque muestra una sola variable por vez.

Un punto de color sobre un grupo indica que adentro hay algo encendido. Sólo aparece cuando el grupo
está plegado, para que puedas ver de un vistazo dónde dejaste capas activas.

!!! note "Las capas apagadas y grises no están rotas"
    Si una capa aparece atenuada es porque en este momento no tiene datos disponibles para mostrar.
    Cada subgrupo tiene un botón **Volver a verificar disponibilidad** que vuelve a consultar. Que
    una capa exista en el catálogo no garantiza que se esté generando en este momento.

## Activas: ordenar y ajustar

La pestaña **Activas** lista lo que está en el mapa, separado en tres bloques que se dibujan siempre
en el mismo orden:

| Bloque | Qué contiene | Dónde se dibuja |
|---|---|---|
| **Capas puntuales** | Estaciones meteorológicas | Arriba de todo |
| **Capas de referencia** | Las capas del IGN | En el medio |
| **Capas de datos** | Satélite, radar y modelos | Abajo |

Ese orden no es arbitrario: garantiza que los límites provinciales y las estaciones queden visibles
por encima de una imagen de satélite, y no tapados por ella.

Podés arrastrar una capa para cambiar su posición **dentro de su bloque**. Lo que no se puede es
mover una capa de un bloque a otro: una imagen de satélite nunca va a taparte los límites.

Cada bloque tiene un botón para apagar de una vez todas sus capas.

### Los controles de cada capa

Cada fila tiene un botón para mostrar u ocultar su escala de colores y otro para expandirla. Al
expandirla aparece, según de qué tipo sea:

- **Opacidad**: un deslizador con el porcentaje al lado. Es la herramienta más útil del panel:
  bajarle la opacidad a una capa te deja ver la de abajo sin apagar ninguna.
- **Elevaciones**: en las capas de radar, cuál de las tres elevaciones de antena mirar.
- **Corridas**: en los modelos, de qué corrida de pronóstico tomar los datos.
- **Consulta** y **Tolerancia**: en las estaciones, si mostrar la observación más reciente o la de un
  momento determinado, y con cuánta holgura horaria aceptarla.
- **Período**: los controles de [animación](animacion.md).

## Combinaciones que funcionan

Algunas superposiciones son clásicas porque cada capa cubre el punto ciego de la otra:

- **Satélite infrarrojo + descargas eléctricas.** El infrarrojo te muestra dónde están los topes más
  fríos; las descargas confirman cuál de esas celdas está realmente activa.
- **Radar + estaciones.** El radar te dice dónde llueve; las estaciones te dicen qué está pasando en
  el suelo, que no siempre es lo mismo.
- **Modelo + observación.** Poner la precipitación pronosticada debajo del radar actual es la forma
  más rápida de ver si el modelo está acertando el evento o corriéndolo de lugar.
- **Cualquier capa de datos + Provincia.** Sin un límite de referencia encima es fácil equivocarse
  de departamento al describir dónde está ocurriendo algo.

## Escalas de color

Cada variable se dibuja con su propia escala. El botón de la escala en la fila de la capa la muestra
u oculta, y en **Herramientas del mapa ▸ Escalas** hay un panel flotante que junta las escalas de
todas las capas activas que tengan una configurada.

Vale la pena tenerlas a la vista: dos capas distintas pueden usar colores parecidos con significados
completamente distintos.
