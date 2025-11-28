import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface EmaData {
  name?: string;
  description?: string;
  temperature?: number;
  humidity?: number;
}

export interface Point<T = EmaData> {
  lat: number;
  lng: number;
  data: T;
}

@Injectable({
  providedIn: 'root',
})
export class MapDataService {
  private readonly BACKEND_URL = 'http://localhost:8080';
  private platformId = inject(PLATFORM_ID);

  constructor(private http: HttpClient) {}

  /**
   * Fetch points data from a specific endpoint.
   * @param endpoint The endpoint to fetch data from.
   * @returns Observable containing the points data.
   */
  getPoints<T = EmaData>(
    endpoint: string = 'emas',
    params?: Record<string, string | number>
  ): Observable<Point<T>[]> {
    // Check if we're in browser environment before making HTTP requests
    if (!isPlatformBrowser(this.platformId)) {
      // During SSR, return mock data instead of making HTTP requests
      console.log('SSR detected, returning mock data for endpoint:', endpoint);
      return of(this.getMockPoints() as Point<T>[]);
    }

    try {
      // Build HttpParams if provided
      const options = params ? { params: params as Record<string, string | number> } : {};

      return this.http.get<Point<T>[]>(`${this.BACKEND_URL}/${endpoint}`, options).pipe(
        map(response => {
          // Ensure we always return an array
          return Array.isArray(response) ? response : [];
        }),
        catchError(error => {
          console.error('Error fetching points data:', error);
          // Return empty array on error instead of failing
          return of([]);
        })
      );
    } catch (error) {
      console.error('Error in getPoints:', error);
      return of([]);
    }
  }

  /**
   * Returns mock data for SSR or fallback scenarios
   */
  private getMockPoints(): Point<EmaData>[] {
    return [
      {
        lat: -34.6037,
        lng: -58.3816,
        data: {
          name: 'Estación Central',
          description: 'Estación meteorológica central',
          temperature: 22,
          humidity: 65
        }
      },
      {
        lat: -34.6118,
        lng: -58.3960,
        data: {
          name: 'Observatorio',
          description: 'Observatorio meteorológico',
          temperature: 21,
          humidity: 70
        }
      },
      {
        lat: -34.5955,
        lng: -58.3706,
        data: {
          name: 'Aeroparque',
          description: 'Estación aeroportuaria',
          temperature: 23,
          humidity: 60
        }
      }
    ];
  }
}
