import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  ENVIRONMENT_INITIALIZER,
  inject,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { MAT_TOOLTIP_DEFAULT_OPTIONS } from '@angular/material/tooltip';
import { SeoService } from './services/seo/seo.service';
import { weatherStationsHttpInterceptor } from './services/weather-stations/weather-stations-http.interceptor';
import { TOOLTIP_DELAYS } from './config/timing.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimationsAsync(),
    provideHttpClient(withFetch(), withInterceptors([weatherStationsHttpInterceptor])),
    provideRouter(
      routes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      }),
    ),
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        // Start syncing per-route title/description/OG tags with navigation.
        // The map services used to be woken here too, which meant /docs and
        // /status paid for a 10s refresh timer and a /basemap/providers fetch
        // they never use; HomeComponent wakes them now.
        inject(SeoService).init();
      },
    },
    {
      provide: MAT_TOOLTIP_DEFAULT_OPTIONS,
      useValue: {
        showDelay: TOOLTIP_DELAYS.SHOW,
        hideDelay: TOOLTIP_DELAYS.HIDE,
        touchendHideDelay: TOOLTIP_DELAYS.TOUCHEND_HIDE,
      },
    },
  ],
};
