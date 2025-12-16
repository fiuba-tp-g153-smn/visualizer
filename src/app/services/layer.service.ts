import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

export enum LayerType {
  POINT = 'point', // Capas con elementos puntuales (estaciones, aeropuertos, etc.)
  RASTER = 'raster', // Imágenes satelitales, radar
  VECTOR = 'vector', // Campos vectoriales (viento, corrientes)
}

export enum LayerCategory {
  SATELLITE_ABI = 'satellite_abi',
  SATELLITE_GLM = 'satellite_glm',
  RADAR = 'radar',
  EMAS = 'emas',
  CONVENTIONAL_STATIONS = 'conventional_stations',
  NUMERICAL_MODELS = 'numerical_models',
}

export interface Layer {
  id: string;
  name: string;
  description?: string;
  type: LayerType;
  category: LayerCategory;
  visible: boolean;
  opacity: number; // 0-100
  selectedForecastHour?: number; // Plazo de pronóstico seleccionado actualmente

  // Metadata específica del tipo de capa
  metadata?: {
    frequency?: string;
    animationFrames?: number;
    updateInterval?: string;
    forecastHours?: number[]; // Plazos de pronóstico disponibles (para modelos numéricos)
  };
}

// Subgrupo: nivel 2 de agrupamiento (contiene capas)
export interface LayerSubgroup {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  layers: Layer[];
  expanded: boolean;
}

// Grupo principal: nivel 1 de agrupamiento (contiene subgrupos)
export interface LayerGroup {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  subgroups: LayerSubgroup[];
  expanded: boolean;
}

// Capa activa con información extra para el panel de organización
export interface ActiveLayer extends Layer {
  groupName: string;
  subgroupName: string;
  zIndex: number;
}

@Injectable({
  providedIn: 'root',
})
export class LayerService {
  // Estado reactivo de los grupos de capas
  private layerGroups = signal<LayerGroup[]>(this.initializeLayerGroups());

  // Orden de las capas activas (por z-index)
  private activeLayerOrder = signal<string[]>([]);

  // Control de tiempo global
  private _globalTimeIndex = signal<number>(0);
  private _isPlaying = signal<boolean>(false);
  private playIntervalId: any = null;

  // Eventos
  private layerOrderChanged$ = new Subject<ActiveLayer[]>();
  private globalTimeChanged$ = new Subject<number>();

  // Métodos para acceder al estado
  getLayerGroups = this.layerGroups.asReadonly();
  globalTimeIndex = this._globalTimeIndex.asReadonly();
  isPlaying = this._isPlaying.asReadonly();

  // Computed: capas activas ordenadas
  activeLayers = computed<ActiveLayer[]>(() => {
    const groups = this.layerGroups();
    const order = this.activeLayerOrder();
    const activeLayers: ActiveLayer[] = [];

    for (const group of groups) {
      for (const subgroup of group.subgroups) {
        for (const layer of subgroup.layers) {
          if (layer.visible) {
            const orderIndex = order.indexOf(layer.id);
            activeLayers.push({
              ...layer,
              groupName: group.name,
              subgroupName: subgroup.name,
              zIndex: orderIndex >= 0 ? order.length - orderIndex : 0,
            });
          }
        }
      }
    }

    // Ordenar por posición en activeLayerOrder (el primero tiene mayor z-index)
    return activeLayers.sort((a, b) => b.zIndex - a.zIndex);
  });

  // Observables
  onLayerOrderChanged() {
    return this.layerOrderChanged$.asObservable();
  }

  onGlobalTimeChanged() {
    return this.globalTimeChanged$.asObservable();
  }

