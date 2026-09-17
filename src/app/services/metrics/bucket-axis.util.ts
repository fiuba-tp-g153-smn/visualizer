/**
 * Eje temporal denso para las series de los paneles de métricas.
 *
 * La API sólo devuelve los buckets que tuvieron datos: si el pipeline estuvo
 * caído dos horas, esos buckets no existen y el eje de categorías pega el
 * anterior con el siguiente, dibujando una línea continua sobre un período en
 * el que no se procesó nada. Acá reconstruimos los slots faltantes para que el
 * hueco ocupe su lugar real en el eje, y marcamos cuáles son sintéticos: los
 * builders les asignan `null` y ApexCharts corta el trazo ahí (verificado en
 * 5.13 para `straight`, `smooth`, `monotoneCubic`, área apilada y barras).
 */

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const TEN_MIN_MS = 600_000;

/**
 * Cadencia implícita según la longitud del bucket truncado de la API:
 * `"2026-06-04"` (día), `"2026-06-04T21"` (hora), `"2026-06-04T21:3"` (10 min).
 */
const GRID_STEP_MS: Readonly<Record<number, number>> = {
  10: DAY_MS,
  13: HOUR_MS,
  15: TEN_MIN_MS,
};

/** Tope de slots del eje; por encima, cada hueco se abre con un único slot. */
const MAX_SLOTS = 1500;

/**
 * Serie de muestreo irregular (timestamps crudos, no buckets de una grilla):
 * es un hueco cuando el salto supera esta proporción de la cadencia mediana.
 * Tolera el jitter normal entre muestras sin partir la línea.
 */
const IRREGULAR_GAP_FACTOR = 1.75;

const OFFSET_SUFFIX = /(?:Z|[+-]\d{2}:?\d{2})$/;

export interface BucketAxis {
  /** Buckets reales más los sintéticos que abren cada hueco, ordenados. */
  readonly buckets: readonly string[];
  /** `false` en un slot sintético: no hubo datos en ese intervalo. */
  has(bucket: string): boolean;
}

/**
 * Instante (epoch ms) de un bucket. Los buckets truncados de la API se
 * completan en UTC —mismo criterio que `fmtBucket`—; cualquier otra cosa se
 * trata como ISO absoluto (`sampled_at`), asumiendo UTC si no trae zona.
 */
export function parseBucket(bucket: string): number {
  if (bucket.length === 10) {
    return Date.parse(`${bucket}T00:00:00Z`);
  }
  if (bucket.length === 13) {
    return Date.parse(`${bucket}:00:00Z`);
  }
  if (bucket.length === 15) {
    return Date.parse(`${bucket.slice(0, 13)}:${bucket.slice(14, 15)}0:00Z`);
  }
  return Date.parse(OFFSET_SUFFIX.test(bucket) ? bucket : `${bucket}Z`);
}

/** Clave de un slot de la grilla, con el mismo truncado que usa la API. */
function gridKey(ms: number, length: number): string {
  return new Date(ms).toISOString().slice(0, length);
}

function medianStep(times: readonly number[]): number {
  const diffs = times.slice(1).map((time, i) => time - times[i]);
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)];
}

/** Inserta un único slot sintético en cada salto mayor al umbral. */
function markGaps(
  buckets: readonly string[],
  times: readonly number[],
  threshold: number,
  keyAt: (prev: number, next: number) => string,
): string[] {
  const out = [buckets[0]];
  for (let i = 1; i < buckets.length; i++) {
    if (times[i] - times[i - 1] > threshold) {
      out.push(keyAt(times[i - 1], times[i]));
    }
    out.push(buckets[i]);
  }
  return out;
}

/** Grilla regular: cada slot ausente entre el primero y el último es un hueco. */
function fillGrid(
  buckets: readonly string[],
  times: readonly number[],
  step: number,
  length: number,
): string[] {
  const first = times[0];
  const last = times[times.length - 1];
  const slots = Math.round((last - first) / step) + 1;
  if (slots <= buckets.length) {
    return [...buckets];
  }
  if (slots > MAX_SLOTS) {
    return markGaps(buckets, times, step, (prev) => gridKey(prev + step, length));
  }
  const out: string[] = [];
  for (let ms = first; ms <= last; ms += step) {
    out.push(gridKey(ms, length));
  }
  return out;
}

/** Muestreo irregular: sin grilla que rellenar, abrimos el hueco con un slot. */
function fillIrregular(buckets: readonly string[], times: readonly number[]): string[] {
  const step = medianStep(times);
  if (!(step > 0)) {
    return [...buckets];
  }
  return markGaps(buckets, times, step * IRREGULAR_GAP_FACTOR, (prev, next) =>
    new Date((prev + next) / 2).toISOString(),
  );
}

/**
 * Eje ordenado con los huecos abiertos. Si los buckets no son fechas
 * reconocibles (o hay uno solo) devuelve la lista tal cual: sin cadencia que
 * inferir, preferimos no inventar slots.
 */
export function denseBucketAxis(buckets: readonly string[]): BucketAxis {
  const real = [...new Set(buckets)].sort();
  const present = new Set(real);
  const has = (bucket: string): boolean => present.has(bucket);
  if (real.length < 2) {
    return { buckets: real, has };
  }
  const times = real.map(parseBucket);
  if (times.some(Number.isNaN)) {
    return { buckets: real, has };
  }
  const { length } = real[0];
  const step = real.every((bucket) => bucket.length === length) ? GRID_STEP_MS[length] : undefined;
  return {
    buckets: step ? fillGrid(real, times, step, length) : fillIrregular(real, times),
    has,
  };
}
