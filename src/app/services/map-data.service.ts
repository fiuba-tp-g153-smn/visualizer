import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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
    // Build HttpParams if provided
    const options = params ? { params: params as Record<string, string | number> } : {};

    return this.http.get<Point<T>[]>(`${this.BACKEND_URL}/${endpoint}`, options);
  }
}
