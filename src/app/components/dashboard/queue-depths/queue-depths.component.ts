import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { QueueDepths } from '../../../models/metrics/metrics.models';

interface QueueTile {
  readonly key: string;
  readonly value: string;
  readonly sub: string;
}

/**
 * Profundidad de las colas de RabbitMQ: total en espera, cola de trabajo general,
 * cola de trabajo ligera y descartes/DLQ.
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
    const total =
      queues?.work == null && queues?.light == null
        ? null
        : (queues?.work ?? 0) + (queues?.light ?? 0);
    return [
      { key: 'total en espera', value: fmt(total), sub: 'general + ligera' },
      { key: 'cola de trabajo general', value: fmt(queues?.work), sub: 'en espera' },
      { key: 'cola de trabajo ligera', value: fmt(queues?.light), sub: 'en espera' },
      { key: 'descartes (DLQ)', value: fmt(queues?.dlq), sub: 'mensajes' },
    ];
  });

  /** RabbitMQ no responde: sin payload o todas las profundidades nulas. */
  readonly offline = computed<boolean>(() => {
    const queues = this.queues();
    return !queues || (queues.work == null && queues.light == null && queues.dlq == null);
  });
}
