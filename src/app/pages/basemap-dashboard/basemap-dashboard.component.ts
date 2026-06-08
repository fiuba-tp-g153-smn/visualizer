import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MAT_TOOLTIP_DEFAULT_OPTIONS, MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { BasemapProvidersTableComponent } from '../../components/data-dashboard/basemap-providers-table/basemap-providers-table.component';
import { MetricPanelComponent } from '../../components/dashboard/metric-panel/metric-panel.component';
import type { BasemapProviderStatus } from '../../models/metrics/data-metrics.models';
import { DataMetricsService } from '../../services/metrics/data-metrics.service';
import { ago } from '../../services/metrics/metrics-format.util';

type RefreshSeconds = 0 | 10 | 30 | 60;

/** Tooltip del panel del scraper de mapa base. */
const BASEMAP_TIP =
  'Estado en vivo del scraper de mapa base (SQLite propio).\n' +
  '• respaldado · respaldando (cursor z·índice) · con errores\n' +
  '• respaldado % y fallidos = del último barrido (ok / intentos)\n' +
  '• "con errores" = pausado: la tasa de error superó el umbral\n' +
  '• Barrido completo cada ~7 días (no_cache → S3)';

/**
 * Panel del scraper de respaldo de mapa base (pestaña "Mapas base" del shell
 * `/status`). Dueño del estado: trae los providers del data-service y los reparte
 * a la tabla de presentación. Solo se instancia cuando su pestaña está activa,
 * así nada más un panel hace polling a la vez.
 */
@Component({
  selector: 'app-basemap-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MetricPanelComponent,
    BasemapProvidersTableComponent,
  ],
  providers: [
    {
      provide: MAT_TOOLTIP_DEFAULT_OPTIONS,
      useValue: { showDelay: 0, hideDelay: 0, touchendHideDelay: 1000 },
    },
  ],
  templateUrl: './basemap-dashboard.component.html',
  styleUrl: './basemap-dashboard.component.scss',
})
export class BasemapDashboardComponent {
  private readonly metrics = inject(DataMetricsService);
  private readonly destroyRef = inject(DestroyRef);

  /** Texto del tooltip del panel. */
  readonly tip = BASEMAP_TIP;

  // Controles
  readonly refreshSecs = signal<RefreshSeconds>(30);

  // Datos
  readonly providers = signal<readonly BasemapProviderStatus[]>([]);

  readonly updatedAt = signal<string>('—');
  readonly errorMsg = signal<string | null>(null);
  readonly loading = signal<boolean>(false);
  readonly hasLoaded = signal<boolean>(false);
  readonly firstLoad = computed<boolean>(() => this.loading() && !this.hasLoaded());
  readonly reloading = signal<boolean>(false);

  /** Conectividad: true=operativo, false=caído, null=conectando. */
  readonly online = computed<boolean | null>(() => {
    if (this.errorMsg()) {
      return false;
    }
    return this.hasLoaded() ? true : null;
  });

  /** "último barrido hace …" tomando el last_swept más reciente. */
  readonly basemapStamp = computed(() => {
    const times = this.providers()
      .map((p) => p.last_swept)
      .filter((t): t is number => t != null);
    if (!times.length) {
      return '';
    }
    return 'último barrido ' + ago(new Date(Math.max(...times) * 1000).toISOString());
  });

  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const seconds = this.refreshSecs();
      this.clearTimer();
      if (seconds > 0) {
        this.intervalId = setInterval(() => void this.refresh(), seconds * 1000);
      }
    });
    this.destroyRef.onDestroy(() => this.clearTimer());
    void this.refresh();
  }

  onRefreshChange(event: Event): void {
    this.refreshSecs.set(Number((event.target as HTMLSelectElement).value) as RefreshSeconds);
  }

  refreshNow(): void {
    void this.refresh(true);
  }

  private async refresh(foreground = false): Promise<void> {
    if (this.loading()) {
      return;
    }
    this.loading.set(true);
    if (foreground) {
      this.reloading.set(true);
    }
    try {
      this.providers.set(await firstValueFrom(this.metrics.getBasemapProviders()));
      this.updatedAt.set(new Date().toLocaleTimeString());
      this.errorMsg.set(null);
      this.hasLoaded.set(true);
    } catch (error) {
      this.errorMsg.set(this.describeError(error));
    } finally {
      this.loading.set(false);
      this.reloading.set(false);
    }
  }

  private clearTimer(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private describeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return error.status === 0
        ? 'el servicio no responde'
        : `el servicio respondió HTTP ${error.status}`;
    }
    return error instanceof Error ? error.message : 'error desconocido';
  }
}
