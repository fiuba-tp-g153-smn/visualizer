import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { InProgressJob, LiveStatus } from '../../../models/metrics/metrics.models';
import { ago } from '../../../services/metrics/metrics-format.util';

interface LiveStat {
  readonly key: string;
  readonly value: string;
  readonly sub: string;
}

/**
 * Vista en vivo: profundidad de colas (RabbitMQ) y trabajos en proceso
 * (rastreador de progreso). Degrada a "n/a" cuando una cola no responde.
 */
@Component({
  selector: 'app-live-status-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './live-status-panel.component.html',
  styleUrl: './live-status-panel.component.scss',
})
export class LiveStatusPanelComponent {
  readonly live = input<LiveStatus | null>(null);

  readonly stats = computed<LiveStat[]>(() => {
    const queues = this.live()?.queues;
    const fmtQueue = (value: number | null | undefined): string =>
      value == null ? 'n/a' : String(value);
    return [
      { key: 'cola de trabajo', value: fmtQueue(queues?.work), sub: 'en espera' },
      { key: 'descartes (DLQ)', value: fmtQueue(queues?.dlq), sub: 'mensajes' },
      { key: 'en proceso', value: String(this.inProgress().length), sub: 'procesándose ahora' },
    ];
  });

  readonly inProgress = computed<readonly InProgressJob[]>(() => this.live()?.in_progress ?? []);

  since(iso: string): string {
    return ago(iso);
  }
}
