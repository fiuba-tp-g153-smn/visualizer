import { Injectable, signal } from '@angular/core';

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
  sublayers?: Layer[];

  // Metadata específica del tipo de capa
  metadata?: {
    frequency?: string;
    animationFrames?: number;
    updateInterval?: string;
  };
}

export interface LayerGroup {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  layers: Layer[];
  expanded: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class LayerService {
  // Estado reactivo de los grupos de capas
  private layerGroups = signal<LayerGroup[]>(this.initializeLayerGroups());

  // Métodos para acceder al estado
  getLayerGroups = this.layerGroups.asReadonly();

  private initializeLayerGroups(): LayerGroup[] {
    return [
      {
        id: 'satellite_abi',
        name: 'GOES 19 (ABI)',
        description: 'Imágenes satelitales ABI',
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
        name: 'GOES 19 (GLM)',
        description: 'Detección de descargas eléctricas',
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
      {
        id: 'radar',
        name: 'Radares',
        description: 'Red de radares meteorológicos',
        icon: 'radar',
        expanded: false,
        layers: [
          {
            id: 'radar_cordoba',
            name: 'RMA1 - Córdoba',
            description: 'PPIs a 0.5°, 0.9° y 1.3°',
            type: LayerType.RASTER,
            category: LayerCategory.RADAR,
            visible: false,
            opacity: 70,
            sublayers: [
              {
                id: 'radar_cordoba_reflectivity',
                name: 'Reflectividad Horizontal',
                type: LayerType.RASTER,
                category: LayerCategory.RADAR,
                visible: false,
                opacity: 70,
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
            metadata: {
              frequency: '10 minutos',
              animationFrames: 12,
            },
          },
          {
            id: 'radar_ezeiza',
            name: 'RMA2 - Ezeiza',
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
            id: 'radar_las_lomitas',
            name: 'RMA3 - Las Lomitas',
            type: LayerType.RASTER,
            category: LayerCategory.RADAR,
            visible: false,
            opacity: 70,
          },
          {
            id: 'radar_parana',
            name: 'PARANÁ - AR8',
            type: LayerType.RASTER,
            category: LayerCategory.RADAR,
            visible: false,
            opacity: 70,
          },
        ],
      },
      {
        id: 'emas',
        name: 'EMAs',
        description: 'Estaciones Meteorológicas Automáticas',
        icon: 'sensors',
        expanded: false,
        layers: [
          {
            id: 'emas_temperature',
            name: 'Temperatura',
            description: 'Datos de temperatura en tiempo real',
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
            description: 'Velocidad y dirección del viento',
            type: LayerType.VECTOR,
            category: LayerCategory.EMAS,
            visible: false,
            opacity: 100,
          },
        ],
      },
      {
        id: 'conventional',
        name: 'Estaciones convencionales',
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
      {
        id: 'numerical_models',
        name: 'Modelos numéricos',
        description: 'WRF, GFS y ECMWF',
        icon: 'grid_on',
        expanded: false,
        layers: [
          {
            id: 'wrf_colmax',
            name: 'WRF - COLMAX',
            description: 'Pronóstico 72 horas',
            type: LayerType.RASTER,
            category: LayerCategory.NUMERICAL_MODELS,
            visible: false,
            opacity: 70,
            metadata: {
              updateInterval: '72h',
            },
          },
          {
            id: 'wrf_gusts',
            name: 'WRF - Ráfagas',
            type: LayerType.VECTOR,
            category: LayerCategory.NUMERICAL_MODELS,
            visible: false,
            opacity: 80,
          },
          {
            id: 'wrf_900hpa',
            name: 'WRF - Campo 900 hPa',
            type: LayerType.RASTER,
            category: LayerCategory.NUMERICAL_MODELS,
            visible: false,
            opacity: 70,
          },
          {
            id: 'gfs_500hpa',
            name: 'GFS - Carta 500 hPa',
            description: 'Pronóstico 10 días',
            type: LayerType.RASTER,
            category: LayerCategory.NUMERICAL_MODELS,
            visible: false,
            opacity: 70,
            metadata: {
              updateInterval: '10 días',
            },
          },
          {
            id: 'gfs_250hpa',
            name: 'GFS - Carta 250 hPa',
            type: LayerType.RASTER,
            category: LayerCategory.NUMERICAL_MODELS,
            visible: false,
            opacity: 70,
          },
          {
            id: 'ecmwf_precipitation',
            name: 'ECMWF - Precipitación acumulada',
            description: 'Pronóstico 10 días',
            type: LayerType.RASTER,
            category: LayerCategory.NUMERICAL_MODELS,
            visible: false,
            opacity: 70,
            metadata: {
              updateInterval: '10 días',
            },
          },
        ],
      },
    ];
  }

  // Métodos para manipular las capas
  toggleLayerVisibility(layerId: string): void {
    this.layerGroups.update((groups) => {
      return groups.map((group) => ({
        ...group,
        layers: this.toggleLayerInArray(group.layers, layerId),
      }));
    });
  }

  private toggleLayerInArray(layers: Layer[], targetId: string): Layer[] {
    return layers.map((layer) => {
      if (layer.id === targetId) {
        return { ...layer, visible: !layer.visible };
      }
      if (layer.sublayers) {
        return {
          ...layer,
          sublayers: this.toggleLayerInArray(layer.sublayers, targetId),
        };
      }
      return layer;
    });
  }

  setLayerOpacity(layerId: string, opacity: number): void {
    this.layerGroups.update((groups) => {
      return groups.map((group) => ({
        ...group,
        layers: this.setOpacityInArray(group.layers, layerId, opacity),
      }));
    });
  }

  private setOpacityInArray(layers: Layer[], targetId: string, opacity: number): Layer[] {
    return layers.map((layer) => {
      if (layer.id === targetId) {
        return { ...layer, opacity: Math.max(0, Math.min(100, opacity)) };
      }
      if (layer.sublayers) {
        return {
          ...layer,
          sublayers: this.setOpacityInArray(layer.sublayers, targetId, opacity),
        };
      }
      return layer;
    });
  }

  toggleGroupExpansion(groupId: string): void {
    this.layerGroups.update((groups) => {
      return groups.map((group) =>
        group.id === groupId ? { ...group, expanded: !group.expanded } : group
      );
    });
  }

  getActiveLayersCount(): number {
    return this.layerGroups().reduce((count, group) => {
      return count + this.countActiveLayers(group.layers);
    }, 0);
  }

  private countActiveLayers(layers: Layer[]): number {
    return layers.reduce((count, layer) => {
      let layerCount = layer.visible ? 1 : 0;
      if (layer.sublayers) {
        layerCount += this.countActiveLayers(layer.sublayers);
      }
      return count + layerCount;
    }, 0);
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
