import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { InProgressJob } from '../../../models/metrics/metrics.models';
import { ago } from '../../../services/metrics/metrics-format.util';

/**
 * Trabajos que los workers están procesando ahora mismo, según el rastreador de
 * progreso (SQLite). Es independiente de RabbitMQ. Presentacional: recibe `jobs`.
 */
@Component({
  selector: 'app-in-progress-jobs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './in-progress-jobs.component.html',
  styleUrl: './in-progress-jobs.component.scss',
})
export class InProgressJobsComponent {
  readonly jobs = input<readonly InProgressJob[]>([]);

  since(iso: string): string {
    return ago(iso);
  }
}
