export const SMN_STATION_RENDER_CONFIG = {
  minDistancePx: 38,
  marker: {
    crowdedRadiusPx: 4,
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
} as const;
