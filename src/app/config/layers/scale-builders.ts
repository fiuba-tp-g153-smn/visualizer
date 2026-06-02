import { LayerScale, ScaleLabelScale, ScaleSpecialPoint, ScaleType } from '../../models';

type ScaleEntry = Readonly<{
  value: number;
  color: string;
  label?: string;
  hardStop?: boolean;
}>;
type SupportedScaleType = ScaleType.CONTINUOUS | ScaleType.DISCRETE;

function roundScaleValue(value: number): number {
  return Number(value.toFixed(8));
}

function entriesDomain(entries: readonly ScaleEntry[]): readonly [number, number] | undefined {
  if (entries.length === 0) return undefined;

  let min = entries[0].value;
  let max = entries[0].value;
  for (const entry of entries) {
    if (entry.value < min) min = entry.value;
    if (entry.value > max) max = entry.value;
  }

  return [min, max] as const;
}

function createLayerScale(params: {
  type: SupportedScaleType;
  unit: string;
  entries: readonly ScaleEntry[];
  labelCount?: number;
  subTickCount?: number;
  clipRange?: readonly [number, number];
  defaultDiscreteClipRange?: readonly [number, number];
  labelScale?: ScaleLabelScale;
  labelValues?: readonly number[];
  specialPoints?: readonly ScaleSpecialPoint[];
  scaleDisplayName?: string;
  scaleRoutingKey?: string;
}): LayerScale {
  const {
    type,
    unit,
    entries,
    labelCount,
    subTickCount,
    clipRange,
    defaultDiscreteClipRange,
    labelScale,
    labelValues,
    specialPoints,
    scaleDisplayName,
    scaleRoutingKey,
  } = params;

  const resolvedClipRange =
    type === ScaleType.DISCRETE ? (clipRange ?? defaultDiscreteClipRange) : clipRange;

  return {
    type,
    unit,
    entries,
    labelCount,
    subTickCount,
    clipRange: resolvedClipRange,
    labelScale,
    labelValues,
    specialPoints,
    ...(scaleRoutingKey ? { scaleRoutingKey } : {}),
    ...(scaleDisplayName ? { scaleDisplayName } : {}),
  } as const satisfies LayerScale;
}

interface BaseScaleConfig {
  readonly unit: string;
  readonly type?: SupportedScaleType;
  readonly labelCount?: number;
  readonly labelValues?: readonly number[];
  readonly subTickCount?: number;
  readonly clipRange?: readonly [number, number];
  readonly specialPoints?: readonly ScaleSpecialPoint[];
  readonly scaleDisplayName?: string;
  readonly scaleRoutingKey?: string;
}

export interface IndexedScaleConfig extends BaseScaleConfig {
  readonly min: number;
  readonly max: number;
  readonly count: number;
  readonly nodes: readonly {
    readonly index: number;
    readonly color: string;
    readonly hardStop?: boolean;
  }[];
}

export interface LinearScaleConfig extends BaseScaleConfig {
  readonly min: number;
  readonly max: number;
  readonly colors: readonly string[];
}

export interface BoundedScaleConfig extends BaseScaleConfig {
  readonly bounds: readonly number[];
  readonly colors: readonly string[];
}

export interface UniformBoundedScaleConfig extends BaseScaleConfig {
  readonly min: number;
  readonly max: number;
  readonly colors: readonly string[];
}

export interface LogScaleConfig extends Omit<BaseScaleConfig, 'labelCount'> {
  readonly min: number;
  readonly max: number;
  readonly colors: readonly string[];
  readonly labelValues: readonly number[];
}

function buildIndexedEntries(config: IndexedScaleConfig): readonly ScaleEntry[] {
  const { min, max, count, nodes } = config;
  return nodes.map(({ index, color, hardStop }) => ({
    value: roundScaleValue(min + (index * (max - min)) / (count - 1)),
    color,
    ...(hardStop ? { hardStop: true as const } : {}),
  }));
}

