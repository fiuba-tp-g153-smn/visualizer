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

    L.tileLayer('https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png', {
      attribution: '<a href="http://leafletjs.com" title="A JS library for interactive maps">Leaflet</a> | <a href="http://www.ign.gob.ar/AreaServicios/Argenmap/IntroduccionV2" target="_blank">Instituto Geográfico Nacional</a> + <a href="http://www.osm.org/copyright" target="_blank">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(this.map);
  }
}