  private initializeLayerGroups(): LayerGroup[] {
    return [
      // ==================== SATÉLITE ====================
      {
        id: 'satellite',
        name: 'Satélite',
        description: 'Productos satelitales GOES-19',
        icon: 'satellite_alt',
        expanded: false,
        subgroups: [
          {
            id: 'satellite_abi',
            name: 'GOES-19 ABI',
            description: 'Advanced Baseline Imager',
            icon: 'satellite',
            expanded: false,
            layers: [
              {
                id: 'abi_cloud_tops',
                name: 'Topes nubosos',
                description: 'Canal 13 - Actualización cada 10 minutos',
                type: LayerType.RASTER,
                category: LayerCategory.SATELLITE_ABI,
                visible: false,
                opacity: 80,
                metadata: {
                  frequency: '10 minutos',
                  animationFrames: 24,
                  updateInterval: '10min',
                },
              },
              {
                id: 'abi_water_vapor',
                name: 'Vapor de agua',
                description: 'Canal 09 - Niveles medios',
                type: LayerType.RASTER,
                category: LayerCategory.SATELLITE_ABI,
                visible: false,
                opacity: 80,
                metadata: {
                  frequency: '10 minutos',
                  animationFrames: 24,
                },
              },
              {
                id: 'abi_visible',
                name: 'Visible',
                description: 'Canal 02',
                type: LayerType.RASTER,
                category: LayerCategory.SATELLITE_ABI,
                visible: false,
                opacity: 80,
                metadata: {
                  frequency: '10 minutos',
                  animationFrames: 24,
                },
              },
            ],
          },
          {
            id: 'satellite_glm',
            name: 'GOES-19 GLM',
            description: 'Geostationary Lightning Mapper',
            icon: 'flash_on',
            expanded: false,
            layers: [
              {
                id: 'glm_group_density',
                name: 'Densidad de grupo',
                type: LayerType.RASTER,
                category: LayerCategory.SATELLITE_GLM,
                visible: false,
                opacity: 80,
                metadata: {
                  frequency: '10 minutos',
                  animationFrames: 24,
                },
              },
              {
                id: 'glm_fed',
                name: 'FED',
                description: 'Flash Extended Density',
                type: LayerType.RASTER,
                category: LayerCategory.SATELLITE_GLM,
                visible: false,
                opacity: 80,
              },
              {
                id: 'glm_toe',
                name: 'TOE',
                description: 'Total Optical Energy',
                type: LayerType.RASTER,
                category: LayerCategory.SATELLITE_GLM,
                visible: false,
                opacity: 80,
              },
              {
                id: 'glm_mfa',
                name: 'MFA',
                description: 'Minimum Flash Area',
                type: LayerType.RASTER,
                category: LayerCategory.SATELLITE_GLM,
                visible: false,
                opacity: 80,
              },
            ],
          },
        ],
      },

      // ==================== RADARES ====================
      {
        id: 'radar',
        name: 'Radares',
        description: 'Red de radares meteorológicos',
        icon: 'radar',
        expanded: false,
        subgroups: [
          {
            id: 'radar_rma1',
            name: 'RMA1 - Córdoba',
            description: 'PPIs a 0.5°, 0.9° y 1.3°',
            icon: 'radar',
            expanded: false,
            layers: [
              {
                id: 'radar_cordoba_reflectivity',
                name: 'Reflectividad Horizontal',
                type: LayerType.RASTER,
                category: LayerCategory.RADAR,
                visible: false,
                opacity: 70,
                metadata: {
                  frequency: '10 minutos',
                  animationFrames: 12,
                },
              },
              {
                id: 'radar_cordoba_zdr',
                name: 'Reflectividad Diferencial',
                type: LayerType.RASTER,
                category: LayerCategory.RADAR,
                visible: false,
                opacity: 70,
              },
              {
                id: 'radar_cordoba_kdp',
                name: 'KDP',
                type: LayerType.RASTER,
                category: LayerCategory.RADAR,
                visible: false,
                opacity: 70,
              },
            ],
          },
          {
            id: 'radar_rma2',
            name: 'RMA2 - Ezeiza',
            icon: 'radar',
            expanded: false,
            layers: [
              {
                id: 'radar_ezeiza_reflectivity',
                name: 'Reflectividad Horizontal',
                type: LayerType.RASTER,
                category: LayerCategory.RADAR,
                visible: false,
                opacity: 70,
                metadata: {
                  frequency: '10 minutos',
                  animationFrames: 12,
                },
              },
            ],
          },
          {
            id: 'radar_rma3',
            name: 'RMA3 - Las Lomitas',
            icon: 'radar',
            expanded: false,
            layers: [
              {
                id: 'radar_las_lomitas_reflectivity',
                name: 'Reflectividad Horizontal',
                type: LayerType.RASTER,
                category: LayerCategory.RADAR,
                visible: false,
                opacity: 70,
              },
            ],
          },
          {
            id: 'radar_parana',
            name: 'Paraná - AR8',
            icon: 'radar',
            expanded: false,
            layers: [
              {
                id: 'radar_parana_reflectivity',
                name: 'Reflectividad Horizontal',
                type: LayerType.RASTER,
                category: LayerCategory.RADAR,
                visible: false,
                opacity: 70,
              },
            ],
          },
        ],
      },

      // ==================== MODELOS NUMÉRICOS ====================
      {
        id: 'numerical_models',
        name: 'Modelos Numéricos',
        description: 'Pronósticos de modelos meteorológicos',
        icon: 'grid_on',
        expanded: false,
        subgroups: [
          {
            id: 'model_wrf',
            name: 'WRF-SMN',
            description: 'Weather Research and Forecasting - 4km',
            icon: 'cloud',
            expanded: false,
            layers: [
              {
                id: 'wrf_precipitation',
                name: 'Precipitación',
                description: 'Pronóstico horario',
                type: LayerType.RASTER,
                category: LayerCategory.NUMERICAL_MODELS,
                visible: false,
                opacity: 80,
                selectedForecastHour: 24,
                metadata: {
                  updateInterval: '6 horas',
                  frequency: '4km resolución',
                  forecastHours: [6, 12, 24, 48, 72],
                },
              },
              {
                id: 'wrf_wind',
                name: 'Viento a 10m',
                description: 'Magnitud del viento',
                type: LayerType.RASTER,
                category: LayerCategory.NUMERICAL_MODELS,
                visible: false,
                opacity: 80,
                selectedForecastHour: 24,
                metadata: {
                  updateInterval: '6 horas',
                  frequency: '4km resolución',
                  forecastHours: [6, 12, 24, 48, 72],
                },
              },
              {
                id: 'wrf_temperature',
                name: 'Temperatura a 2m',
                description: 'Temperatura del aire',
                type: LayerType.RASTER,
                category: LayerCategory.NUMERICAL_MODELS,
                visible: false,
                opacity: 80,
                selectedForecastHour: 24,
                metadata: {
                  updateInterval: '6 horas',
                  frequency: '4km resolución',
                  forecastHours: [6, 12, 24, 48, 72],
                },
              },
              {
                id: 'wrf_pressure',
                name: 'Presión en superficie',
                description: 'Presión atmosférica',
                type: LayerType.RASTER,
                category: LayerCategory.NUMERICAL_MODELS,
                visible: false,
                opacity: 80,
                selectedForecastHour: 24,
                metadata: {
                  updateInterval: '6 horas',
                  frequency: '4km resolución',
                  forecastHours: [6, 12, 24, 48, 72],
                },
              },
            ],
          },
          {
            id: 'model_ecmwf',
            name: 'ECMWF',
            description: 'European Centre - Open Data',
            icon: 'public',
            expanded: false,
            layers: [
              {
                id: 'ecmwf_precipitation',
                name: 'Precipitación acumulada',
                description: 'Pronóstico 24h - Argentina',
                type: LayerType.RASTER,
                category: LayerCategory.NUMERICAL_MODELS,
                visible: false,
                opacity: 80,
                metadata: {
                  updateInterval: '6 horas',
                  frequency: '0.25° resolución',
                },
              },
            ],
          },
        ],
      },

      // ==================== OBSERVACIONES ====================
      {
        id: 'observations',
        name: 'Observaciones',
        description: 'Datos observacionales en tiempo real',
        icon: 'sensors',
        expanded: false,
        subgroups: [
          {
            id: 'obs_emas',
            name: 'EMAs',
            description: 'Estaciones Meteorológicas Automáticas',
            icon: 'cell_tower',
            expanded: false,
            layers: [
              {
                id: 'emas_temperature',
                name: 'Temperatura',
                description: 'Datos en tiempo real',
                type: LayerType.POINT,
                category: LayerCategory.EMAS,
                visible: false,
                opacity: 100,
              },
              {
                id: 'emas_precipitation',
                name: 'Precipitación',
                description: 'Acumulado de precipitación',
                type: LayerType.POINT,
                category: LayerCategory.EMAS,
                visible: false,
                opacity: 100,
              },
              {
                id: 'emas_wind',
                name: 'Viento',
                description: 'Velocidad y dirección',
                type: LayerType.VECTOR,
                category: LayerCategory.EMAS,
                visible: false,
                opacity: 100,
              },
            ],
          },
          {
            id: 'obs_conventional',
            name: 'Estaciones Convencionales',
            description: 'SYNOP y METAR/SPECI',
            icon: 'location_on',
            expanded: false,
            layers: [
              {
                id: 'synop',
                name: 'SYNOP',
                description: 'Estaciones sinópticas',
                type: LayerType.POINT,
                category: LayerCategory.CONVENTIONAL_STATIONS,
                visible: false,
                opacity: 100,
              },
              {
                id: 'metar',
                name: 'METAR/SPECI',
                description: 'Reportes aeronáuticos',
                type: LayerType.POINT,
                category: LayerCategory.CONVENTIONAL_STATIONS,
                visible: false,
                opacity: 100,
              },
            ],
          },
        ],
      },
    ];
  }

