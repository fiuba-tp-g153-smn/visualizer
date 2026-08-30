---
title: Radar
---

# Radar

El radar es el complemento exacto del satélite. Donde el satélite mira los topes de las nubes desde
arriba, el radar mira **dentro** de ellas desde abajo.

Funciona emitiendo pulsos de microondas y midiendo la energía que le rebota. Lo que rebota son los
hidrometeoros: gotas, cristales de hielo, granizo. Cuanto más grandes y más numerosos, más energía
vuelve.

Los radares de la red SINARAME transmiten en **doble polarización**: emiten el pulso en dos
orientaciones, horizontal y vertical, y comparan lo que vuelve de cada una. Eso no sólo dice cuánta
precipitación hay, sino qué forma tienen las partículas, y de ahí se deduce de qué tipo son.

## Las variables

| Variable | Unidad | Qué representa | Cómo se usa |
|---|---|---|---|
| **DBZH** | dBZ | Reflectividad horizontal | La variable principal. Es la medida de intensidad: cuanto más alta, más precipitación. Valores muy altos indican lluvia intensa o granizo. |
| **ZDR** | dB | Reflectividad diferencial | Compara el rebote horizontal con el vertical, y con eso deduce si las partículas están achatadas. Las gotas grandes caen achatadas; el granizo, que cae rotando, no. |
| **VRAD** | m/s | Velocidad radial | Por efecto Doppler, mide si las partículas se acercan o se alejan del radar. Es la única variable que informa sobre el **viento**. |
| **RHOHV** | — | Coeficiente de correlación | Qué tan parecidas entre sí son las partículas de una zona. Cercano a 1 con precipitación homogénea; baja con mezclas, con granizo y con ecos que no son meteorológicos. |
| **KDP** | °/km | Fase diferencial específica | Sensible al contenido de agua líquida, y resistente a la atenuación: sigue siendo confiable detrás de una zona de lluvia muy intensa, donde la reflectividad ya no lo es. |

### Cómo se combinan

Cada variable por separado dice poco; juntas identifican el tipo de precipitación:

- **Reflectividad muy alta con ZDR bajo** es la firma clásica del **granizo**. Mucha energía de
  vuelta, pero de partículas que no están achatadas: no son gotas grandes, son piedras.
- **Reflectividad alta con ZDR alto** es lluvia de gotas grandes: intensa, pero lluvia.
- **RHOHV bajo** es una señal de alerta sobre el dato mismo: puede indicar una mezcla de fases (lluvia
  y granizo juntos) o directamente un eco que no es meteorológico —pájaros, insectos, un edificio,
  interferencia—. Conviene mirarlo antes de sacar conclusiones de una zona rara.
- **VRAD con valores opuestos muy juntos** —una zona acercándose pegada a una alejándose— es una
  firma de **rotación**. Es de las señales más importantes que puede dar un radar.

## Las elevaciones

Cada variable está disponible en tres **elevaciones** de antena, que en la aplicación aparecen en el
control de cada capa. La antena barre en círculos a distintos ángulos por encima del horizonte.

Esto tiene una consecuencia geométrica que conviene tener siempre presente: como el haz sale
inclinado y la Tierra es curva, **cuanto más lejos del radar, más alto está mirando**. Cerca del
radar la elevación más baja mide casi en superficie; a doscientos kilómetros, esa misma elevación
está midiendo a varios kilómetros de altura.

!!! warning "Lo que el radar no ve"
    Hay tres puntos ciegos que explican la mayoría de las lecturas equivocadas:

    - **Debajo del haz.** Lejos del radar, la lluvia que se forma en niveles bajos pasa por debajo de
      lo que la antena está mirando. El radar puede no verla.
    - **Detrás de la lluvia intensa.** Una tormenta muy fuerte absorbe el pulso y debilita lo que
      llega más allá: lo que hay atrás se subestima. KDP es la variable que menos sufre esto.
    - **Detrás del terreno.** Un cerro bloquea el haz y deja un sector sin información, que no es lo
      mismo que un sector sin lluvia.

Comparar dos elevaciones de la misma variable ayuda a entender la estructura vertical: una zona de
reflectividad alta que se mantiene en la elevación superior indica una tormenta profunda; una que
desaparece al subir es precipitación somera.

## Radar y satélite, juntos

Es la combinación que más rinde:

- El **satélite** te dice dónde está la convección profunda y cubre todo el territorio, incluso donde
  no llega ningún radar.
- El **radar** te dice qué está cayendo efectivamente y con qué intensidad, pero sólo dentro de su
  alcance.

Cuando las dos coinciden, la lectura es sólida. Cuando no coinciden, casi siempre es una de las
limitaciones de arriba, y vale la pena averiguar cuál antes de decidir.
