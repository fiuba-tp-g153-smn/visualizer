import {
  ActiveLayerGroupId,
  BoundingBox,
  LayerCategory,
  LayerScale,
  LayerSubgroup,
  LayerType,
  RadarElevation,
  RadarTileLayer,
} from '../../../models';
import { SHARED_DBZH_SCALE } from '../shared-scales.config';
import {
  RADAR_VRAD_SCALE,
  RADAR_RHOHV_SCALE,
  RADAR_ZDR_SCALE,
  RADAR_KDP_SCALE,
} from './scales.config';

/**
 * Valores por defecto para capas RADAR
 */
const RADAR_DEFAULTS = {
  type: LayerType.TILE,
  zIndexGroup: ActiveLayerGroupId.BASE,
  availablePeriods: [6, 12] as const,
  availableElevations: [
    {
      id: 'elev0',
      name: '0.5°',
      activeByDefault: true,
      zIndexPreference: 1,
    },
    {
      id: 'elev1',
      name: '0.9°',
      activeByDefault: false,
      zIndexPreference: 2,
    },
    {
      id: 'elev2',
      name: '1.3°',
      activeByDefault: false,
      zIndexPreference: 3,
    },
  ] as const,
  category: LayerCategory.RADAR,
  tms: false,
  isForecast: false,
};

/** Prefijo de ruta de cada red; es el segmento que sirve el data-service. */
const SINARAME_PREFIX = 'radar-sinarame';
const INTA_PREFIX = 'radar-inta';
enum RadarProduct {
  DBZH = 'dbzh',
  DBZH_450KM = 'dbzh-450km',
  KDP = 'kdp',
  VRAD = 'vrad',
  RHOHV = 'rhohv',
  ZDR = 'zdr',
}

const products = Object.values(RadarProduct) as readonly RadarProduct[];
const MIN_ZOOM = 4;
const MAX_ZOOM = 9;

const RADAR_SCALES: Record<RadarProduct, LayerScale> = {
  [RadarProduct.DBZH]: SHARED_DBZH_SCALE,
  // Misma variable física (reflectividad) que DBZH, sólo cambia el alcance.
  [RadarProduct.DBZH_450KM]: SHARED_DBZH_SCALE,
  [RadarProduct.KDP]: RADAR_KDP_SCALE,
  [RadarProduct.VRAD]: RADAR_VRAD_SCALE,
  [RadarProduct.RHOHV]: RADAR_RHOHV_SCALE,
  [RadarProduct.ZDR]: RADAR_ZDR_SCALE,
};

/**
 * Nombre visible del producto cuando su id no se lee bien como etiqueta.
 * Sin entrada, se muestra el id tal cual (DBZH, VRAD, …).
 */
/**
 * Etiqueta visible de cada momento. El Record es total a propósito: los ids son
 * minúsculas para S3 y las URLs, así que un producto sin entrada caía al id
 * crudo y se mostraba en minúscula en el panel de capas.
 */
const RADAR_PRODUCT_LABELS: Record<RadarProduct, string> = {
  [RadarProduct.DBZH]: 'DBZH',
  [RadarProduct.DBZH_450KM]: 'DBZH 450 km',
  [RadarProduct.KDP]: 'KDP',
  [RadarProduct.VRAD]: 'VRAD',
  [RadarProduct.RHOHV]: 'RHOHV',
  [RadarProduct.ZDR]: 'ZDR',
};

/**
 * El subvolumen 04 (largo alcance) trae un único sweep de 0.55°, no los tres
 * del subvolumen 01, así que sólo se publica elev0 para ese producto.
 */
const SINGLE_ELEVATION: readonly RadarElevation[] = [
  {
    id: 'elev0',
    name: '0.5°',
    activeByDefault: true,
    zIndexPreference: 1,
  },
];

const RADAR_PRODUCT_ELEVATIONS: Partial<Record<RadarProduct, readonly RadarElevation[]>> = {
  [RadarProduct.DBZH_450KM]: SINGLE_ELEVATION,
};

