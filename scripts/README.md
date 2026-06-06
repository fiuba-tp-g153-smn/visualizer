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

Las tablas se relacionan por `layerId`. El directorio `layer-report/` está en `.gitignore`.
