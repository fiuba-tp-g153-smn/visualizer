export const OUTCOME_LABELS: Readonly<Record<string, string>> = {
  success: 'Éxito',
  error: 'Error',
  dlq: 'DLQ',
  requeued: 'Reencolado',
  skipped: 'Omitido',
};

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
