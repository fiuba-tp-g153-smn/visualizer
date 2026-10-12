import { describe, it, expect } from 'vitest';

import { stageBarCell, stageLegend } from './metrics-cells.util';

describe('desglose por etapa con etapas de arranque', () => {
  const STAGES = { read: 3, upload: 2, startup: 2, setup: 0.5, teardown: 0.5 };

  it('stageLegend las muestra en español y en orden de ejecución', () => {
    expect(stageLegend(STAGES)).toMatch(
      /^Arranque .* · Inicialización .* · Lectura .* · Subida .* · Cierre /,
    );
  });

  it('stageBarCell ordena los segmentos igual que la leyenda', () => {
    const titles = (stageBarCell(STAGES).segments ?? []).map(
      (segment) => segment.title.split(':')[0],
    );
    expect(titles).toEqual(['Arranque', 'Inicialización', 'Lectura', 'Subida', 'Cierre']);
  });
});
