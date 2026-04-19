import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  ENVIRONMENT_INITIALIZER,
  inject,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { MAT_TOOLTIP_DEFAULT_OPTIONS } from '@angular/material/tooltip';
import { LayerRefreshService } from './services/layers/layer-refresh.service';
import { BaseMapService } from './services/base-maps/base-map.service';
import { TOOLTIP_DELAYS } from './config/timing.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimationsAsync(),
    provideHttpClient(withFetch()),
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
        // Eager load LayerRefreshService to start auto-refresh immediately
        inject(LayerRefreshService);
        // Eager load BaseMapService to fetch /basemap/providers at app boot
        inject(BaseMapService);
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
