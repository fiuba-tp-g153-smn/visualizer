import { METRICS_TEXTS } from '../../texts';

/** Etiquetas legibles para los dominios de sync/memoria del data-service. */
const DOMAIN_LABELS: Readonly<Record<string, string>> = METRICS_TEXTS.domains;

/** Devuelve la etiqueta legible de un dominio, o el id crudo si no hay mapeo. */
export function domainLabel(domain: string): string {
  return DOMAIN_LABELS[domain] ?? domain;
}
