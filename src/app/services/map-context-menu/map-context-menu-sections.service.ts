import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { LayerType } from '../../models';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../components/floating/confirm-dialog/confirm-dialog';
import { LayerControlService } from '../layers/layer-control.service';
import { LayerConfigService } from '../layers/layer-config.service';
import { SyncPlaybackService } from '../layers/sync-playback.service';
import { PolygonDrawingService } from '../polygons/polygon-drawing.service';
import { NotificationService } from '../notifications/notification.service';
import { MapContextMenuService } from './map-context-menu.service';
import {
  MapContextMenuContext,
  MapContextMenuItem,
  MapContextMenuSection,
} from './map-context-menu.models';

/** Section order in the menu. Feature tools (distance, at 0) render first. */
export const MAP_CONTEXT_MENU_ORDER = {
  ALERTS: 10,
  LAYERS: 20,
  COORDINATES: 100,
} as const;

/** Decimal places for copied coordinates (~1 m). */
const COORDINATE_DECIMALS = 5;

/**
 * General-purpose sections of the map's context menu: drawing an alert polygon, acting on
 * every active layer at once, and copying the clicked coordinates. Registers itself
 * on creation, so the map only needs to inject it.
 */
@Injectable({ providedIn: 'root' })
export class MapContextMenuSectionsService {
  private readonly menu = inject(MapContextMenuService);
  private readonly layerControlService = inject(LayerControlService);
  private readonly layerConfigService = inject(LayerConfigService);
  private readonly syncService = inject(SyncPlaybackService);
  private readonly polygonDrawingService = inject(PolygonDrawingService);
  private readonly notificationService = inject(NotificationService);
  private readonly dialog = inject(MatDialog);

  constructor() {
    this.menu.register(MAP_CONTEXT_MENU_ORDER.ALERTS, () => this.alertsSection());
    this.menu.register(MAP_CONTEXT_MENU_ORDER.LAYERS, () => this.layersSection());
    this.menu.register(MAP_CONTEXT_MENU_ORDER.COORDINATES, (context) =>
      this.coordinatesSection(context),
    );
  }

  private alertsSection(): MapContextMenuSection {
    return {
      items: [
        {
          id: 'alert-draw',
          icon: 'draw',
          label: 'Dibujar polígono',
          run: () => this.polygonDrawingService.startDrawing(),
        },
      ],
    };
  }

  private layersSection(): MapContextMenuSection | null {
    const active = this.layerControlService.activeLayers();
    if (active.length === 0) return null;

    const playable = active
      .map(({ layer }) => layer)
      .filter(
        (layer) =>
          layer.type === LayerType.TILE &&
          (this.layerConfigService.getAvailableTilesets(layer.id)?.length ?? 0) > 1,
      )
      .map(({ id }) => id);
    const syncPlaying = this.syncService.syncState().isPlaying;
    const anyPlaying = syncPlaying || playable.some((id) => this.layerControlService.isPlaying(id));
    const anyIdle = playable.some(
      (id) => !this.layerControlService.isPlaying(id) && !this.isSyncDriven(id),
    );

    const items: MapContextMenuItem[] = [];
    if (anyIdle || (this.hasSyncedLayers() && !syncPlaying)) {
      items.push({
        id: 'layers-play',
        icon: 'play_arrow',
        label: 'Reproducir todas las capas',
        run: () => this.playAll(playable),
      });
    }
    if (anyPlaying) {
      items.push({
        id: 'layers-pause',
        icon: 'pause',
        label: 'Pausar todas las capas',
        run: () => this.pauseAll(playable),
      });
    }
    items.push({
      id: 'layers-clear',
      icon: 'layers_clear',
      label: 'Desactivar todas las capas',
      run: () => this.confirmClearLayers(active.length),
    });
    return { items };
  }

  private coordinatesSection({ lat, lng }: MapContextMenuContext): MapContextMenuSection {
    const text = `${lat.toFixed(COORDINATE_DECIMALS)}, ${lng.toFixed(COORDINATE_DECIMALS)}`;
    return {
      items: [
        {
          id: 'copy-coordinates',
          icon: 'content_copy',
          label: 'Copiar coordenadas',
          run: () => void this.copy(text),
        },
      ],
    };
  }

  private hasSyncedLayers(): boolean {
    return this.syncService.syncState().selectedLayerIds.length > 0;
  }

  private isSyncDriven(layerId: string): boolean {
    return this.syncService.isLayerSelected(layerId);
  }

  /** Synced layers play through the sync timeline; every other layer plays on its own. */
  private playAll(playable: readonly string[]): void {
    if (this.hasSyncedLayers()) this.syncService.play();
    playable
      .filter((id) => !this.isSyncDriven(id) && !this.layerControlService.isPlaying(id))
      .forEach((id) => this.layerControlService.startPlayback(id));
  }

  private pauseAll(playable: readonly string[]): void {
    this.syncService.pause();
    playable.forEach((id) => this.layerControlService.stopPlayback(id));
  }

  private confirmClearLayers(count: number): void {
    const dialogRef = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        data: {
          title: 'Desactivar todas las capas',
          message:
            count === 1 ? '¿Desactivar la capa activa?' : `¿Desactivar las ${count} capas activas?`,
          confirmText: 'Desactivar',
          cancelText: 'Cancelar',
          confirmColor: 'warn',
        },
      },
    );

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.layerControlService
        .activeLayers()
        .forEach(({ layer }) => this.layerControlService.deactivateLayer(layer.id));
    });
  }

  private async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.notificationService.success('Coordenadas copiadas al portapapeles');
    } catch {
      this.notificationService.warning('No se pudieron copiar las coordenadas');
    }
  }
}