/**
 * Bounding box real del barrido de largo alcance, por radar.
 *
 * Medidos de los propios `.H5` del subvolumen 04 con la misma fórmula que aplica
 * el backend en `_compute_cartesian_mapping` (centro del radar ± alcance máximo,
 * corrigiendo la longitud por el coseno de la latitud), y redondeados hacia
 * afuera: son un superconjunto exacto de los tiles que publica el procesador.
 *
 * Los 17 radares medidos usan el mismo barrido: un sweep de ~0.5°, 1235–1237
 * gates de 360 m, alcance 446.3–446.7 km. RMA18 todavía no tiene dato y cae al
 * escalado aproximado de abajo.
 */
const RADAR_LONG_RANGE_BOXES: Readonly<Record<string, BoundingBox>> = {
  rma1: [
    [-35.47, -68.91],
    [-27.42, -59.47],
  ],
  rma2: [
    [-38.83, -63.42],
    [-30.77, -53.61],
  ],
  rma3: [
    [-28.76, -64.98],
    [-20.7, -56.12],
  ],
  rma4: [
    [-31.48, -63.59],
    [-23.42, -54.51],
  ],
  rma5: [
    [-30.3, -58.16],
    [-22.25, -49.18],
  ],
  rma6: [
    [-41.94, -62.63],
    [-33.88, -52.42],
  ],
  rma7: [
    [-42.91, -73.32],
    [-34.85, -62.97],
  ],
  rma8: [
    [-33.22, -62.66],
    [-25.17, -53.43],
  ],
  rma9: [
    [-57.81, -74.56],
    [-49.76, -60.93],
  ],
  rma10: [
    [-42.76, -67.32],
    [-34.71, -57.0],
  ],
  rma11: [
    [-31.53, -69.45],
    [-23.47, -60.36],
  ],
  rma12: [
    [-44.8, -70.39],
    [-36.75, -59.76],
  ],
  rma13: [
    [-31.65, -61.39],
    [-23.6, -52.3],
  ],
  rma14: [
    [-40.22, -66.06],
    [-32.16, -56.08],
  ],
  rma15: [
    [-34.06, -71.53],
    [-26.0, -62.23],
  ],
  rma16: [
    [-37.74, -70.22],
    [-29.69, -60.54],
  ],
  rma17: [
    [-37.38, -68.52],
    [-29.32, -58.88],
  ],
  rma18: [
    [-40.25, -71.93],
    [-32.2, -61.95],
  ],
  rma20: [
    [-28.77, -68.68],
    [-20.72, -59.82],
  ],
};

/**
 * Alcance (km) que representan los boundingBox declarados en RADARES_SMN:
 * el subvolumen corto son 652 gates de 360 m ≈ 235 km, más un margen.
 */
const RADAR_DEFAULT_RANGE_KM = 240;

/**
 * Alcance de los productos que se leen de un subvolumen de largo alcance.
 * Sólo se usa como respaldo para un radar sin caja medida en
 * RADAR_LONG_RANGE_BOXES.
 */
const RADAR_PRODUCT_RANGE_KM: Partial<Record<RadarProduct, number>> = {
  [RadarProduct.DBZH_450KM]: 450,
};

/**
 * Reescala un boundingBox alrededor de su centro (la posición del radar).
 * Leaflet usa `bounds` para no pedir tiles fuera de la caja, así que un
 * producto de mayor alcance necesita la suya o pierde el anillo exterior.
 */
function scaleBoundingBox(box: BoundingBox, factor: number): BoundingBox {
  const [[latS, lngW], [latN, lngE]] = box;
  const latCenter = (latS + latN) / 2;
  const lngCenter = (lngW + lngE) / 2;
  const latHalf = ((latN - latS) / 2) * factor;
  const lngHalf = ((lngE - lngW) / 2) * factor;
  return [
    [latCenter - latHalf, lngCenter - lngHalf],
    [latCenter + latHalf, lngCenter + lngHalf],
  ];
}