  // Métodos para manipular las capas
  toggleLayerVisibility(layerId: string): void {
    // Obtener estado actual para saber si estamos activando o desactivando
    const currentLayer = this.getLayerById(layerId);
    const wasVisible = currentLayer?.visible ?? false;

    this.layerGroups.update((groups) => {
      return groups.map((group) => ({
        ...group,
        subgroups: group.subgroups.map((subgroup) => ({
          ...subgroup,
          layers: this.toggleLayerInArray(subgroup.layers, layerId),
        })),
      }));
    });

    // Actualizar orden de capas activas
    if (wasVisible) {
      this.removeFromActiveOrder(layerId);
    } else {
      this.addToActiveOrder(layerId);
    }
  }

  private toggleLayerInArray(layers: Layer[], targetId: string): Layer[] {
    return layers.map((layer) => {
      if (layer.id === targetId) {
        return { ...layer, visible: !layer.visible };
      }
      return layer;
    });
  }

  setLayerOpacity(layerId: string, opacity: number): void {
    this.layerGroups.update((groups) => {
      return groups.map((group) => ({
        ...group,
        subgroups: group.subgroups.map((subgroup) => ({
          ...subgroup,
          layers: this.setOpacityInArray(subgroup.layers, layerId, opacity),
        })),
      }));
    });
  }

