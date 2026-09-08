/**
 * The capture manifest: every screenshot and clip the user manual embeds.
 *
 * One entry per file under docs/imgs/manual/<NN>-<slug>.png or
 * docs/videos/<NN>-<slug>.webm, NN being the manual chapter. This is the only
 * file that changes when a shot is added or moved. Everything a shot needs is
 * declared here: the route, the localStorage state to seed before first paint,
 * the steps to drive, what to wait for, and which selectors to annotate.
 *
 * Seeded keys mirror src/app/constants/storage-keys.constants.ts; the shapes
 * mirror what each service persists. Layer ids are the ones from
 * src/app/config/layers. A shot that cannot be captured declares `blocked`
 * with the reason instead of shipping a stale image.
 */

export type Step =
  | { do: 'click'; target: string; steps?: number; pauseMs?: number }
  | { do: 'dblclick'; target: string; steps?: number; pauseMs?: number }
  | { do: 'clickAt'; x: number; y: number; steps?: number; pauseMs?: number }
  | { do: 'dblclickAt'; x: number; y: number; steps?: number; pauseMs?: number }
  | { do: 'rightClick'; target: string; steps?: number; pauseMs?: number }
  | { do: 'rightClickAt'; x: number; y: number; steps?: number; pauseMs?: number }
  | { do: 'hover'; target: string; steps?: number; pauseMs?: number }
  | { do: 'moveTo'; x: number; y: number; steps?: number; pauseMs?: number }
  | { do: 'drag'; target: string; dx: number; dy: number; steps?: number; pauseMs?: number }
  | { do: 'type'; target: string; text: string; steps?: number; pauseMs?: number }
  | { do: 'press'; key: string; pauseMs?: number }
  | { do: 'wait'; ms: number }
  | { do: 'waitFor'; target: string; timeoutMs?: number; pauseMs?: number }
  | { do: 'waitTiles' }
  | { do: 'scrollIntoView'; target: string; pauseMs?: number }
  | { do: 'evaluate'; script: string; pauseMs?: number };

export interface Shot {
  id: string;
  kind: 'shot' | 'clip';
  output: string;
  viewport: { width: number; height: number };
  route: string;
  /** localStorage values keyed by the bare name (`active-layers`, not the versioned key). */
  seed: Record<string, unknown>;
  steps?: Step[];
  /** A selector that must be visible before the capture. */
  waitFor?: string;
  /** Wait for every Leaflet tile to finish loading (default true). */
  waitTiles?: boolean;
  settleMs?: number;
  /** Selectors to outline with a numbered badge, in order. */
  annotate?: string[];
  /** Crop the screenshot to this selector instead of the viewport. */
  clip?: string;
  /** Draw the fake cursor in a screenshot too (clips always do). */
  cursor?: boolean;
  /** Extra milliseconds recorded after the last step of a clip. */
  tailMs?: number;
  /** Only run when ALERTS_SERVICE_BASE_URL points at a local service: the shot writes an alert. */
  requiresLocalAlerts?: boolean;
  /** Why this shot cannot be captured today. Listed in the final report; never faked. */
  blocked?: string;
}

// ── Layer ids and seed fragments ─────────────────────────────────────────────

const CH13 = 'goes-19/abi/ch-13';
const GLM_FED = 'goes-19/glm/glm-fed';
const ECMWF_TP = 'ecmwf/total-precipitation';
const GFS_MSLP = 'gfs/mslp';
const PROVINCIA = 'ign-provincia';
const DEPARTAMENTOS = 'ign-limite-interdepartamental-o-de-partido';

const wms = (id: string, zIndex: number) => ({ id, visible: true, opacity: 1, zIndex, type: 'wms' });
const goes = (id: string, zIndex: number, imageCount = 12, opacity = 1) => ({
  id, visible: true, opacity, zIndex, type: 'tile', category: 'goes_19',
  availablePeriods: [6, 12, 24],
  playback: { isPlaying: false, speed: 1, imageCount },
});
const ecmwf = (zIndex: number) => ({
  id: ECMWF_TP, visible: true, opacity: 0.85, zIndex, type: 'tile', category: 'ecmwf_tp',
  availablePeriods: [8, 16, 32, 48],
  playback: { isPlaying: false, timeIndex: 0, speed: 1, imageCount: 16 },
  forecast: {
    selectedForecastIndices: [0],
    forecastOpacityByIndex: {},
    secondaryRenderControlsByIndex: { '0': { selectedRenderIds: ['primary', 'ecmwf-mslp-isobars'], renderOpacity: {} } },
  },
});