/** Caja del producto: la medida si existe, si no la escalada, si no la base. */
function boundingBoxFor(product: RadarProduct, radarId: string, box: BoundingBox): BoundingBox {
  const rangeKm = RADAR_PRODUCT_RANGE_KM[product];
  if (!rangeKm) return box;
  return RADAR_LONG_RANGE_BOXES[radarId] ?? scaleBoundingBox(box, rangeKm / RADAR_DEFAULT_RANGE_KM);
}

// Ubicaciones y configuraciones de los 18 radares de la red SINARAME (SMN/INTA)
const RADARES_SMN = [
  {
    id: 'rma1',
    number: 1,
    ubi: 'Córdoba',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-33.6, -66.78],
      [-29.26, -61.6],
    ] as const,
  },
  {
    id: 'rma2',
    number: 2,
    ubi: 'Ezeiza',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-36.96, -61.22],
      [-32.62, -55.82],
    ] as const,
  },
  {
    id: 'rma3',
    number: 3,
    ubi: 'Las Lomitas',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-26.89, -62.97],
      [-22.55, -58.13],
    ] as const,
  },
  {
    id: 'rma4',
    number: 4,
    ubi: 'Resistencia',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-29.61, -61.53],
      [-25.27, -56.57],
    ] as const,
  },
  {
    id: 'rma5',
    number: 5,
    ubi: 'Bernardo de Irigoyen',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-28.44, -56.12],
      [-24.1, -51.22],
    ] as const,
  },
  {
    id: 'rma6',
    number: 6,
    ubi: 'Mar del Plata',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-40.07, -60.35],
      [-35.72, -54.71],
    ] as const,
  },
  {
    id: 'rma7',
    number: 7,
    ubi: 'Neuquén',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-41.03, -71.0],
      [-36.69, -65.29],
    ] as const,
  },
  {
    id: 'rma8',
    number: 8,
    ubi: 'Mercedes',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-31.35, -60.57],
      [-27.02, -55.52],
    ] as const,
  },
  {
    id: 'rma9',
    number: 9,
    ubi: 'Río Grande',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-55.94, -71.59],
      [-51.57, -63.89],
    ] as const,
  },
  {
    id: 'rma10',
    number: 10,
    ubi: 'Bahía Blanca',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-40.89, -65.02],
      [-36.54, -59.31],
    ] as const,
  },
  {
    id: 'rma11',
    number: 11,
    ubi: 'Termas de Río Hondo',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-29.66, -67.39],
      [-25.32, -62.42],
    ] as const,
  },
  {
    id: 'rma12',
    number: 12,
    ubi: 'Las Grutas',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-42.93, -68.02],
      [-38.58, -62.13],
    ] as const,
  },
  {
    id: 'rma13',
    number: 13,
    ubi: 'Ituzaingó',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-29.78, -59.33],
      [-25.44, -54.36],
    ] as const,
  },
  {
    id: 'rma14',
    number: 14,
    ubi: 'Bolívar',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-38.35, -63.82],
      [-34.0, -58.32],
    ] as const,
  },
  {
    id: 'rma15',
    number: 15,
    ubi: 'Patquía',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-32.19, -69.43],
      [-27.85, -64.33],
    ] as const,
  },
  {
    id: 'rma16',
    number: 16,
    ubi: 'Villa Reynolds',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-35.88, -68.04],
      [-31.53, -62.71],
    ] as const,
  },
  {
    id: 'rma17',
    number: 17,
    ubi: 'Alejandro Roca',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-35.51, -66.35],
      [-31.17, -61.05],
    ] as const,
  },
  {
    id: 'rma18',
    number: 18,
    ubi: 'Santa Isabel',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    boundingBox: [
      [-38.38, -69.69],
      [-34.04, -64.18],
    ] as const,
  },
  {
    id: 'rma20',
    number: 20,
    ubi: 'Las Lajitas',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    // Derivada de la posición que declara el propio archivo ODIM
    // (lat -24.74611, lon -64.25111) con el alcance de 240 km del subvolumen 01.
    boundingBox: [
      [-26.91, -66.64],
      [-22.58, -61.87],
    ] as const,
  },
];