function buildLinearEntries(
  config: Pick<LinearScaleConfig, 'min' | 'max' | 'colors'>,
): ScaleEntry[] {
  const { min, max, colors } = config;
  const lastIndex = colors.length - 1;
  return colors.map((color, index) => {
    const ratio = lastIndex > 0 ? index / lastIndex : 0;
    return { value: roundScaleValue(min + ratio * (max - min)), color };
  });
}

export function buildScaleFromIndexedNodes(config: IndexedScaleConfig): LayerScale {
  const {
    min,
    max,
    unit,
    labelCount,
    labelValues,
    subTickCount,
    clipRange,
    specialPoints,
    scaleDisplayName,
    scaleRoutingKey,
  } = config;
  const entries = buildIndexedEntries(config);

  return createLayerScale({
    type: config.type ?? ScaleType.CONTINUOUS,
    unit,
    entries,
    labelCount,
    labelValues,
    subTickCount,
    clipRange,
    defaultDiscreteClipRange: [min, max],
    specialPoints,
    scaleDisplayName,
    scaleRoutingKey,
  });
}

export function buildScaleFromLinearGradient(config: LinearScaleConfig): LayerScale {
  const {
    min,
    max,
    unit,
    labelCount,
    labelValues,
    subTickCount,
    clipRange,
    specialPoints,
    scaleDisplayName,
    scaleRoutingKey,
  } = config;
  const entries = buildLinearEntries(config);

  return createLayerScale({
    type: config.type ?? ScaleType.CONTINUOUS,
    unit,
    entries,
    labelCount,
    labelValues,
    subTickCount,
    clipRange,
    defaultDiscreteClipRange: [min, max],
    specialPoints,
    scaleDisplayName,
    scaleRoutingKey,
  });
}

export function buildScaleFromThresholds(config: BoundedScaleConfig): LayerScale {
  const {
    bounds,
    colors,
    unit,
    labelCount,
    labelValues,
    subTickCount,
    specialPoints,
    scaleDisplayName,
    scaleRoutingKey,
  } = config;
  const entries = bounds.map((value, i) => ({
    value,
    color: colors[i] ?? colors[colors.length - 1],
  }));
  const domain = entriesDomain(entries);

  return createLayerScale({
    type: config.type ?? ScaleType.CONTINUOUS,
    unit,
    entries,
    labelCount,
    labelValues,
    subTickCount,
    clipRange: config.clipRange,
    defaultDiscreteClipRange: domain,
    specialPoints,
    scaleDisplayName,
    scaleRoutingKey,
  });
}

export function buildScaleFromUniformThresholds(config: UniformBoundedScaleConfig): LayerScale {
  const { min, max, colors } = config;
  const steps = Math.max(colors.length - 1, 0);
  const bounds =
    steps === 0
      ? [min]
      : Array.from({ length: colors.length }, (_, i) =>
          roundScaleValue(min + (i * (max - min)) / steps),
        );

  return buildScaleFromThresholds({
    ...config,
    bounds,
  });
}

export function buildLogScale(config: LogScaleConfig): LayerScale {
  const {
    min,
    max,
    unit,
    colors,
    labelValues,
    subTickCount,
    clipRange,
    scaleDisplayName,
    scaleRoutingKey,
  } = config;
  const lastIndex = colors.length - 1;
  const logMin = Math.log10(min);
  const logMax = Math.log10(max);
  const entries = colors.map((color, index) => {
    const ratio = lastIndex > 0 ? index / lastIndex : 0;
    return { value: roundScaleValue(Math.pow(10, logMin + ratio * (logMax - logMin))), color };
  });

  return createLayerScale({
    type: ScaleType.CONTINUOUS,
    unit,
    entries,
    labelScale: ScaleLabelScale.LOG,
    labelValues,
    subTickCount,
    clipRange,
    specialPoints: config.specialPoints,
    scaleDisplayName,
    scaleRoutingKey,
  });
}
