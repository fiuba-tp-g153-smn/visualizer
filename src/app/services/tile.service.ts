import { Injectable, signal } from '@angular/core';
import type { TileProvider } from '../tile-config/tile-config';

@Injectable({
  providedIn: 'root',
})
export class TileService {
  private currentProvider = signal<TileProvider | undefined>(undefined);

  getCurrentProvider() {
    return this.currentProvider.asReadonly();
  }

  setProvider(provider: TileProvider): void {
    this.currentProvider.set(provider);
    console.log('🗺️ TileService: Provider changed to', provider.name);
  }
}
