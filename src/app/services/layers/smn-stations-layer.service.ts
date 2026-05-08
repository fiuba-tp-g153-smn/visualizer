import { Injectable, inject } from '@angular/core';
import * as L from 'leaflet';

import { LayerCategory, LayerType, SmnStationLayer, LayerScale, ScaleType } from '../../models';
import { SMN_STATION_PANE } from '../../config/layers/smn-stations/config';
import { SMN_UNITS, TEMPERATURE_UNITS } from '../../constants';
import { UnitsSettingsService } from '../settings/units-settings.service';
import {
  convertCelsiusToKelvin,
  convertValueForDisplay,
  getDisplayUnit,
} from '../../utils/unit-conversion.utils';
import { LayersService } from './layers.service';
import { SmnStationsDataService } from './smn-stations-data.service';

@Injectable({
  providedIn: 'root',
})
export class SmnStationsLayerService {
  private readonly layersService = inject(LayersService);
  private readonly stationsDataService = inject(SmnStationsDataService);
  private readonly unitsSettings = inject(UnitsSettingsService);
  private readonly layerPool = new Map<string, L.Layer>();

  createLayer(layerId: string, opacity: number, zoom: number, map: L.Map): L.Layer {
    const layer = this.layersService.getLayerById(layerId);
    if (
      !layer ||
      layer.type !== LayerType.VECTOR ||
      layer.category !== LayerCategory.SMN_STATIONS
    ) {
      throw new Error(`Layer '${layerId}' is not a SMN station layer`);
    }

    const snapshot = this.stationsDataService.peek();
    if (!snapshot) {
      void this.stationsDataService.load();
      return L.layerGroup();
    }

    const poolKey = `${layerId}-${zoom}-${opacity}-${snapshot.fetchedAt}`;
    const cachedLayer = this.layerPool.get(poolKey);
    if (cachedLayer) {
      return cachedLayer;
    }

    const stationLayer = layer as SmnStationLayer;
    const markerGroup = L.layerGroup();

    // Collision detection / expanded marker logic based on pixel distance.
    // Always consider the full snapshot so stations don't pop in/out when the
    // viewport changes or the map is zooming.

    const MIN_DISTANCE_PX = 44; // minimum pixel distance to allow an expanded marker (increased margin)
    const MIN_DIST_SQ = MIN_DISTANCE_PX * MIN_DISTANCE_PX;

    type VisiblePoint = {
      observation: SmnStationObservationLike;
      latLng: L.LatLngExpression;
      px: L.Point;
      isCrowded: boolean;
      value: number;
    };

    const visiblePoints: VisiblePoint[] = [];

    for (const observation of snapshot.observations) {
      const latLng: L.LatLngExpression = [
        observation.station.coord.lat,
        observation.station.coord.lon,
      ];
      const value = this.resolveValue(stationLayer.variable, observation);
      if (value === null) continue;
      const px = map.latLngToLayerPoint(latLng as L.LatLngExpression);
      visiblePoints.push({ observation, latLng, px, isCrowded: false, value });
    }

    // Build spatial grid
    const grid: Record<string, VisiblePoint[]> = {};
    const cellSize = MIN_DISTANCE_PX;
    visiblePoints.forEach((p) => {
      const gx = Math.floor(p.px.x / cellSize);
      const gy = Math.floor(p.px.y / cellSize);
      const key = `${gx},${gy}`;
      if (!grid[key]) grid[key] = [];
      grid[key].push(p);
    });

    // Detect collisions
    visiblePoints.forEach((p) => {
      if (p.isCrowded) return;
      const gx = Math.floor(p.px.x / cellSize);
      const gy = Math.floor(p.px.y / cellSize);
      let found = false;
      for (let dx = -1; dx <= 1 && !found; dx++) {
        for (let dy = -1; dy <= 1 && !found; dy++) {
          const key = `${gx + dx},${gy + dy}`;
          const cell = grid[key];
          if (!cell) continue;
          for (const other of cell) {
            if (other === p) continue;
            const distSq = Math.pow(p.px.x - other.px.x, 2) + Math.pow(p.px.y - other.px.y, 2);
            if (distSq < MIN_DIST_SQ) {
              p.isCrowded = true;
              other.isCrowded = true;
              found = true;
              break;
            }
          }
        }
      }
    });

    // Render markers based on crowding
    for (const p of visiblePoints) {
      const observation = p.observation;
      const value = p.value;
      const color = this.resolveColor(stationLayer.scale, value);
      const { displayValue, displayUnit } = this.resolveDisplayValueAndUnit(
        value,
        stationLayer.scale?.unit ?? '',
      );
      const isWindLayer = stationLayer.variable === 'wind_speed';
      const isCalmWind = this.isCalmWind(
        observation.weather.wind.speed,
        observation.weather.wind.direction,
      );

      let marker: L.Layer;
      if (isWindLayer) {
        marker = L.marker(p.latLng, {
          pane: SMN_STATION_PANE,
          icon: this.buildWindIcon(
            observation.weather.wind.direction,
            color,
            p.isCrowded,
            p.isCrowded ? undefined : Math.round(displayValue),
            isCalmWind,
          ),
          interactive: true,
        });
      } else if (p.isCrowded) {
        marker = L.circleMarker(p.latLng, {
          pane: SMN_STATION_PANE,
          radius: 4,
          fillColor: color,
          color: '#000',
          weight: 0.5,
          opacity,
          fillOpacity: 0.85,
          interactive: true,
        });
      } else {
        const textColor = this.resolveContrastingTextColor(color);
        const icon = L.divIcon({
          className: 'smn-station-divicon',
          html: `<div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:${color};color:${textColor};font-weight:700;border:2px solid #000;box-shadow:0 1px 3px rgba(0,0,0,0.3);">${Math.round(value)}</div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });
        marker = L.marker(p.latLng, { pane: SMN_STATION_PANE, icon, interactive: true });
      }

      // Bind event handlers: left-click disabled, right-click opens detail popup
      const markerWithEvents = marker as L.Marker & { on: (event: string, callback: (evt: L.LeafletMouseEvent) => void) => void };
      markerWithEvents.on?.('click', (evt: L.LeafletMouseEvent) => {
        evt.originalEvent?.stopPropagation?.();
        evt.originalEvent?.preventDefault?.();
      });

      markerWithEvents.on?.('contextmenu', (evt: L.LeafletMouseEvent) => {
        const detail = this.buildPopup(stationLayer, observation, value);
        // Use the default popup pane so the popup appears above markers/panes.
        // Rely on pane z-index (configured for SMN station pane) so the popup
        // isn't covered by nearby markers; no manual offset applied.
        L.popup({ pane: 'popupPane' }).setLatLng(evt.latlng).setContent(detail).openOn(map);
      });

      markerGroup.addLayer(marker);
    }

    this.layerPool.set(poolKey, markerGroup);
    return markerGroup;
  }

  private resolveRadius(zoom: number): number {
    const baseRadius = 2.5 + Math.max(0, zoom - 4) * 0.45;
    return Math.min(11, Math.max(3, baseRadius));
  }

  private resolveValue(
    variable: SmnStationLayer['variable'],
    observation: SmnStationObservationLike,
  ): number | null {
    switch (variable) {
      case 'temperature':
        return observation.weather.temperature === null
          ? null
          : convertCelsiusToKelvin(observation.weather.temperature);
      case 'feels_like':
        return observation.weather.feels_like === null
          ? null
          : convertCelsiusToKelvin(observation.weather.feels_like);
      case 'humidity':
        return observation.weather.humidity;
      case 'pressure':
        return observation.weather.pressure;
      case 'visibility':
        return observation.weather.visibility;
      case 'wind_speed':
        return observation.weather.wind.speed ?? 0;
      default:
        return null;
    }
  }

  private resolveColor(scale: LayerScale, value: number): string {
    switch (scale.type) {
      case ScaleType.CONTINUOUS:
        return this.interpolateContinuous(scale.stops, value);
      case ScaleType.DISCRETE:
        return this.resolveDiscreteColor(scale.steps, value);
      case ScaleType.PALETTE_CONFIG:
        return this.resolvePaletteColor(
          scale.hexColors,
          scale.bounds,
          value,
          scale.useBoundaryNorm ?? false,
        );
      default:
        return '#0090d0';
    }
  }

  private interpolateContinuous(
    stops: readonly { value: number; color: string }[],
    value: number,
  ): string {
    if (stops.length === 0) {
      return '#0090d0';
    }

    const sortedStops = [...stops].sort((a, b) => a.value - b.value);
    if (value <= sortedStops[0].value) {
      return sortedStops[0].color;
    }

    const lastStop = sortedStops[sortedStops.length - 1];
    if (value >= lastStop.value) {
      return lastStop.color;
    }

    for (let index = 0; index < sortedStops.length - 1; index++) {
      const left = sortedStops[index];
      const right = sortedStops[index + 1];
      if (value < left.value || value > right.value) {
        continue;
      }

      const ratio = (value - left.value) / (right.value - left.value || 1);
      return this.mixHexColors(left.color, right.color, ratio);
    }

    return lastStop.color;
  }

  private resolveDiscreteColor(
    steps: readonly { value: number; color: string }[],
    value: number,
  ): string {
    if (steps.length === 0) {
      return '#0090d0';
    }

    const sorted = [...steps].sort((a, b) => a.value - b.value);
    let selected = sorted[0];
    for (const step of sorted) {
      if (value >= step.value) {
        selected = step;
      }
    }
    return selected.color;
  }

  private resolvePaletteColor(
    colors: readonly string[],
    bounds: readonly number[],
    value: number,
    useBoundaryNorm: boolean,
  ): string {
    if (colors.length === 0) {
      return '#0090d0';
    }

    if (bounds.length === 0) {
      return colors[0];
    }

    if (useBoundaryNorm) {
      let index = 0;
      for (let i = 0; i < bounds.length; i++) {
        if (value >= bounds[i]) {
          index = i;
        }
      }
      return colors[Math.min(index, colors.length - 1)] ?? colors[0];
    }

    for (let i = 0; i < bounds.length; i++) {
      if (value < bounds[i]) {
        return colors[Math.max(0, i - 1)] ?? colors[0];
      }
    }

    return colors[colors.length - 1] ?? colors[0];
  }

  private mixHexColors(startColor: string, endColor: string, ratio: number): string {
    const start = this.hexToRgb(startColor);
    const end = this.hexToRgb(endColor);
    const clamped = Math.max(0, Math.min(1, ratio));

    const red = Math.round(start.red + (end.red - start.red) * clamped);
    const green = Math.round(start.green + (end.green - start.green) * clamped);
    const blue = Math.round(start.blue + (end.blue - start.blue) * clamped);

    return this.rgbToHex(red, green, blue);
  }

  private hexToRgb(color: string): { red: number; green: number; blue: number } {
    const normalized = color.replace('#', '');
    const red = Number.parseInt(normalized.slice(0, 2), 16);
    const green = Number.parseInt(normalized.slice(2, 4), 16);
    const blue = Number.parseInt(normalized.slice(4, 6), 16);
    return { red, green, blue };
  }

  private rgbToHex(red: number, green: number, blue: number): string {
    return `#${[red, green, blue]
      .map((component) => component.toString(16).padStart(2, '0'))
      .join('')}`;
  }

  private buildPopup(
    layer: SmnStationLayer,
    observation: SmnStationObservationLike,
    rawValue: number,
  ): string {
    const sourceUnit = layer.scale?.unit ?? '';
    const { displayValue, displayUnit } = this.resolveDisplayValueAndUnit(rawValue, sourceUnit);
    const formatValue = (
      input: number | null | undefined,
      precision: number,
      inputUnit = '',
    ): string => {
      if (input === null || input === undefined || Number.isNaN(input)) {
        return '-';
      }
      return `${input.toFixed(precision)}${inputUnit}`;
    };
    const formatText = (input: string | null | undefined): string => {
      if (!input) {
        return '-';
      }
      const trimmed = input.trim();
      return trimmed.length > 0 ? trimmed : '-';
    };
    const calmWind =
      observation.weather.wind.direction === 'Calma' && observation.weather.wind.speed === null;
    const windText = calmWind
      ? `0 ${SMN_UNITS.WIND_SPEED}`
      : formatValue(observation.weather.wind.speed, 0, ` ${SMN_UNITS.WIND_SPEED}`);
    const stationName = formatText(observation.station.name);
    const province = formatText(observation.station.province);
    const windDirection = formatText(observation.weather.wind.direction);
    const { value: temperatureValue, unit: temperatureUnit } = this.resolveTemperatureDisplay(
      observation.weather.temperature,
    );
    const { value: feelsLikeValue, unit: feelsLikeUnit } = this.resolveTemperatureDisplay(
      observation.weather.feels_like,
    );

    return `
      <strong>${stationName}</strong><br/>
      ${province}<br/>
      ${layer.name}: ${displayValue.toFixed(this.getPrecision(layer.variable))} ${displayUnit}<br/>
      Temperatura: ${formatValue(temperatureValue, 1, ` ${temperatureUnit}`)}<br/>
      Sensación térmica: ${formatValue(feelsLikeValue, 1, ` ${feelsLikeUnit}`)}<br/>
      Humedad: ${formatValue(observation.weather.humidity, 0, SMN_UNITS.HUMIDITY)}<br/>
      Presión: ${formatValue(observation.weather.pressure, 1, ` ${SMN_UNITS.PRESSURE}`)}<br/>
      Visibilidad: ${formatValue(observation.weather.visibility, 1, ` ${SMN_UNITS.VISIBILITY}`)}<br/>
      Viento: ${windText} (${windDirection})<br/>
      Actualizado: ${new Date(observation.weather.date).toLocaleString('es-AR')}
    `;
  }

  private buildWindIcon(
    direction: string | null | undefined,
    color: string,
    compact: boolean,
    label?: number,
    calm = false,
  ): L.DivIcon {
    const size = compact ? 20 : 40;
    const anchor = compact ? 10 : 20;
    const rotation = this.resolveWindRotationByDirection(direction);
    const symbolSize = compact ? 16 : 24;
    const background = calm ? '#f3f4f6' : color;
    const textColor = this.resolveContrastingTextColor(background);
    const labelHtml =
      compact || label === undefined ? '' : `<span class="smn-wind-label">${label}</span>`;
    const iconClass = compact ? 'smn-wind-icon is-compact' : 'smn-wind-icon';
    const symbolClass = calm ? 'smn-wind-symbol is-calm' : 'smn-wind-symbol';
    const symbolName = calm ? '◎' : '➤';
    const symbolRotation = calm ? 0 : rotation;
    const symbolColor = compact ? color : textColor;
    const containerStyle = [
      `--wind-bg:${background}`,
      `--wind-symbol-color:${symbolColor}`,
      `--wind-symbol-size:${symbolSize}px`,
      `--wind-label-color:${textColor}`,
      `--wind-rotation:${symbolRotation}deg`,
    ].join(';');

    return L.divIcon({
      className: 'smn-station-windicon',
      html: `<div class="${iconClass}" style="${containerStyle}"><span class="${symbolClass}">${symbolName}</span>${labelHtml}</div>`,
      iconSize: [size, size],
      iconAnchor: [anchor, anchor],
    });
  }

  private resolveDisplayValueAndUnit(
    value: number,
    sourceUnit: string,
  ): { displayValue: number; displayUnit: string } {
    const displayValue = convertValueForDisplay(value, sourceUnit, this.unitsSettings);
    const displayUnit = getDisplayUnit(sourceUnit, this.unitsSettings);
    return { displayValue, displayUnit };
  }

  private resolveTemperatureDisplay(value: number | null): { value: number | null; unit: string } {
    if (value === null || Number.isNaN(value)) {
      return { value: null, unit: getDisplayUnit(TEMPERATURE_UNITS.CELSIUS, this.unitsSettings) };
    }

    const displayValue = convertValueForDisplay(
      value,
      TEMPERATURE_UNITS.CELSIUS,
      this.unitsSettings,
    );
    const unit = getDisplayUnit(TEMPERATURE_UNITS.CELSIUS, this.unitsSettings);
    return { value: displayValue, unit };
  }

  private isCalmWind(speed: number | null | undefined, direction: string | null): boolean {
    return direction === 'Calma' || !speed || speed === 0;
  }

  private resolveWindRotationByDirection(direction: string | null | undefined): number {
    switch (direction) {
      case 'Norte':
        return 0;
      case 'Noreste':
        return 45;
      case 'Este':
        return 90;
      case 'Sudeste':
        return 135;
      case 'Sur':
        return 180;
      case 'Sudoeste':
        return 225;
      case 'Oeste':
        return 270;
      case 'Noroeste':
        return 315;
      case 'Direcciones Variables':
      default:
        return 0;
    }
  }

  private resolveContrastingTextColor(backgroundColor: string): string {
    const { red, green, blue } = this.hexToRgb(backgroundColor);
    const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
    return luminance > 0.62 ? '#111827' : '#ffffff';
  }

  private getPrecision(variable: SmnStationLayer['variable']): number {
    switch (variable) {
      case 'humidity':
        return 0;
      case 'pressure':
      case 'visibility':
      case 'wind_speed':
      case 'temperature':
      case 'feels_like':
        return 1;
      default:
        return 1;
    }
  }
}

type SmnStationObservationLike = {
  station: {
    coord: {
      lat: number;
      lon: number;
    };
    name: string | null;
    province: string | null;
  };
  weather: {
    date: string;
    temperature: number | null;
    feels_like: number | null;
    humidity: number | null;
    pressure: number | null;
    visibility: number | null;
    wind: {
      speed: number | null;
      deg: number | null;
      direction: string | null;
    };
  };
};
