import { Injectable, signal, computed } from '@angular/core';
import type { TileProvider } from '../tile-config/tile-config';

/**
 * Servicio para manejar el proveedor de tiles del mapa
 * Mantiene el estado del provider actual y notifica cambios
 */
@Injectable({
  providedIn: 'root',
})
export class TileService {
  // Provider por defecto - ArgenMAP
  private readonly DEFAULT_PROVIDER_ID = 'argenmap';

  // Estado del provider actual (se mantiene entre navegaciones)
  private currentProvider = signal<TileProvider | undefined>(undefined);

  // Flag para saber si ya se inicializó
  private initialized = false;

  getCurrentProvider() {
    return this.currentProvider.asReadonly();
  }

  /**
   * Verifica si el servicio ya tiene un provider configurado
   */
  hasProvider(): boolean {
    return this.currentProvider() !== undefined;
  }

  /**
   * Obtiene el ID del provider actual o el default
   */
  getCurrentProviderId(): string {
    return this.currentProvider()?.id ?? this.DEFAULT_PROVIDER_ID;
  }

  /**
   * Inicializa el provider solo si no se ha inicializado antes
   * Devuelve true si se inicializó, false si ya estaba inicializado
   */
  initializeIfNeeded(provider: TileProvider): boolean {
    if (this.initialized) {
      return false;
    }
    this.currentProvider.set(provider);
    this.initialized = true;
    console.log('🗺️ TileService: Initialized with', provider.name);
    return true;
  }

  setProvider(provider: TileProvider): void {
    const current = this.currentProvider();

    // Solo actualizar si es diferente al actual
    if (current?.id !== provider.id) {
      this.currentProvider.set(provider);
      this.initialized = true;
      console.log('🗺️ TileService: Provider changed to', provider.name);
    }
  }
}
