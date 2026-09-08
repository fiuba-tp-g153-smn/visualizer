# docs-media — capturas del manual

Todas las imágenes de `docs/imgs/manual/` y los clips de `docs/videos/` los
produce este directorio, nunca una captura a mano. Cuando la interfaz cambia,
la corrección es volver a correrlo, no buscar quién tiene la grabación
original.

```
make docs-media                 # todo el manifiesto
npx tsx scripts/docs-media/capture.ts 03-activas 05-animacion   # sólo esos ids
npx tsx scripts/docs-media/capture.ts --list                     # qué hay y qué está bloqueado
```

## Qué hace

`capture.ts` levanta `ng serve` en el puerto `4299` (o reutiliza uno que ya
escuche ahí, o el que indique `DOCS_MEDIA_BASE_URL`), abre Chromium con
Playwright y recorre `shots.config.ts`. Por cada entrada:

1. **Siembra el estado** escribiendo las claves de `localStorage` que la
   aplicación restaura al arrancar (`src/app/constants/storage-keys.constants.ts`),
   con `context.addInitScript()` antes del primer render. Nada se consigue
   «clickeando hasta llegar»: una captura construida a partir de veinte clics se
   rompe la primera vez que se mueve un menú.
2. **Fija el mapa.** La vista inicial no se persiste y la URL no la lleva, así
   que todas las capturas parten del centro y zoom por defecto de la aplicación
   y el mapa base sembrado.
3. **Espera a las teselas, no a la red.** `networkidle` no se cumple nunca en un
   mapa Leaflet que sigue precargando. Se espera a que no quede ningún
   `.leaflet-tile` sin cargar durante dos cuadros seguidos, más 250 ms de
   transición.
4. **Dibuja un cursor.** Playwright no renderiza el puntero; `cursor.ts` inyecta
   una flecha y una onda en cada clic, y el runner mueve el mouse con
   `steps` para que se deslice.
5. **Anota** los selectores pedidos con un contorno y un número, inyectados en
   el DOM antes de la captura, así la anotación se reproduce sola.

Los clips se graban con `recordVideo`, se recomprimen a VP9 con `ffmpeg` y el
runner corta el poster (`<nombre>-poster.webp`) como último paso.

## Backends

Las direcciones se hornean en el bundle al compilar, así que el runner arranca
el servidor de desarrollo con estas variables (cambiables por entorno):

| Variable | Valor por defecto | Por qué |
|---|---|---|
| `DATA_SERVICE_BASE_URL` | `https://data.mapasmn.com` | Imágenes reales sin levantar el stack completo |
| `ALERTS_SERVICE_BASE_URL` | `http://localhost:6007` | **Generar un aviso escribe en MySQL.** El clip que lo hace se salta solo si esta URL no es local |
| `METRICS_SERVICE_BASE_URL` | `http://localhost:6020` | La pestaña Procesamiento del panel de estado |

Registro de qué usó cada corrida versionada:

| Fecha | data-service | alerts-service | metrics-api | Notas |
|---|---|---|---|---|
| 2026-09-08 | `https://data.mapasmn.com` | `http://localhost:6007` (stack local, `make up` en alerts-service) | `http://localhost:6020` (stack local) | Radar y WRF sin datos en ningún backend; estaciones sin clave real del SMN; ver los `blocked` del manifiesto |

## Cuando una captura se rompe

- **Un selector no aparece:** la interfaz cambió. Buscar el `data-testid` en
  `src/app/components/**` y corregir el manifiesto, o agregar el atributo si el
  control es nuevo. Los `data-testid` existen sólo para esto; no cambian
  comportamiento ni estilos.
- **La captura sale con otra imagen de satélite:** es esperable, las teselas
  son del momento de la corrida. El hook de cache-busting cambia la URL con el
  contenido, así que reemplazar el archivo en el mismo lugar alcanza.
- **Un `blocked`:** la captura necesita algo que no está disponible (datos de
  radar, una clave real del SMN). No se reemplaza por una imagen vieja; se deja
  el motivo en el manifiesto y se lista en el informe.

## Trampas que ya costaron una corrida

- **El tooltip de la barra lateral intercepta el clic siguiente.** Por eso
  `openPanel()` es un clic más un `hover` sobre el título del panel: el puntero
  se va del botón y el tooltip se cierra. Si un clic sigue fallando por un
  tooltip, el paso `click` cae a un evento `click` del DOM sobre el elemento.
- **Hosts con `display: contents` no tienen caja.** `app-detail-chip` y
  `app-alert-list-item` son así: el manifiesto apunta al `button` o al hijo
  directo, no al host que lleva el `data-testid`.
- **El splash tapa la app.** `openPage()` espera a que `#app-splash` se retire
  del DOM; sin eso la primera captura es un rectángulo azul con el logo.
- **`scrollIntoView` dentro de un `mat-expansion-panel` desplaza el cuerpo del
  panel**, que tiene `overflow: hidden`, y esconde el encabezado. Para abrir un
  grupo o subgrupo se hace clic en su `mat-expansion-panel-header`.
- **Los avisos emitidos del stack local se dibujan en todos los mapas.** La semilla
  base los oculta (`alerts-visibility`), y sólo el capítulo 6 los vuelve a mostrar.
- **La consulta puntual viene activada de fábrica.** Con capas de datos activas,
  el visor fijo muestra paneles «Sin dato» aunque nadie haya hecho clic. Es la
  interfaz real, no un defecto de la captura.
- **La grabación arranca al crear la página.** El clip se recorta desde el
  momento en que la app estuvo lista, y el póster sale del clip ya recortado.

## Requisitos

Node 24 (`.nvmrc`-menos: usar `nvm use 24`), `npx playwright install chromium`
una vez, `ffmpeg` en el `PATH`, y los backends de la tabla alcanzables.