/** State every shot starts from: defaults as shipped, plus a placeholder station key so the prompt never opens. */
const BASE: Record<string, unknown> = {
  'base-map': 'argenmap',
  'active-layers': [wms(PROVINCIA, 1)],
  'map-tools': { showCoordinates: false, showAttribution: true, showScale: false, showZoom: true, showCursorLines: false, showGraticule: false },
  'units-settings': { temperatureUnit: '°C', windSpeedUnit: 'kt', decimalPrecision: 2 },
  'timezone-settings': { mode: 'hoa' },
  'weather-stations-api-key': { key: 'docs-capture-placeholder' },
  'polygon-detail-level': '3',
  // Emitted alerts drawn by the local alerts-service would otherwise leak into
  // every shot; chapter 6 turns them back on where it needs them.
  'alerts-visibility': { active: false, pending: false },
};
const seed = (extra: Record<string, unknown> = {}) => ({ ...BASE, ...extra });

/** A draft polygon over the north of Río Negro, visible at the default zoom. */
const DRAFT = {
  id: 'polygon_1757200000000_docs001',
  name: '',
  draftNumber: 1,
  coordinates: [[-39.3, -66.4], [-39.3, -64.2], [-40.4, -64.2], [-40.4, -66.4]],
  visible: true,
  createdAt: '2026-09-08T12:00:00.000Z',
  updatedAt: '2026-09-08T12:00:00.000Z',
};

const SHOT = { width: 1440, height: 900 };
const CLIP = { width: 1280, height: 800 };
const PANEL = '[data-testid="menu-panel"]';
const MAP_CENTER_CLICK = { x: 900, y: 450 };

const openPanel = (id: string): Step[] => [
  { do: 'click', target: `[data-testid="sidebar-panel-${id}"]`, pauseMs: 500 },
  // Park the cursor on the panel title: the sidebar tooltip would otherwise stay
  // open over the panel and intercept the next click.
  { do: 'hover', target: '[data-testid="menu-panel-title"]', steps: 8, pauseMs: 400 },
];
const row = (layerId: string, child = '') => `[data-testid="layers-row-${layerId}"] ${child}`.trim();

// ── The manifest ─────────────────────────────────────────────────────────────

