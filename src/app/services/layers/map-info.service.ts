import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  Control,
  DomEvent,
  GeoJSON as GeoJsonLayer,
  LatLngExpression,
  LayerGroup,
  LeafletMouseEvent,
  Map as LeafletMap,
  Marker,
  PathOptions,
  Polyline,
  PolylineOptions,
  divIcon,
  geoJSON,
  layerGroup,
  marker,
  polyline,
} from 'leaflet';
import type { Geometry } from 'geojson';
import { MAP_CONFIG } from '../../config';
import { STORAGE_KEYS } from '../../constants';

interface MapToolsState {
  showCoordinates: boolean;
  showAttribution: boolean;
  showScale: boolean;
  showZoom: boolean;
  showCursorLines: boolean;
  showGraticule: boolean;
}

/** Scale bar configuration */
interface ScaleInfo {
  text: string;
  width: number;
}

/** Important geographic lines for the graticule */
const GRATICULE_LATITUDES = [
  { lat: 66.5, label: 'Círculo Polar Ártico' },
  { lat: 23.5, label: 'Trópico de Cáncer' },
  { lat: 0, label: 'Ecuador' },
  { lat: -23.5, label: 'Trópico de Capricornio' },
  { lat: -66.5, label: 'Círculo Polar Antártico' },
];

const GRATICULE_LONGITUDES = [
  { lng: -180, label: '180° W' },
  { lng: -150, label: '150° W' },
  { lng: -120, label: '120° W' },
  { lng: -90, label: '90° W' },
  { lng: -60, label: '60° W' },
  { lng: -30, label: '30° W' },
  { lng: 0, label: 'Meridiano de Greenwich' },
  { lng: 30, label: '30° E' },
  { lng: 60, label: '60° E' },
  { lng: 90, label: '90° E' },
  { lng: 120, label: '120° E' },
  { lng: 150, label: '150° E' },
];

// Use theme-aligned colors (primary: #0090d0, secondary: #fcbf49, tertiary: #242c4f)
const CROSSHAIR_STYLE: PolylineOptions = {
  color: '#0090d0', // primary
  weight: 1,
  opacity: 0.6,
  dashArray: '4, 4',
  interactive: false,
};

const GRATICULE_STYLE: PolylineOptions = {
  color: '#73777c', // neutral-50
  weight: 1,
  opacity: 0.4,
  dashArray: '2, 4',
  interactive: false,
};

const GRATICULE_SPECIAL_STYLE: PolylineOptions = {
  color: '#555c82', // tertiary-40
  weight: 1,
  opacity: 0.5,
  interactive: false,
};

const QUERY_MARKER_ICON = divIcon({
  className: 'query-marker',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  html: `<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-100%" y="-100%" width="300%" height="300%">
        <feDropShadow dx="0" dy="0" stdDeviation="1" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
    </defs>
    <g filter="url(#shadow)">
      <line x1="10" y1="0" x2="10" y2="6" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="10" y1="14" x2="10" y2="20" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="0" y1="10" x2="6" y2="10" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="14" y1="10" x2="20" y2="10" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="10" cy="10" r="2" fill="none" stroke="white" stroke-width="2"/>
    </g>
  </svg>`,
});

