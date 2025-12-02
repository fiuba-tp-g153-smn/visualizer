import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, shareReplay, catchError, map, BehaviorSubject } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import {
  MapPoint,
  PointsResponse,
  VectorField,
  VectorFieldResponse,
  RasterImageData,
  RasterResponse,
  BoundingBox,
  MapQueryParams,
  EmaPointData,
  StationPointData,
} from '../models/map-data.models';

/**
 * Servicio para consumir datos del backend
 * Maneja puntos, vectores e imágenes raster
 */
@Injectable({
  providedIn: 'root',
})
export class MapDataService {
  private http = inject(HttpClient);
  private apiConfig = inject(ApiConfigService);

  // Cache para evitar llamadas repetidas
  private cache = new Map<string, Observable<unknown>>();
  private readonly CACHE_DURATION_MS = 60000; // 1 minuto

  // ==========================================================================
  // PUNTOS (EMAs, Estaciones, etc.)
  // ==========================================================================

  /**
   * Obtiene puntos de EMAs
   */
  getEmas(params?: MapQueryParams): Observable<MapPoint<EmaPointData>[]> {
    return this.getPoints<EmaPointData>(this.apiConfig.endpoints.emas, params);
  }

  /**
   * Obtiene estaciones SYNOP
   */
  getSynop(params?: MapQueryParams): Observable<MapPoint<StationPointData>[]> {
    return this.getPoints<StationPointData>(this.apiConfig.endpoints.synop, params);
  }

  /**
   * Obtiene reportes METAR
   */
  getMetar(params?: MapQueryParams): Observable<MapPoint<StationPointData>[]> {
    return this.getPoints<StationPointData>(this.apiConfig.endpoints.metar, params);
  }

  /**
   * Método genérico para obtener puntos de cualquier endpoint
   */
  getPoints<T>(endpoint: string, params?: MapQueryParams): Observable<MapPoint<T>[]> {
    const httpParams = this.buildHttpParams(params);
    const cacheKey = `points:${endpoint}:${httpParams.toString()}`;

    // Verificar cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as Observable<MapPoint<T>[]>;
    }

    const url = this.apiConfig.buildUrl(endpoint);
    const request$ = this.http
      .get<PointsResponse<T> | MapPoint<T>[]>(url, { params: httpParams })
      .pipe(
        map((response) => {
          // Soporta ambos formatos: { data: [...] } o directamente [...]
          if (Array.isArray(response)) {
            return response;
          }
          return response.data;
        }),
        shareReplay(1),
        catchError((error) => {
          console.error(`Error fetching points from ${endpoint}:`, error);
          this.cache.delete(cacheKey);
          return of([]);
        })
      );

    this.cache.set(cacheKey, request$);
    this.scheduleCacheCleanup(cacheKey);

    return request$;
  }

  // ==========================================================================
  // VECTORES (Viento, etc.)
  // ==========================================================================

  /**
   * Obtiene campo de viento
   */
  getWindVectors(params?: MapQueryParams): Observable<VectorField | null> {
    return this.getVectorField(this.apiConfig.endpoints.vectors.wind, params);
  }

  /**
   * Método genérico para obtener campos vectoriales
   */
  getVectorField(endpoint: string, params?: MapQueryParams): Observable<VectorField | null> {
    const httpParams = this.buildHttpParams(params);
    const cacheKey = `vectors:${endpoint}:${httpParams.toString()}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as Observable<VectorField | null>;
    }

    const url = this.apiConfig.buildUrl(endpoint);
    const request$ = this.http
      .get<VectorFieldResponse | VectorField>(url, { params: httpParams })
      .pipe(
        map((response) => {
          if ('data' in response) {
            return response.data;
          }
          return response;
        }),
        shareReplay(1),
        catchError((error) => {
          console.error(`Error fetching vectors from ${endpoint}:`, error);
          this.cache.delete(cacheKey);
          return of(null);
        })
      );

    this.cache.set(cacheKey, request$);
    this.scheduleCacheCleanup(cacheKey);

    return request$;
  }

  // ==========================================================================
  // IMÁGENES RASTER (Satelital, Radar, Modelos)
  // ==========================================================================

  /**
   * Obtiene imagen satelital ABI
   */
  getSatelliteAbi(options?: {
    producto?: string;
    canal?: string;
    fecha?: string;
  }): Observable<RasterImageData | null> {
    return this.getRasterImage(this.apiConfig.endpoints.satellite.abi, options);
  }

  /**
   * Obtiene imagen satelital GLM
   */
  getSatelliteGlm(options?: {
    producto?: string;
    fecha?: string;
  }): Observable<RasterImageData | null> {
    return this.getRasterImage(this.apiConfig.endpoints.satellite.glm, options);
  }

  /**
   * Obtiene imagen de radar
   */
  getRadarImage(
    radarId: string,
    options?: { producto?: string; fecha?: string }
  ): Observable<RasterImageData | null> {
    return this.getRasterImage(`${this.apiConfig.endpoints.radar}/${radarId}`, options);
  }

  /**
   * Método genérico para obtener imágenes raster
   */
  getRasterImage(
    endpoint: string,
    options?: Record<string, string | undefined>
  ): Observable<RasterImageData | null> {
    const cleanOptions = options
      ? Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined))
      : {};
    const httpParams = new HttpParams({ fromObject: cleanOptions as Record<string, string> });
    const cacheKey = `raster:${endpoint}:${httpParams.toString()}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as Observable<RasterImageData | null>;
    }

    const url = this.apiConfig.buildUrl(endpoint);
    const request$ = this.http
      .get<RasterResponse | RasterImageData>(url, { params: httpParams })
      .pipe(
        map((response) => {
          if ('data' in response && !('imageUrl' in response)) {
            return response.data as RasterImageData;
          }
          return response as RasterImageData;
        }),
        shareReplay(1),
        catchError((error) => {
          console.error(`Error fetching raster from ${endpoint}:`, error);
          this.cache.delete(cacheKey);
          return of(null);
        })
      );

    this.cache.set(cacheKey, request$);
    this.scheduleCacheCleanup(cacheKey);

    return request$;
  }

  // ==========================================================================
  // UTILIDADES
  // ==========================================================================

  /**
   * Limpia todo el cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Limpia el cache de un endpoint específico
   */
  clearCacheFor(endpoint: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(endpoint)) {
        this.cache.delete(key);
      }
    }
  }

  private buildHttpParams(params?: MapQueryParams): HttpParams {
    let httpParams = new HttpParams();

    if (params?.bounds) {
      httpParams = httpParams
        .set('north', params.bounds.north.toString())
        .set('south', params.bounds.south.toString())
        .set('east', params.bounds.east.toString())
        .set('west', params.bounds.west.toString());
    }

    if (params?.zoom !== undefined) {
      httpParams = httpParams.set('zoom', params.zoom.toString());
    }

    if (params?.fecha) {
      httpParams = httpParams.set('fecha', params.fecha);
    }

    if (params?.producto) {
      httpParams = httpParams.set('producto', params.producto);
    }

    return httpParams;
  }

  private scheduleCacheCleanup(key: string): void {
    setTimeout(() => {
      this.cache.delete(key);
    }, this.CACHE_DURATION_MS);
  }
}
