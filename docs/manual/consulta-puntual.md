---
title: Consultar un valor puntual
---

# Consultar un valor puntual

Los colores de una capa te dan una idea, pero una idea aproximada: entre dos tonos vecinos de una
escala puede haber una diferencia que importa. Cuando necesitás el número, está la consulta puntual.

## Cómo se usa

1. Abrí **Herramientas del mapa** y andá a la pestaña **Dato puntual**.
2. Activá la consulta.
3. Hacé clic en cualquier punto del mapa.

El sistema devuelve el valor numérico real de **cada capa activa** en ese punto, con su unidad. No
es el color leído de la imagen: es el dato subyacente.

Podés elegir si el resultado se muestra en un **panel fijo** o **junto al marcador**, según prefieras
tener el número quieto en un costado o pegado al lugar donde hiciste clic.

## Para qué sirve en la práctica

- **Verificar un umbral.** Saber si esa zona naranja está en 45 dBZ o en 52 dBZ cambia la lectura de
  la severidad.
- **Comparar dos puntos.** Dos clics seguidos te dan la diferencia real entre el centro y el borde de
  una celda, o entre dos zonas del área que estás por incluir en un aviso.
- **Contrastar capas en el mismo lugar.** Como devuelve el valor de todas las capas activas de una
  sola vez, un solo clic te dice cuánta inestabilidad pronostica el modelo, cuánto llueve según el
  radar y qué temperatura mide la estación más cercana, todo en el mismo punto.
- **Fundamentar el aviso.** Cuando tengas que justificar por qué incluiste un departamento, el valor
  puntual es un argumento más sólido que la impresión del color.
