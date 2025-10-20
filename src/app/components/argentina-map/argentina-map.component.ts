import { Component, OnInit, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-argentina-map',
  standalone: true,
  templateUrl: './argentina-map.component.html',
  styleUrl: './argentina-map.component.scss'
})
export class ArgentinaMapComponent implements OnInit, OnDestroy {
  private map: any = null;
  private platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initMap();
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private async initMap(): Promise<void> {
    const L = await import('leaflet');

    this.map = L.map('map', {
      center: [-41, -63.6],
      zoom: 5,
      minZoom: 2,
      maxZoom: 18
    });

    // OPCIÓN 1: OpenStreetMap estándar (muestra todas las rutas, idioma mixto)
    // L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    //   attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    //   maxZoom: 18
    // }).addTo(this.map);

    // OPCIÓN 2: CartoDB Positron (mapa MUY limpio, mínimo detalle de rutas) ⭐ RECOMENDADO
    // L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    //   attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    //   maxZoom: 19
    // }).addTo(this.map);

    // OPCIÓN 3: CartoDB Voyager (equilibrio entre detalle y limpieza)
    // L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    //   attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    //   maxZoom: 19
    // }).addTo(this.map);

    // OPCIÓN 4: CartoDB Dark Matter (tema oscuro, mapa limpio)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19
    }).addTo(this.map);

    // OPCIÓN 5: Esri World Street Map (mejor etiquetado internacional, incluye español)
    // L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    //   attribution: 'Tiles &copy; Esri',
    //   maxZoom: 18
    // }).addTo(this.map);

    // OPCIÓN 6: Stadia Alidade Smooth (muy limpio, sin rutas detalladas)
    // L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', {
    //   attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
    //   maxZoom: 20
    // }).addTo(this.map);
  }
}

