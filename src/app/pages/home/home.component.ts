import { Component, inject } from '@angular/core';
import { MapContainer } from '../../components/map-container/map-container';
import { MapOverlayComponent } from '../../components/overlay/map-overlay';
import { LayerRefreshService } from '../../services/layers/layer-refresh.service';
import { BaseMapService } from '../../services/base-maps/base-map.service';
import { BasemapPerfService } from '../../services/base-maps/basemap-perf.service';

@Component({
  selector: 'app-home',
  imports: [MapContainer, MapOverlayComponent],
  template: `
    <app-map-container />
    <app-map-overlay />
  `,
  styles: [
    `
      :host {
        display: grid;
        width: 100vw;
        height: 100vh;
      }
      :host > * {
        grid-area: 1 / 1;
      }
    `,
  ],
})
export class HomeComponent {
  // Woken here rather than at app boot: layer auto-refresh polls on a timer and
  // BaseMapService fetches /basemap/providers, neither of which the /docs or
  // /status routes have any use for. BasemapPerfService has to attach its
  // PerformanceObserver before the first tile request, which is still true here
  // — the map renders as a child of this component.
  private readonly layerRefresh = inject(LayerRefreshService);
  private readonly baseMaps = inject(BaseMapService);
  private readonly basemapPerf = inject(BasemapPerfService);
}
