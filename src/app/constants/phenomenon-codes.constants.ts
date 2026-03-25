/**
 * Código de fenómeno meteorológico
 */
export interface PhenomenonCode {
  code: number;
  description: string;
}

/**
 * Códigos de fenómenos meteorológicos disponibles para alertas
 * Basado en el diccionario FENOMENOS del backend (alerts-service)
 */
export const PHENOMENON_CODES: ReadonlyArray<PhenomenonCode> = [
  { code: 1, description: 'Tormentas fuertes con ráfagas' },
  { code: 2, description: 'Tormentas fuertes con ocasional caída de granizo' },
  { code: 3, description: 'Tormentas fuertes con caída de granizo' },
  { code: 4, description: 'Tormentas fuertes con lluvias intensas' },
  { code: 5, description: 'Tormentas fuertes con ráfagas y ocasional caída de granizo' },
  { code: 6, description: 'Tormentas fuertes con ráfagas y caída de granizo' },
  { code: 7, description: 'Tormentas fuertes con lluvias intensas y ráfagas' },
  { code: 8, description: 'Tormentas fuertes con lluvias intensas y ocasional caída de granizo' },
  { code: 9, description: 'Tormentas fuertes con lluvias intensas y caída de granizo' },
  {
    code: 10,
    description: 'Tormentas fuertes con lluvias intensas, ráfagas y ocasional caída de granizo',
  },
  { code: 11, description: 'Tormentas fuertes con lluvias intensas, ráfagas y caída de granizo' },
  { code: 21, description: 'Tormentas severas con ráfagas' },
  { code: 22, description: 'Tormentas severas con ocasional caída de granizo' },
  { code: 23, description: 'Tormentas severas con caída de granizo' },
  { code: 24, description: 'Tormentas severas con lluvias intensas' },
  { code: 25, description: 'Tormentas severas con ráfagas y ocasional caída de granizo' },
  { code: 26, description: 'Tormentas severas con ráfagas y caída de granizo' },
  { code: 27, description: 'Tormentas severas con lluvias intensas y ráfagas' },
  { code: 28, description: 'Tormentas severas con lluvias intensas y ocasional caída de granizo' },
  { code: 29, description: 'Tormentas severas con lluvias intensas y caída de granizo' },
  {
    code: 30,
    description: 'Tormentas severas con lluvias intensas, ráfagas y ocasional caída de granizo',
  },
  { code: 31, description: 'Tormentas severas con lluvias intensas, ráfagas y caída de granizo' },
  { code: 40, description: 'Lluvias intensas' },
  { code: 41, description: 'Nevadas intensas' },
  { code: 90, description: 'Posible formación de tornados' },
  {
    code: 91,
    description:
      'Tormentas severas con lluvias intensas, ráfagas, granizo y posible formación de tornados',
  },
  {
    code: 92,
    description: 'Tormentas severas con lluvias intensas, ráfagas, granizo y tornados',
  },
] as const;
