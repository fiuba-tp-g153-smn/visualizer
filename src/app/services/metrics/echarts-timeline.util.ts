import type { RecentJob } from '../../models/metrics/metrics.models';
import { buildTypeColorMap, LABEL_COLOR } from './metrics-chart.util';
import { colorOf, packIntoLanes, type TimelineColorBy, tooltipHtml } from './timeline-shared.util';

/** Un dato del gráfico: `value`=[carril, inicioMs, finMs] + metadatos. */
export interface EchartsTimelineDatum {
  value: [number, number, number];
  job: RecentJob;
  color: string;
  tooltip: string;
}

/** Subset tipado de la opción de ECharts que construimos (se castea al pasarla). */
export interface EchartsTimelineOption {
  useUTC: boolean;
  animation: boolean;
  grid: Record<string, number | boolean>;
  xAxis: Record<string, unknown>;
  yAxis: Record<string, unknown>;
  dataZoom: Array<Record<string, unknown>>;
  tooltip: Record<string, unknown>;
  series: Array<Record<string, unknown>>;
}

/** Lo que necesita `renderItem` de la API de ECharts (subset, para no usar `any`). */
interface RenderApi {
  value(dim: number): number;
  coord(point: [number, number]): [number, number];
  size(dataSize: [number, number]): [number, number];
}
interface RenderParams {
  dataIndex: number;
}

/**
 * Construye la opción de ECharts para la línea de tiempo (serie `custom` estilo
 * Gantt sobre un eje de tiempo). Las filas se empaquetan con `packIntoLanes`
 * (no son workers). `dataZoom` (inside + slider, `weakFilter`) da el zoom
 * interactivo sin que desaparezcan las barras del borde; `useUTC` respeta el
 * toggle de zona horaria. Pura: la `renderItem`/tooltip son closures sobre los
 * datos; el componente solo hace `setOption` y escucha el click.
 */
export function buildEchartsOption(
  jobs: readonly RecentJob[],
  opts: { utc: boolean; colorBy: TimelineColorBy; maxSpanMs?: number | null },
): { option: EchartsTimelineOption; lanes: number; extent: [number, number] } {
  const { rows, lanes } = packIntoLanes(jobs);
  const typeColorFor = buildTypeColorMap(jobs.map((job) => job.job_type));

  const data: EchartsTimelineDatum[] = rows.map((row) => ({
    value: [row.lane, row.start, row.end],
    job: row.job,
    color: colorOf(row.job, opts.colorBy, typeColorFor),
    tooltip: tooltipHtml(row.job, opts.utc),
  }));

  const laneLabels = Array.from({ length: Math.max(lanes, 1) }, (_, i) => String(i + 1));

  // Extensión temporal de los datos (min inicio / max fin), con reduce para no
  // desbordar la pila al hacer spread sobre miles de filas.
  let extentMin = Infinity;
  let extentMax = -Infinity;
  for (const row of rows) {
    if (row.start < extentMin) extentMin = row.start;
    if (row.end > extentMax) extentMax = row.end;
  }
  if (!rows.length) {
    extentMin = 0;
    extentMax = 0;
  }

  // Modo "todo": acota la ventana visible a `maxSpanMs` y arranca en el tramo
  // más reciente; el componente carga semanas anteriores al desplazarte.
  const maxSpan = opts.maxSpanMs ?? null;
  const windowed = maxSpan != null && rows.length > 0;
  const zoomBounds: Record<string, number> = windowed
    ? { maxValueSpan: maxSpan, startValue: Math.max(extentMin, extentMax - maxSpan), endValue: extentMax }
    : {};

  const renderItem = (params: RenderParams, api: RenderApi): unknown => {
    const lane = api.value(0);
    const start = api.coord([api.value(1), lane]);
    const end = api.coord([api.value(2), lane]);
    const bandHeight = api.size([0, 1])[1];
    const height = bandHeight * 0.6;
    const width = Math.max(end[0] - start[0], 1);
    return {
      type: 'rect',
      shape: { x: start[0], y: start[1] - height / 2, width, height, r: 1 },
      style: { fill: data[params.dataIndex].color },
    };
  };

  return {
    lanes,
    extent: [extentMin, extentMax],
    option: {
      useUTC: opts.utc,
      animation: false,
      grid: { left: 12, right: 16, top: 8, bottom: 34, containLabel: true },
      xAxis: {
        type: 'time',
        axisLabel: { color: LABEL_COLOR, fontSize: 11, hideOverlap: true },
        splitLine: { show: true, lineStyle: { color: '#eceef0' } },
      },
      yAxis: {
        type: 'category',
        data: laneLabels,
        show: false,
        inverse: true,
      },
      dataZoom: [
        // Rueda hace zoom; el arrastre lo maneja el componente (banda → dataZoom).
        // `zoomBounds` acota la ventana a `maxSpanMs` y la sitúa en el tramo reciente.
        {
          type: 'inside',
          xAxisIndex: 0,
          filterMode: 'weakFilter',
          zoomOnMouseWheel: true,
          moveOnMouseMove: false,
          // El arrastre lo maneja el componente (banda de selección); sin cursor "mano".
          cursorGrab: false,
          cursorGrabbing: false,
          ...zoomBounds,
        },
        { type: 'slider', xAxisIndex: 0, filterMode: 'weakFilter', height: 18, bottom: 6, ...zoomBounds },
      ],
      tooltip: {
        trigger: 'item',
        appendToBody: true,
        borderColor: '#e0e0e0',
        formatter: (p: { data?: EchartsTimelineDatum }) => p.data?.tooltip ?? '',
      },
      series: [
        {
          type: 'custom',
          clip: true,
          // Render por lotes para que una semana completa (miles de barras) no
          // bloquee el hilo principal.
          progressive: 2000,
          progressiveThreshold: 2000,
          encode: { x: [1, 2], y: 0 },
          data,
          renderItem,
        },
      ],
    },
  };
}
