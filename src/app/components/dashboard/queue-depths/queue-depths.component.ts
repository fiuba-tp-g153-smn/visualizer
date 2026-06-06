import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { QueueDepths } from '../../../models/metrics/metrics.models';

interface QueueTile {
  readonly key: string;
  readonly value: string;
  readonly sub: string;
}

/**
 * Profundidad de las colas de RabbitMQ (cola de trabajo y descartes/DLQ).
 * Degrada a "N/A" por tile y muestra un aviso de "sin conexión" cuando el
 * broker no responde. Presentacional: recibe `queues` por input.
 */
@Component({
  selector: 'app-queue-depths',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './queue-depths.component.html',
  styleUrl: './queue-depths.component.scss',
})
export class QueueDepthsComponent {
  readonly queues = input<QueueDepths | null>(null);

  readonly tiles = computed<QueueTile[]>(() => {
    const queues = this.queues();
    const fmt = (value: number | null | undefined): string =>
      value == null ? 'N/A' : String(value);
    return [
      { key: 'cola de trabajo', value: fmt(queues?.work), sub: 'en espera' },
      { key: 'descartes (DLQ)', value: fmt(queues?.dlq), sub: 'mensajes' },
    ];
  });

  /** RabbitMQ no responde: sin payload o ambas profundidades nulas. */
  readonly offline = computed<boolean>(() => {
    const queues = this.queues();
    return !queues || (queues.work == null && queues.dlq == null);
  });
}
