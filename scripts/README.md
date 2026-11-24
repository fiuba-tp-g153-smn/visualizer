# Scripts

## generate-layer-report.ts

Genera un reporte CSV con todas las configuraciones de labels/escalas de las capas de la app.
Lee directamente los configs TypeScript del proyecto, sin servidor ni build.

### Uso

```bash
npx tsx scripts/generate-layer-report.ts
```

### Output: `layer-report/`

| Archivo | Filas | Descripción |
| --------- | ------- | ------------- |
| `groups.csv` | 6 | Grupos de capas (Satélite, Radar, Modelos…) |
| `subgroups.csv` | 30 | Subgrupos con FK → `groupId` |
| `layers.csv` | ~131 | Capas con FK → `subgroupId` |
| `scales.csv` | ~27 | Escalas únicas (agrupadas por objeto compartido) con columna `usedBy` |
| `secondary-renders.csv` | ~12 | Renders secundarios WRF/ECMWF con datos de punto puntual |
| `elevations.csv` | 3 | Elevaciones de radar (compartidas por todos los productos) |
| `unit-settings.csv` | 2 | Unidades configurables: temperatura y velocidad de viento |
| `radar-stations.csv` | 18 | Un radar RMA por fila, con número y localidad |
| `layer-report.xlsx` | — | Los ocho CSV como ocho hojas, con tabla, filtro y fila fija |

Las claves foráneas son `groupId` en `subgroups.csv`, `subgroupId` en `layers.csv` y `layerId`
en `secondary-renders.csv`; `scales.csv` lista sus capas en `usedBy`. El directorio
`layer-report/` está en `.gitignore`.

## metarea-vi/build-geojson.py

Genera `public/geo/metarea-vi.json` con los límites de las zonas de pronóstico marítimo de la
METAREA VI (zonas costeras y áreas oceánicas), a partir de los shapefiles del SMN que están en
`metarea-vi/source/`. Solo usa la biblioteca estándar de Python: no requiere GDAL.

### Uso

```bash
python3 scripts/metarea-vi/build-geojson.py           # regenera el archivo
python3 scripts/metarea-vi/build-geojson.py --check   # falla si el archivo commiteado no coincide con una generación nueva
```

Solo hace falta correrlo si cambian los shapefiles o las tablas del script. El resultado se
commitea.

### Qué hace

- Lee los shapefiles de líneas y valida que estén en WGS84.
- Asigna `id` y `name` desde la tabla `ZONES`. Si hay un shapefile que no está en la tabla, o al
  revés, aborta.
- Aplica las correcciones de vértices de `CORRECTIONS`, cada una justificada con la definición
  oficial ("Referencias METAREA VI" del boletín SHN/SMN). Si un vértice a corregir no está en la
  fuente, aborta.
- Valida que todas las coordenadas caigan dentro de la METAREA VI y escribe un FeatureCollection
  RFC 7946 determinista, con una feature por línea y 5 decimales.

Los shapefiles en `source/` no se editan a mano. Las diferencias conocidas con la definición
oficial que no se corrigen están documentadas en el encabezado del script.
