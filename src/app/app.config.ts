import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { MARKED_OPTIONS, MarkedRenderer, provideMarkdown } from 'ngx-markdown';
import { HttpClient } from '@angular/common/http';

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
    provideMarkdown({
      loader: HttpClient,
      markedOptions: {
        provide: MARKED_OPTIONS,
        useFactory: () => {
          const renderer = new MarkedRenderer();
          renderer.heading = ({ text, depth }: { text: string; depth: number }) => {
            const id = text
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^\w\s-]/g, '')
              .trim()
              .replace(/\s+/g, '-');
            return `<h${depth} id="${id}">${text}</h${depth}>`;
          };
          return { renderer };
        },
      },
    }),
  ],
};
