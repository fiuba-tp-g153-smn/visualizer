import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { NgApexchartsModule } from 'ng-apexcharts';

import type { StageTimings } from '../../../models/metrics/metrics.models';
import {
  buildStagePieChart,
  type StagePieOptions,
} from '../../../services/metrics/metrics-chart.util';

/**
 * Torta (donut) reutilizable del desglose por etapa de un trabajo o tipo.
 * Opcionalmente incluye la porción "Descarga" (tiempo de descarga) vía un toggle.
 * Presentacional: recibe los tiempos por `input` y arma las opciones de ApexCharts.
 */
@Component({
  selector: 'app-stage-pie-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgApexchartsModule, MatSlideToggleModule],
  template: `
    @if ((networkSecs() ?? 0) > 0) {
      <mat-slide-toggle
        class="spc__toggle"
        [checked]="includeRed()"
        (change)="includeRed.set($event.checked)"
      >
        {{ includeRed() ? 'Incluir descarga' : 'Solo procesamiento' }}
      </mat-slide-toggle>
    }

    @if (options().series.length) {
      <apx-chart
        [series]="options().series"
        [chart]="options().chart"
        [labels]="options().labels"
        [colors]="options().colors"
        [legend]="options().legend"
        [dataLabels]="options().dataLabels"
        [tooltip]="options().tooltip"
        [plotOptions]="options().plotOptions"
        [stroke]="options().stroke"
      ></apx-chart>
    } @else {
      <div class="spc__empty">Sin desglose disponible.</div>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .spc__toggle {
      display: block;
      margin-bottom: 8px;
      font-size: 12px;
    }

    .spc__empty {
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant, #5f6368);
    }
  `,
})
export class StagePieChartComponent {
  readonly stages = input.required<StageTimings>();
  readonly networkSecs = input<number | null>(null);
  readonly height = input<number>(280);
  readonly legendPosition = input<'bottom' | 'right'>('bottom');

  readonly includeRed = signal(true);

  readonly options = computed<StagePieOptions>(() =>
    buildStagePieChart(
      this.stages(),
      this.networkSecs(),
      this.includeRed(),
      this.height(),
      this.legendPosition(),
    ),
  );
}
