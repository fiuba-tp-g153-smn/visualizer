---
title: Ver la evolución en el tiempo
---

# Ver la evolución en el tiempo

Una imagen aislada dice poco. Lo que informa es el movimiento: hacia dónde se desplaza una celda, si
crece o se debilita, si el pronóstico la lleva sobre una ciudad. Para eso está la animación.

## Animar una capa

Expandí la capa en la pestaña **Activas** y buscá la sección **Período**. Adentro hay:

- El **selector de cantidad de imágenes**. Cuántos cuadros animar. Las opciones dependen de la capa.
- El **intervalo**, en segundos por imagen, entre 0,1 y 10. Es la velocidad de reproducción.
- La **marca de tiempo** de la imagen que estás viendo en este momento.
- El **botón de reproducción**, un botón para **ir a la imagen más reciente**, y un deslizador para
  moverte cuadro por cuadro.

!!! note "Observación y pronóstico animan hacia lados distintos"
    Una capa de observación (satélite, radar) anima las **últimas** imágenes: te muestra cómo se
    llegó hasta ahora. Una capa de pronóstico anima las **primeras**: te muestra qué viene. Es la
    diferencia entre mirar para atrás y mirar para adelante, y es la razón por la que el mismo
    control se comporta distinto según la capa.

El deslizador cuadro por cuadro suele ser más útil que la reproducción automática cuando estás
tratando de identificar el momento exacto en que algo cambió.

Hay un botón de recarga para volver a pedir las imágenes disponibles, aunque de todos modos la lista
se actualiza sola cada diez segundos.

## Animar varias capas juntas

Acá está la parte interesante. Si reproducís dos capas por separado, cada una avanza a su propio
ritmo y en algún momento vas a estar mirando una imagen de satélite de las 15:00 junto a un radar de
las 15:40. La conclusión que saques de esa comparación va a estar mal.

La pestaña **Sincronización** resuelve eso. Elegís las capas que querés reproducir juntas y el
sistema busca la correspondencia temporal entre ellas, de modo que cada cuadro que veas de una
corresponda al mismo momento que el de la otra.

Cuando una capa está sincronizada:

- Su control de período muestra la marca **Sincronizado**.
- Su deslizador propio queda deshabilitado: manda la sincronización.
- Su botón de reproducción pasa a ofrecer **Desconectar de sincronización**.

!!! warning "Si no se pueden alinear, no se reproduce"
    Si las capas elegidas no tienen momentos en común, o si sus tiempos no se pueden hacer coincidir
    dentro de la tolerancia, el panel te lo dice y bloquea la reproducción. Es deliberado: es
    preferible no animar a mostrarte lado a lado dos instantes distintos como si fueran simultáneos.

Es la herramienta que conviene usar siempre que estés comparando dos fuentes, y especialmente antes
de emitir un aviso.
