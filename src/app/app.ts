import { Component, inject } from '@angular/core';
import { MapViewer } from './map-viewer/map-viewer';
import { TileService } from './services/tile.service';

@Component({
  selector: 'app-root',
  imports: [MapViewer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private tileService = inject(TileService);

  ngOnInit() {
    // Exponer el servicio en la consola para testing
    (window as any).tileService = this.tileService;
    console.log('💡 Prueba cambiar el mapa base desde la consola:');
    console.log('   tileService.setProvider("osm")');
    console.log('   tileService.setProvider("satellite")');
    console.log('   tileService.setProvider("cartoDB")');
    console.log('   tileService.setProvider("argenmap")');
  }
}
