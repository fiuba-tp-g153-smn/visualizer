import {
  ApplicationRef,
  EnvironmentInjector,
  Injectable,
  createComponent,
  inject,
} from '@angular/core';
import * as L from 'leaflet';
import {
  LayerType,
  LayerCategory,
  WmsLayer,
  WeatherStationLayer,
  LayerScale,
  ScaleType,
  GoesTileLayerConfig,
  RadarTileLayerConfig,
  RadarTileLayer,
  TileLayerControls,
  GoesLayerControls,
  RadarLayerControls,
  WmsLayerControls,
  TileLayer,
  LayerControls,
  EcmwfTpLayerControls,
  EcmwfTpTileLayerConfig,
  EcmwfTpTileLayer,
  WeatherStationVariable,
  WrfLayerControls,
  WrfTileLayer,
  WrfTileLayerConfig,
} from '../../models';
import { DataServiceHealthService } from '../data-service-health/data-service-health.service';
import { NotificationService } from '../notifications/notification.service';
import { LayerConfigService } from './layer-config.service';
import { LayerControlService } from './layer-control.service';
import { LayerRefreshService } from './layer-refresh.service';
import { LayersService } from './layers.service';
import { buildBasemapTileUrl, buildTileUrl, MAP_CONFIG } from '../../config';
import { WEATHER_STATION_PANE } from '../../config/layers/weather-stations/config';
import { WEATHER_STATION_RENDER_CONFIG } from '../../config/layers/weather-stations/render.config';
import {
  IGN_WMS_BACKED_UP_LAYER_IDS,
  IGN_WMS_BASE_CONFIG,
  IGN_WMS_WORKSPACE_URLS,
} from '../../config/layers';
import { buildWrfTileUrl } from '../../config/backend.config';
import { computeWindowStart, getDefaultCursorIndex } from '../../utils/playback-window';
import { WEATHER_STATION_UNITS, TEMPERATURE_UNITS } from '../../constants';
import { UnitsSettingsService } from '../settings/units-settings.service';
import {
  convertCelsiusToKelvin,
  convertKilometersPerHourToKnots,
  convertValueForDisplay,
  getDisplayUnit,
} from '../../utils/unit-conversion.utils';
import { formatDateTimeLocalized, wrfFxxxForInitAndTime } from '../../utils/tileset-timestamp';
import { windBarbSvg } from '../../utils/wind-barb.util';
import { windDirectionTriangleSvg } from '../../utils/wind-direction.util';
import {
  WeatherStationPopupComponent,
  WeatherStationPopupData,
} from '../../components/floating/weather-station-popup/weather-station-popup.component';

/**
 * Service responsible for creating and managing Leaflet tile layers.
 *
 * This service:
 * - Creates Leaflet layers based on layer type (TILE vs WMS) and category
 * - Reacts to configuration changes from LayerConfigService
 * - Builds dynamic tile URLs using layer.id and tileset information
 * - Handles tile loading errors with user notifications
 * - Creates placeholder layers when configuration is not yet available
 *
 * The service uses a factory pattern to convert Layer models into
 * configured L.TileLayer instances appropriate for each layer type.
 */
@Injectable({
  providedIn: 'root',
})
export class LayerRenderService {
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly notificationService = inject(NotificationService);
  private readonly layerConfigService = inject(LayerConfigService);
  private readonly layerRefreshService = inject(LayerRefreshService);
  private readonly layersService = inject(LayersService);
  private readonly unitsSettings = inject(UnitsSettingsService);
  private readonly healthService = inject(DataServiceHealthService);
  private readonly layerControlService = inject(LayerControlService);

  // Track errors per layer to avoid notification spam
  private readonly errorTracker = new Map<string, number>();
  private readonly MAX_ERRORS_BEFORE_NOTIFY = 5;

  // Tile Layer Pool: cache of L.TileLayer instances for reuse
  private readonly layerPool = new Map<string, L.TileLayer>();
  private readonly weatherStationsLayerPool = new Map<string, L.Layer>();

  // ============================================================================
  // Public Methods - Layer Creation
  // ============================================================================

  /**
   * Creates a Leaflet TileLayer for the given layer ID and controls.
   * Uses a pool to reuse layer instances when only visual properties (opacity) change.
   *
   * @param layerId - The layer identifier
   * @param controls - Current layer control state (opacity, timeIndex, elevation, etc.)
   * @returns A configured Leaflet TileLayer
   * @throws Error if layer not found or unsupported type
   */
  createTileLayer(layerId: string, controls: LayerControls): L.TileLayer {
    const layer = this.layersService.getLayerById(layerId);

    if (!layer) {
      throw new Error(`Layer '${layerId}' not found`);
    }

    // Generate a unique key for the pool based on layer data (not visual properties)
    const poolKey = this.generatePoolKey(layerId, controls);

    // Check if we already have a layer instance in the pool
    if (this.layerPool.has(poolKey)) {
      // Return cached layer as-is; caller (map-viewer) manages opacity
      return this.layerPool.get(poolKey)!;
    }

    // Create new layer if not in pool
    let tileLayer: L.TileLayer;
    switch (layer.type) {
      case LayerType.TILE:
        tileLayer = this.createDataTileLayer(layerId, controls as TileLayerControls);
        break;
      case LayerType.WMS:
        tileLayer = this.createWmsLayer(layerId, controls as WmsLayerControls);
        break;
      default:
        throw new Error(`Unsupported layer type for layer ${layerId}`);
    }

    // Store in pool for future reuse
    this.layerPool.set(poolKey, tileLayer);
    return tileLayer;
  }

