export const SMN_STATION_RENDER_CONFIG = {
  minDistancePx: 38,
  marker: {
    crowdedRadiusPx: 4,
    crowdedWeatherFillOpacityBase: 0.88,
    crowdedValueFillOpacityBase: 0.85,
    minimumFillOpacity: 0.12,
    dotMinFillOpacity: 0.2,
    dotMinRadiusPx: 1.75,
    dotRadiusFactor: 0.38,
    circleMinRadiusPx: 3.5,
    circleRadiusFactor: 0.75,
    circleStrokeWeight: 0.8,
    badgeMinDiameterPx: 24,
    badgeDiameterFactor: 3.2,
    badgeFontSizePx: 12,
    weatherFallbackColor: '#6b7280',
    weatherStrokeColor: '#111827',
  },
  density: {
    denseDistanceMultiplier: 0.9,
    mediumDistanceMultiplier: 1.2,
  },
  paneZIndex: {
    minInput: 1,
    maxInput: 1000,
    minOutput: 200,
    maxOutput: 690,
  },
  weather: {
    fallbackIconId: 3,
    nightStartsAtHour: 20,
    nightEndsBeforeHour: 7,
  },
} as const;

export type SmnWeatherPhenomenonConfig = {
  phenomenonId: number;
  label: string;
  dayColor: string;
  nightColor?: string;
  dayIconId: number;
  nightIconId?: number;
};

export const SMN_WEATHER_PHENOMENA: readonly SmnWeatherPhenomenonConfig[] = [
  {
    phenomenonId: 3,
    label: 'Despejado',
    dayColor: '#eabc0b',
    nightColor: '#9fb4d8',
    dayIconId: 3,
    nightIconId: 5,
  },
  {
    phenomenonId: 13,
    label: 'Ligeramente nublado',
    dayColor: '#e3c85e',
    nightColor: '#a7b4ca',
    dayIconId: 13,
    nightIconId: 14,
  },
  {
    phenomenonId: 19,
    label: 'Algo nublado',
    dayColor: '#d3ba5a',
    nightColor: '#98a8c4',
    dayIconId: 19,
    nightIconId: 20,
  },
  {
    phenomenonId: 25,
    label: 'Parcialmente nublado',
    dayColor: '#e1d8b4',
    nightColor: '#8b98b3',
    dayIconId: 25,
    nightIconId: 26,
  },
  {
    phenomenonId: 37,
    label: 'Mayormente nublado',
    dayColor: '#bfbeb8',
    nightColor: '#7d889b',
    dayIconId: 37,
    nightIconId: 38,
  },
  { phenomenonId: 43, label: 'Nublado', dayColor: '#bebfc1', nightColor: '#69778f', dayIconId: 43 },
  { phenomenonId: 51, label: 'Ventoso', dayColor: '#9aa19f', dayIconId: 118 },
  { phenomenonId: 61, label: 'Neblina', dayColor: '#8c8e91', dayIconId: 61 },
  { phenomenonId: 67, label: 'Niebla', dayColor: '#b79821', dayIconId: 67 },
  { phenomenonId: 69, label: 'Niebla engelante', dayColor: '#67686a', dayIconId: 119 },
  {
    phenomenonId: 71,
    label: 'Llovizna',
    dayColor: '#2aa9d7',
    nightColor: '#1f8fb8',
    dayIconId: 81,
  },
  {
    phenomenonId: 72,
    label: 'Lluvias aisladas',
    dayColor: '#25a3d3',
    nightColor: '#1d86af',
    dayIconId: 93,
  },
  { phenomenonId: 73, label: 'Lluvias', dayColor: '#1e99c8', nightColor: '#187ca3', dayIconId: 74 },
  {
    phenomenonId: 74,
    label: 'Chaparrones',
    dayColor: '#2b9ec9',
    nightColor: '#1f89b1',
    dayIconId: 72,
    nightIconId: 73,
  },
  {
    phenomenonId: 76,
    label: 'Tormentas aisladas',
    dayColor: '#5f7f93',
    nightColor: '#4c6879',
    dayIconId: 99,
  },
  { phenomenonId: 77, label: 'Lluvia y nevada', dayColor: '#8db5c6', dayIconId: 84 },
  { phenomenonId: 79, label: 'Nevadas', dayColor: '#cad1d4', dayIconId: 75 },
  {
    phenomenonId: 81,
    label: 'Tormentas',
    dayColor: '#5b7789',
    nightColor: '#475f6d',
    dayIconId: 85,
  },
  {
    phenomenonId: 83,
    label: 'Lluvias fuertes',
    dayColor: '#2f96be',
    nightColor: '#247a9a',
    dayIconId: 77,
  },
  { phenomenonId: 85, label: 'Nevadas fuertes', dayColor: '#b3bdc3', dayIconId: 80 },
  {
    phenomenonId: 89,
    label: 'Tormentas fuertes',
    dayColor: '#587789',
    nightColor: '#445f6c',
    dayIconId: 89,
  },
  { phenomenonId: 92, label: 'Ventisca alta', dayColor: '#8da7b6', dayIconId: 92 },
  { phenomenonId: 94, label: 'Ventisca', dayColor: '#8da7b6', dayIconId: 88 },
  { phenomenonId: 96, label: 'Ventisca baja', dayColor: '#8da6b5', dayIconId: 96 },
];

export const SMN_WEATHER_DAY_ICON_BY_PHENOMENON = new Map<number, number>(
  SMN_WEATHER_PHENOMENA.map((entry) => [entry.phenomenonId, entry.dayIconId]),
);

export const SMN_WEATHER_NIGHT_ICON_BY_PHENOMENON = new Map<number, number>(
  SMN_WEATHER_PHENOMENA.filter((entry) => entry.nightIconId !== undefined).map((entry) => [
    entry.phenomenonId,
    entry.nightIconId as number,
  ]),
);

export const SMN_SUPPORTED_WEATHER_ICON_IDS = new Set<number>(
  SMN_WEATHER_PHENOMENA.flatMap((entry) =>
    entry.nightIconId === undefined ? [entry.dayIconId] : [entry.dayIconId, entry.nightIconId],
  ),
);

export const SMN_WEATHER_COLOR_BY_PHENOMENON = new Map<number, string>(
  SMN_WEATHER_PHENOMENA.map((entry) => [entry.phenomenonId, entry.dayColor]),
);

export const SMN_WEATHER_NIGHT_COLOR_BY_PHENOMENON = new Map<number, string>(
  SMN_WEATHER_PHENOMENA.filter((entry) => entry.nightColor !== undefined).map((entry) => [
    entry.phenomenonId,
    entry.nightColor as string,
  ]),
);

export const SMN_WEATHER_SCALE_STEPS = SMN_WEATHER_PHENOMENA.map((entry) => ({
  value: entry.phenomenonId,
  color: entry.dayColor,
  label: entry.label,
}));
