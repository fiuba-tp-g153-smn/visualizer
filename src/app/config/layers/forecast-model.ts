import { ForecastModelId, ForecastModelTileLayer, Layer, LayerCategory } from '../../models';
import {
  buildGfsBarbTileUrl,
  buildGfsPointQueryUrl,
  buildGfsTileUrl,
  buildWrfBarbTileUrl,
  buildWrfPointQueryUrl,
  buildWrfTileUrl,
} from '../backend.config';
import {
  formatGfsCycleTag,
  formatWrfInitTag,
  gfsFxxxForCycleAndTime,
  parseGfsCycleTag,
  parseGfsStepTimestamp,
  parseWrfInitTag,
  parseWrfStepTimestamp,
  wrfFxxxForInitAndTime,
} from '../../utils/tileset-timestamp';

/**
 * Todo lo que varía entre dos modelos numéricos con la misma forma
 * (producto → corrida → paso): cómo se arman las URLs y cómo se traduce la
 * etiqueta de corrida a un instante absoluto.
 *
 * El resto de la maquinaria — selección de corridas, playback, opacidad por
 * render, overlays vectoriales, dato puntual — es idéntica para WRF y GFS y no
 * necesita saber de qué modelo se trata.
 */
export interface ForecastModelAdapter {
  readonly id: ForecastModelId;
  /** Etiqueta del modelo en el nombre completo de la capa y en el dato puntual. */
  readonly displayName: string;
  buildTileUrl(productId: string, runTag: string, fxxx: string): string;
  buildBarbTileUrl(
    productId: string,
    runTag: string,
    fxxx: string,
    z: number,
    x: number,
    y: number,
  ): string;
  buildPointQueryUrl(
    productId: string,
    runTag: string,
    fxxx: string,
    lat: number,
    lon: number,
  ): string;
  /** Instante en que arranca una corrida. */
  parseRunTag(runTag: string): Date | null;
  /** Instante para el que vale un paso de una corrida. */
  parseStepTimestamp(runTag: string, fxxx: string): Date | null;
  /** Paso de esa corrida para un instante absoluto; null si es anterior a la corrida. */
  fxxxForRunAndTime(runTag: string, time: Date): string | null;
  /** Etiqueta compacta de corrida para el selector ("MM-DD HHh"). */
  formatRunTag(runTag: string): string;
  /**
   * Extrae las corridas del listado del data-service. Es lo único que difiere
   * en la forma de la respuesta: WRF las publica como `init_runs[].init_tag` y
   * GFS como `cycles[].cycle`. Los pasos, en cambio, son `steps[].fxxx` en
   * ambos, así que no hacen falta dos lectores.
   */
  readRunTags(response: unknown): string[];
}

interface WrfRunListResponse {
  init_runs?: Array<{ init_tag: string }>;
}

interface GfsCycleListResponse {
  cycles?: Array<{ cycle: string }>;
}

const WRF_ADAPTER: ForecastModelAdapter = {
  id: 'wrf',
  displayName: 'WRF',
  buildTileUrl: buildWrfTileUrl,
  buildBarbTileUrl: buildWrfBarbTileUrl,
  buildPointQueryUrl: buildWrfPointQueryUrl,
  parseRunTag: parseWrfInitTag,
  parseStepTimestamp: parseWrfStepTimestamp,
  fxxxForRunAndTime: wrfFxxxForInitAndTime,
  formatRunTag: formatWrfInitTag,
  readRunTags: (response) =>
    ((response as WrfRunListResponse)?.init_runs ?? []).map((run) => run.init_tag),
};

const GFS_ADAPTER: ForecastModelAdapter = {
  id: 'gfs',
  displayName: 'GFS',
  buildTileUrl: buildGfsTileUrl,
  buildBarbTileUrl: buildGfsBarbTileUrl,
  buildPointQueryUrl: buildGfsPointQueryUrl,
  parseRunTag: parseGfsCycleTag,
  parseStepTimestamp: parseGfsStepTimestamp,
  fxxxForRunAndTime: gfsFxxxForCycleAndTime,
  formatRunTag: formatGfsCycleTag,
  readRunTags: (response) =>
    ((response as GfsCycleListResponse)?.cycles ?? []).map((entry) => entry.cycle),
};

const ADAPTERS: Readonly<Record<ForecastModelId, ForecastModelAdapter>> = {
  wrf: WRF_ADAPTER,
  gfs: GFS_ADAPTER,
};

/**
 * Adaptador de un modelo. `undefined` cae en WRF, que era el único modelo con
 * esta forma antes de incorporar GFS y por eso no marca `modelId` en su config.
 */
export function forecastModelAdapter(modelId?: ForecastModelId): ForecastModelAdapter {
  return ADAPTERS[modelId ?? 'wrf'];
}

/** Adaptador de una capa concreta. */
export function adapterForLayer(layer: ForecastModelTileLayer): ForecastModelAdapter {
  return forecastModelAdapter(layer.modelId);
}

/** True cuando la capa es un modelo por corrida/paso (WRF o GFS). */
export function isForecastModelLayer(layer: Layer): layer is ForecastModelTileLayer {
  return layer.category === LayerCategory.WRF;
}

/**
 * True cuando la capa publica una pirámide raster. Los productos que son solo
 * contornos (la presión a nivel del mar de GFS) devuelven false: no se les pide
 * ningún tile, pero sus overlays y su dato puntual siguen funcionando.
 */
export function hasRasterPyramid(layer: ForecastModelTileLayer): boolean {
  return layer.hasRaster !== false;
}
