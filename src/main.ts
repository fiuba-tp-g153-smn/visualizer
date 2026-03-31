import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { AppLoaderComponent } from './app/components/floating/app-loader/app-loader';
import { createApplication } from '@angular/platform-browser';

// Bootstrap del loader primero para que se muestre inmediatamente
createApplication(appConfig).then((appRef) => {
  appRef.bootstrap(AppLoaderComponent);
});

// Bootstrap de la aplicación principal
bootstrapApplication(App, appConfig).catch((err) => console.error(err));
