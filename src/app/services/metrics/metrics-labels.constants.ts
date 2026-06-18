export const OUTCOME_LABELS: Readonly<Record<string, string>> = {
  success: 'Éxito',
  error: 'Error',
  dlq: 'DLQ',
  requeued: 'Reencolado',
  skipped: 'Omitido',
};

// Colores por resultado, alineados con las píldoras `.pill--*` de la tabla
// (sortable-table.component.scss). Fuente única para las barras de la línea de
// tiempo y su leyenda.
export const OUTCOME_COLORS: Readonly<Record<string, string>> = {
  success: '#2e9b51',
  error: '#e8702a',
  dlq: '#d23b4e',
  requeued: '#b5892a',
  skipped: '#6b7280',
};

const FALLBACK_OUTCOME_COLOR = '#8e8e8e';

export const STAGE_LABELS: Readonly<Record<string, string>> = {
  read: 'Lectura',
  load: 'Carga',
  aggregate: 'Agregación',
  georef: 'Georref.',
  extract: 'Extracción',
  mapping: 'Mapeo',
  brightness_temp: 'Temp. brillo',
  reproject: 'Reproyección',
  rgba: 'RGBA',
  cog: 'COG',
  geotiff: 'GeoTIFF',
  prewarp: 'Prewarp',
  secondary_cog: 'COG sec.',
  geojson: 'GeoJSON',
  tiling: 'Teselado',
  upload: 'Subida',
  list: 'Verif. existentes', // ECMWF producer: S3 existence-check (GRIB/COG HEADs)
  // Alert-generation stages (alerts-service dashboard).
  intersect: 'Intersección',
  filter: 'Filtrado deptos.',
  render: 'Render (GIF)',
  persist: 'Guardado',
};

export const PRODUCT_TERMS: Readonly<Record<string, string>> = {
  'Cloud Tops': 'Tope de nubes',
  'Water Vapor': 'Vapor de agua',
  Visible: 'Visible',
  'GLM Lightning': 'Rayos GLM',
  'Horizontal Reflectivity': 'Reflectividad horizontal',
  'Radial Velocity': 'Velocidad radial',
  'Cross-correlation Coefficient': 'Coef. correlación cruzada',
  'Differential Reflectivity': 'Reflectividad diferencial',
  'Specific Differential Phase': 'Fase dif. específica',
  'Differential Phase': 'Fase diferencial',
  'Spectrum Width': 'Ancho espectral',
  'Total Power': 'Potencia total',
  Reflectivity: 'Reflectividad',
};

export function prod(label: string | null | undefined): string {
  let text = label ?? '';
  for (const [en, es] of Object.entries(PRODUCT_TERMS)) {
    text = text.split(en).join(es);
  }
  return text;
}

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

export function outcomeLabel(outcome: string): string {
  return OUTCOME_LABELS[outcome] ?? outcome;
}

export function outcomeColor(outcome: string): string {
  return OUTCOME_COLORS[outcome] ?? FALLBACK_OUTCOME_COLOR;
}
