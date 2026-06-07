import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as echarts from 'echarts';

import type { RecentJob } from '../../../models/metrics/metrics.models';
import {
  buildEchartsOption,
  type EchartsTimelineDatum,
} from '../../../services/metrics/echarts-timeline.util';
import {
  legendItems,
  ROW_HEIGHT,
  type TimelineColorBy,
} from '../../../services/metrics/timeline-shared.util';
import {
  TIMEZONE_MODES,
  TimezoneSettingsService,
} from '../../../services/settings/timezone-settings.service';

const DRAG_THRESHOLD_PX = 6;
type Range = [number, number];

/**
 * Línea de tiempo de unidades con **Apache ECharts** (serie `custom` sobre eje
 * de tiempo, canvas). Zoom: rueda, y **arrastrar para seleccionar un rango**
 * (banda → acción `dataZoom`). Botones: volver al zoom anterior (historial) y
 * ver todo. Filas empaquetadas para no solaparse. Presentacional: recibe `jobs`
 * y emite `jobClick`; las horas siguen el toggle de zona horaria.
 */
@Component({
  selector: 'app-job-timeline-echarts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatSlideToggleModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="jt__head">
      <mat-slide-toggle
        class="jt__toggle"
        [checked]="colorBy() === 'type'"
        (change)="colorBy.set($event.checked ? 'type' : 'outcome')"
      >
        {{ colorBy() === 'type' ? 'Color: tipo' : 'Color: resultado' }}
      </mat-slide-toggle>
      <div class="jt__legend">
        @for (item of legend(); track item.label) {
          <span class="jt__legend-item">
            <span class="jt__dot" [style.background]="item.color"></span>{{ item.label }}
          </span>
        }
      </div>
      <span class="jt__spacer"></span>
      <button
        mat-icon-button
        type="button"
        matTooltip="Volver al zoom anterior"
        [disabled]="!canBack()"
        (click)="zoomBack()"
      >
        <mat-icon>undo</mat-icon>
      </button>
      <button mat-icon-button type="button" matTooltip="Ver todo" (click)="zoomAll()">
        <mat-icon>zoom_out_map</mat-icon>
      </button>
    </div>

    @if (!hasData()) {
      <div class="jt__empty">Sin trabajos en este rango.</div>
    }
    <div #wrap class="jt__wrap" (pointerdown)="onDown($event)">
      <div #chart class="jt__chart"></div>
      <div #band class="jt__band" hidden></div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .jt__head {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .jt__toggle {
      font-size: 12px;
    }
    .jt__legend {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .jt__legend-item {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      color: var(--mat-sys-on-surface-variant, #5f6368);
    }
    .jt__dot {
      width: 10px;
      height: 10px;
      border-radius: 2px;
      display: inline-block;
    }
    .jt__spacer {
      flex: 1 1 auto;
    }
    .jt__wrap {
      position: relative;
      cursor: crosshair;
    }
    .jt__chart {
      width: 100%;
      height: 200px;
    }
    .jt__band {
      position: absolute;
      top: 0;
      bottom: 0;
      background: rgba(0, 144, 208, 0.15);
      border: 1px solid rgba(0, 144, 208, 0.5);
      pointer-events: none;
      z-index: 2;
    }
    .jt__empty {
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant, #5f6368);
    }
  `,
})
export class JobTimelineEchartsComponent {
  readonly jobs = input.required<readonly RecentJob[]>();
  readonly jobClick = output<RecentJob>();

  private readonly timezone = inject(TimezoneSettingsService);
  private readonly chartEl = viewChild.required<ElementRef<HTMLElement>>('chart');
  private readonly wrapEl = viewChild.required<ElementRef<HTMLElement>>('wrap');
  private readonly bandEl = viewChild.required<ElementRef<HTMLElement>>('band');

  readonly colorBy = signal<TimelineColorBy>('outcome');
  private readonly utc = computed<boolean>(() => this.timezone.mode() === TIMEZONE_MODES.UTC);

  readonly hasData = computed<boolean>(() => this.jobs().length > 0);
  readonly legend = computed(() => legendItems(this.jobs(), this.colorBy()));

  readonly canBack = signal(false);

  private chart: echarts.ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Historial de rangos (ms) para "volver al zoom anterior"; null = rango completo.
  private history: Array<Range | null> = [];
  private currentRange: Range | null = null;

  // Estado del arrastre.
  private dragStartX = 0;
  private dragWrapLeft = 0;
  private dragWidth = 0;

  constructor() {
    afterNextRender(() => {
      const host = this.chartEl().nativeElement;
      this.chart = echarts.init(host);
      this.chart.on('click', (params) => {
        const job = (params.data as EchartsTimelineDatum | null | undefined)?.job;
        if (job) {
          this.jobClick.emit(job);
        }
      });
      this.resizeObserver = new ResizeObserver(() => this.chart?.resize());
      this.resizeObserver.observe(host);
      this.render();
    });

    // Re-render cuando cambian los datos, el color o la zona horaria.
    effect(() => {
      this.jobs();
      this.colorBy();
      this.utc();
      this.render();
    });

    inject(DestroyRef).onDestroy(() => {
      this.detachDrag();
      this.resizeObserver?.disconnect();
      this.chart?.dispose();
    });
  }

  private render(): void {
    const chart = this.chart;
    if (!chart) {
      return;
    }
    this.resetZoomState(); // datos nuevos → rango completo, sin historial
    if (!this.hasData()) {
      chart.clear();
      return;
    }
    const { option, lanes } = buildEchartsOption(this.jobs(), {
      utc: this.utc(),
      colorBy: this.colorBy(),
    });
    this.chartEl().nativeElement.style.height = `${Math.max(200, lanes * ROW_HEIGHT + 80)}px`;
    chart.resize();
    chart.setOption(option as unknown as Parameters<echarts.ECharts['setOption']>[0], true);
  }

  // ── Zoom por arrastre (banda → acción dataZoom) ───────────────────────────

  onDown(event: PointerEvent): void {
    if (!this.chart || !this.hasData() || event.button !== 0) {
      return;
    }
    const rect = this.wrapEl().nativeElement.getBoundingClientRect();
    this.dragWrapLeft = rect.left;
    this.dragWidth = rect.width;
    this.dragStartX = this.clampX(event.clientX);
    // Eventos de puntero (no de ratón): zrender hace preventDefault del
    // `pointerdown` y suprimiría los eventos `mouse*` de compatibilidad.
    document.addEventListener('pointermove', this.onMove);
    document.addEventListener('pointerup', this.onUp);
  }

  private readonly onMove = (event: PointerEvent): void => {
    const x = this.clampX(event.clientX);
    const width = Math.abs(x - this.dragStartX);
    if (width <= DRAG_THRESHOLD_PX) {
      return;
    }
    // Se posiciona la banda directamente en el DOM: el listener corre fuera de
    // la zona de Angular, así que no dependemos de la detección de cambios.
    const band = this.bandEl().nativeElement;
    band.style.left = `${Math.min(this.dragStartX, x)}px`;
    band.style.width = `${width}px`;
    band.hidden = false;
  };

  private readonly onUp = (event: PointerEvent): void => {
    this.detachDrag();
    this.bandEl().nativeElement.hidden = true;
    const endX = this.clampX(event.clientX);
    if (!this.chart || Math.abs(endX - this.dragStartX) < DRAG_THRESHOLD_PX) {
      return; // fue un click, no un arrastre → lo maneja chart.on('click')
    }
    const a = this.pxToMs(Math.min(this.dragStartX, endX));
    const b = this.pxToMs(Math.max(this.dragStartX, endX));
    if (a == null || b == null) {
      return;
    }
    this.applyRange([a, b]);
  };

  /** Offset X (relativo al wrap) → ms en el eje de tiempo. */
  private pxToMs(offsetX: number): number | null {
    const value = this.chart?.convertFromPixel({ xAxisIndex: 0 }, offsetX);
    return typeof value === 'number' ? value : null;
  }

  private clampX(clientX: number): number {
    return Math.max(0, Math.min(clientX - this.dragWrapLeft, this.dragWidth));
  }

  private applyRange(range: Range): void {
    this.history.push(this.currentRange);
    this.canBack.set(true);
    this.currentRange = range;
    this.dispatchZoom(range);
  }

  zoomBack(): void {
    if (!this.chart || !this.history.length) {
      return;
    }
    const prev = this.history.pop() ?? null;
    this.canBack.set(this.history.length > 0);
    this.currentRange = prev;
    this.dispatchZoom(prev);
  }

  zoomAll(): void {
    this.history = [];
    this.currentRange = null;
    this.canBack.set(false);
    this.dispatchZoom(null);
  }

  private dispatchZoom(range: Range | null): void {
    const payload = range
      ? { type: 'dataZoom', startValue: range[0], endValue: range[1] }
      : { type: 'dataZoom', start: 0, end: 100 };
    this.chart?.dispatchAction(
      payload as unknown as Parameters<echarts.ECharts['dispatchAction']>[0],
    );
  }

  private resetZoomState(): void {
    this.history = [];
    this.currentRange = null;
    this.canBack.set(false);
  }

  private detachDrag(): void {
    document.removeEventListener('pointermove', this.onMove);
    document.removeEventListener('pointerup', this.onUp);
  }
}
