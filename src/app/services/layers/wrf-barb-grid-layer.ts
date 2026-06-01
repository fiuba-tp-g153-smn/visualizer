import * as L from 'leaflet';
import type { Feature, FeatureCollection, Point } from 'geojson';

import { buildWrfBarbTileUrl } from '../../config/backend.config';
import { renderBarbGlyphMarkup } from '../../config/layers/wrf/wrf-overlay-styles';

const BARB_NATIVE_ZOOMS = [2, 4, 6, 8, 10, 12] as const;
const TILE_SIZE = 256;

function snapBarbZoom(z: number): number {
  for (let i = BARB_NATIVE_ZOOMS.length - 1; i >= 0; i--) {
    if (z >= BARB_NATIVE_ZOOMS[i]) return BARB_NATIVE_ZOOMS[i];
  }
  return BARB_NATIVE_ZOOMS[0];
}

function lonLatToTilePixel(
  lon: number,
  lat: number,
  z: number,
  tx: number,
  ty: number,
): [number, number] {
  const n = 2 ** z;
  const fx = ((lon + 180) / 360) * n;
  const latR = (lat * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n;
  return [(fx - tx) * TILE_SIZE, (fy - ty) * TILE_SIZE];
}

export interface WrfBarbGridLayerOptions extends L.GridLayerOptions {
  productId: string;
  initTag: string;
  fxxx: string;
}

/**
 * Capa custom de tiles vectoriales para barbas WRF.
 *
 * Backend emite GeoJSONs solo en zooms nativos `{2, 4, 6, 8, 10, 12}`. Para
 * cualquier zoom intermedio (3, 5, 7, 9, ...) snappea al nativo más cercano
 * hacia abajo, fetcha ese tile (con cache por instancia) y filtra/proyecta
 * features al pixel-en-tile que Leaflet realmente pidió. Render = 1 `<svg>`
 * por tile con N glyphs adentro (sin DOM por barba).
 */
export class WrfBarbGridLayer extends L.GridLayer {
  private readonly opts: WrfBarbGridLayerOptions;
  private readonly nativeTileCache = new Map<
    string,
    Promise<FeatureCollection | null>
  >();

  constructor(opts: WrfBarbGridLayerOptions) {
    super({ tileSize: TILE_SIZE, noWrap: true, ...opts });
    this.opts = opts;
  }

  override createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tile = L.DomUtil.create('div', 'wrf-barb-tile');
    tile.style.position = 'absolute';
    tile.style.overflow = 'visible';
    tile.style.pointerEvents = 'none';

    const nativeZ = snapBarbZoom(coords.z);
    const shift = coords.z - nativeZ;
    const nx = coords.x >> shift;
    const ny = coords.y >> shift;
    const key = `${nativeZ}/${nx}/${ny}`;

    let pending = this.nativeTileCache.get(key);
    if (!pending) {
      const url = buildWrfBarbTileUrl(
        this.opts.productId,
        this.opts.initTag,
        this.opts.fxxx,
        nativeZ,
        nx,
        ny,
      );
      pending = fetch(url)
        .then((r) => (r.ok ? (r.json() as Promise<FeatureCollection>) : null))
        .catch((): null => null)
        .then((fc) => this.fallbackIfEmpty(fc, nativeZ, nx, ny));
      this.nativeTileCache.set(key, pending);
    }

    pending.then((fc) => {
      if (fc && fc.features.length > 0) this.paintTile(tile, fc, coords);
      done(undefined, tile);
    });

    return tile;
  }

  private fallbackIfEmpty(
    fc: FeatureCollection | null,
    z: number,
    x: number,
    y: number,
  ): Promise<FeatureCollection | null> {
    if (fc && fc.features.length > 0) return Promise.resolve(fc);
    const idx = (BARB_NATIVE_ZOOMS as readonly number[]).indexOf(z);
    if (idx <= 0) return Promise.resolve(null);
    const lz = BARB_NATIVE_ZOOMS[idx - 1];
    const lx = x >> (z - lz);
    const ly = y >> (z - lz);
    const lkey = `${lz}/${lx}/${ly}`;
    let lp = this.nativeTileCache.get(lkey);
    if (!lp) {
      const lurl = buildWrfBarbTileUrl(
        this.opts.productId,
        this.opts.initTag,
        this.opts.fxxx,
        lz,
        lx,
        ly,
      );
      lp = fetch(lurl)
        .then((r) => (r.ok ? (r.json() as Promise<FeatureCollection>) : null))
        .catch((): null => null);
      this.nativeTileCache.set(lkey, lp);
    }
    return lp;
  }

  private paintTile(
    tile: HTMLElement,
    fc: FeatureCollection,
    coords: L.Coords,
  ): void {
    // Scale glyphs with zoom so barbs maintain visual prominence at high zoom.
    // At z=4 scale=1 (16px staff), at z=14 scale=2.5 (40px staff).
    const scale = 1 + Math.max(0, coords.z - 4) * 0.15;
    const parts: string[] = [];
    for (const feature of fc.features as Feature<Point>[]) {
      const [lon, lat] = feature.geometry.coordinates;
      const [px, py] = lonLatToTilePixel(lon, lat, coords.z, coords.x, coords.y);
      // Filter: render only if feature center falls inside this tile's pixel
      // bounds. Sibling tiles cover other quarters of the same native tile, so
      // each glyph is drawn exactly once.
      if (px < 0 || px >= TILE_SIZE || py < 0 || py >= TILE_SIZE) continue;
      const props = feature.properties as { speed_kt: number; dir_deg: number };
      parts.push(renderBarbGlyphMarkup(props.speed_kt, props.dir_deg, px, py, scale));
    }
    tile.innerHTML = `<svg width="${TILE_SIZE}" height="${TILE_SIZE}" style="overflow:visible;position:absolute;left:0;top:0">${parts.join('')}</svg>`;
  }
}
