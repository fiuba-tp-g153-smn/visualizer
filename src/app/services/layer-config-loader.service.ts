import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { LayerGroup } from '../models';
import { firstValueFrom } from 'rxjs';

/**
 * Servicio para cargar la configuración de capas desde JSON
 * según el entorno (development o production)
 */
@Injectable({
  providedIn: 'root',
})
export class LayerConfigLoaderService {
  private readonly http = inject(HttpClient);
  private configCache: LayerGroup[] | null = null;

  /**
   * Carga la configuración de capas apropiada según el entorno
   * @returns Promesa con la configuración de capas
   */
  async loadLayerConfig(): Promise<LayerGroup[]> {
    if (this.configCache) {
      console.log('[LayerConfigLoader] Retornando config cacheada');
      return this.configCache;
    }

    const isProd = environment.production;
    const configFile = isProd
      ? 'config/layers-prod.json'
      : 'config/layers-dev.json';

    console.log('[LayerConfigLoader] Cargando configuración:', {
      environment: isProd ? 'production' : 'development',
      file: configFile,
    });

    try {
      const config = await firstValueFrom(this.http.get<LayerGroup[]>(configFile));
      console.log('[LayerConfigLoader] Configuración cargada exitosamente:', config);

      // Mostrar capas visibles en menu por cada grupo
      config.forEach(group => {
        const visibleLayers = group.subgroups.flatMap(sg =>
          sg.layers.filter(l => l.menuVisible !== false).map(l => l.name)
        );
        console.log(`[LayerConfigLoader] ${group.name} - Capas visibles:`, visibleLayers);
      });

      this.configCache = config;
      return config;
    } catch (error) {
      console.error(`[LayerConfigLoader] Error cargando configuración de ${configFile}:`, error);
      throw new Error(`Failed to load layer configuration: ${configFile}`);
    }
  }
}
