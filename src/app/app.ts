import { Component, signal, inject, PLATFORM_ID } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { HttpClient } from '@angular/common/http';;
import { MapViewer } from './map-viewer/map-viewer';
import { MainMenu } from './main-menu/main-menu';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MapViewer, MainMenu],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);
  
  // Signal to store the data service URL for use in templates
  protected dataServiceUrl = signal<string>('Loading...');

  constructor() {
    if (isPlatformServer(this.platformId)) {
      // Running on server (Node.js) - can access process.env directly
      const dataServiceUrl = (globalThis as any).process?.env?.['DATA_SERVICE_URL'];
      console.log('DATA_SERVICE_URL (Server):', dataServiceUrl);
      this.dataServiceUrl.set(dataServiceUrl);
      
    } else if (isPlatformBrowser(this.platformId)) {
      // Running in browser - fetch from API endpoint
      this.http.get<{DATA_SERVICE_URL: string}>('/api/env')
        .subscribe({
          next: (response) => {
            const dataServiceUrl = response.DATA_SERVICE_URL;
            console.log('DATA_SERVICE_URL (Browser):', dataServiceUrl);
            this.dataServiceUrl.set(dataServiceUrl);
          },
          error: (error) => {
            console.log('Failed to load environment variables:', error);
          }
        });
    }
  }

  protected readonly title = signal('visualizator');
}
