import { ALERTS_TEXTS } from '../texts';

export interface PhenomenonCode {
  code: number;
  description: string;
}

const P = ALERTS_TEXTS.phenomena;

export const PHENOMENON_CODES: ReadonlyArray<PhenomenonCode> = [
  { code: 1, description: P[1] },
  { code: 2, description: P[2] },
  { code: 3, description: P[3] },
  { code: 4, description: P[4] },
  { code: 5, description: P[5] },
  { code: 6, description: P[6] },
  { code: 7, description: P[7] },
  { code: 8, description: P[8] },
  { code: 9, description: P[9] },
  { code: 10, description: P[10] },
  { code: 11, description: P[11] },
  { code: 21, description: P[21] },
  { code: 22, description: P[22] },
  { code: 23, description: P[23] },
  { code: 24, description: P[24] },
  { code: 25, description: P[25] },
  { code: 26, description: P[26] },
  { code: 27, description: P[27] },
  { code: 28, description: P[28] },
  { code: 29, description: P[29] },
  { code: 30, description: P[30] },
  { code: 31, description: P[31] },
  { code: 40, description: P[40] },
  { code: 41, description: P[41] },
  { code: 90, description: P[90] },
  { code: 91, description: P[91] },
  { code: 92, description: P[92] },
] as const;
