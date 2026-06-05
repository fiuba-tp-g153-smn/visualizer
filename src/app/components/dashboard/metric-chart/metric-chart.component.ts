import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';

import type { MetricsChartOptions } from '../../../services/metrics/metrics-chart.util';

/**
 * Envoltorio fino sobre `apx-chart` que enlaza un objeto `MetricsChartOptions`
 * completo. Reutilizado por todos los gráficos del panel.
 */
@Component({
  selector: 'app-metric-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgApexchartsModule],
  template: `
    @if (options(); as opts) {
      <apx-chart
        [series]="opts.series"
        [chart]="opts.chart"
        [colors]="opts.colors"
        [xaxis]="opts.xaxis"
        [yaxis]="opts.yaxis"
        [stroke]="opts.stroke"
        [fill]="opts.fill"
        [dataLabels]="opts.dataLabels"
        [legend]="opts.legend"
        [grid]="opts.grid"
        [tooltip]="opts.tooltip"
        [plotOptions]="opts.plotOptions"
      ></apx-chart>
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
  `,
})
export class MetricChartComponent {
  readonly options = input<MetricsChartOptions | null>(null);
}
