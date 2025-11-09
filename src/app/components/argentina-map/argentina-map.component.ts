import { Component, OnInit, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MapDataService, Point, EmaData } from '../../services/map-data.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-argentina-map',
  standalone: true,
  templateUrl: './argentina-map.component.html',
  styleUrl: './argentina-map.component.scss',
})
export class ArgentinaMapComponent implements OnInit, OnDestroy {
  private map: any = null;
  private platformId = inject(PLATFORM_ID);
  private pointsLayer: any = null;
  private layersControl: any = null;
  private legendControl: any = null;
  private subscriptions: Subscription = new Subscription();

  private minTemp = -15;
  private maxTemp = 40;

  constructor(private mapDataService: MapDataService) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initMap();
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
    this.subscriptions.unsubscribe();
  }

  private async initMap(): Promise<void> {
    const L = await import('leaflet');

    this.map = L.map('map', {
      center: [-34.6037, -58.3816], // Starting point: CABA
      zoom: 12,
      minZoom: 2,
      maxZoom: 18,
    });

    L.tileLayer(
      'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png',
      {
        attribution:
          '<a href="http://leafletjs.com" title="A JS library for interactive maps">Leaflet</a> | <a href="http://www.ign.gob.ar/AreaServicios/Argenmap/IntroduccionV2" target="_blank">Instituto Geográfico Nacional</a> + <a href="http://www.osm.org/copyright" target="_blank">OpenStreetMap</a>',
        maxZoom: 19,
      }
    ).addTo(this.map);

    // Layer control
    this.layersControl = L.control.layers(undefined, {}, { collapsed: false }).addTo(this.map);

    // Color scale legend
    this.createLegend(L);

    // Load points once at startup (so the visualizer shows data immediately),
    // and again whenever the user moves/zooms the map.
    this.loadPointsBasedOnBounds();
    this.map.on('moveend', () => {
      this.loadPointsBasedOnBounds();
    });
  }

  private loadPointsBasedOnBounds(): void {
    const bounds = this.map.getBounds();
    const params = {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    };

    this.subscriptions.add(
      this.mapDataService.getPoints('emas', params).subscribe((points: Point<EmaData>[]) => {
        this.addPointsToMap(points);
      })
    );
  }

  private async addPointsToMap(points: Point<EmaData>[]): Promise<void> {
    const L = await import('leaflet');

    if (this.pointsLayer) {
      this.map.removeLayer(this.pointsLayer);
    }

    this.pointsLayer = L.layerGroup();

    points.forEach((point: Point<EmaData>) => {
      const temp = typeof point.data?.temperature === 'number' ? point.data.temperature : null;

      // Choose a color based on temperature. Missing temperatures get a
      // default blue color. All points are the same size.
      const color =
        temp !== null ? this.temperatureToColor(temp, this.minTemp, this.maxTemp) : '#2f7bff';
      const radius = 7;

      // Use a simple circleMarker so markers are rendered as colored points.
      const marker = L.circleMarker([point.lat, point.lng], {
        radius,
        fillColor: color,
        color: '#222',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.9,
      });

      const name = point.data?.name ?? '';
      const description = point.data?.description ?? '';
      const formatedDescription =
        temp !== null
          ? `${description ? description + '<br>' : ''}Temperature: ${temp} °C`
          : description;

      marker.bindPopup(`<strong>${name}</strong><br>${formatedDescription}`);
      this.pointsLayer.addLayer(marker);
    });

    this.pointsLayer.addTo(this.map);

    if (this.layersControl) {
      try {
        this.map.removeControl(this.layersControl);
      } catch (e) {
        // ignore
      }
    }

    this.layersControl = L.control
      .layers(undefined, { EMAs: this.pointsLayer }, { collapsed: false })
      .addTo(this.map);
  }

  toggleLayerVisibility(): void {
    if (this.map.hasLayer(this.pointsLayer)) {
      this.map.removeLayer(this.pointsLayer);
    } else {
      this.pointsLayer.addTo(this.map);
    }
  }

  // Map a temperature value to a color on the blue -> yellow -> orange -> red scale.
  private temperatureToColor(temp: number, min: number, max: number): string {
    const t = max > min ? (temp - min) / (max - min) : 0;
    // Three segments: blue->yellow, yellow->orange, orange->red
    if (t <= 0.33) {
      const u = t / 0.33;
      return this.interpolateHex('#0000ff', '#ffff00', u);
    } else if (t <= 0.66) {
      const u = (t - 0.33) / 0.33;
      return this.interpolateHex('#ffff00', '#ff9900', u);
    } else {
      const u = (t - 0.66) / 0.34; // remaining fraction
      return this.interpolateHex('#ff9900', '#ff0000', u);
    }
  }

  // Interpolate between two hex colors (e.g. #rrggbb) by fraction u in [0,1].
  private interpolateHex(a: string, b: string, u: number): string {
    const pa = this.hexToRgb(a);
    const pb = this.hexToRgb(b);
    const r = Math.round(pa.r + (pb.r - pa.r) * u);
    const g = Math.round(pa.g + (pb.g - pa.g) * u);
    const bl = Math.round(pa.b + (pb.b - pa.b) * u);
    return '#' + this.toHex(r) + this.toHex(g) + this.toHex(bl);
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const h = hex.replace('#', '');
    const bigint = parseInt(h, 16);
    if (h.length === 6) {
      return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
    }
    // Fallback for short hex (#rgb)
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }

  private toHex(n: number): string {
    const s = n.toString(16);
    return s.length === 1 ? '0' + s : s;
  }

  // Create a legend control that explains the temperature color scale.
  private createLegend(L: any): void {
    // Remove existing legend if present
    if (this.legendControl) {
      try {
        this.map.removeControl(this.legendControl);
      } catch (e) {
        // ignore
      }
      this.legendControl = null;
    }

    const grades: number[] = [];

    for (let t = this.minTemp; t <= this.maxTemp; t += 5) {
      grades.push(t);
    }

    this.legendControl = L.control({ position: 'bottomright' });
    this.legendControl.onAdd = () => {
      const div = L.DomUtil.create('div', 'info legend');
      let html =
        '<div style="background:rgba(255,255,255,0.9);padding:6px;border-radius:4px;font-size:12px;">';
      html += '<strong>Temperature (°C)</strong><br/>';
      grades.forEach((g, i) => {
        const color = this.temperatureToColor(g, this.minTemp, this.maxTemp);
        html += `<i style="background:${color};width:18px;height:12px;display:inline-block;margin-right:6px;border:1px solid #666;"></i> ${g}${
          i < grades.length - 1 ? '<br/>' : ''
        }`;
      });
      html += '</div>';
      div.innerHTML = html;
      return div;
    };

    this.legendControl.addTo(this.map);
  }
}
