import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { NgApexchartsModule } from 'ng-apexcharts';

import type { StageTimings } from '../../../models/metrics/metrics.models';
import {
  buildStagePieChart,
  type StagePieOptions,
} from '../../../services/metrics/metrics-chart.util';

/**
 * Torta (donut) reutilizable del desglose por etapa de un trabajo o tipo.
 * Opcionalmente incluye la porción "Red" (tiempo de descarga) vía un checkbox.
 * Presentacional: recibe los tiempos por `input` y arma las opciones de ApexCharts.
 */
@Component({
  selector: 'app-stage-pie-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgApexchartsModule, MatCheckboxModule],
  template: `
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

    @if ((networkSecs() ?? 0) > 0) {
      <mat-checkbox
        class="spc__toggle"
        [checked]="includeRed()"
        (change)="includeRed.set($event.checked)"
      >
        Incluir red
      </mat-checkbox>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .spc__toggle {
      display: block;
      margin-top: 8px;
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

  readonly includeRed = signal(false);

  readonly options = computed<StagePieOptions>(() =>
    buildStagePieChart(this.stages(), this.networkSecs(), this.includeRed()),
  );
}