  private setOpacityInArray(layers: Layer[], targetId: string, opacity: number): Layer[] {
    return layers.map((layer) => {
      if (layer.id === targetId) {
        return { ...layer, opacity: Math.max(0, Math.min(100, opacity)) };
      }
      return layer;
    });
  }

  toggleGroupExpansion(groupId: string): void {
    this.layerGroups.update((groups) => {
      return groups.map((group) => {
        if (group.id === groupId) {
          return { ...group, expanded: !group.expanded };
        }
        // También buscar en subgrupos
        return {
          ...group,
          subgroups: group.subgroups.map((subgroup) =>
            subgroup.id === groupId ? { ...subgroup, expanded: !subgroup.expanded } : subgroup
          ),
        };
      });
    });
  }

  getActiveLayersCount(): number {
    return this.layerGroups().reduce((count, group) => {
      return (
        count +
        group.subgroups.reduce((subCount, subgroup) => {
          return subCount + subgroup.layers.filter((layer) => layer.visible).length;
        }, 0)
      );
    }, 0);
  }

  clearAllLayers(): void {
    this.layerGroups.update((groups) => {
      return groups.map((group) => ({
        ...group,
        subgroups: group.subgroups.map((subgroup) => ({
          ...subgroup,
          layers: subgroup.layers.map((layer) => ({ ...layer, visible: false })),
        })),
      }));
    });
  }

  // Cambiar el plazo de pronóstico seleccionado
  setForecastHour(layerId: string, hour: number): void {
    this.layerGroups.update((groups) => {
      return groups.map((group) => ({
        ...group,
        subgroups: group.subgroups.map((subgroup) => ({
          ...subgroup,
          layers: this.setForecastHourInArray(subgroup.layers, layerId, hour),
        })),
      }));
    });
  }

  private setForecastHourInArray(layers: Layer[], targetId: string, hour: number): Layer[] {
    return layers.map((layer) => {
      if (layer.id === targetId) {
        return { ...layer, selectedForecastHour: hour };
      }
      return layer;
    });
  }

  // Obtener una capa por ID
  getLayerById(layerId: string): Layer | undefined {
    for (const group of this.layerGroups()) {
      for (const subgroup of group.subgroups) {
        const layer = subgroup.layers.find((l) => l.id === layerId);
        if (layer) return layer;
      }
    }
    return undefined;
  }

