---
title: Estaciones
---

# Estaciones meteorológicas

Las estaciones son el único dato de la aplicación que se mide **directamente en el lugar**. El
satélite infiere, el radar infiere, el modelo calcula; la estación mide. A cambio, sólo informa
sobre el punto exacto donde está instalada.

Se dibujan como marcadores sobre el mapa, uno por estación de la red del Servicio Meteorológico
Nacional.

## Las variables disponibles

Se muestra **una variable por vez** —por eso este grupo usa botones de opción y no casillas—:

| Variable | Qué aporta |
|---|---|
| **Temperatura** | La lectura básica del estado de la masa de aire. |
| **Punto de rocío** | La temperatura a la que el aire se saturaría. Cuanto más alto, más humedad absoluta hay disponible. |
| **Sensación térmica** | Cómo se percibe la temperatura combinada con humedad y viento. |
| **Humedad** | La humedad relativa. |
| **Presión** | Útil para seguir el paso de un sistema: una caída marcada anticipa su llegada. |
| **Visibilidad** | Se reduce con niebla, precipitación intensa o polvo. |
| **Viento** | Dirección e intensidad medidas en superficie. |

!!! note "El punto de rocío es la variable más subestimada"
    No se mide: se calcula a partir de la temperatura y la humedad relativa. A diferencia de la
    humedad relativa, que depende de cuán caliente esté el aire, el punto de rocío indica la cantidad
    **absoluta** de humedad presente. Por eso es un mejor indicador del combustible disponible para
    la convección: dos lugares con 60 % de humedad pueden tener contenidos de vapor muy distintos, y
    el punto de rocío lo distingue de inmediato.

## Ver el detalle de una estación

!!! note "Se abre con el botón derecho"
    Un clic derecho sobre un marcador abre una ficha con la observación actual y un gráfico. Desde el
    pie de esa ficha se llega al histórico completo de las últimas 48 horas, con gráficos, un resumen
    y la tabla de observaciones.

El histórico de 48 horas es lo que convierte a la estación en algo más que un número suelto: permite
ver la tendencia. Una caída sostenida de presión, un salto de temperatura al paso de un frente o un
aumento del punto de rocío a lo largo de la tarde son señales que un valor aislado no muestra.

## Momento de la observación

En el control de la capa hay dos ajustes:

- **Consulta**: si mostrar la observación **más reciente** o la de un momento **específico**.
- **Tolerancia**: con cuánta holgura horaria aceptar una observación cercana a ese momento.

La tolerancia existe porque no todas las estaciones reportan exactamente a la misma hora. Si la
ponés muy estricta, van a aparecer menos estaciones; si la aflojás demasiado, vas a estar comparando
mediciones de momentos distintos. Para revisar una situación pasada conviene una tolerancia
intermedia y tener presente que el mapa resultante no es perfectamente simultáneo.

## Hace falta una clave

Estas capas requieren una clave de acceso, que se carga una sola vez en **Configuración ▸ SMN** y
queda guardada en tu navegador. Si las estaciones no muestran datos, ese es el primer lugar donde
mirar.

## Su límite

Una estación describe un punto. Entre dos estaciones puede haber ochenta kilómetros, y una tormenta
severa puede caber entera en ese hueco sin que ninguna de las dos la registre. Las estaciones
confirman y cuantifican lo que otras capas detectan; no sirven para descartar que algo esté pasando.
