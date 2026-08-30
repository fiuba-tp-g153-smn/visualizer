---
title: Primeros pasos
---

# Primeros pasos

Al abrir la aplicación vas a ver un mapa que ocupa toda la pantalla y, a la izquierda, una columna
angosta de íconos. El mapa es el área de trabajo; la columna es desde donde se controla todo.

## La barra de la izquierda

Cada ícono abre un panel. Sólo hay un panel abierto por vez, y se cierra volviendo a hacer clic en
su ícono.

| Ícono | Para qué sirve |
|---|---|
| **Capas del mapa** | Elegir qué se ve: satélite, radar, modelos, estaciones y capas de referencia. |
| **Avisos a corto plazo** | Dibujar el área afectada y emitir un aviso. |
| **Herramientas del mapa** | Escalas de color, consulta de valores y los indicadores del mapa. |
| **Explorador** | Buscar un lugar por nombre y elegir el mapa de fondo. |
| **Configuración** | Unidades, zona horaria y la clave de acceso a las estaciones. |

Más abajo, separados por una línea, hay dos accesos: **Rendimiento y estado**, que abre el
[panel de estado](panel-de-estado.md), y **Documentación**, que abre estas páginas.

Al pie de la columna están los botones de zoom, con el nivel actual entre el `+` y el `−`.

## Moverse por el mapa

- **Acercar y alejar**: la rueda del mouse, o los botones `+` y `−`.
- **Desplazarse**: arrastrar con el botón izquierdo, o usar las flechas del teclado.
- **Buscar un lugar**: el panel **Explorador** tiene un buscador por nombre.

## Los indicadores del mapa

Sobre el mapa aparecen algunas ayudas visuales: la escala, las coordenadas del cursor, las líneas
guía, los trópicos y meridianos, y la atribución del proveedor del fondo.

Todos son opcionales. En **Herramientas del mapa ▸ General** hay una casilla para cada uno, y cada
indicador también se cierra desde su propia crucecita. Si la pantalla te queda cargada, apagarlos es
lo primero que conviene hacer.

## Ajustes que valen la pena revisar una vez

En el panel **Configuración**:

- **Unidades**. La temperatura puede mostrarse en grados Celsius o en Kelvin, y el viento en
  kilómetros por hora o en nudos. También se elige cuántos decimales mostrar.
- **Zona horaria**. Podés ver los horarios en la hora local de tu computadora o en UTC.

!!! warning "Prestá atención a la zona horaria"
    Por defecto los horarios se muestran en **hora local**, no en UTC. Como buena parte del material
    meteorológico se maneja en UTC, conviene decidir de entrada en cuál de las dos querés trabajar y
    dejarlo fijo, para no comparar dos imágenes creyendo que son del mismo momento cuando no lo son.

- **SMN**. La clave de acceso al servicio de estaciones. Sin ella las capas de estaciones no traen
  datos. Se guarda en tu navegador, así que se carga una sola vez por computadora.

## Lo que la aplicación recuerda

Cuando cerrás y volvés a entrar, la aplicación no arranca de cero: recupera las capas que tenías
activas con su transparencia y su orden, el mapa de fondo que habías elegido, tus preferencias de
unidades y zona horaria, y la clave de estaciones.

!!! note "Si algo se ve raro, empezá por acá"
    Como se recuerda la última sesión, un mapa que "arranca mal" suele ser una capa que quedó
    activa la vez anterior. Abrí **Capas del mapa ▸ Activas** y mirá qué hay prendido.

Esa memoria es de esa computadora y ese navegador. Desde otra máquina vas a encontrar la
configuración de fábrica: sólo la capa **Provincia** encendida, sobre el mapa Argenmap.