  // ==================== GESTIÓN DE CAPAS ACTIVAS ====================

  // Mover capa arriba (mayor z-index)
  moveLayerUp(layerId: string): void {
    this.activeLayerOrder.update((order) => {
      const index = order.indexOf(layerId);
      if (index > 0) {
        const newOrder = [...order];
        [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
        return newOrder;
      }
      return order;
    });
    this.layerOrderChanged$.next(this.activeLayers());
  }

  // Mover capa abajo (menor z-index)
  moveLayerDown(layerId: string): void {
    this.activeLayerOrder.update((order) => {
      const index = order.indexOf(layerId);
      if (index >= 0 && index < order.length - 1) {
        const newOrder = [...order];
        [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
        return newOrder;
      }
      return order;
    });
    this.layerOrderChanged$.next(this.activeLayers());
  }

  // Agregar capa al orden cuando se activa
  private addToActiveOrder(layerId: string): void {
    this.activeLayerOrder.update((order) => {
      if (!order.includes(layerId)) {
        return [layerId, ...order]; // Agregar al inicio (mayor z-index)
      }
      return order;
    });
  }

  // Quitar capa del orden cuando se desactiva
  private removeFromActiveOrder(layerId: string): void {
    this.activeLayerOrder.update((order) => order.filter((id) => id !== layerId));
  }

  // Desactivar una capa específica
  deactivateLayer(layerId: string): void {
    this.toggleLayerVisibility(layerId);
  }

  // ==================== CONTROL DE TIEMPO GLOBAL ====================

  // Obtener plazos disponibles (unión de todos los plazos de capas temporales activas)
  getAvailableForecastHours(): number[] {
    const hours = new Set<number>();
    for (const layer of this.activeLayers()) {
      if (layer.metadata?.forecastHours) {
        layer.metadata.forecastHours.forEach((h) => hours.add(h));
      }
    }
    return Array.from(hours).sort((a, b) => a - b);
  }

  // Avanzar tiempo global
  advanceGlobalTime(): void {
    const hours = this.getAvailableForecastHours();
    if (hours.length === 0) return;

    this._globalTimeIndex.update((index) => {
      const newIndex = (index + 1) % hours.length;
      return newIndex;
    });

    // Actualizar todas las capas temporales
    const currentHour = hours[this._globalTimeIndex()];
    this.setGlobalForecastHour(currentHour);
  }

  // Retroceder tiempo global
  rewindGlobalTime(): void {
    const hours = this.getAvailableForecastHours();
    if (hours.length === 0) return;

    this._globalTimeIndex.update((index) => {
      const newIndex = index === 0 ? hours.length - 1 : index - 1;
      return newIndex;
    });

    const currentHour = hours[this._globalTimeIndex()];
    this.setGlobalForecastHour(currentHour);
  }

  // Establecer hora global específica
  setGlobalForecastHour(hour: number): void {
    for (const layer of this.activeLayers()) {
      if (layer.metadata?.forecastHours?.includes(hour)) {
        this.setForecastHour(layer.id, hour);
      }
    }
    this.globalTimeChanged$.next(hour);
  }

  // Play/pause automático
  togglePlay(intervalMs: number = 2000): void {
    if (this._isPlaying()) {
      this.stopPlay();
    } else {
      this.startPlay(intervalMs);
    }
  }

  startPlay(intervalMs: number = 2000): void {
    if (this.playIntervalId) {
      clearInterval(this.playIntervalId);
    }
    this._isPlaying.set(true);
    this.playIntervalId = setInterval(() => {
      this.advanceGlobalTime();
    }, intervalMs);
  }

  stopPlay(): void {
    if (this.playIntervalId) {
      clearInterval(this.playIntervalId);
      this.playIntervalId = null;
    }
    this._isPlaying.set(false);
  }

  // Obtener hora actual
  getCurrentGlobalHour(): number | null {
    const hours = this.getAvailableForecastHours();
    if (hours.length === 0) return null;
    return hours[this._globalTimeIndex()];
  }

  // Mock: En el futuro, este método cargaría datos reales de un backend
  async loadLayerData(layerId: string): Promise<any> {
    console.log(`Loading data for layer: ${layerId}`);
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ message: `Mock data for ${layerId}` });
      }, 500);
    });
  }
}
