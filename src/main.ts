import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Side-effect import: monkey-patches L.Polyline.prototype.setText for isobar labels.
import 'leaflet-textpath';

// The loading splash lives as static HTML/CSS in index.html (#app-splash) and is
// removed by the App component once the app is stable. There is no second Angular
// app, so BaseMapService — and its /basemap/providers fetch — is created once.
bootstrapApplication(App, appConfig).catch((err) => console.error(err));
