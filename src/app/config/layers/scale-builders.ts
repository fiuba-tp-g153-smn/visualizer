import { LayerScale, ScaleLabelScale, ScaleType } from '../../models';

export interface PaletteNodeScaleConfig {
  readonly min: number;
  readonly max: number;
  readonly count: number;
  readonly unit: string;
  readonly nodes: readonly { readonly index: number; readonly color: string }[];
  readonly labelCount?: number;
  readonly subTickCount?: number;
}

export function buildLinearContinuousScaleAtIndices(config: PaletteNodeScaleConfig): LayerScale {
  const { min, max, count, unit, nodes, labelCount, subTickCount } = config;
  const stops = nodes.map(({ index, color }) => ({
    value: Number((min + (index * (max - min)) / (count - 1)).toFixed(8)),
    color,
  }));
  return { type: ScaleType.CONTINUOUS, unit, stops, labelCount, subTickCount } as const satisfies LayerScale;
}

export interface LinearScaleConfig {
  readonly min: number;
  readonly max: number;
  readonly unit: string;
  readonly colors: readonly string[];
  readonly labelCount?: number;
  readonly subTickCount?: number;
}

export interface LogScaleConfig {
  readonly min: number;
  readonly max: number;
  readonly unit: string;
  readonly colors: readonly string[];
  readonly labelValues: readonly number[];
  readonly subTickCount?: number;
}

export function buildLinearContinuousScale(config: LinearScaleConfig): LayerScale {
  const { min, max, unit, colors, labelCount, subTickCount } = config;
  const lastIndex = colors.length - 1;
  const stops = colors.map((color, index) => {
    const ratio = lastIndex > 0 ? index / lastIndex : 0;
    return { value: Number((min + ratio * (max - min)).toFixed(8)), color };
  });
  return { type: ScaleType.CONTINUOUS, unit, stops, labelCount, subTickCount } as const satisfies LayerScale;
}

export function buildLinearDiscreteScale(config: LinearScaleConfig): LayerScale {
  const { min, max, unit, colors, labelCount, subTickCount } = config;
  const lastIndex = colors.length - 1;
  const steps = colors.map((color, index) => {
    const ratio = lastIndex > 0 ? index / lastIndex : 0;
    return { value: Number((min + ratio * (max - min)).toFixed(8)), color };
  });
  return {
    type: ScaleType.DISCRETE,
    unit,
    steps,
    labelCount,
    subTickCount,
    labelRange: [min, max],
  } as const satisfies LayerScale;
}

export function buildLogContinuousScale(config: LogScaleConfig): LayerScale {
  const { min, max, unit, colors, labelValues, subTickCount } = config;
  const lastIndex = colors.length - 1;
  const logMin = Math.log10(min);
  const logMax = Math.log10(max);
  const stops = colors.map((color, index) => {
    const ratio = lastIndex > 0 ? index / lastIndex : 0;
    return { value: Number(Math.pow(10, logMin + ratio * (logMax - logMin)).toFixed(8)), color };
  });
  return {
    type: ScaleType.CONTINUOUS,
    unit,
    stops,
    labelScale: ScaleLabelScale.LOG,
    labelValues,
    labelDomain: [min, max],
    subTickCount,
  } as const satisfies LayerScale;
}