/**
 * Radares del INTA (Rainbow5). Se publican bajo `tiles/radar/inta/...`, con los
 * mismos productos y elevaciones que los SINARAME: la geometría de 240 km es
 * equivalente y las tres primeras elevaciones (0.5°, 0.9°, 1.3°) coinciden.
 *
 * Coordenadas y alcance leídos de la cabecera XML de los propios `.vol`; la
 * caja es centro ± 240 km con la corrección por coseno de la latitud, la misma
 * fórmula que aplica el backend en `_compute_cartesian_mapping`.
 */
const RADARES_INTA = [
  {
    id: 'par',
    name: 'INTA Paraná',
    ubi: 'Paraná',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    // lat -31.848438, lon -60.537289
    boundingBox: [
      [-34.02, -63.09],
      [-29.68, -57.99],
    ] as const,
  },
  {
    id: 'ang',
    name: 'INTA Anguil',
    ubi: 'Anguil',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    // lat -36.539684, lon -63.990067
    boundingBox: [
      [-38.71, -66.69],
      [-34.37, -61.29],
    ] as const,
  },
  {
    id: 'per',
    name: 'INTA Pergamino',
    ubi: 'Pergamino',
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_ZOOM,
    // lat -33.946098, lon -60.562500
    boundingBox: [
      [-36.11, -63.17],
      [-31.78, -57.95],
    ] as const,
  },
];

/**
 * Productos del feed INTA: los cuatro momentos con equivalente directo en
 * SINARAME. No incluye `vrad` (el Nyquist de estos radares es ±6,65 m/s contra
 * los ±40 que abarca la paleta, se vería monocroma) ni `dbzh-450km` (no hay
 * barrido de largo alcance en este feed).
 */
const INTA_PRODUCTS: readonly RadarProduct[] = [
  RadarProduct.DBZH,
  RadarProduct.ZDR,
  RadarProduct.RHOHV,
  RadarProduct.KDP,
];

interface RadarSite {
  readonly id: string;
  readonly minNativeZoom: number;
  readonly maxNativeZoom: number;
  readonly boundingBox: BoundingBox;
}

function buildRadarLayers(
  prefix: string,
  site: RadarSite,
  siteLabel: string,
  siteProducts: readonly RadarProduct[],
): RadarTileLayer[] {
  return siteProducts.map((product) => {
    const label = RADAR_PRODUCT_LABELS[product];
    return {
      ...RADAR_DEFAULTS,
      id: `${prefix}/${site.id.toUpperCase()}/${product}`,
      name: label,
      scale: RADAR_SCALES[product],
      description: `Producto ${label} del radar meteorológico ${siteLabel}`,
      minNativeZoom: site.minNativeZoom,
      maxNativeZoom: site.maxNativeZoom,
      availableElevations:
        RADAR_PRODUCT_ELEVATIONS[product] ?? RADAR_DEFAULTS.availableElevations,
      boundingBox: boundingBoxFor(product, site.id, site.boundingBox),
    };
  }) as RadarTileLayer[];
}

const SINARAME_SUBGROUPS: LayerSubgroup[] = RADARES_SMN.map((radar) => {
  const siteLabel = `RMA ${radar.number} de ${radar.ubi}`;
  return {
    id: radar.id,
    name: `RMA ${radar.number} - ${radar.ubi}`,
    description: `Capas del radar meteorológico ${siteLabel}`,
    expanded: false,
    layers: buildRadarLayers(SINARAME_PREFIX, radar, siteLabel, products),
  };
});

const INTA_SUBGROUPS: LayerSubgroup[] = RADARES_INTA.map((radar) => ({
  id: radar.id,
  name: radar.name,
  description: `Capas del radar meteorológico ${radar.name} del INTA`,
  expanded: false,
  layers: buildRadarLayers(INTA_PREFIX, radar, `${radar.name} del INTA`, INTA_PRODUCTS),
}));

export const RADAR_SUBGROUPS: LayerSubgroup[] = [
  ...SINARAME_SUBGROUPS,
  ...INTA_SUBGROUPS,
];
