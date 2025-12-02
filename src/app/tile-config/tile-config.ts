import { Component, signal, output, inject, effect } from '@angular/core';
import { MatRadioModule } from '@angular/material/radio';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { TileService } from '../services/tile.service';

export interface TileProvider {
  id: string;
  name: string;
  description: string;
  url: string;
  attribution: string;
  maxZoom: number;
  preview?: string;
  category: 'standard' | 'satellite' | 'terrain' | 'dark' | 'custom';
}

@Component({
  selector: 'app-tile-config',
  imports: [MatRadioModule, MatCardModule, MatIconModule, FormsModule],
  templateUrl: './tile-config.html',
  styleUrl: './tile-config.scss',
})
export class TileConfig {
  private tileService = inject(TileService);
  selectedProviderId = signal<string>('argenmap');
  tileProviderChanged = output<TileProvider>();

  constructor() {
    // Sincronizar con el estado actual del TileService
    const currentId = this.tileService.getCurrentProviderId();
    this.selectedProviderId.set(currentId);

    // Solo inicializar si el TileService no tiene provider
    if (!this.tileService.hasProvider()) {
      const initialProvider = this.tileProviders.find((p) => p.id === currentId);
      if (initialProvider) {
        this.tileService.initializeIfNeeded(initialProvider);
      }
    }
  }

  tileProviders: TileProvider[] = [
    {
      id: 'osm',
      name: 'OpenStreetMap',
      description: 'Mapa estándar de OpenStreetMap',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
      category: 'standard',
    },
    {
      id: 'cartodb-light',
      name: 'CartoDB Positron',
      description: 'Mapa claro minimalista, ideal para visualizar datos',
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      attribution: '© OpenStreetMap, © CartoDB',
      maxZoom: 19,
      category: 'standard',
    },
    {
      id: 'cartodb-dark',
      name: 'CartoDB Dark Matter',
      description: 'Mapa oscuro para visualizaciones contrastantes',
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '© OpenStreetMap, © CartoDB',
      maxZoom: 19,
      category: 'dark',
    },
    {
      id: 'esri-world',
      name: 'Esri World Street Map',
      description: 'Mapa detallado de calles y lugares',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: '© Esri',
      maxZoom: 19,
      category: 'standard',
    },
    {
      id: 'esri-imagery',
      name: 'Esri World Imagery',
      description: 'Imágenes satelitales de alta resolución',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '© Esri',
      maxZoom: 19,
      category: 'satellite',
    },
    {
      id: 'esri-topo',
      name: 'Esri World Topographic',
      description: 'Mapa topográfico con relieve',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: '© Esri',
      maxZoom: 19,
      category: 'terrain',
    },
    {
      id: 'argenmap',
      name: 'ArgenMAP (IGN)',
      description: 'Mapa oficial del Instituto Geográfico Nacional de Argentina',
      url: 'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png',
      attribution: '© Instituto Geográfico Nacional + OpenStreetMap',
      maxZoom: 19,
      category: 'standard',
    },
    {
      id: 'stamen-terrain',
      name: 'Stamen Terrain',
      description: 'Mapa de relieve con sombreado',
      url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png',
      attribution: '© Stamen Design, © OpenStreetMap',
      maxZoom: 18,
      category: 'terrain',
    },
  ];

  get groupedProviders(): Record<string, TileProvider[]> {
    return this.tileProviders.reduce((acc, provider) => {
      if (!acc[provider.category]) {
        acc[provider.category] = [];
      }
      acc[provider.category].push(provider);
      return acc;
    }, {} as Record<string, TileProvider[]>);
  }

  get categories(): string[] {
    return Object.keys(this.groupedProviders);
  }

  getCategoryName(category: string): string {
    const names: Record<string, string> = {
      standard: 'Mapas estándar',
      satellite: 'Imágenes satelitales',
      terrain: 'Mapas topográficos',
      dark: 'Mapas oscuros',
      custom: 'Personalizados',
    };
    return names[category] || category;
  }

  getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      standard: 'map',
      satellite: 'satellite_alt',
      terrain: 'terrain',
      dark: 'dark_mode',
      custom: 'tune',
    };
    return icons[category] || 'map';
  }

  onProviderChange(providerId: string): void {
    this.selectedProviderId.set(providerId);
    const provider = this.tileProviders.find((p) => p.id === providerId);
    if (provider) {
      console.log('🗺️ Tile provider changed:', provider.name);
      this.tileService.setProvider(provider);
      this.tileProviderChanged.emit(provider);
    }
  }

  getSelectedProvider(): TileProvider | undefined {
    return this.tileProviders.find((p) => p.id === this.selectedProviderId());
  }
}
