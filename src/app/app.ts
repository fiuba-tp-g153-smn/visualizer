import { Component, inject } from '@angular/core';
import { MapViewer } from './map-viewer/map-viewer';
import { TileService } from './services/tile.service';
import { LayerService } from './services/layer.service';
import { NotificationPanelComponent } from './components/notification-panel/notification-panel';
import { NotificationService } from './services/notification.service';

@Component({
  selector: 'app-root',
  imports: [MapViewer, NotificationPanelComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private tileService = inject(TileService);
  private layerService = inject(LayerService);
  private notificationService = inject(NotificationService);

  ngOnInit() {
    // Exponer servicios en la consola para testing
    (window as any).tileService = this.tileService;
    (window as any).layerService = this.layerService;
    (window as any).notificationService = this.notificationService;
    console.log('💡 Prueba cambiar el mapa base desde la consola:');
    console.log('   tileService.setProvider("osm")');
    console.log('   tileService.setProvider("satellite")');
    console.log('   tileService.setProvider("cartoDB")');
    console.log('   tileService.setProvider("argenmap")');
    console.log('');
    console.log('💡 Prueba gestionar capas:');
    console.log('   layerService.toggleLayer("abi-ch2")');
    console.log('   layerService.toggleLayer("abi-ch13")');
    console.log('   layerService.setOpacity("abi-ch13", 50)');
    console.log('   layerService.moveLayerUp("abi-ch13")');
    console.log('   layerService.moveLayerDown("abi-ch13")');
    console.log('   layerService.activeLayers()');
    console.log('');
    console.log('💡 Prueba el sistema de notificaciones:');
    console.log('   notificationService.error("Capa no disponible", "abi-ch13")');
    console.log('   notificationService.warning("Conexión lenta")');
    console.log('   notificationService.info("Cargando datos...")');
    console.log('   notificationService.success("¡Listo!")');
    console.log('   notificationService.dismissAll()');
  }
}