  createWeatherStationsLayer(
    layerId: string,
    opacity: number,
    zoom: number,
    map: L.Map,
    actualZIndex?: number,
  ): L.Layer {
    const layer = this.layersService.getLayerById(layerId);
    if (
      !layer ||
      layer.type !== LayerType.VECTOR ||
      layer.category !== LayerCategory.WEATHER_STATIONS
    ) {
      throw new Error(`Layer '${layerId}' is not a weather station layer`);
    }

    const snapshot = this.layerRefreshService.peekWeatherStationsSnapshot();
    if (!snapshot) {
      void this.layerRefreshService.loadWeatherStationsSnapshot();
      return L.layerGroup();
    }

    this.applyWeatherStationsPaneZIndex(map, actualZIndex);

    const showStationsWithoutData =
      this.layerControlService.getWeatherStationsShowStationsWithoutData();
    const displayTemperatureUnit = this.unitsSettings.temperatureUnit();
    const displayWindSpeedUnit = this.unitsSettings.windSpeedUnit();
    const paneZIndex = map.getPane(WEATHER_STATION_PANE)?.style.zIndex ?? '560';
    const poolKey = `${layerId}-${zoom}-${opacity}-${snapshot.fetchedAt}-${paneZIndex}-show=${showStationsWithoutData}-temp=${displayTemperatureUnit}-wind=${displayWindSpeedUnit}`;
    const cachedLayer = this.weatherStationsLayerPool.get(poolKey);
    if (cachedLayer) {
      return cachedLayer;
    }

    const stationLayer = layer as WeatherStationLayer;
    const markerGroup = L.layerGroup();
    const markerRadius = this.resolveWeatherStationsRadius(zoom);

    type VisiblePoint = {
      observation: WeatherStationObservationLike;
      latLng: L.LatLng;
      px: L.Point;
      value: number;
      metersPerPixel: number;
      nearestDistMeters: number;
      isStale: boolean;
    };

    const visiblePoints: VisiblePoint[] = [];
    for (const observation of snapshot.observations) {
      // `hasData === false` ⇔ the station's last observation falls outside the
      // requested tolerance window. Default-true fallback keeps LATEST mode
      // (where the field is irrelevant) rendering normally.
      const isStale = observation.hasData === false;
      if (isStale && !showStationsWithoutData) {
        continue;
      }

      const latLng = L.latLng(observation.station.coord.lat, observation.station.coord.lon);
      const value = this.resolveWeatherStationsValue(stationLayer.variable, observation);
      if (value === null) {
        continue;
      }

      // Wind layer: a null speed is either calm (reported as 'Calma' → shown as 0)
      // or no reading at all. Drop the latter so the map only shows real wind data.
      if (
        stationLayer.variable === WeatherStationVariable.WIND_SPEED &&
        observation.weather.wind.speed === null &&
        observation.weather.wind.direction !== 'Calma'
      ) {
        continue;
      }

      const px = map.latLngToLayerPoint(latLng);
      visiblePoints.push({
        observation,
        latLng,
        px,
        value,
        metersPerPixel: this.resolveWeatherStationsMetersPerPixel(map, latLng, zoom),
        nearestDistMeters: Number.POSITIVE_INFINITY,
        isStale,
      });
    }

    const dotRadiusPx = Math.max(
      WEATHER_STATION_RENDER_CONFIG.marker.dotMinRadiusPx,
      markerRadius * WEATHER_STATION_RENDER_CONFIG.marker.dotRadiusFactor,
    );
    const circleRadiusPx = Math.max(
      WEATHER_STATION_RENDER_CONFIG.marker.circleMinRadiusPx,
      markerRadius * WEATHER_STATION_RENDER_CONFIG.marker.circleRadiusFactor,
    );
    const badgeDiameterPx = Math.max(
      WEATHER_STATION_RENDER_CONFIG.marker.badgeMinDiameterPx,
      Math.round(markerRadius * WEATHER_STATION_RENDER_CONFIG.marker.badgeDiameterFactor),
    );
    const circleDiameterPx = circleRadiusPx * 2;
    // Minimized wind stations render a direction triangle instead of a dot; size it
    // well above the dot (~3.5–8.4px) yet below the barb so it stays de-cluttered.
    const windDirSizePx = Math.max(20, Math.round(markerRadius * 2.3));

    const cellSize = Math.max(WEATHER_STATION_RENDER_CONFIG.minDistancePx, circleDiameterPx);
    const grid = new Map<string, VisiblePoint[]>();
    for (const point of visiblePoints) {
      const gx = Math.floor(point.px.x / cellSize);
      const gy = Math.floor(point.px.y / cellSize);
      const key = `${gx},${gy}`;
      const cell = grid.get(key);
      if (cell) {
        cell.push(point);
      } else {
        grid.set(key, [point]);
      }
    }

    for (const point of visiblePoints) {
      const gx = Math.floor(point.px.x / cellSize);
      const gy = Math.floor(point.px.y / cellSize);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const key = `${gx + dx},${gy + dy}`;
          const cell = grid.get(key);
          if (!cell) {
            continue;
          }
          for (const other of cell) {
            if (other === point) {
              continue;
            }
            const distMeters = map.distance(point.latLng, other.latLng);
            if (distMeters < point.nearestDistMeters) {
              point.nearestDistMeters = distMeters;
            }
          }
        }
      }
    }

    // Neutral gray for stations whose observation is outside the requested
    // tolerance window. Soft and desaturated — visible but clearly inactive.
    const STALE_COLOR = '#9ca3af';
    const STALE_TOOLTIP = 'Sin datos en el período solicitado';

    // Wind barbs are much larger than a badge, so they need extra spacing before
    // colliding; widen the density thresholds for the wind layer so crowded barbs
    // collapse to dots (the de-clutter) sooner when zooming out.
    const declutterFactor = stationLayer.variable === WeatherStationVariable.WIND_SPEED ? 4 : 1;
    const markerOpacity = Math.max(0, Math.min(1, opacity));

    for (const point of visiblePoints) {
      const observation = point.observation;
      const value = point.value;
      const color = point.isStale
        ? STALE_COLOR
        : this.resolveWeatherStationsColor(stationLayer.scale, value);

      const denseThresholdMeters =
        circleDiameterPx *
        point.metersPerPixel *
        WEATHER_STATION_RENDER_CONFIG.density.denseDistanceMultiplier *
        declutterFactor;
      const mediumThresholdMeters =
        badgeDiameterPx *
        point.metersPerPixel *
        WEATHER_STATION_RENDER_CONFIG.density.mediumDistanceMultiplier *
        declutterFactor;

      const level: WeatherStationRenderLevel =
        point.nearestDistMeters <= denseThresholdMeters
          ? WeatherStationRenderLevel.DOT
          : point.nearestDistMeters <= mediumThresholdMeters
            ? WeatherStationRenderLevel.CIRCLE
            : WeatherStationRenderLevel.BADGE;

      // Cancel Leaflet's latitude-based marker stacking so all station sizes
      // share the same effective z-index inside the pane.
      const sharedZIndexOffset = -Math.round(point.px.y);

      // When the wind variable is selected, draw a standard wind barb instead of
      // the value badge (except at the densest DOT level, to avoid overlap).
      const isWindBarb =
        stationLayer.variable === WeatherStationVariable.WIND_SPEED &&
        level !== WeatherStationRenderLevel.DOT;

      let marker: L.Marker;
      if (isWindBarb) {
        // The barb glyph is always in knots (meteorological standard); the badge
        // number tracks the user's display unit (km/h ↔ kt toggle) via the same
        // helper the popover uses, so the on-map value matches the popover.
        const knots = convertKilometersPerHourToKnots(observation.weather.wind.speed ?? 0);
        const { value: windValue } = this.resolveWeatherStationsWindSpeedDisplay(
          observation.weather.wind.speed,
        );
        // Any null here is a calm station (no-data was filtered out above); show 0
        // to match the popover's calm reading.
        const windLabel =
          windValue === null || Number.isNaN(windValue) ? '0' : String(Math.round(windValue));
        const textColor = this.resolveWeatherStationsContrastingTextColor(color);
        const icon = this.buildWeatherStationsWindBarbIcon(
          knots,
          observation.weather.wind.deg,
          Math.round(badgeDiameterPx * 3),
          badgeDiameterPx,
          color,
          textColor,
          windLabel,
          markerOpacity,
        );
        marker = this.createWeatherStationsIconMarker(point.latLng, icon, sharedZIndexOffset);
      } else if (level === WeatherStationRenderLevel.DOT) {
        // Wind layer: a minimized station shows its direction as a (speed-coloured)
        // triangle, matching the popover's wind-compass arrow. Calm / unknown bearing
        // has no honest direction, so it stays a plain dot (as do all other layers).
        const deg = observation.weather.wind.deg;
        const hasBearing =
          stationLayer.variable === WeatherStationVariable.WIND_SPEED &&
          observation.weather.wind.direction !== 'Calma' &&
          deg !== null &&
          Number.isFinite(deg);
        const icon =
          hasBearing && deg !== null
            ? this.buildWeatherStationsWindDirIcon(deg, windDirSizePx, color)
            : this.buildWeatherStationsDotIcon(
                dotRadiusPx * 2,
                color,
                Math.max(WEATHER_STATION_RENDER_CONFIG.marker.dotMinFillOpacity, opacity),
              );
        marker = this.createWeatherStationsIconMarker(point.latLng, icon, sharedZIndexOffset);
      } else if (level === WeatherStationRenderLevel.CIRCLE) {
        const icon = this.buildWeatherStationsCircleIcon(
          circleRadiusPx * 2,
          color,
          Math.max(
            WEATHER_STATION_RENDER_CONFIG.marker.minimumFillOpacity,
            WEATHER_STATION_RENDER_CONFIG.marker.crowdedValueFillOpacityBase * opacity,
          ),
          Math.max(opacity, WEATHER_STATION_RENDER_CONFIG.marker.minimumFillOpacity),
        );
        marker = this.createWeatherStationsIconMarker(point.latLng, icon, sharedZIndexOffset);
      } else {
        const textColor = this.resolveWeatherStationsContrastingTextColor(color);
        const { displayValue } = this.resolveWeatherStationsDisplayValueAndUnit(
          value,
          stationLayer.scale?.unit ?? '',
        );
        const labelValue = Math.round(displayValue);
        const iconDiameter = badgeDiameterPx;
        const icon = this.buildWeatherStationsBadgeIcon(
          labelValue,
          iconDiameter,
          color,
          textColor,
          markerOpacity,
        );
        marker = this.createWeatherStationsIconMarker(point.latLng, icon, sharedZIndexOffset);
      }

      if (point.isStale && typeof marker.bindTooltip === 'function') {
        marker.bindTooltip(STALE_TOOLTIP, { direction: 'top', opacity: 0.9, sticky: false });
      }

      marker.on?.('click', (evt: L.LeafletMouseEvent) => {
        const button = (evt.originalEvent as MouseEvent | undefined)?.button ?? 0;
        if (button !== 0) {
          return;
        }
        // Re-fire on the map so PointQueryViewerService.handleMapClick (wired
        // via map.on('click', ...) in map-container.ts) still triggers for
        // points that land on a station marker.
        map.fire('click', {
          latlng: evt.latlng,
          layerPoint: evt.layerPoint,
          containerPoint: evt.containerPoint,
          originalEvent: evt.originalEvent,
        } as L.LeafletMouseEvent);
      });

      marker.on?.('contextmenu', (evt: L.LeafletMouseEvent) => {
        if (evt.originalEvent) {
          L.DomEvent.preventDefault(evt.originalEvent);
        }

        const popupData = this.buildWeatherStationsPopupData(observation);
        const { element, destroy } = this.createWeatherStationsPopupElement(popupData);
        const popup = L.popup({ pane: 'popupPane', className: 'weather-station-popup' })
          .setLatLng(evt.latlng)
          .setContent(element)
          .openOn(map);

        popup.once('remove', () => {
          destroy();
        });
      });

      markerGroup.addLayer(marker);
    }

    this.weatherStationsLayerPool.set(poolKey, markerGroup);
    return markerGroup;
  }

  private resolveWeatherStationsRadius(zoom: number): number {
    const baseRadius = 2.5 + Math.max(0, zoom - 4) * 0.45;
    return Math.min(11, Math.max(3, baseRadius));
  }

  private resolveWeatherStationsMetersPerPixel(map: L.Map, latLng: L.LatLng, zoom: number): number {
    const projected = map.project(latLng, zoom);
    const onePixelEast = L.point(projected.x + 1, projected.y);
    const shiftedLatLng = map.unproject(onePixelEast, zoom);
    const meters = map.distance(latLng, shiftedLatLng);
    return meters > 0 ? meters : 1;
  }

  private resolveWeatherStationsContrastingTextColor(color: string): string {
    const normalized = color.replace('#', '');
    if (normalized.length !== 6) {
      return '#111827';
    }

    const red = Number.parseInt(normalized.slice(0, 2), 16);
    const green = Number.parseInt(normalized.slice(2, 4), 16);
    const blue = Number.parseInt(normalized.slice(4, 6), 16);
    const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
    return luminance > 0.58 ? '#111827' : '#f9fafb';
  }

  private buildWeatherStationsBadgeIcon(
    value: number,
    diameterPx: number,
    backgroundColor: string,
    textColor: string,
    iconOpacity: number,
  ): L.DivIcon {
    const label = String(value);
    const { fontSizePx, letterSpacingPx } = this.resolveWeatherStationsBadgeTypography(
      label,
      diameterPx,
    );
    return L.divIcon({
      className: 'weather-station-divicon',
      html: `<div class="weather-station-badge" style="--weather-badge-size:${diameterPx}px;--weather-badge-bg:${backgroundColor};--weather-badge-fg:${textColor};--weather-badge-font-size:${fontSizePx}px;--weather-badge-letter-spacing:${letterSpacingPx}px;--weather-badge-opacity:${iconOpacity};">${label}</div>`,
      iconSize: [diameterPx, diameterPx],
      iconAnchor: [diameterPx / 2, diameterPx / 2],
    });
  }

  /**
   * Wind marker = the solid value badge (its prior aesthetic, here carrying the
   * temperature) with a black wind barb behind it, overflowing to the outside.
   */
  private buildWeatherStationsWindBarbIcon(
    speedKnots: number,
    deg: number | null,
    sizePx: number,
    badgeDiameterPx: number,
    backgroundColor: string,
    textColor: string,
    label: string,
    iconOpacity: number,
  ): L.DivIcon {
    const barb = windBarbSvg(speedKnots, deg, { size: sizePx, color: '#111827' });
    const { fontSizePx, letterSpacingPx } = this.resolveWeatherStationsBadgeTypography(
      label,
      badgeDiameterPx,
    );
    const badge = `<div class="weather-station-badge" style="--weather-badge-size:${badgeDiameterPx}px;--weather-badge-bg:${backgroundColor};--weather-badge-fg:${textColor};--weather-badge-font-size:${fontSizePx}px;--weather-badge-letter-spacing:${letterSpacingPx}px;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);">${label}</div>`;
    return L.divIcon({
      className: 'weather-station-divicon',
      html: `<div style="position:relative;width:${sizePx}px;height:${sizePx}px;opacity:${iconOpacity};">${barb}${badge}</div>`,
      iconSize: [sizePx, sizePx],
      iconAnchor: [sizePx / 2, sizePx / 2],
    });
  }

  private resolveWeatherStationsBadgeTypography(
    label: string,
    diameterPx: number,
  ): { fontSizePx: number; letterSpacingPx: number } {
    const baseFontSizePx = WEATHER_STATION_RENDER_CONFIG.marker.badgeFontSizePx;
    const digits = Math.max(1, label.length);

    const byDigits =
      digits <= 2
        ? baseFontSizePx
        : digits === 3
          ? baseFontSizePx - 1
          : digits === 4
            ? baseFontSizePx - 2
            : baseFontSizePx - 3;

    const byDiameter = Math.round(diameterPx * 0.56 - Math.max(0, digits - 2) * 1.35);
    const fontSizePx = Math.max(8, Math.min(baseFontSizePx, Math.min(byDigits, byDiameter)));
    const letterSpacingPx = digits >= 4 ? -0.3 : 0;

    return { fontSizePx, letterSpacingPx };
  }

  /**
   * Minimized wind marker = a speed-coloured triangle pointing in the wind
   * direction (same convention as the popover's wind-compass arrow), used at the
   * dense DOT level instead of a directionless dot.
   */
  private buildWeatherStationsWindDirIcon(deg: number, sizePx: number, color: string): L.DivIcon {
    return L.divIcon({
      className: 'weather-station-divicon',
      html: windDirectionTriangleSvg(deg, { size: sizePx, color }),
      iconSize: [sizePx, sizePx],
      iconAnchor: [sizePx / 2, sizePx / 2],
    });
  }

  private buildWeatherStationsDotIcon(
    diameterPx: number,
    color: string,
    fillOpacity: number,
  ): L.DivIcon {
    const normalizedOpacity = Math.max(0, Math.min(1, fillOpacity));
    return L.divIcon({
      className: 'weather-station-divicon',
      html: `<div style="width:${diameterPx}px;height:${diameterPx}px;border-radius:50%;background:${this.weatherStationsHexToRgba(color, normalizedOpacity)};"></div>`,
      iconSize: [diameterPx, diameterPx],
      iconAnchor: [diameterPx / 2, diameterPx / 2],
    });
  }

  private buildWeatherStationsCircleIcon(
    diameterPx: number,
    color: string,
    fillOpacity: number,
    strokeOpacity: number,
  ): L.DivIcon {
    const strokeWidth = WEATHER_STATION_RENDER_CONFIG.marker.circleStrokeWeight;
    const normalizedFillOpacity = Math.max(0, Math.min(1, fillOpacity));
    const normalizedStrokeOpacity = Math.max(0, Math.min(1, strokeOpacity));

    return L.divIcon({
      className: 'weather-station-divicon',
      html: `<div style="width:${diameterPx}px;height:${diameterPx}px;border-radius:50%;box-sizing:border-box;border:${strokeWidth}px solid rgba(0,0,0,${normalizedStrokeOpacity});background:${this.weatherStationsHexToRgba(color, normalizedFillOpacity)};"></div>`,
      iconSize: [diameterPx, diameterPx],
      iconAnchor: [diameterPx / 2, diameterPx / 2],
    });
  }

  private createWeatherStationsIconMarker(
    latLng: L.LatLng,
    icon: L.DivIcon,
    zIndexOffset: number,
  ): L.Marker {
    return L.marker(latLng, {
      pane: WEATHER_STATION_PANE,
      icon,
      interactive: true,
      zIndexOffset,
    });
  }

  private weatherStationsHexToRgba(color: string, alpha: number): string {
    const { red, green, blue } = this.hexToWeatherStationsRgb(color);
    const normalizedAlpha = Math.max(0, Math.min(1, alpha));
    return `rgba(${red}, ${green}, ${blue}, ${normalizedAlpha})`;
  }

  /**
   * Creates a Leaflet TileLayer for a radar layer with a specific elevation.
   * This is used when multiple elevations are selected.
   *
   * @param layerId - The radar layer identifier
   * @param controls - Current layer control state
   * @param elevationId - The specific elevation ID to create a layer for
   * @returns A configured Leaflet TileLayer for that elevation
   */
  createRadarTileLayerForElevation(
    layerId: string,
    controls: RadarLayerControls,
    elevationId: string,
  ): L.TileLayer {
    // Generate pool key including the specific elevation
    const config = this.layerConfigService.getConfig(layerId) as RadarTileLayerConfig | undefined;
    if (!config) {
      throw new Error(`Configuration not loaded for radar layer '${layerId}'`);
    }

    const tilesets = config.availableTilesets;
    if (tilesets.length === 0) {
      throw new Error(`No tilesets available for radar layer '${layerId}'`);
    }

    const radarLayer = this.layersService.getLayerById(layerId);
    const radarIsForecast = radarLayer?.type === LayerType.TILE && radarLayer.isForecast;
    const timeIndex =
      controls.playback.timeIndex ?? getDefaultCursorIndex(tilesets.length, radarIsForecast);

    if (timeIndex < 0 || timeIndex >= tilesets.length) {
      throw new Error(
        `Time index ${timeIndex} out of bounds for layer '${layerId}' (available: 0-${tilesets.length - 1})`,
      );
    }

    const tilesetId = tilesets[timeIndex].id;
    const poolKey = `${layerId}-${elevationId}-${tilesetId}`;

    // Check pool
    if (this.layerPool.has(poolKey)) {
      // Return cached layer as-is; caller (map-viewer) manages opacity
      return this.layerPool.get(poolKey)!;
    }

    // Create new layer
    const tileLayer = this.createRadarTileLayer(layerId, controls, elevationId);
    this.layerPool.set(poolKey, tileLayer);
    return tileLayer;
  }

  /**
   * Returns the number of available tilesets for a TILE layer (GOES or Radar).
   * Used by map-viewer to determine valid prefetch index bounds.
   * @throws Error if configuration not loaded
   */
  getAvailableTilesetsCount(layerId: string): number {
    const config = this.layerConfigService.getConfig(layerId) as
      | GoesTileLayerConfig
      | RadarTileLayerConfig
      | undefined;
    if (!config) {
      throw new Error(`Configuration not loaded for layer '${layerId}'`);
    }
    return config.availableTilesets.length;
  }

  /**
   * Creates or retrieves a GOES tile layer for a specific timeIndex, ignoring opacity.
   * Used for pre-fetching adjacent frames without affecting the displayed opacity.
   */
  createTileLayerForTimeIndex(
    layerId: string,
    controls: GoesLayerControls,
    timeIndex: number,
  ): L.TileLayer {
    const overrideControls: GoesLayerControls = {
      ...controls,
      playback: { ...controls.playback, timeIndex },
    };
    return this.createTileLayer(layerId, overrideControls);
  }

  /**
   * Creates or retrieves a radar tile layer for a specific elevation and timeIndex, ignoring opacity.
   * Used for pre-fetching adjacent frames without affecting the displayed opacity.
   */
  createRadarTileLayerForElevationAtTimeIndex(
    layerId: string,
    controls: RadarLayerControls,
    elevationId: string,
    timeIndex: number,
  ): L.TileLayer {
    const overrideControls: RadarLayerControls = {
      ...controls,
      playback: { ...controls.playback, timeIndex },
    };
    return this.createRadarTileLayerForElevation(layerId, overrideControls, elevationId);
  }

  /**
   * Creates GOES layers for playback including current frame and prerendered next frames.
   * Returns a map of composite keys to layers with opacity already set.
   *
   * @param layerId - The GOES layer identifier
   * @param controls - Current layer control state
   * @param targetOpacity - Target opacity for the current visible frame (0-1)
   * @param absoluteZIndex - Z-index to apply to all layers
   * @returns Map of composite keys (layerId#timeIndex) to layer objects
   */
  createGoesLayersForPlayback(
    layerId: string,
    controls: GoesLayerControls,
    targetOpacity: number,
    absoluteZIndex: number,
  ): Map<string, L.TileLayer> {
    const result = new Map<string, L.TileLayer>();
    const currentTimeIndex = controls.playback.timeIndex ?? 0;
    const totalFrames = this.getAvailableTilesetsCount(layerId);

    // Current visible frame
    const tileLayer = this.createTileLayer(layerId, controls);
    this.applyLayerStyles(tileLayer, targetOpacity, absoluteZIndex);
    result.set(`${layerId}#${currentTimeIndex}`, tileLayer);

    // Pre-render next N frames at opacity=0
    const goesLayer = this.layersService.getLayerById(layerId);
    const goesIsForecast = goesLayer?.type === LayerType.TILE && goesLayer.isForecast;
    this.prerenderNextFrames(
      result,
      currentTimeIndex,
      totalFrames,
      controls.playback.imageCount,
      absoluteZIndex,
      goesIsForecast,
      (adjIndex) => {
        const adjLayer = this.createTileLayerForTimeIndex(layerId, controls, adjIndex);
        return { layer: adjLayer, key: `${layerId}#${adjIndex}` };
      },
    );

    return result;
  }

  /**
   * Creates radar layers for playback including current frame and prerendered next frames.
   * Returns a map of composite keys to layers with opacity already set.
   * One layer per selected elevation, each with its own opacity if configured.
   * Z-indices are allocated incrementally based on elevation zIndexPreference (higher preference = higher z-index).
   *
   * @param layerId - The radar layer identifier
   * @param controls - Current layer control state
   * @param targetOpacity - Target opacity for the current visible frames (0-1) (used as fallback if no elevation-specific opacity)
   * @param absoluteZIndex - Base z-index for the layer (elevations will use absoluteZIndex, absoluteZIndex+1, etc.)
   * @returns Map of composite keys (layerId#elevationId#timeIndex) to layer objects
   */
  createRadarLayersForPlayback(
    layerId: string,
    controls: RadarLayerControls,
    targetOpacity: number,
    absoluteZIndex: number,
  ): Map<string, L.TileLayer> {
    const result = new Map<string, L.TileLayer>();
    const selectedElevationIds = controls.elevation.selectedElevationIds;
    const currentTimeIndex = controls.playback.timeIndex ?? 0;
    const totalFrames = this.getAvailableTilesetsCount(layerId);

    // Get layer to access elevation configurations
    const layer = this.layersService.getLayerById(layerId);
    if (!layer || layer.type !== LayerType.TILE || layer.category !== LayerCategory.RADAR) {
      throw new Error(`Layer ${layerId} is not a radar layer`);
    }

    const radarLayer = layer as RadarTileLayer;

    // Build a map of elevationId -> zIndexPreference for selected elevations
    const selectedElevationsWithPreference = selectedElevationIds
      .map((elevationId) => {
        const elevation = radarLayer.availableElevations.find((e) => e.id === elevationId);
        if (!elevation) {
          throw new Error(`Elevation '${elevationId}' not found for layer '${layerId}'`);
        }
        return { elevationId, zIndexPreference: elevation.zIndexPreference };
      })
      .sort((a, b) => a.zIndexPreference - b.zIndexPreference); // Sort by preference (lower first)

    // Allocate z-indices incrementally: baseZIndex, baseZIndex+1, baseZIndex+2, etc.
    // The map-layers service ensures proper separation between layers by tracking cumulative offsets
    selectedElevationsWithPreference.forEach((item, index) => {
      const elevationZIndex = absoluteZIndex + index;
      const elevationId = item.elevationId;

      // Use elevation-specific opacity if available, otherwise use targetOpacity
      const elevationOpacity = controls.elevation.elevationOpacity[elevationId];
      const opacity = elevationOpacity !== undefined ? elevationOpacity : targetOpacity;

      // Current visible frame for this elevation
      const tileLayer = this.createRadarTileLayerForElevation(layerId, controls, elevationId);
      this.applyLayerStyles(tileLayer, opacity, elevationZIndex);
      result.set(`${layerId}#${elevationId}#${currentTimeIndex}`, tileLayer);

      // Pre-render next N frames at opacity=0 for this elevation
      this.prerenderNextFrames(
        result,
        currentTimeIndex,
        totalFrames,
        controls.playback.imageCount,
        elevationZIndex,
        false,
        (adjIndex) => {
          const adjLayer = this.createRadarTileLayerForElevationAtTimeIndex(
            layerId,
            controls,
            elevationId,
            adjIndex,
          );
          return { layer: adjLayer, key: `${layerId}#${elevationId}#${adjIndex}` };
        },
      );
    });

    return result;
  }

  /**
   * Creates a Leaflet TileLayer for an ECMWF layer with a specific forecast run.
   */
  createEcmwfTpTileLayerForForecast(
    layerId: string,
    controls: EcmwfTpLayerControls,
    forecastTs: string,
    periodTs: string,
  ): L.TileLayer {
    const poolKey = `${layerId}-${forecastTs}-${periodTs}`;

    if (this.layerPool.has(poolKey)) {
      return this.layerPool.get(poolKey)!;
    }

    const layer = this.layersService.getLayerById(layerId);
    if (!layer || layer.type !== LayerType.TILE || layer.category !== LayerCategory.ECMWF_TP) {
      throw new Error(`Invalid ECMWF layer: '${layerId}'`);
    }

    const pathToTileset = `${layerId}/${forecastTs}/${periodTs}`;
    const tileLayer = this.buildTileLayer(
      buildTileUrl(pathToTileset),
      layer as unknown as TileLayer,
      controls.opacity,
    );
    this.attachErrorHandlers(tileLayer, layerId, forecastTs, this.formatForecastLabel(forecastTs));
    this.layerPool.set(poolKey, tileLayer);
    return tileLayer;
  }

  /**
   * Creates an ECMWF tile layer for a specific forecast at a given timeIndex.
   * Used for pre-fetching adjacent frames.
   */
  createEcmwfTpTileLayerForForecastAtTimeIndex(
    layerId: string,
    controls: EcmwfTpLayerControls,
    forecastTs: string,
    timeIndex: number,
  ): L.TileLayer | null {
    const config = this.layerConfigService.getConfig(layerId) as EcmwfTpTileLayerConfig | undefined;
    if (!config) return null;

    const periodEntry = config.availableTilesets[timeIndex];
    if (!periodEntry) return null;
    const periodTs = periodEntry.id;

    // Only render if this forecast has data for this period
    const forecastsForPeriod = config.forecastsByPeriod[periodTs];
    if (!forecastsForPeriod || !forecastsForPeriod.includes(forecastTs)) return null;

    return this.createEcmwfTpTileLayerForForecast(layerId, controls, forecastTs, periodTs);
  }

  /**
   * Creates ECMWF layers for playback — one set per selected forecast run.
   * Each forecast gets its own tile layer(s) with per-forecast opacity and
   * z-index stacking.
   */
  createEcmwfTpLayersForPlayback(
    layerId: string,
    controls: EcmwfTpLayerControls,
    targetOpacity: number,
    absoluteZIndex: number,
  ): Map<string, L.TileLayer> {
    const result = new Map<string, L.TileLayer>();
    const selectedForecasts = controls.forecast.selectedForecastTimestamps;
    const currentTimeIndex = controls.playback.timeIndex ?? 0;
    const totalFrames = this.getAvailableTilesetsCount(layerId);

    const config = this.layerConfigService.getConfig(layerId) as EcmwfTpTileLayerConfig | undefined;
    if (!config || totalFrames === 0) return result;

    const currentPeriodEntry = config.availableTilesets[currentTimeIndex];
    if (!currentPeriodEntry) return result;
    const currentPeriodTs = currentPeriodEntry.id;

    const ecmwfLayer = this.layersService.getLayerById(layerId);
    // When the layer renders secondary isobars, each forecast reserves an
    // extra z-slot above its raster so the isobars can slot in just above the
    // TP tile without colliding with the next forecast (or the next layer up).
    const slotsPerForecast =
      ecmwfLayer &&
      ecmwfLayer.type === LayerType.TILE &&
      (ecmwfLayer as EcmwfTpTileLayer).secondaryRender
        ? 2
        : 1;

    selectedForecasts.forEach((forecastTs, index) => {
      const forecastZIndex = absoluteZIndex + index * slotsPerForecast;
      const forecastOpacity = controls.forecast.forecastOpacity[forecastTs];
      const opacity = forecastOpacity !== undefined ? forecastOpacity : targetOpacity;

      // Only create a tile if this forecast has data for the current period
      const forecastsForPeriod = config.forecastsByPeriod[currentPeriodTs];
      if (forecastsForPeriod && forecastsForPeriod.includes(forecastTs)) {
        const tileLayer = this.createEcmwfTpTileLayerForForecast(
          layerId,
          controls,
          forecastTs,
          currentPeriodTs,
        );
        this.applyLayerStyles(tileLayer, opacity, forecastZIndex);
        result.set(`${layerId}#${forecastTs}#${currentTimeIndex}`, tileLayer);
      }

      // Pre-render next N frames at opacity=0
      this.prerenderNextFrames(
        result,
        currentTimeIndex,
        totalFrames,
        controls.playback.imageCount,
        forecastZIndex,
        true,
        (adjIndex) => {
          const adjLayer = this.createEcmwfTpTileLayerForForecastAtTimeIndex(
            layerId,
            controls,
            forecastTs,
            adjIndex,
          );
          if (!adjLayer) return null;
          return { layer: adjLayer, key: `${layerId}#${forecastTs}#${adjIndex}` };
        },
      );
    });

    return result;
  }

  private resolveWeatherStationsValue(
    variable: WeatherStationLayer['variable'],
    observation: WeatherStationObservationLike,
  ): number | null {
    switch (variable) {
      case WeatherStationVariable.TEMPERATURE:
        return observation.weather.temperature === null
          ? null
          : convertCelsiusToKelvin(observation.weather.temperature);
      case WeatherStationVariable.FEELS_LIKE:
        return observation.weather.feels_like === null
          ? null
          : convertCelsiusToKelvin(observation.weather.feels_like);
      case WeatherStationVariable.HUMIDITY:
        return observation.weather.humidity;
      case WeatherStationVariable.PRESSURE:
        return observation.weather.pressure;
      case WeatherStationVariable.VISIBILITY:
        return observation.weather.visibility;
      case WeatherStationVariable.WIND_SPEED:
        return observation.weather.wind.speed ?? 0;
      default:
        return null;
    }
  }

  private resolveWeatherStationsColor(scale: LayerScale, value: number): string {
    switch (scale.type) {
      case ScaleType.CONTINUOUS:
        return this.interpolateContinuousWeatherStationsColor(scale.entries, value);
      case ScaleType.DISCRETE:
        return this.resolveDiscreteWeatherStationsColor(scale.entries, value);
      default:
        throw new Error(
          `Unsupported weather station scale type: '${String((scale as { type: unknown }).type)}'`,
        );
    }
  }

  private interpolateContinuousWeatherStationsColor(
    entries: readonly { value: number; color: string }[],
    value: number,
  ): string {
    if (entries.length === 0) {
      throw new Error('Invalid continuous weather station scale: no entries configured');
    }

    const sortedEntries = [...entries].sort((a, b) => a.value - b.value);
    if (value <= sortedEntries[0].value) {
      return sortedEntries[0].color;
    }

    const lastEntry = sortedEntries[sortedEntries.length - 1];
    if (value >= lastEntry.value) {
      return lastEntry.color;
    }

    for (let index = 0; index < sortedEntries.length - 1; index++) {
      const left = sortedEntries[index];
      const right = sortedEntries[index + 1];
      if (value < left.value || value > right.value) {
        continue;
      }

      const ratio = (value - left.value) / (right.value - left.value || 1);
      return this.mixWeatherStationsHexColors(left.color, right.color, ratio);
    }

    return lastEntry.color;
  }

  private resolveDiscreteWeatherStationsColor(
    entries: readonly { value: number; color: string }[],
    value: number,
  ): string {
    if (entries.length === 0) {
      throw new Error('Invalid discrete weather station scale: no entries configured');
    }

    const sorted = [...entries].sort((a, b) => a.value - b.value);
    let selected = sorted[0];
    for (const entry of sorted) {
      if (value >= entry.value) {
        selected = entry;
      }
    }
    return selected.color;
  }

  private mixWeatherStationsHexColors(startColor: string, endColor: string, ratio: number): string {
    const start = this.hexToWeatherStationsRgb(startColor);
    const end = this.hexToWeatherStationsRgb(endColor);
    const clamped = Math.max(0, Math.min(1, ratio));

    const red = Math.round(start.red + (end.red - start.red) * clamped);
    const green = Math.round(start.green + (end.green - start.green) * clamped);
    const blue = Math.round(start.blue + (end.blue - start.blue) * clamped);

    return this.weatherStationsRgbToHex(red, green, blue);
  }

  private hexToWeatherStationsRgb(color: string): { red: number; green: number; blue: number } {
    const normalized = color.replace('#', '');
    const red = Number.parseInt(normalized.slice(0, 2), 16);
    const green = Number.parseInt(normalized.slice(2, 4), 16);
    const blue = Number.parseInt(normalized.slice(4, 6), 16);
    return { red, green, blue };
  }

  private weatherStationsRgbToHex(red: number, green: number, blue: number): string {
    return `#${[red, green, blue]
      .map((component) => component.toString(16).padStart(2, '0'))
      .join('')}`;
  }

  private buildWeatherStationsPopupData(
    observation: WeatherStationObservationLike,
  ): WeatherStationPopupData {
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
    const { value: windSpeedValue, unit: windSpeedUnit } =
      this.resolveWeatherStationsWindSpeedDisplay(observation.weather.wind.speed);
    const stationName = formatText(observation.station.name);
    const province = formatText(observation.station.province);
    const windDegrees = observation.weather.wind.deg;
    const { value: temperatureValue, unit: temperatureUnit } =
      this.resolveWeatherStationsTemperatureDisplay(observation.weather.temperature);
    const { value: feelsLikeValue, unit: feelsLikeUnit } =
      this.resolveWeatherStationsTemperatureDisplay(observation.weather.feels_like);

    return {
      stationId: observation.weather.station_id ?? observation.station.id ?? 0,
      stationName,
      province,
      lat: observation.station.coord?.lat ?? null,
      lon: observation.station.coord?.lon ?? null,
      temperature: formatValue(temperatureValue, 1, ` ${temperatureUnit}`),
      feelsLike: formatValue(feelsLikeValue, 1, ` ${feelsLikeUnit}`),
      weatherDescription: formatText(observation.weather.weather?.description),
      values: [
        {
          label: 'Humedad',
          value: formatValue(observation.weather.humidity, 0, WEATHER_STATION_UNITS.HUMIDITY),
        },
        {
          label: 'Presión',
          value: formatValue(observation.weather.pressure, 1, ` ${WEATHER_STATION_UNITS.PRESSURE}`),
        },
        {
          label: 'Visibilidad',
          value: formatValue(
            observation.weather.visibility,
            1,
            ` ${WEATHER_STATION_UNITS.VISIBILITY}`,
          ),
        },
      ],
      wind: {
        speed: calmWind ? '0' : formatValue(windSpeedValue, 0, ''),
        unit: windSpeedUnit,
        deg:
          windDegrees === null || windDegrees === undefined || Number.isNaN(windDegrees)
            ? null
            : Math.round(windDegrees),
        direction: formatText(observation.weather.wind.direction),
      },
      updatedAt: formatDateTimeLocalized(new Date(observation.weather.date)),
    };
  }

  private createWeatherStationsPopupElement(data: WeatherStationPopupData): {
    element: HTMLElement;
    destroy: () => void;
  } {
    const componentRef = createComponent(WeatherStationPopupComponent, {
      environmentInjector: this.environmentInjector,
    });

    componentRef.setInput('data', data);
    this.appRef.attachView(componentRef.hostView);
    componentRef.changeDetectorRef.detectChanges();

    return {
      element: componentRef.location.nativeElement as HTMLElement,
      destroy: () => {
        this.appRef.detachView(componentRef.hostView);
        componentRef.destroy();
      },
    };
  }

  private resolveWeatherStationsDisplayValueAndUnit(
    value: number,
    sourceUnit: string,
  ): { displayValue: number; displayUnit: string } {
    const displayValue = convertValueForDisplay(value, sourceUnit, this.unitsSettings);
    const displayUnit = getDisplayUnit(sourceUnit, this.unitsSettings);
    return { displayValue, displayUnit };
  }

  private resolveWeatherStationsTemperatureDisplay(value: number | null): {
    value: number | null;
    unit: string;
  } {
    if (value === null || Number.isNaN(value)) {
      return {
        value: null,
        unit: getDisplayUnit(TEMPERATURE_UNITS.CELSIUS, this.unitsSettings),
      };
    }

    const displayValue = convertValueForDisplay(
      value,
      TEMPERATURE_UNITS.CELSIUS,
      this.unitsSettings,
    );
    const unit = getDisplayUnit(TEMPERATURE_UNITS.CELSIUS, this.unitsSettings);
    return { value: displayValue, unit };
  }

  private resolveWeatherStationsWindSpeedDisplay(value: number | null): {
    value: number | null;
    unit: string;
  } {
    if (value === null || Number.isNaN(value)) {
      return {
        value: null,
        unit: getDisplayUnit(WEATHER_STATION_UNITS.WIND_SPEED, this.unitsSettings),
      };
    }

    const displayValue = convertValueForDisplay(
      value,
      WEATHER_STATION_UNITS.WIND_SPEED,
      this.unitsSettings,
    );
    const unit = getDisplayUnit(WEATHER_STATION_UNITS.WIND_SPEED, this.unitsSettings);
    return { value: displayValue, unit };
  }

  private applyWeatherStationsPaneZIndex(map: L.Map, actualZIndex?: number): void {
    if (actualZIndex === undefined) {
      return;
    }

    const pane = map.getPane(WEATHER_STATION_PANE);
    if (!pane) {
      return;
    }

    pane.style.zIndex = String(actualZIndex);
  }

  /**
   * Crea un L.TileLayer WRF para una corrida (init_tag) y paso (fxxx).
   * El productId se infiere del WrfTileLayer (capa).
   */
  createWrfTileLayerForForecast(
    layerId: string,
    controls: WrfLayerControls,
    initTag: string,
    fxxx: string,
  ): L.TileLayer {
    const poolKey = `${layerId}-${initTag}-${fxxx}`;
    if (this.layerPool.has(poolKey)) {
      return this.layerPool.get(poolKey)!;
    }

    const layer = this.layersService.getLayerById(layerId);
    if (!layer || layer.type !== LayerType.TILE || layer.category !== LayerCategory.WRF) {
      throw new Error(`Invalid WRF layer: '${layerId}'`);
    }

    const wrfLayer = layer as WrfTileLayer;
    const tileUrl = buildWrfTileUrl(wrfLayer.productId, initTag, fxxx);
    const tileLayer = this.buildTileLayer(tileUrl, layer as TileLayer, controls.opacity);
    this.attachErrorHandlers(tileLayer, layerId, initTag, this.formatForecastLabel(initTag));
    this.layerPool.set(poolKey, tileLayer);
    return tileLayer;
  }

  /**
   * Crea un tile WRF para un forecast en un timeIndex dado (prefetch frames).
   */
  createWrfTileLayerForForecastAtTimeIndex(
    layerId: string,
    controls: WrfLayerControls,
    initTag: string,
    timeIndex: number,
  ): L.TileLayer | null {
    const config = this.layerConfigService.getConfig(layerId) as WrfTileLayerConfig | undefined;
    if (!config) return null;

    const stepEntry = config.availableTilesets[timeIndex];
    if (!stepEntry) return null;

    // entry.id es el instante absoluto (epoch); forecastsByPeriod indica qué
    // corridas tienen un paso ahí, y el fxxx concreto se deriva por corrida.
    const forecastsForStep = config.forecastsByPeriod[stepEntry.id];
    if (!forecastsForStep || !forecastsForStep.includes(initTag)) return null;

    const fxxx = wrfFxxxForInitAndTime(initTag, stepEntry.time);
    if (!fxxx) return null;

    return this.createWrfTileLayerForForecast(layerId, controls, initTag, fxxx);
  }

  /**
   * Crea capas WRF para playback — un set por cada corrida seleccionada.
   * Espejo de createEcmwfTpLayersForPlayback.
   */
  createWrfLayersForPlayback(
    layerId: string,
    controls: WrfLayerControls,
    targetOpacity: number,
    absoluteZIndex: number,
  ): Map<string, L.TileLayer> {
    const result = new Map<string, L.TileLayer>();
    const selectedForecasts = controls.forecast.selectedForecastTimestamps;
    const currentTimeIndex = controls.playback.timeIndex ?? 0;
    const totalFrames = this.getAvailableTilesetsCount(layerId);

    const config = this.layerConfigService.getConfig(layerId) as WrfTileLayerConfig | undefined;
    if (!config || totalFrames === 0) return result;

    const currentEntry = config.availableTilesets[currentTimeIndex];
    if (!currentEntry) return result;
    const forecastsForStep = config.forecastsByPeriod[currentEntry.id];

    selectedForecasts.forEach((initTag, index) => {
      const forecastZIndex = absoluteZIndex + index;
      const forecastOpacity = controls.forecast.forecastOpacity[initTag];
      const opacity = forecastOpacity !== undefined ? forecastOpacity : targetOpacity;

      const fxxx = wrfFxxxForInitAndTime(initTag, currentEntry.time);
      if (fxxx && forecastsForStep && forecastsForStep.includes(initTag)) {
        const tileLayer = this.createWrfTileLayerForForecast(layerId, controls, initTag, fxxx);
        this.applyLayerStyles(tileLayer, opacity, forecastZIndex);
        result.set(`${layerId}#${initTag}#${currentTimeIndex}`, tileLayer);
      }

      this.prerenderNextFrames(
        result,
        currentTimeIndex,
        totalFrames,
        controls.playback.imageCount,
        forecastZIndex,
        true,
        (adjIndex) => {
          const adjLayer = this.createWrfTileLayerForForecastAtTimeIndex(
            layerId,
            controls,
            initTag,
            adjIndex,
          );
          if (!adjLayer) return null;
          return { layer: adjLayer, key: `${layerId}#${initTag}#${adjIndex}` };
        },
      );
    });

    return result;
  }

  /**
   * Applies opacity and z-index styles to a tile layer.
   */
  private applyLayerStyles(layer: L.TileLayer, opacity: number, zIndex: number): void {
    layer.setOpacity(opacity);
    layer.setZIndex(zIndex);
  }

  /**
   * Pre-renders next N frames at opacity=0 for smooth playback transitions.
   * Uses modular arithmetic to wrap around the animation window.
   */
  private prerenderNextFrames(
    result: Map<string, L.TileLayer>,
    currentTimeIndex: number,
    totalFrames: number,
    imageCount: number,
    absoluteZIndex: number,
    isForecast: boolean,
    createLayer: (timeIndex: number) => { layer: L.TileLayer; key: string } | null,
  ): void {
    const minTimeIndex = computeWindowStart(totalFrames, imageCount, isForecast);
    const windowSize = Math.min(imageCount, totalFrames - minTimeIndex);

    if (windowSize > 1) {
      for (let offset = 1; offset <= MAP_CONFIG.prerenderNextFrames; offset++) {
        const posInWindow = currentTimeIndex - minTimeIndex;
        const adjPosInWindow = (((posInWindow + offset) % windowSize) + windowSize) % windowSize;
        const adjIndex = minTimeIndex + adjPosInWindow;

        const created = createLayer(adjIndex);
        if (!created) continue;
        this.applyLayerStyles(created.layer, 0, absoluteZIndex);
        result.set(created.key, created.layer);
      }
    }
  }

  /**
   * Cleans old layers from the pool that are not in use.
   * @param activeKeys Set of keys (layerId-tilesetId) that MUST be kept
   */
  prunePool(activeKeys: Set<string>): void {
    for (const [key] of this.layerPool) {
      if (!activeKeys.has(key)) {
        this.layerPool.delete(key);
      }
    }
  }

  // ============================================================================
  // Private Methods - Tile Layer Factory
  // ============================================================================

  /**
   * Generates a unique pool key for a layer based on its data (not visual properties).
   * The key should change only when the actual tile data changes, not when visual
   * properties like opacity change.
   */
  private generatePoolKey(layerId: string, controls: LayerControls): string {
    const layer = this.layersService.getLayerById(layerId);
    if (!layer) return layerId;

    switch (layer.type) {
      case LayerType.TILE: {
        const tileControls = controls as TileLayerControls;
        switch (layer.category) {
          case LayerCategory.GOES_19: {
            const goesControls = tileControls as GoesLayerControls;
            const config = this.layerConfigService.getConfig(layerId) as
              | GoesTileLayerConfig
              | undefined;
            if (!config) return `${layerId}-placeholder`;

            const tilesets = config.availableTilesets;
            if (tilesets.length === 0) return `${layerId}-empty`;

            const timeIndex =
              goesControls.playback.timeIndex ??
              getDefaultCursorIndex(tilesets.length, layer.isForecast);

            // Clamp timeIndex to valid range for pool key generation
            const clampedIndex = Math.max(0, Math.min(timeIndex, tilesets.length - 1));
            const tilesetId = tilesets[clampedIndex].id;
            return `${layerId}-${tilesetId}`;
          }
          case LayerCategory.RADAR: {
            const radarControls = tileControls as RadarLayerControls;
            const config = this.layerConfigService.getConfig(layerId) as
              | RadarTileLayerConfig
              | undefined;
            if (!config) return `${layerId}-placeholder`;

            const selectedElevationIds = radarControls.elevation.selectedElevationIds;
            // Pool key includes all selected elevations to detect changes
            const elevationsKey = selectedElevationIds.sort().join(',');

            const tilesets = config.availableTilesets;
            if (tilesets.length === 0) return `${layerId}-empty`;

            const timeIndex =
              radarControls.playback.timeIndex ??
              getDefaultCursorIndex(tilesets.length, layer.isForecast);

            // Clamp timeIndex to valid range for pool key generation
            const clampedIndex = Math.max(0, Math.min(timeIndex, tilesets.length - 1));
            const tilesetId = tilesets[clampedIndex].id;
            return `${layerId}-[${elevationsKey}]-${tilesetId}`;
          }
          case LayerCategory.ECMWF_TP: {
            const ecmwfControls = tileControls as EcmwfTpLayerControls;
            const config = this.layerConfigService.getConfig(layerId) as
              | EcmwfTpTileLayerConfig
              | undefined;
            if (!config) return `${layerId}-placeholder`;

            const tilesets = config.availableTilesets;
            if (tilesets.length === 0) return `${layerId}-empty`;

            const ecmwfLayer = layer as EcmwfTpTileLayer;
            const timeIndex = Math.max(
              0,
              Math.min(
                ecmwfControls.playback.timeIndex ??
                  getDefaultCursorIndex(tilesets.length, ecmwfLayer.isForecast),
                tilesets.length - 1,
              ),
            );
            const forecastsKey = ecmwfControls.forecast.selectedForecastTimestamps.join(',');
            return `${layerId}-[${forecastsKey}]-${tilesets[timeIndex].id}`;
          }
          case LayerCategory.WRF: {
            const wrfControls = tileControls as WrfLayerControls;
            const config = this.layerConfigService.getConfig(layerId) as
              | WrfTileLayerConfig
              | undefined;
            if (!config) return `${layerId}-placeholder`;

            const tilesets = config.availableTilesets;
            if (tilesets.length === 0) return `${layerId}-empty`;

            const wrfLayer = layer as WrfTileLayer;
            const timeIndex = Math.max(
              0,
              Math.min(
                wrfControls.playback.timeIndex ??
                  getDefaultCursorIndex(tilesets.length, wrfLayer.isForecast),
                tilesets.length - 1,
              ),
            );
            const forecastsKey = wrfControls.forecast.selectedForecastTimestamps.join(',');
            return `${layerId}-[${forecastsKey}]-${tilesets[timeIndex].id}`;
          }
          default:
            return layerId;
        }
      }
      case LayerType.WMS: {
        const wmsLayer = layer as WmsLayer;
        return `${layerId}-${wmsLayer.wmsLayerName}`;
      }
      default:
        return layerId;
    }
  }

  /**
   * Creates a data tile layer (GOES, Radar, etc.) based on category.
   * Note: For radar layers with multiple elevations, use createRadarTileLayerForElevation instead.
   */
  private createDataTileLayer(layerId: string, controls: TileLayerControls): L.TileLayer {
    const layer = this.layersService.getLayerById(layerId);
    if (!layer || layer.type !== LayerType.TILE) {
      throw new Error(`Layer ${layerId} is not a TILE layer`);
    }

    switch (layer.category) {
      case LayerCategory.GOES_19:
        return this.createGoesTileLayer(layerId, controls as GoesLayerControls);
      case LayerCategory.RADAR:
        // Radar layers should be created via createRadarTileLayerForElevation in map-viewer
        throw new Error(
          `Radar layer ${layerId} should be created using createRadarTileLayerForElevation`,
        );
      case LayerCategory.ECMWF_TP:
        throw new Error(
          `ECMWF layer ${layerId} should be created using createEcmwfTpTileLayerForForecast`,
        );
      case LayerCategory.WRF:
        throw new Error(
          `WRF layer ${layerId} should be created using createWrfTileLayerForForecast`,
        );
      default:
        throw new Error(`Unsupported tile layer category for layer ${layerId}`);
    }
  }

  /**
   * Creates a WMS layer based on category.
   *
   * Returns the parent `L.TileLayer` type because some categories (IGN
   * layers backed up by the data-service) render as plain XYZ tiles
   * instead of going through `L.TileLayer.WMS`.
   */
  private createWmsLayer(layerId: string, controls: WmsLayerControls): L.TileLayer {
    const layer = this.layersService.getLayerById(layerId);
    if (!layer || layer.type !== LayerType.WMS) {
      throw new Error(`Layer ${layerId} is not a WMS layer`);
    }

    const wmsLayer = layer as WmsLayer;

    switch (wmsLayer.category) {
      case LayerCategory.IGN_WMS:
        if (IGN_WMS_BACKED_UP_LAYER_IDS.has(wmsLayer.id)) {
          return this.createIgnCachedTileLayer(wmsLayer, controls);
        }
        return this.createIgnWmsLayer(wmsLayer, controls);
      default:
        throw new Error(`Unsupported WMS layer category for layer ${layerId}`);
    }
  }

  // ============================================================================
  // Private Methods - GOES Layer Creation
  // ============================================================================

  /**
   * Creates a tile layer for GOES-19 satellite imagery.
   * Reads configuration from LayerConfigService to get available tilesets.
   *
   * Returns a placeholder layer if configuration is not yet loaded.
   */
  private createGoesTileLayer(layerId: string, controls: GoesLayerControls): L.TileLayer {
    const layer = this.layersService.getLayerById(layerId);

    if (!layer || layer.type !== LayerType.TILE || layer.category !== LayerCategory.GOES_19) {
      throw new Error(`Invalid GOES layer: '${layerId}'`);
    }

    const tilesetId = this.getTilesetId(layerId, layer, controls.playback.timeIndex);

    const pathToTileset = `${layerId}/${tilesetId}`;
    const tileUrl = buildTileUrl(pathToTileset);

    const tileLayer = this.buildTileLayer(tileUrl, layer, controls.opacity);
    this.attachErrorHandlers(tileLayer, layerId);
    return tileLayer;
  }

  /**
   * Formats a forecast timestamp for display in error messages.
   */
  private formatForecastLabel(forecastTs: string): string {
    if (forecastTs.length >= 13) {
      return `${forecastTs.substring(0, 4)}-${forecastTs.substring(4, 6)}-${forecastTs.substring(6, 8)} ${forecastTs.substring(9, 11)}:${forecastTs.substring(11, 13)}`;
    }
    return forecastTs;
  }

  // ============================================================================
  // Private Methods - Radar Layer Creation
  // ============================================================================

  /**
   * Creates a tile layer for radar imagery with a specific elevation.
   * Reads configuration from LayerConfigService to get available tilesets (shared across elevations).
   * Uses the elevation-specific opacity if available, otherwise uses the layer's global opacity.
   *
   * @throws Error if layer not found or not a TILE layer
   */
  private createRadarTileLayer(
    layerId: string,
    controls: RadarLayerControls,
    elevationId: string,
  ): L.TileLayer {
    const layer = this.layersService.getLayerById(layerId);

    if (!layer || layer.type !== LayerType.TILE) {
      throw new Error(`Layer ${layerId} is not a TILE layer`);
    }

    const radarLayer = layer as RadarTileLayer;

    // Find the elevation object by ID
    const elevation = radarLayer.availableElevations.find((e) => e.id === elevationId);
    if (!elevation) {
      throw new Error(`Elevation '${elevationId}' not found for layer '${layerId}'`);
    }

    const tilesetId = this.getTilesetId(layerId, layer, controls.playback.timeIndex);
    const pathToTileset = `${layerId}/${elevation.id}/${tilesetId}`;
    const tileUrl = buildTileUrl(pathToTileset);

    // Use elevation-specific opacity if available, otherwise use layer's global opacity
    const elevationOpacity = controls.elevation.elevationOpacity[elevationId];
    const opacity = elevationOpacity !== undefined ? elevationOpacity : controls.opacity;

    const tileLayer = this.buildTileLayer(tileUrl, layer, opacity);
    this.attachErrorHandlers(tileLayer, layerId, elevationId, elevation.name);
    return tileLayer;
  }

  // ============================================================================
  // Private Methods - WMS Layer Creation
  // ============================================================================

  /**
   * Creates a WMS tile layer for IGN (Instituto Geográfico Nacional) layers.
   * Uses configured WMS workspace or defaults to main IGN endpoint.
   */
  private createIgnWmsLayer(layer: WmsLayer, controls: WmsLayerControls): L.TileLayer.WMS {
    const url = layer.wmsWorkspace
      ? IGN_WMS_WORKSPACE_URLS[layer.wmsWorkspace] || IGN_WMS_BASE_CONFIG.defaultUrl
      : IGN_WMS_BASE_CONFIG.defaultUrl;

    const wmsLayer = L.tileLayer.wms(url, {
      layers: layer.wmsLayerName,
      format: IGN_WMS_BASE_CONFIG.format,
      transparent: IGN_WMS_BASE_CONFIG.transparent,
      version: IGN_WMS_BASE_CONFIG.version,
      crs: L.CRS.EPSG3857,
      opacity: controls.opacity,
    });

    this.attachErrorHandlers(wmsLayer, layer.id);
    return wmsLayer;
  }

  /**
   * Creates a plain XYZ TileLayer pointing at the data-service basemap
   * endpoint for IGN layers that are pre-scraped and cached server-side.
   *
   * The data-service does prod-first internally (upstream WMS → Redis →
   * S3), so the frontend doesn't need a manual WMS fallback — every miss
   * is already absorbed by the cache chain or relayed live.
   */
  private createIgnCachedTileLayer(layer: WmsLayer, controls: WmsLayerControls): L.TileLayer {
    const tileUrl = buildBasemapTileUrl(layer.id);
    const tileLayer = L.tileLayer(tileUrl, {
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
      noWrap: false,
      opacity: controls.opacity,
      attribution: IGN_WMS_BASE_CONFIG.attribution,
    });
    this.attachErrorHandlers(tileLayer, layer.id);
    return tileLayer;
  }

  // ============================================================================
  // Private Methods - Utilities
  // ============================================================================

  /**
   * Gets the tilesetId for the current playback state and handles fetching config if not available.
   *
  /**
   * Gets the tileset ID for a tile layer at a specific time index.
   * @throws Error if config not loaded or invalid time index
   */
  private getTilesetId(layerId: string, layer: TileLayer, timeIndex: number | undefined): string {
    const config = this.layerConfigService.getConfig(layerId) as
      | RadarTileLayerConfig
      | GoesTileLayerConfig
      | EcmwfTpTileLayerConfig
      | undefined;

    if (!config) {
      const categoryName =
        layer.category === LayerCategory.RADAR
          ? 'Radar'
          : layer.category === LayerCategory.ECMWF_TP
            ? 'ECMWF'
            : 'GOES';
      throw new Error(`Configuration not loaded for ${categoryName} layer '${layerId}'`);
    }

    // Get the tileset ID for the current time index
    const tilesets = config.availableTilesets;
    if (!tilesets || tilesets.length === 0) {
      throw new Error(`No tilesets available for layer '${layerId}'`);
    }

    // If timeIndex is undefined, fall back to the layer's default cursor.
    const resolvedTimeIndex = timeIndex ?? getDefaultCursorIndex(tilesets.length, layer.isForecast);

    if (resolvedTimeIndex >= tilesets.length || resolvedTimeIndex < 0) {
      throw new Error(
        `Invalid time index ${resolvedTimeIndex} for layer '${layerId}' (available: 0-${tilesets.length - 1})`,
      );
    }

    return tilesets[resolvedTimeIndex].id;
  }

  /**
   * Builds a Leaflet TileLayer with common options and layer-specific configuration.
   *
   * @param tileUrl - The URL template for tiles
   * @param layer - The layer configuration
   * @param opacity - Optional opacity override (0-1)
   * @param extraOptions - Additional Leaflet tile layer options
   * @returns Configured Leaflet TileLayer
   */
  private buildTileLayer(
    tileUrl: string,
    layer: TileLayer,
    opacity?: number,
    extraOptions?: L.TileLayerOptions,
  ): L.TileLayer {
    const baseOptions = this.createBaseTileLayerOptions(opacity);
    return L.tileLayer(tileUrl, {
      ...baseOptions,
      minNativeZoom: layer.minNativeZoom,
      maxNativeZoom: layer.maxNativeZoom,
      bounds: layer.boundingBox as L.LatLngBoundsExpression | undefined,
      tms: layer.tms ?? false,
      ...extraOptions,
    });
  }

  /**
   * Creates base tile layer options using global map configuration.
   * These options are common to all tile layers.
   */
  private createBaseTileLayerOptions(opacity?: number): L.TileLayerOptions {
    return {
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
      noWrap: true,
      opacity: opacity,
    };
  }

  /**
   * Attaches error and success handlers to a tile layer for monitoring.
   * Tracks errors and shows user notifications after repeated failures.
   * @param tileLayer - The Leaflet tile layer to attach handlers to
   * @param layerId - The base layer ID
   * @param elevationId - Optional elevation ID for radar layers (used for error tracking)
   * @param elevationName - Optional elevation name for display in error messages
   */
  private attachErrorHandlers(
    tileLayer: L.TileLayer,
    layerId: string,
    elevationId?: string,
    elevationName?: string,
  ): void {
    // Use base layerId for display name lookup
    const baseLayerName = this.layersService.getLayerDisplayName(layerId);

    // Construct display name with elevation info if provided
    const layerName = elevationName ? `${baseLayerName} (${elevationName})` : baseLayerName;

    // Use composite key for error tracking when elevation is provided
    const trackingKey = elevationId ? `${layerId}#${elevationId}` : layerId;

    let errorCount = 0;

    tileLayer.on('tileerror', (error: L.TileErrorEvent) => {
      errorCount++;
      console.warn(
        `Error loading tile for ${layerName}:`,
        error.error,
        `(${errorCount}/${this.MAX_ERRORS_BEFORE_NOTIFY})`,
      );

      // After several consecutive errors, surface the issue.
      if (errorCount >= this.MAX_ERRORS_BEFORE_NOTIFY) {
        // Ask the health service to probe /health. If the data-service
        // itself is down, this raises a single global banner so we can
        // skip the per-layer toast and avoid notification spam across
        // every active layer.
        this.healthService.reportFailure();

        if (!this.healthService.isAvailable()) {
          errorCount = 0;
          return;
        }

        const currentErrors = this.errorTracker.get(trackingKey) || 0;

        // Only notify once to avoid spam
        if (currentErrors === 0) {
          this.notificationService.error(
            `La capa "${layerName}" no está disponible temporalmente. Verificá la conexión con el servidor.`,
            trackingKey,
          );
        }

        this.errorTracker.set(trackingKey, currentErrors + 1);
        errorCount = 0; // Reset for next batch
      }
    });

    // If tiles start loading successfully, reset error tracking
    tileLayer.on('tileload', () => {
      if (errorCount > 0) {
        errorCount = Math.max(0, errorCount - 1);
      }

      // If there were previous errors, clear them and log recovery
      if (this.errorTracker.has(trackingKey)) {
        console.info(`✅ Layer ${layerName} recovered`);
        this.errorTracker.delete(trackingKey);
      }
    });
  }
}

type WeatherStationObservationLike = {
  // Optional so the renderer's structural type stays compatible with snapshots
  // that pre-date the field. When absent the renderer treats the station as
  // having data (true).
  hasData?: boolean;
  station: {
    coord: {
      lat: number;
      lon: number;
    };
    id?: number | null;
    name: string | null;
    province: string | null;
  };
  weather: {
    date: string;
    station_id?: number | null;
    temperature: number | null;
    feels_like: number | null;
    humidity: number | null;
    pressure: number | null;
    visibility: number | null;
    weather: {
      id: number | null;
      description: string | null;
    };
    wind: {
      speed: number | null;
      deg: number | null;
      direction: string | null;
    };
  };
};

enum WeatherStationRenderLevel {
  DOT = 'dot',
  CIRCLE = 'circle',
  BADGE = 'badge',
}
