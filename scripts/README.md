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
| `groups.csv` | 5 | Grupos de capas (Satélite, Radar, Modelos…) |
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
