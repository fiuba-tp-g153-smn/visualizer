import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  SmnCurrentWeatherStationDto,
  SmnStationDto,
  SmnStationObservation,
  SmnStationSnapshot,
} from '../../models';

interface AuthTokenResponse {
  token: string;
}

interface StoredTokenState {
  token: string;
  storedAt: number;
}

const TOKEN_STORAGE_KEY = 'smn-station-api-token-v1';
const TOKEN_TTL_MS = 20 * 60 * 60 * 1000;

@Injectable({
  providedIn: 'root',
})
export class SmnStationsDataService {
  private readonly http = inject(HttpClient);
  private readonly snapshotSignal = signal<SmnStationSnapshot | null>(null);
  private readonly loadTickSignal = signal(0);
  private inflight: Promise<SmnStationSnapshot> | null = null;

  readonly loadTick = this.loadTickSignal.asReadonly();

  peek(): SmnStationSnapshot | null {
    return this.snapshotSignal();
  }

  async load(force = false): Promise<SmnStationSnapshot> {
    const currentSnapshot = this.snapshotSignal();
    console.info('[SmnStationsDataService] load requested', {
      force,
      hasSnapshot: currentSnapshot !== null,
      hasInflight: this.inflight !== null,
    });
    if (!force && currentSnapshot) {
      console.info('[SmnStationsDataService] returning cached snapshot', {
        source: currentSnapshot.source,
        observations: currentSnapshot.observations.length,
      });
      return currentSnapshot;
    }

    if (this.inflight) {
      return this.inflight;
    }

    this.inflight = this.fetchSnapshot();
    try {
      const snapshot = await this.inflight;
      this.snapshotSignal.set(snapshot);
      this.loadTickSignal.update((value) => value + 1);
      return snapshot;
    } finally {
      this.inflight = null;
    }
  }

  private async fetchSnapshot(): Promise<SmnStationSnapshot> {
    try {
      console.info('[SmnStationsDataService] fetching SMN snapshot', {
        baseUrl: environment.smnApi.baseUrl,
        hasUsername: Boolean(environment.smnApi.username),
        hasPassword: Boolean(environment.smnApi.password),
      });
      const token = await this.resolveToken();
      const headers = this.buildAuthHeaders(token);
      const stationsUrl = `${environment.smnApi.baseUrl}/georef/station`;
      const weatherUrl = `${environment.smnApi.baseUrl}/weather/station`;
      console.info('[SmnStationsDataService] requesting SMN endpoints', {
        stationsUrl,
        weatherUrl,
      });
      const [stations, weather] = await Promise.all([
        firstValueFrom(this.http.get<SmnStationDto[]>(stationsUrl, { headers })),
        firstValueFrom(this.http.get<SmnCurrentWeatherStationDto[]>(weatherUrl, { headers })),
      ]);

      console.info('[SmnStationsDataService] SMN endpoints responded', {
        stations: stations.length,
        weather: weather.length,
      });

      const weatherByStation = new Map<number, SmnCurrentWeatherStationDto>();
      for (const entry of weather) {
        weatherByStation.set(entry.station_id, entry);
      }

      const observations = stations
        .map((station) => {
          const currentWeather = weatherByStation.get(station.id);
          if (!currentWeather) {
            return null;
          }
          return { station, weather: currentWeather } satisfies SmnStationObservation;
        })
        .filter((entry): entry is SmnStationObservation => entry !== null)
        .sort((a, b) => a.station.name.localeCompare(b.station.name, 'es'));

      if (observations.length > 0) {
        console.info('[SmnStationsDataService] built API snapshot', {
          observations: observations.length,
          sampleStation: observations[0]?.station.name,
        });
        return {
          observations,
          fetchedAt: new Date().toISOString(),
          source: 'api',
        };
      }

      console.warn(
        '[SmnStationsDataService] no matched station/weather pairs, falling back to demo data',
        {
          stations: stations.length,
          weather: weather.length,
        },
      );
    } catch (error) {
      console.warn('[SmnStationsDataService] falling back to demo data after request failure', {
        baseUrl: environment.smnApi.baseUrl,
        error,
      });
    }

    return this.buildDemoSnapshot();
  }

  private async resolveToken(): Promise<string> {
    const cachedToken = this.readStoredToken();
    if (cachedToken) {
      console.info('[SmnStationsDataService] using cached SMN auth token');
      return cachedToken;
    }

    const username = environment.smnApi.username;
    const password = environment.smnApi.password;
    if (!username || !password) {
      console.warn('[SmnStationsDataService] SMN credentials missing in environment', {
        hasUsername: Boolean(username),
        hasPassword: Boolean(password),
      });
      throw new Error('SMN API credentials are not configured');
    }

    console.info('[SmnStationsDataService] requesting SMN auth token', {
      baseUrl: environment.smnApi.baseUrl,
      username,
    });
    const response = await firstValueFrom(
      this.http.post<AuthTokenResponse>(`${environment.smnApi.baseUrl}/api-token/auth`, {
        username,
        password,
      }),
    );

    console.info('[SmnStationsDataService] SMN auth token received');
    this.storeToken(response.token);
    return response.token;
  }

