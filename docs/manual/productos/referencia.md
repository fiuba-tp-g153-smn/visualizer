---
title: Capas de referencia
---

# Capas de referencia

Este grupo no trae datos meteorológicos. Trae el contexto geográfico que hace que los datos
meteorológicos signifiquen algo: sin límites departamentales, una zona de reflectividad alta es una
mancha de color; con ellos, es un departamento con nombre que puede entrar en un aviso.

Las provee el Instituto Geográfico Nacional y siempre se dibujan **por encima** de las capas de
datos, para que no queden tapadas.

## Qué hay disponible

| Subgrupo | Contenido |
|---|---|
| **Límites** | Límite interdepartamental o de partido, límite internacional |
| **Administrativo** | Localidad, sublocalidad, gobierno local, provincia |
| **Territorial** | Área de montaña |
| **Infraestructura** | Aeródromo, aeropuerto, helipuerto, red vial nacional |
| **Hidrografía** | Corriente de agua, ferrocarril |
| **Defensa y seguridad** | Cuartel de bomberos, pasos de fronteras internacionales |
| **Otros** | Línea de transmisión eléctrica, central eléctrica, centro de esquí |

La única que viene encendida por defecto es **Provincia**.

## Cuáles conviene tener prendidas

Depende de qué estés haciendo:

- **Siempre**: Provincia. Es la referencia mínima para describir dónde está ocurriendo algo.
- **Antes de emitir un aviso**: el límite interdepartamental. El aviso se emite por departamento, así
  que ver esos límites mientras dibujás el área evita sorpresas al momento de verificar.
- **Para evaluar impacto**: Localidad, y la red vial nacional. Una tormenta severa sobre campo abierto
  y la misma tormenta sobre una ruta principal o una ciudad no tienen las mismas consecuencias.
- **Para eventos de viento**: líneas de transmisión eléctrica.
- **Para lluvias intensas**: corrientes de agua, que ayudan a anticipar dónde puede haber
  anegamientos.
- **En zona de montaña**: área de montaña, que además explica muchos de los huecos de cobertura del
  [radar](radar.md).

!!! note "No prendas todo a la vez"
    Estas capas se dibujan encima de los datos. Con demasiadas activas, el mapa se vuelve una maraña
    de líneas y termina ocultando justamente lo que estabas mirando. Dos o tres bien elegidas rinden
    mucho más que diez.
