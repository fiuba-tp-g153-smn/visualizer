/**
 * Mapas de visualización en español. El valor crudo del API se conserva para
 * color/clase/agrupación; estas etiquetas son solo para mostrar.
 */

/** Resultado del trabajo → etiqueta. */
export const OUTCOME_LABELS: Readonly<Record<string, string>> = {
  success: 'Éxito',
  error: 'Error',
  dlq: 'DLQ',
  requeued: 'Reencolado',
  skipped: 'Omitido',
};

/** Etapa del pipeline → etiqueta corta. */
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

/**
 * Términos de producto (vienen en inglés desde `describe_job`) → español.
 * Se aplican como reemplazo de subcadena best-effort; las etiquetas WRF ya
 * vienen en español y pasan sin cambios.
 */
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

/** Traduce los términos conocidos dentro de un `product_label`. */
export function prod(label: string | null | undefined): string {
  let text = label ?? '';
  for (const [en, es] of Object.entries(PRODUCT_TERMS)) {
    text = text.split(en).join(es);
  }
  return text;
}

/** Etiqueta de etapa (o la clave cruda si es desconocida). */
export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

/** Etiqueta de resultado (o el valor crudo si es desconocido). */
export function outcomeLabel(outcome: string): string {
  return OUTCOME_LABELS[outcome] ?? outcome;
}
