import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { EMPTY, Subject, Subscription, debounceTime, finalize, switchMap } from 'rxjs';

import {
  Layer,
  LayerCategory,
  LayerType,
  PointQueryDisplayData,
  TileLayerControls,
} from '../../models';
import { LayerControlService } from './layer-control.service';
import { PointQueryService } from './point-query.service';

interface MouseCoordinates {
  lat: number;
  lon: number;
}

interface ActiveDataLayerEntry {
  layer: Layer;
  controls: TileLayerControls;
}

@Injectable({
  providedIn: 'root',
})
export class PointQueryViewerService {
  private readonly controlService = inject(LayerControlService);
  private readonly pointQueryService = inject(PointQueryService);

  private readonly subscriptions = new Subscription();
  private readonly mouseMoveSubject = new Subject<MouseCoordinates>();
  private readonly queryTriggerSubject = new Subject<{
    layer: ActiveDataLayerEntry;
    coordinates: MouseCoordinates;
  }>();
  private initialized = false;

  readonly carouselIndex = signal<number>(0);
  readonly isPointerMoving = signal<boolean>(false);
  readonly isRequestLoading = signal<boolean>(false);
  readonly pointQueryResult = signal<PointQueryDisplayData | null>(null);
  readonly lastMouseCoordinates = signal<MouseCoordinates | null>(null);
  readonly isFloatingViewerEnabled = signal<boolean>(true);
  readonly isMenuSectionOpen = signal<boolean>(false);

  readonly shouldRunQueries = computed<boolean>(
    () => this.isFloatingViewerEnabled() || this.isMenuSectionOpen(),
  );

  readonly activeDataLayers = computed<ActiveDataLayerEntry[]>(() => {
    return this.controlService
      .activeLayers()
      .filter(
        ({ layer }) =>
          layer.type === LayerType.TILE &&
          (layer.category === LayerCategory.GOES_19 || layer.category === LayerCategory.RADAR),
      )
      .map(({ layer, controls }) => ({
        layer,
        controls: controls as TileLayerControls,
      }));
  });

  readonly currentDataLayer = computed<ActiveDataLayerEntry | null>(() => {
    const layers = this.activeDataLayers();
    if (layers.length === 0) {
      return null;
    }

    const normalizedIndex = ((this.carouselIndex() % layers.length) + layers.length) % layers.length;
    return layers[normalizedIndex] ?? null;
  });

  readonly isPointPanelVisible = computed<boolean>(() => this.activeDataLayers().length > 0);

  readonly isPointPanelLoading = computed<boolean>(
    () => this.isPointerMoving() || this.isRequestLoading(),
  );

  constructor() {
    effect(() => {
      const layers = this.activeDataLayers();
      const currentIndex = this.carouselIndex();

      if (layers.length === 0) {
        this.carouselIndex.set(0);
        this.pointQueryResult.set(null);
        this.isRequestLoading.set(false);
        this.isPointerMoving.set(false);
        return;
      }

      if (currentIndex >= layers.length || currentIndex < 0) {
        this.carouselIndex.set(0);
      }
    });

    effect(() => {
      const currentLayer = this.currentDataLayer();
      const coordinates = this.lastMouseCoordinates();
      const shouldRunQueries = this.shouldRunQueries();

      if (!shouldRunQueries) {
        this.isPointerMoving.set(false);
        this.isRequestLoading.set(false);
        return;
      }

      if (!currentLayer || !coordinates) {
        return;
      }

      this.queryTriggerSubject.next({
        layer: currentLayer,
        coordinates,
      });
    });
  }

  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    this.subscriptions.add(
      this.mouseMoveSubject.pipe(debounceTime(400)).subscribe((coordinates) => {
        this.isPointerMoving.set(false);
        this.lastMouseCoordinates.set(coordinates);
      }),
    );

    this.subscriptions.add(
      this.queryTriggerSubject
        .pipe(
          switchMap(({ layer, coordinates }) => {
            if (!this.shouldRunQueries()) {
              this.isRequestLoading.set(false);
              return EMPTY;
            }

            this.isRequestLoading.set(true);
            return this.pointQueryService
              .queryLayerPoint(layer.layer, layer.controls, coordinates.lat, coordinates.lon)
              .pipe(finalize(() => this.isRequestLoading.set(false)));
          }),
        )
        .subscribe((result) => this.pointQueryResult.set(result)),
    );
  }

  handleMouseMove(lat: number, lon: number): void {
    if (!this.shouldRunQueries()) {
      this.isPointerMoving.set(false);
      return;
    }

    this.isPointerMoving.set(true);
    this.mouseMoveSubject.next({ lat, lon });
  }

  showPreviousLayerValue(): void {
    const total = this.activeDataLayers().length;
    if (total === 0) {
      return;
    }

    this.carouselIndex.set((this.carouselIndex() - 1 + total) % total);
  }

  showNextLayerValue(): void {
    const total = this.activeDataLayers().length;
    if (total === 0) {
      return;
    }

    this.carouselIndex.set((this.carouselIndex() + 1) % total);
  }

  setFloatingViewerEnabled(isEnabled: boolean): void {
    this.isFloatingViewerEnabled.set(isEnabled);
  }

  setMenuSectionOpen(isOpen: boolean): void {
    this.isMenuSectionOpen.set(isOpen);
  }
}