  private buildAuthHeaders(token: string) {
    return {
      Accept: 'application/json',
      Authorization: `JWT ${token}`,
    };
  }

  private readStoredToken(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    try {
      const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as StoredTokenState;
      if (!parsed.token || !parsed.storedAt) {
        return null;
      }
      if (Date.now() - parsed.storedAt > TOKEN_TTL_MS) {
        return null;
      }
      return parsed.token;
    } catch {
      return null;
    }
  }

  private storeToken(token: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const payload: StoredTokenState = {
        token,
        storedAt: Date.now(),
      };
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage failures.
    }
  }

  private buildDemoSnapshot(): SmnStationSnapshot {
    const observations: SmnStationObservation[] = [
      this.createDemoObservation(
        87585,
        'BUENOS AIRES OBSERVATORIO',
        'Capital Federal',
        -34.5875,
        -58.3722,
        25,
        'AUTOMATICA',
        21.3,
        22.1,
        71,
        1012.8,
        16.8,
        13.6,
        'Despejado',
        'Oeste',
        18,
      ),
      this.createDemoObservation(
        87576,
        'ROSARIO AERO',
        'Santa Fe',
        -32.9044,
        -60.785,
        22,
        'AUTOMATICA',
        18.7,
        19.2,
        64,
        1014.9,
        20.4,
        14.1,
        'Parcialmente nublado',
        'Sudeste',
        11,
      ),
      this.createDemoObservation(
        87148,
        'CORDOBA AERO',
        'Córdoba',
        -31.3236,
        -64.2079,
        474,
        'AUTOMATICA',
        25.8,
        27.1,
        39,
        1008.4,
        12.2,
        18.5,
        'Nublado',
        'Norte',
        26,
      ),
      this.createDemoObservation(
        87217,
        'MENDOZA AERO',
        'Mendoza',
        -32.8315,
        -68.7921,
        704,
        'AUTOMATICA',
        29.6,
        31.2,
        28,
        1005.3,
        28.0,
        22.8,
        'Despejado',
        'Noroeste',
        33,
      ),
      this.createDemoObservation(
        89217,
        'NEUQUEN AERO',
        'Neuquén',
        -38.9516,
        -68.1543,
        271,
        'AUTOMATICA',
        16.4,
        14.9,
        55,
        1018.1,
        11.5,
        10.8,
        'Cubierto',
        'Sudoeste',
        8,
      ),
      this.createDemoObservation(
        87715,
        'MAR DEL PLATA AERO',
        'Buenos Aires',
        -37.9345,
        -57.5736,
        22,
        'AUTOMATICA',
        14.2,
        12.8,
        83,
        1016.7,
        9.4,
        6.9,
        'Llovizna',
        'Este',
        22,
      ),
      this.createDemoObservation(
        87925,
        'SALTA AERO',
        'Salta',
        -24.8558,
        -65.4864,
        1221,
        'AUTOMATICA',
        26.9,
        28.7,
        47,
        1009.5,
        19.1,
        16.3,
        'Despejado',
        'Noreste',
        14,
      ),
      this.createDemoObservation(
        87791,
        'USHUAIA AERO',
        'Tierra del Fuego',
        -54.8433,
        -68.2955,
        28,
        'AUTOMATICA',
        6.8,
        3.9,
        76,
        1002.6,
        4.8,
        3.2,
        'Nevada débil',
        'Sur',
        35,
      ),
    ];

    return {
      observations,
      fetchedAt: new Date().toISOString(),
      source: 'demo',
    };
  }

  private createDemoObservation(
    id: number,
    name: string,
    province: string,
    lat: number,
    lon: number,
    height: number,
    type: 'MANUAL' | 'AUTOMATICA',
    temperature: number,
    feelsLike: number,
    humidity: number,
    pressure: number,
    visibility: number,
    windSpeed: number,
    weatherDescription: string,
    windDirection: SmnCurrentWeatherStationDto['wind']['direction'],
    windDegrees: number,
  ): SmnStationObservation {
    const station = {
      airport_code: 'SABA',
      coord: { lat, lon },
      height,
      id,
      name,
      province,
      ref: { location_id: id + 1000 },
      type,
    };

    const weather: SmnCurrentWeatherStationDto = {
      date: new Date().toISOString(),
      station_id: id,
      temperature,
      feels_like: feelsLike,
      humidity,
      pressure,
      visibility,
      weather: {
        id: 1,
        description: weatherDescription,
      },
      wind: {
        deg: windDegrees,
        direction: windDirection,
        speed: windSpeed,
      },
    };

    return { station, weather };
  }
}
