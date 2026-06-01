import { Injectable, effect, inject } from '@angular/core';
import * as L from 'leaflet';
import { AvisosService } from './avisos.service';
import { Aviso } from '../../models/geo';
import { AVISO_POLYGON_OPTIONS } from '../../config/map-avisos.config';
import { formatDateTimeLocalized } from '../../utils/tileset-timestamp';

/**
 * Renders active alert ("aviso") polygons on the map in a dedicated layer group,
 * reacting to AvisosService state. Read-only overlay, separate from the editable
 * user polygons.
 */
@Injectable({ providedIn: 'root' })
export class AvisosMapService {
  private readonly avisosService = inject(AvisosService);

  private map: L.Map | null = null;
  private readonly layerGroup: L.FeatureGroup = L.featureGroup();

  constructor() {
    effect(() => {
      const show = this.avisosService.showActive();
      const avisos = this.avisosService.avisos();
      if (!this.map) return;
      if (show) {
        this.render(avisos);
      } else {
        this.clear();
      }
    });
  }

  /** Wire the service to the Leaflet map instance (called from MapContainer). */
  initialize(map: L.Map): void {
    this.map = map;
    this.layerGroup.addTo(map);
  }

  private render(avisos: ReadonlyArray<Aviso>): void {
    this.layerGroup.clearLayers();

    for (const aviso of avisos) {
      if (aviso.coordinates.length < 3) continue; // not a drawable polygon

      const latlngs = aviso.coordinates.map(([lat, lng]) => [lat, lng] as L.LatLngExpression);
      const polygon = L.polygon(latlngs, AVISO_POLYGON_OPTIONS);
      polygon.bindPopup(this.buildPopup(aviso));
      this.layerGroup.addLayer(polygon);
    }
  }

  private clear(): void {
    this.layerGroup.clearLayers();
  }

  private buildPopup(aviso: Aviso): string {
    const start = formatDateTimeLocalized(aviso.startDatetime);
    const end = formatDateTimeLocalized(aviso.endDatetime);
    return `
      <strong>Aviso #${aviso.alertId}</strong><br />
      ${aviso.phenomenon}<br />
      Inicio: ${start}<br />
      Fin: ${end}
    `;
  }
}
