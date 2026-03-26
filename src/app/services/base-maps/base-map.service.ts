import { Injectable, signal, effect } from '@angular/core';
import { MAP_CONFIG, getBaseMap, BASE_MAPS } from '../../config';
import { BaseMap } from '../../models';

const BASE_MAP_LOCAL_STORAGE_KEY = 'mapasmn_selected_base_map';

/**
 * Base Map Service
 *
 * Manages the current base map selection and provides reactive access to base map changes.
 * Persists the user's selection to localStorage for consistency across sessions.
 */
@Injectable({
  providedIn: 'root',
})
export class BaseMapService {
  // Current base map signal (reactive)
  private _currentBaseMap = signal<BaseMap>(this.loadBaseMapFromStorage());

  // Readonly getter to expose the signal
  currentBaseMap = this._currentBaseMap.asReadonly();

  constructor() {
    // Effect: Save to localStorage whenever base map changes
    effect(() => {
      const baseMap = this._currentBaseMap();
      this.saveBaseMapToStorage(baseMap.id);
    });
  }

  /**
   * Get all available base maps
   */
  getAvailableBaseMaps(): BaseMap[] {
    return Object.values(BASE_MAPS);
  }

  /**
   * Change the current base map
   * @param baseMapId - ID of the base map to activate
   * @throws {Error} If base map ID is not found
   */
  setBaseMap(baseMapId: string): void {
    const baseMap = getBaseMap(baseMapId);
    this._currentBaseMap.set(baseMap);
    console.log('🗺️ Base map changed to:', baseMap.name);
  }

  /**
   * Get the current base map (direct value, not signal)
   */
  getCurrentBaseMap(): BaseMap {
    return this._currentBaseMap();
  }

  /**
   * Load base map selection from localStorage
   * Falls back to default if stored ID is invalid or not found
   */
  private loadBaseMapFromStorage(): BaseMap {
    try {
      const storedId = localStorage.getItem(BASE_MAP_LOCAL_STORAGE_KEY);
      if (storedId && BASE_MAPS[storedId]) {
        console.log('📍 Loaded base map from storage:', storedId);
        return BASE_MAPS[storedId];
      }
    } catch (error) {
      console.warn('Failed to load base map from storage:', error);
    }
    return getBaseMap(MAP_CONFIG.defaultBaseMapId);
  }

  /**
   * Save base map selection to localStorage
   */
  private saveBaseMapToStorage(baseMapId: string): void {
    try {
      localStorage.setItem(BASE_MAP_LOCAL_STORAGE_KEY, baseMapId);
    } catch (error) {
      console.warn('Failed to save base map to storage:', error);
    }
  }
}