export const SHOTS: Shot[] = [
  // 2. Primeros pasos
  {
    id: '02-ventana', kind: 'shot', output: 'docs/imgs/manual/02-ventana.png', viewport: SHOT, route: '/',
    seed: seed(), annotate: ['mat-card.button-bar', '[data-testid="map-zoom-controls"]', '[data-testid="map-attribution"]'],
  },
  {
    id: '02-panel-capas', kind: 'shot', output: 'docs/imgs/manual/02-panel-capas.png', viewport: SHOT, route: '/',
    seed: seed(), steps: [...openPanel('layers')], waitFor: PANEL,
    annotate: ['[data-testid="menu-panel-title"]', '[data-testid="layers-tab-available"]', '[data-testid="menu-close"]'],
  },
  {
    id: '02-configuracion', kind: 'shot', output: 'docs/imgs/manual/02-configuracion.png', viewport: SHOT, route: '/',
    seed: seed(), steps: [...openPanel('settings')], waitFor: '[data-testid="settings-timezone-group"]', clip: PANEL,
    annotate: ['[data-testid="settings-temperature-group"]', '[data-testid="settings-wind-group"]', '[data-testid="settings-timezone-group"]', '[data-testid="settings-decimal-precision"]'],
  },
  {
    id: '02-mapa-base', kind: 'shot', output: 'docs/imgs/manual/02-mapa-base.png', viewport: SHOT, route: '/',
    seed: seed(), steps: [...openPanel('explore'), { do: 'click', target: '[data-testid="explorer-tab-basemap"]', pauseMs: 900 }],
    waitFor: '[data-testid="explorer-basemap-grid"]', clip: PANEL,
  },
  {
    id: '02-indicadores', kind: 'shot', output: 'docs/imgs/manual/02-indicadores.png', viewport: SHOT, route: '/',
    seed: seed({ 'map-tools': { showCoordinates: true, showAttribution: true, showScale: true, showZoom: true, showCursorLines: false, showGraticule: true } }),
    steps: [...openPanel('map-tools'), { do: 'moveTo', x: 900, y: 500, steps: 10, pauseMs: 400 }],
    waitFor: '[data-testid="tools-toggle-zoom"]',
    annotate: ['[data-testid="map-scale"]', '[data-testid="map-coordinates"]', '[data-testid="map-attribution"]', '[data-testid="tools-toggle-zoom"]'],
  },
  {
    id: '02-cambiar-mapa-base', kind: 'clip', output: 'docs/videos/02-cambiar-mapa-base.webm', viewport: CLIP, route: '/',
    seed: seed(),
    steps: [
      ...openPanel('explore'),
      { do: 'click', target: '[data-testid="explorer-tab-basemap"]', pauseMs: 900 },
      { do: 'click', target: '[data-testid="explorer-basemap-argenmapOscuro"]', pauseMs: 400 },
      { do: 'waitTiles' },
      { do: 'wait', ms: 1200 },
      { do: 'click', target: '[data-testid="explorer-basemap-satellite"]', pauseMs: 400 },
      { do: 'waitTiles' },
    ],
    tailMs: 1500,
  },

  // 3. Trabajar con capas
  {
    id: '03-disponibles', kind: 'shot', output: 'docs/imgs/manual/03-disponibles.png', viewport: SHOT, route: '/',
    seed: seed({ 'active-layers': [wms(PROVINCIA, 1), goes(CH13, 2)] }),
    steps: [...openPanel('layers')], waitFor: '[data-testid="layers-group-goes-19"]', clip: PANEL,
    annotate: ['[data-testid="layers-search-input"]', '[data-testid="layers-group-goes-19"]'],
  },
  {
    id: '03-activas', kind: 'shot', output: 'docs/imgs/manual/03-activas.png', viewport: SHOT, route: '/',
    seed: seed({ 'active-layers': [wms(PROVINCIA, 1), wms(DEPARTAMENTOS, 2), goes(CH13, 1), ecmwf(2)] }),
    steps: [...openPanel('layers'), { do: 'click', target: '[data-testid="layers-tab-active"]', pauseMs: 900 }],
    waitFor: '[data-testid="layers-active-droplist"]',
    annotate: ['[data-testid="layers-active-group-overlay"]', '[data-testid="layers-active-group-base"]', `${row(CH13, '[data-testid="layers-row-expand"]')}`],
  },
  {
    id: '03-capa-expandida', kind: 'shot', output: 'docs/imgs/manual/03-capa-expandida.png', viewport: SHOT, route: '/',
    seed: seed({ 'active-layers': [wms(PROVINCIA, 1), goes(CH13, 1)] }),
    steps: [
      ...openPanel('layers'),
      { do: 'click', target: '[data-testid="layers-tab-active"]', pauseMs: 900 },
      { do: 'click', target: row(CH13, '[data-testid="layers-row-expand"]'), pauseMs: 900 },
    ],
    waitFor: row(CH13, '[data-testid="layers-time-play"]'), clip: PANEL,
    annotate: [row(CH13, '[data-testid="layers-opacity-slider"]'), row(CH13, '[data-testid="layers-row-scale-toggle"]'), row(CH13, '[data-testid="layers-row-close"]')],
  },
  {
    id: '03-opacidad', kind: 'clip', output: 'docs/videos/03-opacidad.webm', viewport: CLIP, route: '/',
    seed: seed({ 'active-layers': [wms(PROVINCIA, 1), goes(CH13, 1)] }),
    steps: [
      ...openPanel('layers'),
      { do: 'click', target: '[data-testid="layers-tab-active"]', pauseMs: 900 },
      { do: 'click', target: row(CH13, '[data-testid="layers-row-expand"]'), pauseMs: 900 },
      { do: 'drag', target: row(CH13, '[data-testid="layers-opacity-slider"] input'), dx: -120, dy: 0, steps: 40, pauseMs: 800 },
      { do: 'drag', target: row(CH13, '[data-testid="layers-opacity-slider"] input'), dx: 90, dy: 0, steps: 40, pauseMs: 800 },
    ],
    tailMs: 1200,
  },
  {
    id: '03-referencia', kind: 'shot', output: 'docs/imgs/manual/03-referencia.png', viewport: SHOT, route: '/',
    seed: seed({ 'active-layers': [wms(PROVINCIA, 1), wms(DEPARTAMENTOS, 2), wms('ign-red-vial-nacional', 3)] }),
    steps: [
      ...openPanel('layers'),
      { do: 'click', target: '[data-testid="layers-group-ign-wms"] mat-expansion-panel-header', pauseMs: 900 },
    ],
    waitFor: '[data-testid="layers-subgroup-ign-limits"]',
  },
  {
    id: '03-grupo-toggle', kind: 'clip', output: 'docs/videos/03-grupo-toggle.webm', viewport: CLIP, route: '/',
    seed: seed({ 'active-layers': [wms(PROVINCIA, 1), goes(CH13, 1), goes(GLM_FED, 2, 12, 0.9)] }),
    steps: [
      ...openPanel('layers'),
      { do: 'click', target: '[data-testid="layers-tab-active"]', pauseMs: 900 },
      { do: 'click', target: '[data-testid="layers-active-group-base"] [data-testid="layers-active-group-clear"]', pauseMs: 1200 },
      { do: 'waitTiles' },
      { do: 'click', target: '[data-testid="layers-tab-available"]', pauseMs: 900 },
      { do: 'click', target: '[data-testid="layers-group-goes-19"] mat-expansion-panel-header', pauseMs: 900 },
      { do: 'click', target: '[data-testid="layers-subgroup-abi"] mat-expansion-panel-header', pauseMs: 900 },
      { do: 'click', target: row(CH13, '[data-testid="layers-row-checkbox"]'), pauseMs: 1200 },
      { do: 'waitTiles' },
    ],
    tailMs: 1200,
  },

  // 4. Productos
  {
    id: '04-1-satelite', kind: 'shot', output: 'docs/imgs/manual/04-1-satelite.png', viewport: SHOT, route: '/',
    seed: seed({ 'active-layers': [wms(PROVINCIA, 1), goes(CH13, 1)] }),
    steps: [
      ...openPanel('layers'),
      { do: 'click', target: '[data-testid="layers-group-goes-19"] mat-expansion-panel-header', pauseMs: 900 },
      { do: 'click', target: '[data-testid="layers-subgroup-abi"] mat-expansion-panel-header', pauseMs: 900 },
    ],
    waitFor: row(CH13, '[data-testid="layers-row-checkbox"]'),
  },
  {
    id: '04-1-glm', kind: 'shot', output: 'docs/imgs/manual/04-1-glm.png', viewport: SHOT, route: '/',
    seed: seed({ 'active-layers': [wms(PROVINCIA, 1), goes(CH13, 1), goes(GLM_FED, 2, 12, 0.9)] }),
    steps: [...openPanel('layers'), { do: 'click', target: '[data-testid="layers-tab-active"]', pauseMs: 900 }],
    waitFor: '[data-testid="layers-active-droplist"]',
  },
  {
    id: '04-2-radar-catalogo', kind: 'shot', output: 'docs/imgs/manual/04-2-radar-catalogo.png', viewport: SHOT, route: '/',
    seed: seed(),
    steps: [
      ...openPanel('layers'),
      { do: 'scrollIntoView', target: '[data-testid="layers-group-radar"]', pauseMs: 400 },
      { do: 'click', target: '[data-testid="layers-group-radar"] mat-expansion-panel-header', pauseMs: 900 },
      { do: 'click', target: '[data-testid="layers-subgroup-rma1"] mat-expansion-panel-header', pauseMs: 900 },
    ],
    waitFor: '[data-testid="layers-row-radar/RMA1/DBZH"]', clip: PANEL,
  },
  {
    id: '04-2-radar-mapa', kind: 'shot', output: 'docs/imgs/manual/04-2-radar-mapa.png', viewport: SHOT, route: '/',
    seed: seed(), blocked: 'Ningún backend alcanzable publica teselas de radar hoy: producción y el stack local listan RMA1..RMA18 con tilesets vacíos (los crudos SINARAME sólo llegan por el replicador y ese producto está apagado en settings.json).',
  },
  {
    id: '04-3-modelos', kind: 'shot', output: 'docs/imgs/manual/04-3-modelos.png', viewport: SHOT, route: '/',
    seed: seed({ 'active-layers': [wms(PROVINCIA, 1), ecmwf(1)] }),
    steps: [
      ...openPanel('layers'),
      { do: 'click', target: '[data-testid="layers-tab-active"]', pauseMs: 900 },
      { do: 'click', target: row(ECMWF_TP, '[data-testid="layers-row-expand"]'), pauseMs: 1200 },
    ],
    waitFor: row(ECMWF_TP, '[data-testid="layers-time-play"]'),
  },
  {
    id: '04-3-gfs', kind: 'shot', output: 'docs/imgs/manual/04-3-gfs.png', viewport: SHOT, route: '/',
    seed: seed({ 'active-layers': [wms(PROVINCIA, 1), {
      id: GFS_MSLP, visible: true, opacity: 1, zIndex: 1, type: 'tile', category: 'wrf',
      availablePeriods: [8, 17, 25, 33], playback: { isPlaying: false, timeIndex: 0, speed: 1, imageCount: 8 },
      forecast: { selectedForecastTimestamps: [], forecastOpacity: {}, renderControls: {} },
    }] }),
    steps: [...openPanel('layers'), { do: 'click', target: '[data-testid="layers-tab-active"]', pauseMs: 900 }],
    waitFor: '[data-testid="layers-active-droplist"]', settleMs: 2500,
  },
  {
    id: '04-3-wrf', kind: 'shot', output: 'docs/imgs/manual/04-3-wrf.png', viewport: SHOT, route: '/',
    seed: seed(), blocked: 'Ningún backend alcanzable publica corridas de WRF hoy: producción y el stack local responden init_runs vacío para todos los productos.',
  },
  {
    id: '04-4-estaciones', kind: 'shot', output: 'docs/imgs/manual/04-4-estaciones.png', viewport: SHOT, route: '/',
    seed: seed(), blocked: 'Las capas de estaciones exigen una clave real de la API del SMN (cabecera X-API-Key); no hay credencial disponible para la captura.',
  },
  {
    id: '04-4-clave', kind: 'shot', output: 'docs/imgs/manual/04-4-clave.png', viewport: SHOT, route: '/',
    seed: seed(),
    steps: [...openPanel('settings'), { do: 'click', target: '[data-testid="settings-tab-smn"]', pauseMs: 900 }, { do: 'click', target: '[data-testid="settings-api-key-set"]', pauseMs: 900 }],
    waitFor: 'mat-dialog-container', waitTiles: false,
  },

  // 5. Animación y consulta puntual
  {
    id: '05-periodo', kind: 'shot', output: 'docs/imgs/manual/05-periodo.png', viewport: SHOT, route: '/',
    seed: seed({ 'active-layers': [wms(PROVINCIA, 1), goes(CH13, 1, 24)] }),
    steps: [
      ...openPanel('layers'),
      { do: 'click', target: '[data-testid="layers-tab-active"]', pauseMs: 900 },
      { do: 'click', target: row(CH13, '[data-testid="layers-row-expand"]'), pauseMs: 1200 },
    ],
    waitFor: row(CH13, '[data-testid="layers-time-play"]'), clip: PANEL,
    annotate: [row(CH13, '[data-testid="layers-image-count-select"]'), row(CH13, '[data-testid="layers-speed-input"]'), row(CH13, '[data-testid="layers-time-current"]'), row(CH13, '[data-testid="layers-time-play"]'), row(CH13, '[data-testid="layers-time-latest"]'), row(CH13, '[data-testid="layers-time-slider"]')],
  },
  {
    id: '05-animacion', kind: 'clip', output: 'docs/videos/05-animacion.webm', viewport: CLIP, route: '/',
    seed: seed({ 'active-layers': [wms(PROVINCIA, 1), goes(CH13, 1, 12)] }),
    steps: [
      ...openPanel('layers'),
      { do: 'click', target: '[data-testid="layers-tab-active"]', pauseMs: 900 },
      { do: 'click', target: row(CH13, '[data-testid="layers-row-expand"]'), pauseMs: 1200 },
      { do: 'click', target: row(CH13, '[data-testid="layers-time-play"]'), pauseMs: 7000 },
      { do: 'click', target: row(CH13, '[data-testid="layers-time-play"]'), pauseMs: 600 },
    ],
    tailMs: 800,
  },
  {
    id: '05-sincronizacion', kind: 'shot', output: 'docs/imgs/manual/05-sincronizacion.png', viewport: SHOT, route: '/',
    seed: seed({ 'active-layers': [wms(PROVINCIA, 1), goes(CH13, 1, 12), goes(GLM_FED, 2, 12, 0.9)] }),
    steps: [
      ...openPanel('layers'),
      { do: 'click', target: '[data-testid="layers-tab-sync"]', pauseMs: 900 },
      { do: 'click', target: `[data-testid="layers-sync-pick-${CH13}"] mat-checkbox`, pauseMs: 700 },
      { do: 'click', target: `[data-testid="layers-sync-pick-${GLM_FED}"] mat-checkbox`, pauseMs: 1500 },
    ],
    waitFor: '[data-testid="layers-tab-sync"]', clip: PANEL,
  },
  {
    id: '05-consulta', kind: 'shot', output: 'docs/imgs/manual/05-consulta.png', viewport: SHOT, route: '/',
    seed: seed({
      'active-layers': [wms(PROVINCIA, 1), goes(CH13, 1)],
      'point-query-viewer': { enabled: true, selectedLayerIdsOrdered: [CH13], manuallyDeselectedLayerIds: [], showMarker: true, panelMode: 'fixed' },
    }),
    steps: [
      ...openPanel('map-tools'),
      { do: 'click', target: '[data-testid="tools-tab-point"]', pauseMs: 900 },
      { do: 'clickAt', x: 960, y: 420, pauseMs: 1500 },
      { do: 'waitFor', target: '[data-testid="map-point-value-panel"]', timeoutMs: 30000 },
    ],
    waitFor: '[data-testid="map-point-value-panel"]', cursor: true,
    annotate: ['[data-testid="tools-point-enable"]', '[data-testid="map-point-value-panel"]'],
  },
  {
    id: '05-consulta-clip', kind: 'clip', output: 'docs/videos/05-consulta.webm', viewport: CLIP, route: '/',
    seed: seed({
      'active-layers': [wms(PROVINCIA, 1), goes(CH13, 1)],
      'point-query-viewer': { enabled: false, selectedLayerIdsOrdered: [CH13], manuallyDeselectedLayerIds: [], showMarker: true, panelMode: 'fixed' },
    }),
    steps: [
      ...openPanel('map-tools'),
      { do: 'click', target: '[data-testid="tools-tab-point"]', pauseMs: 900 },
      { do: 'click', target: '[data-testid="tools-point-enable"]', pauseMs: 900 },
      { do: 'clickAt', x: 860, y: 400, pauseMs: 2500 },
      { do: 'clickAt', x: 920, y: 470, pauseMs: 2500 },
    ],
    tailMs: 1200,
  },

  // 6. Avisos
  {
    id: '06-panel-avisos', kind: 'shot', output: 'docs/imgs/manual/06-panel-avisos.png', viewport: SHOT, route: '/',
    seed: seed({ polygons: [DRAFT], 'polygon-next-draft-number': '2' }),
    steps: [...openPanel('alerts')], waitFor: `[data-testid="alerts-draft-${DRAFT.id}"]`,
    annotate: ['[data-testid="alerts-draw-toggle"]', '[data-testid="alerts-detail-level-slider"]', `[data-testid="alerts-draft-${DRAFT.id}"] > *`, `[data-testid="alerts-draft-${DRAFT.id}"] [data-testid="alerts-generate"]`],
  },
  {
    id: '06-dibujar', kind: 'clip', output: 'docs/videos/06-dibujar.webm', viewport: CLIP, route: '/',
    seed: seed(),
    steps: [
      ...openPanel('alerts'),
      { do: 'click', target: '[data-testid="alerts-draw-toggle"]', pauseMs: 800 },
      { do: 'clickAt', x: 700, y: 330, steps: 30, pauseMs: 700 },
      { do: 'clickAt', x: 860, y: 320, steps: 30, pauseMs: 700 },
      { do: 'clickAt', x: 880, y: 440, steps: 30, pauseMs: 700 },
      { do: 'dblclickAt', x: 720, y: 460, steps: 30, pauseMs: 1500 },
      { do: 'waitFor', target: '[data-testid^="alerts-draft-"]', timeoutMs: 15000 },
    ],
    tailMs: 1500,
  },
  {
    id: '06-departamentos', kind: 'shot', output: 'docs/imgs/manual/06-departamentos.png', viewport: SHOT, route: '/',
    seed: seed({ polygons: [DRAFT], 'polygon-next-draft-number': '2' }),
    steps: [
      ...openPanel('alerts'),
      { do: 'click', target: `[data-testid="alerts-draft-${DRAFT.id}"] [data-testid="alerts-departments-search"] button`, pauseMs: 800 },
      { do: 'waitFor', target: `[data-testid="alerts-draft-${DRAFT.id}"] [data-testid="alerts-departments-toggle"] button`, timeoutMs: 60000 },
      { do: 'click', target: `[data-testid="alerts-draft-${DRAFT.id}"] [data-testid="alerts-departments-toggle"] button`, pauseMs: 900 },
    ],
    waitFor: '[data-testid="alerts-department-province"]',
  },
  {
    id: '06-generar-dialogo', kind: 'shot', output: 'docs/imgs/manual/06-generar-dialogo.png', viewport: SHOT, route: '/',
    seed: seed({ polygons: [DRAFT], 'polygon-next-draft-number': '2' }),
    steps: [
      ...openPanel('alerts'),
      { do: 'click', target: `[data-testid="alerts-draft-${DRAFT.id}"] [data-testid="alerts-generate"]`, pauseMs: 1500 },
      { do: 'waitFor', target: '[data-testid="dialog-phenomenon-select"]', timeoutMs: 30000 },
      { do: 'click', target: '[data-testid="dialog-phenomenon-select"]', pauseMs: 900 },
    ],
    waitFor: 'mat-option', waitTiles: false,
  },
  {
    id: '06-generar', kind: 'clip', output: 'docs/videos/06-generar.webm', viewport: CLIP, route: '/',
    seed: seed({ 'alerts-visibility': { active: true, pending: true }, polygons: [DRAFT], 'polygon-next-draft-number': '2' }),
    requiresLocalAlerts: true,
    steps: [
      ...openPanel('alerts'),
      { do: 'click', target: `[data-testid="alerts-draft-${DRAFT.id}"] [data-testid="alerts-generate"]`, pauseMs: 1500 },
      { do: 'waitFor', target: '[data-testid="dialog-phenomenon-select"]', timeoutMs: 30000 },
      { do: 'click', target: '[data-testid="dialog-phenomenon-select"]', pauseMs: 900 },
      { do: 'click', target: 'mat-option >> nth=1', pauseMs: 700 },
      { do: 'click', target: '[data-testid="dialog-phenomenon-confirm"]', pauseMs: 1000 },
      { do: 'waitFor', target: '[data-testid^="alerts-pending-"]', timeoutMs: 180000 },
      { do: 'wait', ms: 1500 },
    ],
    tailMs: 1500,
  },
  {
    id: '06-emitidos', kind: 'shot', output: 'docs/imgs/manual/06-emitidos.png', viewport: SHOT, route: '/',
    seed: seed({ 'alerts-visibility': { active: true, pending: true } }),
    steps: [...openPanel('alerts'), { do: 'click', target: '[data-testid="alerts-tab-emitted"]', pauseMs: 2500 }],
    waitFor: '[data-testid="alerts-emitted"]', clip: PANEL,
  },

  // 7. Panel de estado
  { id: '07-procesamiento', kind: 'shot', output: 'docs/imgs/manual/07-procesamiento.png', viewport: SHOT, route: '/status/processing', seed: seed(), waitFor: 'section.panel', waitTiles: false, settleMs: 2500 },
  { id: '07-cache', kind: 'shot', output: 'docs/imgs/manual/07-cache.png', viewport: SHOT, route: '/status/cache', seed: seed(), waitFor: 'section.panel', waitTiles: false, settleMs: 2500 },
  { id: '07-mapas-base', kind: 'shot', output: 'docs/imgs/manual/07-mapas-base.png', viewport: SHOT, route: '/status/basemap', seed: seed(), waitFor: 'section.panel', waitTiles: false, settleMs: 2500 },
  { id: '07-alertas', kind: 'shot', output: 'docs/imgs/manual/07-alertas.png', viewport: SHOT, route: '/status/alerts', seed: seed(), waitFor: 'section.panel', waitTiles: false, settleMs: 2500 },
];
