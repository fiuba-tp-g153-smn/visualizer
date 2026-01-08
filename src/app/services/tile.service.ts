import { Injectable, signal } from '@angular/core';
import { TileProvider, TILE_PROVIDERS, getTileProvider } from '../config/tile-providers.config';
import { MAP_CONFIG } from '../config/map.config';

/**
 * Servicio para gestionar el proveedor de tiles del mapa base
 */
@Injectable({
  providedIn: 'root',
})
export class TileService {
  // Signal del proveedor actual (reactivo)
  private _currentProvider = signal<TileProvider>(
    getTileProvider(MAP_CONFIG.defaultTileProviderId)
  );

  // Getter readonly para exponer el signal
  currentProvider = this._currentProvider.asReadonly();

  /**
   * Obtiene todos los proveedores disponibles
   */
  getAvailableProviders(): TileProvider[] {
    return Object.values(TILE_PROVIDERS);
  }

  /**
   * Cambia el proveedor de tiles actual
   */
  setProvider(providerId: string): void {
    const provider = getTileProvider(providerId);
    this._currentProvider.set(provider);
    console.log('🗺️ Tile provider cambiado a:', provider.name);
  }

  /**
   * Obtiene el proveedor actual (valor directo, no signal)
   */
  getCurrentProvider(): TileProvider {
    return this._currentProvider();
  }
}
