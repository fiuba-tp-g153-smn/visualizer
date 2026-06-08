/** Etiquetas legibles para los dominios de sync/memoria del data-service. */
const DOMAIN_LABELS: Readonly<Record<string, string>> = {
  satellite: 'Satélite',
  radar: 'Radar',
  ecmwf_tp: 'ECMWF · precipitación',
  ecmwf_mslp: 'ECMWF · presión',
  wrf: 'WRF',
  basemap: 'Mapa base',
  weather_stations: 'Estaciones',
  indexes: 'Índices',
  listings: 'Listados',
  sync: 'Estado de sync',
  other: 'Otros',
};

/** Devuelve la etiqueta legible de un dominio, o el id crudo si no hay mapeo. */
export function domainLabel(domain: string): string {
  return DOMAIN_LABELS[domain] ?? domain;
}
