import { Injectable, computed, signal } from '@angular/core';
import * as L from 'leaflet';
import { MAP_CONFIG } from '../../config';

const STORAGE_KEY = 'smn-map-tools-v1';

interface MapToolsState {
  showCoordinates: boolean;
  showAttribution: boolean;
  showScale: boolean;
  showZoom: boolean;
}

/** Scale bar configuration */
interface ScaleInfo {
  text: string;
  width: number;
}

@Injectable({
  providedIn: 'root',
})
export class MapInfoService {
  private map: L.Map | null = null;

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

  // Event handlers
  private mouseMoveHandler: ((e: L.LeafletMouseEvent) => void) | null = null;
  private mouseOutHandler: (() => void) | null = null;
  private zoomEndHandler: (() => void) | null = null;
  private moveEndHandler: (() => void) | null = null;

  constructor() {
    this.loadPersistedState();
  }

  private loadPersistedState(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored) as MapToolsState;
        this.showCoordinates.set(state.showCoordinates ?? MAP_CONFIG.defaultShowCoordinates);
        this.showAttribution.set(state.showAttribution ?? MAP_CONFIG.defaultShowAttribution);
        this.showScale.set(state.showScale ?? MAP_CONFIG.defaultShowScale);
        this.showZoom.set(state.showZoom ?? MAP_CONFIG.defaultShowZoom);
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
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage errors
    }
  }

  initialize(map: L.Map): void {
    this.map = map;
    this.currentZoom.set(Math.round(map.getZoom()));
    this.mapCenterLat.set(map.getCenter().lat);

    // Setup event listeners for reactive data
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.map) return;

    // Mouse move for coordinates
    this.mouseMoveHandler = (e: L.LeafletMouseEvent) => {
      this.mouseLatitude.set(e.latlng.lat);
      this.mouseLongitude.set(e.latlng.lng);
    };

    this.mouseOutHandler = () => {
      this.mouseLatitude.set(null);
      this.mouseLongitude.set(null);
    };

    // Zoom/move for scale calculation
    this.zoomEndHandler = () => {
      if (this.map) {
        this.currentZoom.set(Math.round(this.map.getZoom()));
        this.mapCenterLat.set(this.map.getCenter().lat);
      }
    };

    this.moveEndHandler = () => {
      if (this.map) {
        this.mapCenterLat.set(this.map.getCenter().lat);
      }
    };

    this.map.on('mousemove', this.mouseMoveHandler);
    this.map.on('mouseout', this.mouseOutHandler);
    this.map.on('zoomend', this.zoomEndHandler);
    this.map.on('moveend', this.moveEndHandler);
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
    if (this.zoomEndHandler) {
      this.map.off('zoomend', this.zoomEndHandler);
      this.zoomEndHandler = null;
    }
    if (this.moveEndHandler) {
      this.map.off('moveend', this.moveEndHandler);
      this.moveEndHandler = null;
    }
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

  setCurrentZoom(zoom: number): void {
    this.currentZoom.set(Math.max(MAP_CONFIG.minZoom, Math.min(MAP_CONFIG.maxZoom, zoom)));
  }

  zoomIn(): void {
    this.setCurrentZoom(this.currentZoom() + 1);
  }

  zoomOut(): void {
    this.setCurrentZoom(this.currentZoom() - 1);
  }

  destroy(): void {
    this.removeEventListeners();
    this.map = null;
  }
}
