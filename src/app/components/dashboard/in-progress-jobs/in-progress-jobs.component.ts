import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';

import type { InProgressJob } from '../../../models/metrics/metrics.models';
import { ago } from '../../../services/metrics/metrics-format.util';

/** A job row with its "desde" elapsed label precomputed against the live clock. */
type InProgressRow = InProgressJob & { readonly since: string };

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

  /** Ticks every second so the "desde" elapsed time advances between refreshes. */
  private readonly now = signal(Date.now());

  readonly rows = computed<readonly InProgressRow[]>(() =>
    this.jobs().map((job) => ({ ...job, since: ago(job.updated_at, this.now()) })),
  );

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
