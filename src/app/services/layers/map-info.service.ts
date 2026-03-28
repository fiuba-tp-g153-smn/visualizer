import { Injectable, signal } from '@angular/core';
import * as L from 'leaflet';

const STORAGE_KEY = 'smn-map-tools-v1';

interface MapToolsState {
  showCoordinates: boolean;
  showAttribution: boolean;
  showScale: boolean;
  showZoom: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class MapInfoService {
  private map: L.Map | null = null;

  // Tool visibility states
  showCoordinates = signal<boolean>(false);
  showAttribution = signal<boolean>(true);
  showScale = signal<boolean>(false);
  showZoom = signal<boolean>(false);

  // Leaflet controls
  private scaleControl: L.Control.Scale | null = null;
  private attributionControl: L.Control.Attribution | null = null;
  private coordinatesControl: L.Control | null = null;
  private coordinatesMouseMoveHandler: ((e: L.LeafletMouseEvent) => void) | null = null;

  constructor() {
    this.loadPersistedState();
  }

  private loadPersistedState(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored) as MapToolsState;
        this.showCoordinates.set(state.showCoordinates ?? false);
        this.showAttribution.set(state.showAttribution ?? true);
        this.showScale.set(state.showScale ?? false);
        this.showZoom.set(state.showZoom ?? false);
      }
    } catch (e) {
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
    } catch (e) {
      // Ignore storage errors
    }
  }

  initialize(map: L.Map): void {
    this.map = map;

    // Add default controls if enabled
    if (this.showScale()) {
      this.addScaleControl();
    }
    if (this.showAttribution()) {
      this.addAttributionControl();
    }
    if (this.showCoordinates()) {
      this.addCoordinatesControl();
    }
  }

  toggleCoordinates(enabled: boolean): void {
    this.showCoordinates.set(enabled);
    this.persistState();
    if (!this.map) return;

    if (enabled) {
      this.addCoordinatesControl();
    } else {
      this.removeCoordinatesControl();
    }
  }

  toggleAttribution(enabled: boolean): void {
    this.showAttribution.set(enabled);
    this.persistState();
    if (!this.map) return;

    if (enabled) {
      this.addAttributionControl();
    } else {
      this.removeAttributionControl();
    }
  }

  toggleScale(enabled: boolean): void {
    this.showScale.set(enabled);
    this.persistState();
    if (!this.map) return;

    if (enabled) {
      this.addScaleControl();
    } else {
      this.removeScaleControl();
    }
  }

  toggleZoom(enabled: boolean): void {
    this.showZoom.set(enabled);
    this.persistState();
  }

  private addScaleControl(): void {
    if (!this.map || this.scaleControl) return;
    // Use Leaflet's native scale control - dinámico y adaptable al zoom
    const scale = L.control.scale({
      position: 'bottomleft',
      metric: true,
      imperial: false, // Solo mostrar KMs
      maxWidth: 200,
    }) as any;

    // Wrap the control to add custom class
    const originalOnAdd = scale.onAdd?.bind(scale);
    if (originalOnAdd) {
      scale.onAdd = (map: L.Map) => {
        const container = originalOnAdd(map);
        if (container) {
          container.classList?.add('custom-leaflet-scale');
        }
        return container;
      };
    }

    scale.addTo(this.map);
    this.scaleControl = scale;
    this.ensureScaleAboveCoordinates();
  }

  private removeScaleControl(): void {
    if (!this.map || !this.scaleControl) return;
    this.map.removeControl(this.scaleControl);
    this.scaleControl = null;
  }

  private addAttributionControl(): void {
    if (!this.map || this.attributionControl) return;
    this.attributionControl = L.control.attribution({
      position: 'bottomright',
      prefix:
        '<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">Leaflet</a>',
    });
    this.attributionControl.addTo(this.map);

    // Sync attributions already present on active layers.
    this.map.eachLayer((layer) => {
      const attribution = (layer as L.Layer & { options?: { attribution?: string } }).options
        ?.attribution;
      if (attribution) {
        this.attributionControl?.addAttribution(attribution);
      }
    });
  }

  private removeAttributionControl(): void {
    if (!this.map || !this.attributionControl) return;
    this.map.removeControl(this.attributionControl);
    this.attributionControl = null;
  }

  private addCoordinatesControl(): void {
    if (!this.map || this.coordinatesControl) return;

    // Create a custom control for coordinates
    const CoordinatesControl = L.Control.extend({
      onAdd: () => {
        const div = L.DomUtil.create('div', 'leaflet-control-coordinates leaflet-control');
        div.style.backgroundColor = 'white';
        div.style.padding = '4px 8px';
        div.style.borderRadius = '4px';
        div.style.fontSize = '12px';
        div.style.whiteSpace = 'nowrap';
        div.textContent = 'Mueve el cursor...';

        this.coordinatesMouseMoveHandler = (e: L.LeafletMouseEvent) => {
          div.textContent = `${e.latlng.lat.toFixed(4)}°, ${e.latlng.lng.toFixed(4)}°`;
        };

        this.map?.on('mousemove', this.coordinatesMouseMoveHandler);

        return div;
      },
    });

    this.coordinatesControl = new CoordinatesControl({ position: 'bottomleft' });
    this.coordinatesControl.addTo(this.map);
    this.ensureScaleAboveCoordinates();
  }

  private removeCoordinatesControl(): void {
    if (!this.map || !this.coordinatesControl) return;
    if (this.coordinatesMouseMoveHandler) {
      this.map.off('mousemove', this.coordinatesMouseMoveHandler);
      this.coordinatesMouseMoveHandler = null;
    }
    this.map.removeControl(this.coordinatesControl);
    this.coordinatesControl = null;
  }

  private ensureScaleAboveCoordinates(): void {
    if (!this.map || !this.scaleControl || !this.coordinatesControl) {
      return;
    }

    // In bottom corners, Leaflet inserts new controls at the top.
    // Re-adding scale keeps it visually above coordinates regardless of toggle order.
    this.map.removeControl(this.scaleControl);
    this.scaleControl.addTo(this.map);
  }

  destroy(): void {
    if (this.map) {
      if (this.scaleControl) {
        this.map.removeControl(this.scaleControl);
      }
      if (this.attributionControl) {
        this.map.removeControl(this.attributionControl);
      }
      if (this.coordinatesControl) {
        this.map.removeControl(this.coordinatesControl);
      }
      if (this.coordinatesMouseMoveHandler) {
        this.map.off('mousemove', this.coordinatesMouseMoveHandler);
        this.coordinatesMouseMoveHandler = null;
      }
    }
    this.attributionControl = null;
    this.coordinatesControl = null;
    this.scaleControl = null;
    this.map = null;
  }
}