/** A flat, centered badge — matches the circular language of the weather-station markers. */
const SEARCH_MARKER_ICON = divIcon({
  className: 'search-result-marker',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  html: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="search-marker-shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.35"/>
      </filter>
    </defs>
    <g filter="url(#search-marker-shadow)">
      <circle cx="16" cy="16" r="11" fill="var(--mat-sys-primary)" stroke="white" stroke-width="3"/>
      <circle cx="16" cy="16" r="3.5" fill="white" />
    </g>
  </svg>`,
});

/** Themed like `SEARCH_MARKER_ICON`, so every "search result" cue stays visually consistent. */
const SEARCH_RESULT_POLYGON_STYLE: PathOptions = {
  color: 'var(--mat-sys-primary)',
  weight: 2,
  fillColor: 'var(--mat-sys-primary)',
  fillOpacity: 0.12,
};

/** Caps how far a polygon fly-to zooms in, so small boundaries don't feel jarring. */
const SEARCH_POLYGON_FIT_MAX_ZOOM = 12;

type SearchResult =
  | { readonly kind: 'marker'; readonly lat: number; readonly lon: number; readonly label: string }
  | {
      readonly kind: 'polygon';
      readonly geometry: Geometry;
      readonly label: string;
      readonly animate: boolean;
    };

@Injectable({
  providedIn: 'root',
})
export class MapInfoService {
  private map: LeafletMap | null = null;

  // Zoom state
  readonly currentZoom = signal<number>(MAP_CONFIG.initialZoom);
  readonly canZoomIn = computed(() => this.currentZoom() < MAP_CONFIG.maxZoom);
  readonly canZoomOut = computed(() => this.currentZoom() > MAP_CONFIG.minZoom);

  // Mouse coordinates state
  readonly mouseLatitude = signal<number | null>(null);
  readonly mouseLongitude = signal<number | null>(null);

  // Map center for scale calculation
  private readonly mapCenterLat = signal<number>(MAP_CONFIG.initialCenter.lat);

  // Scale bar state (computed from zoom and center latitude)
  readonly scaleInfo = computed<ScaleInfo>(() => this.calculateScale());

  // Tool visibility states
  readonly showCoordinates = signal<boolean>(MAP_CONFIG.defaultShowCoordinates);
  readonly showAttribution = signal<boolean>(MAP_CONFIG.defaultShowAttribution);
  readonly showScale = signal<boolean>(MAP_CONFIG.defaultShowScale);
  readonly showZoom = signal<boolean>(MAP_CONFIG.defaultShowZoom);

  // Crosshair lines that follow the cursor
  readonly showCursorLines = signal<boolean>(false);

  // Graticule (major parallels and meridians)
  readonly showGraticule = signal<boolean>(false);

  // Query marker position (set by PointQueryViewerService)
  readonly queryMarkerPosition = signal<{ lat: number; lon: number } | null>(null);
  readonly queryMarkerScreenPosition = signal<{ x: number; y: number } | null>(null);
  readonly isZooming = signal<boolean>(false);

  readonly searchResult = signal<SearchResult | null>(null);
  readonly searchResultContextMenu = signal<{ x: number; y: number } | null>(null);

  // Overlay layers (managed internally)
  private latitudeLine: Polyline | null = null;
  private longitudeLine: Polyline | null = null;
  private graticuleGroup: LayerGroup | null = null;
  private queryMarker: Marker | null = null;
  private searchMarker: Marker | null = null;
  private searchPolygon: GeoJsonLayer | null = null;

  // Event handlers
  private mouseMoveHandler: ((e: LeafletMouseEvent) => void) | null = null;
  private mouseOutHandler: (() => void) | null = null;
  private zoomStartHandler: (() => void) | null = null;
  private zoomEndHandler: (() => void) | null = null;
  private moveHandler: (() => void) | null = null;

  constructor() {
    this.loadPersistedState();
    this.setupOverlayEffects();
  }

  private setupOverlayEffects(): void {
    // Effect: update crosshair lines when mouse moves or visibility changes
    effect(() => {
      const lat = this.mouseLatitude();
      const lng = this.mouseLongitude();
      const show = this.showCursorLines();
      this.updateCrosshair(lat, lng, show);
    });

    // Effect: update graticule when visibility changes
    effect(() => {
      const show = this.showGraticule();
      this.updateGraticule(show);
    });

    // Effect: update query marker position
    effect(() => {
      const position = this.queryMarkerPosition();
      this.updateQueryMarker(position);
      this.updateQueryMarkerScreenPosition(position);
    });

    // Effect: update place-search result overlay (marker or polygon)
    effect(() => {
      const result = this.searchResult();
      this.updateSearchResult(result);
    });
  }

  private loadPersistedState(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MAP_TOOLS);
      if (stored) {
        const state = JSON.parse(stored) as MapToolsState;
        this.showCoordinates.set(state.showCoordinates ?? MAP_CONFIG.defaultShowCoordinates);
        this.showAttribution.set(state.showAttribution ?? MAP_CONFIG.defaultShowAttribution);
        this.showScale.set(state.showScale ?? MAP_CONFIG.defaultShowScale);
        this.showZoom.set(state.showZoom ?? MAP_CONFIG.defaultShowZoom);
        this.showCursorLines.set(state.showCursorLines ?? false);
        this.showGraticule.set(state.showGraticule ?? false);
      }
    } catch {
      // Ignore parse errors, use defaults
    }
  }

  private persistState(): void {
    try {
      const state: MapToolsState = {
        showCoordinates: this.showCoordinates(),
        showAttribution: this.showAttribution(),
        showScale: this.showScale(),
        showZoom: this.showZoom(),
        showCursorLines: this.showCursorLines(),
        showGraticule: this.showGraticule(),
      };
      localStorage.setItem(STORAGE_KEYS.MAP_TOOLS, JSON.stringify(state));
    } catch {
      // Ignore storage errors
    }
  }

  initialize(map: LeafletMap): void {
    this.map = map;
    this.currentZoom.set(Math.round(map.getZoom()));
    this.mapCenterLat.set(map.getCenter().lat);

    // Setup event listeners for reactive data
    this.setupEventListeners();

    // Apply persisted overlay states now that map is available
    this.applyPersistedOverlays();

    // Re-apply marker and its screen projection if the query state existed before map init.
    const queryPosition = this.queryMarkerPosition();
    this.updateQueryMarker(queryPosition);
    this.updateQueryMarkerScreenPosition(queryPosition);
  }

  /** Apply overlays that were loaded from storage before map was initialized */
  private applyPersistedOverlays(): void {
    // Graticule needs to be initialized if it was persisted as visible
    if (this.showGraticule()) {
      this.updateGraticule(true);
    }
    // Cursor lines will auto-apply when mouse moves over the map
  }

  private setupEventListeners(): void {
    if (!this.map) return;

    // Mouse move for coordinates
    this.mouseMoveHandler = (e: LeafletMouseEvent) => {
      this.mouseLatitude.set(e.latlng.lat);
      this.mouseLongitude.set(e.latlng.lng);
    };

    // Clear coordinates when mouse leaves the map
    this.mouseOutHandler = () => {
      this.mouseLatitude.set(null);
      this.mouseLongitude.set(null);
    };

    // Hide near-marker overlays while zooming and restore at the end.
    this.zoomStartHandler = () => {
      this.isZooming.set(true);
    };

    // Zoom final state update
    this.zoomEndHandler = () => {
      this.isZooming.set(false);

      if (this.map) {
        this.currentZoom.set(Math.round(this.map.getZoom()));
        this.mapCenterLat.set(this.map.getCenter().lat);
        this.updateQueryMarkerScreenPosition(this.queryMarkerPosition());
      }
    };

    this.moveHandler = () => {
      if (this.map) {
        this.mapCenterLat.set(this.map.getCenter().lat);
        this.updateQueryMarkerScreenPosition(this.queryMarkerPosition());
      }
    };

    this.map.on('mousemove', this.mouseMoveHandler);
    this.map.on('mouseout', this.mouseOutHandler);
    this.map.on('zoomstart', this.zoomStartHandler);
    this.map.on('zoomend', this.zoomEndHandler);
    this.map.on('move', this.moveHandler);
  }

  private removeEventListeners(): void {
    if (!this.map) return;

    if (this.mouseMoveHandler) {
      this.map.off('mousemove', this.mouseMoveHandler);
      this.mouseMoveHandler = null;
    }
    if (this.mouseOutHandler) {
      this.map.off('mouseout', this.mouseOutHandler);
      this.mouseOutHandler = null;
    }
    if (this.zoomStartHandler) {
      this.map.off('zoomstart', this.zoomStartHandler);
      this.zoomStartHandler = null;
    }
    if (this.zoomEndHandler) {
      this.map.off('zoomend', this.zoomEndHandler);
      this.zoomEndHandler = null;
    }
    if (this.moveHandler) {
      this.map.off('move', this.moveHandler);
      this.moveHandler = null;
    }

    this.isZooming.set(false);
  }

  /**
   * Calculate scale bar text and width based on current zoom and latitude.
   * Uses the same logic as Leaflet's L.Control.Scale.
   */
  private calculateScale(): ScaleInfo {
    const zoom = this.currentZoom();
    const lat = this.mapCenterLat();
    const maxWidth = 150; // max bar width in pixels

    // Earth radius in meters
    const earthRadius = 6378137;

    // Meters per pixel at equator for zoom level 0
    const metersPerPixelAtEquator = (2 * Math.PI * earthRadius) / 256;

    // Adjust for zoom level and latitude (Mercator projection)
    const metersPerPixel =
      (metersPerPixelAtEquator * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);

    // Calculate the distance represented by maxWidth pixels
    const maxMeters = maxWidth * metersPerPixel;

    // Find a "nice" round number for the scale
    const { distance, unit } = this.getRoundDistance(maxMeters);

    // Calculate the actual pixel width for this distance
    const width = distance / metersPerPixel;

    return {
      text: `${distance >= 1000 ? distance / 1000 : distance} ${unit}`,
      width: Math.round(width),
    };
  }

  /**
   * Get a nice round distance value for the scale bar.
   */
  private getRoundDistance(maxMeters: number): { distance: number; unit: string } {
    // Round numbers for scale bar (in meters)
    const roundNumbers = [
      1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000,
      500000, 1000000, 2000000, 3000000, 5000000, 10000000,
    ];

    for (const num of roundNumbers) {
      if (num <= maxMeters) {
        continue;
      }
      // Use the previous round number that fits
      const idx = roundNumbers.indexOf(num);
      const distance = idx > 0 ? roundNumbers[idx - 1] : roundNumbers[0];
      const unit = distance >= 1000 ? 'km' : 'm';
      return { distance, unit };
    }

    // Fallback for very large scales
    return { distance: 5000000, unit: 'km' };
  }

  toggleCoordinates(enabled: boolean): void {
    this.showCoordinates.set(enabled);
    this.persistState();
  }

  toggleAttribution(enabled: boolean): void {
    this.showAttribution.set(enabled);
    this.persistState();
  }

  toggleScale(enabled: boolean): void {
    this.showScale.set(enabled);
    this.persistState();
  }

  toggleZoom(enabled: boolean): void {
    this.showZoom.set(enabled);
    this.persistState();
  }

  toggleCursorLines(enabled: boolean): void {
    this.showCursorLines.set(enabled);
    this.persistState();
  }

  toggleGraticule(enabled: boolean): void {
    this.showGraticule.set(enabled);
    this.persistState();
  }

  setCurrentZoom(zoom: number): void {
    this.currentZoom.set(Math.max(MAP_CONFIG.minZoom, Math.min(MAP_CONFIG.maxZoom, zoom)));
  }

  zoomIn(): void {
    this.setCurrentZoom(this.currentZoom() + 1);
  }

  zoomOut(): void {
    this.setCurrentZoom(this.currentZoom() - 1);
  }

  /**
   * Moves the map to the given coordinates, optionally adjusting zoom.
   * Animation is opt-in: an in-flight `flyTo` gets cancelled (and can silently
   * no-op) when another view change — e.g. a quick double click — interrupts
   * it, which feels broken for a search "go to result" action.
   */
  flyTo(lat: number, lon: number, zoom?: number, animate = false): void {
    if (!this.map) return;

    // Recompute the container size first: right after load (or while a panel's
    // open/close transition is still settling) Leaflet's cached size can be stale,
    // which throws off the very first programmatic move.
    this.map.invalidateSize();

    const targetZoom = zoom ?? Math.max(this.map.getZoom(), MAP_CONFIG.initialZoom);
    if (animate) {
      this.map.flyTo([lat, lon], targetZoom);
    } else {
      this.map.setView([lat, lon], targetZoom, { animate: false });
    }
    this.setCurrentZoom(Math.round(targetZoom));
  }

  destroy(): void {
    this.removeEventListeners();
    this.removeCrosshair();
    this.removeGraticule();
    this.removeQueryMarker();
    this.removeSearchResult();
    this.map = null;
  }

  // ── Overlay Management ─────────────────────────────────────────────────────

  /** Drops a pin marking a point place-search result, replacing any prior marker/polygon. */
  setSearchResultMarker(lat: number, lon: number, label: string): void {
    this.searchResult.set({ kind: 'marker', lat, lon, label });
  }

  /** Outlines an area place-search result, replacing any prior marker/polygon. */
  setSearchResultPolygon(geometry: Geometry, label: string, animate = false): void {
    this.searchResult.set({ kind: 'polygon', geometry, label, animate });
  }

  /** Removes the place-search marker/polygon shown on the map, if any. */
  clearSearchResult(): void {
    this.searchResult.set(null);
  }

  setQueryMarkerPosition(position: { lat: number; lon: number } | null): void {
    this.queryMarkerPosition.set(position);
  }

  private updateCrosshair(lat: number | null, lng: number | null, show: boolean): void {
    if (!this.map) return;

    if (show && lat !== null && lng !== null) {
      // Latitude line (horizontal)
      const latCoords: LatLngExpression[] = [
        [lat, -180],
        [lat, 180],
      ];
      if (this.latitudeLine) {
        this.latitudeLine.setLatLngs(latCoords);
      } else {
        this.latitudeLine = polyline(latCoords, CROSSHAIR_STYLE).addTo(this.map);
      }

      // Longitude line (vertical)
      const lngCoords: LatLngExpression[] = [
        [-90, lng],
        [90, lng],
      ];
      if (this.longitudeLine) {
        this.longitudeLine.setLatLngs(lngCoords);
      } else {
        this.longitudeLine = polyline(lngCoords, CROSSHAIR_STYLE).addTo(this.map);
      }
    } else {
      this.removeCrosshair();
    }
  }

  private removeCrosshair(): void {
    if (this.latitudeLine) {
      this.latitudeLine.remove();
      this.latitudeLine = null;
    }
    if (this.longitudeLine) {
      this.longitudeLine.remove();
      this.longitudeLine = null;
    }
  }

  private updateGraticule(show: boolean): void {
    if (!this.map) return;

    if (show) {
      if (!this.graticuleGroup) {
        this.graticuleGroup = layerGroup().addTo(this.map);
        this.createGraticuleLines();
      }
    } else {
      this.removeGraticule();
    }
  }

  private createGraticuleLines(): void {
    if (!this.graticuleGroup) return;

    // Add latitude lines (parallels)
    for (const { lat, label } of GRATICULE_LATITUDES) {
      const isSpecial = lat === 0; // Ecuador
      const style = isSpecial ? GRATICULE_SPECIAL_STYLE : GRATICULE_STYLE;
      const line = polyline(
        [
          [lat, -180],
          [lat, 180],
        ],
        style,
      );
      line.bindTooltip(label, { permanent: false, direction: 'top' });
      this.graticuleGroup.addLayer(line);
    }

    // Add longitude lines (meridians)
    for (const { lng, label } of GRATICULE_LONGITUDES) {
      const isSpecial = lng === 0; // Greenwich
      const style = isSpecial ? GRATICULE_SPECIAL_STYLE : GRATICULE_STYLE;
      const line = polyline(
        [
          [-90, lng],
          [90, lng],
        ],
        style,
      );
      line.bindTooltip(label, { permanent: false, direction: 'right' });
      this.graticuleGroup.addLayer(line);
    }
  }

  private removeGraticule(): void {
    if (this.graticuleGroup) {
      this.graticuleGroup.clearLayers();
      this.graticuleGroup.remove();
      this.graticuleGroup = null;
    }
  }

  private updateQueryMarker(position: { lat: number; lon: number } | null): void {
    if (!this.map) return;

    if (position) {
      const latLng: LatLngExpression = [position.lat, position.lon];
      if (this.queryMarker) {
        this.queryMarker.setLatLng(latLng);
      } else {
        this.queryMarker = marker(latLng, {
          icon: QUERY_MARKER_ICON,
          interactive: false,
        }).addTo(this.map);
      }
    } else {
      this.removeQueryMarker();
    }
  }

  private updateQueryMarkerScreenPosition(position: { lat: number; lon: number } | null): void {
    if (!this.map || !position) {
      this.queryMarkerScreenPosition.set(null);
      return;
    }

    const point = this.map.latLngToContainerPoint([position.lat, position.lon]);
    this.queryMarkerScreenPosition.set({ x: Math.round(point.x), y: Math.round(point.y) });
  }

  private removeQueryMarker(): void {
    if (this.queryMarker) {
      this.queryMarker.remove();
      this.queryMarker = null;
    }

    this.queryMarkerScreenPosition.set(null);
  }

  private updateSearchResult(result: SearchResult | null): void {
    if (!this.map) return;

    this.removeSearchResult();
    if (!result) return;

    if (result.kind === 'marker') {
      this.showSearchMarker(result.lat, result.lon, result.label);
    } else {
      this.showSearchPolygon(result.geometry, result.label, result.animate);
    }
  }

  private showSearchMarker(lat: number, lon: number, label: string): void {
    if (!this.map) return;

    const latLng: LatLngExpression = [lat, lon];
    this.searchMarker = marker(latLng, { icon: SEARCH_MARKER_ICON, interactive: true })
      .bindTooltip(label, { direction: 'top', offset: [0, -16] })
      .addTo(this.map);

    this.bindClearOnContextMenu(this.searchMarker);
  }

  private showSearchPolygon(geometry: Geometry, label: string, animate: boolean): void {
    const map = this.map;
    if (!map) return;

    const layer = geoJSON(geometry, { style: () => SEARCH_RESULT_POLYGON_STYLE }).bindTooltip(
      label,
      { direction: 'top', sticky: true },
    );
    this.searchPolygon = layer;
    this.bindClearOnContextMenu(layer);

    const bounds = layer.getBounds();
    if (!bounds.isValid()) {
      layer.addTo(map);
      return;
    }

    // See `flyTo` — refresh the cached container size before the first move.
    map.invalidateSize();

    if (animate) {
      // Defer adding until the fly settles: rendering the boundary mid-flight,
      // at the pre-zoom scale, makes large areas flash as a giant, jarring block.
      map.once('moveend', () => {
        if (this.searchPolygon === layer) {
          layer.addTo(map);
        }
      });
      map.flyToBounds(bounds, { maxZoom: SEARCH_POLYGON_FIT_MAX_ZOOM });
      return;
    }

    map.fitBounds(bounds, { maxZoom: SEARCH_POLYGON_FIT_MAX_ZOOM, animate: false });
    this.setCurrentZoom(Math.round(map.getZoom()));
    layer.addTo(map);
  }

  /** Opens the search-result context menu on right-click; left-click stays reserved for point queries. */
  private bindClearOnContextMenu(layer: Marker | GeoJsonLayer): void {
    const map = this.map;
    if (!map) return;

    layer.on('contextmenu', (evt: LeafletMouseEvent) => {
      if (evt.originalEvent) {
        DomEvent.preventDefault(evt.originalEvent);
      }

      const point = map.latLngToContainerPoint(evt.latlng);
      this.searchResultContextMenu.set({ x: Math.round(point.x), y: Math.round(point.y) });
    });
  }

  closeSearchResultContextMenu(): void {
    this.searchResultContextMenu.set(null);
  }

  private removeSearchResult(): void {
    if (this.searchMarker) {
      this.searchMarker.remove();
      this.searchMarker = null;
    }
    if (this.searchPolygon) {
      this.searchPolygon.remove();
      this.searchPolygon = null;
    }

    this.closeSearchResultContextMenu();
  }
}
