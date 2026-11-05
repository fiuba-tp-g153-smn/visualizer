import { Injectable, inject, signal } from '@angular/core';
import { LeafletMouseEvent } from 'leaflet';
import { DrawingMode, PolygonDrawingService } from '../polygons/polygon-drawing.service';
import {
  MapContextMenuContext,
  MapContextMenuItem,
  MapContextMenuProvider,
  MapContextMenuSection,
  MapContextMenuState,
} from './map-context-menu.models';

interface RegisteredProvider {
  readonly order: number;
  readonly provider: MapContextMenuProvider;
}

/**
 * Right-click menu over empty map (markers, polygons and alerts keep their own menus).
 * Features contribute sections through {@link register}; sections render in `order`,
 * and an exclusive section replaces all the others while its feature is busy.
 */
@Injectable({ providedIn: 'root' })
export class MapContextMenuService {
  private readonly polygonDrawingService = inject(PolygonDrawingService);

  private readonly providers: RegisteredProvider[] = [];
  private readonly menuState = signal<MapContextMenuState | null>(null);

  readonly state = this.menuState.asReadonly();

  /** Adds a section provider. Lower `order` renders first. */
  register(order: number, provider: MapContextMenuProvider): void {
    this.providers.push({ order, provider });
    this.providers.sort((a, b) => a.order - b.order);
  }

  handleMapContextMenu(event: LeafletMouseEvent): void {
    const target = event.originalEvent?.target;
    if (target instanceof Element && target.closest('.leaflet-interactive')) return;
    if (this.polygonDrawingService.drawingMode() !== DrawingMode.NONE) return;

    const sections = this.collectSections({ lat: event.latlng.lat, lng: event.latlng.lng });
    if (sections.length === 0) return;

    this.menuState.set({
      x: Math.round(event.containerPoint.x),
      y: Math.round(event.containerPoint.y),
      sections,
    });
  }

  run(item: MapContextMenuItem): void {
    this.close();
    item.run();
  }

  close(): void {
    this.menuState.set(null);
  }

  private collectSections(context: MapContextMenuContext): readonly MapContextMenuSection[] {
    const sections = this.providers
      .map(({ provider }) => provider(context))
      .filter((section): section is MapContextMenuSection => section !== null);

    const exclusive = sections.find((section) => section.exclusive);
    const visible = exclusive ? [exclusive] : sections;
    return visible.filter((section) => section.items.length > 0);
  }
}
