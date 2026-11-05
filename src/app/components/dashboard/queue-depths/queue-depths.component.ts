import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { QueueDepths } from '../../../models/metrics/metrics.models';
import { DASHBOARDS_TEXTS } from '../../../texts';

interface QueueTile {
  readonly key: string;
  readonly value: string;
  readonly sub: string;
}

/**
 * Profundidad de las colas de RabbitMQ: total en espera, cola de trabajo general,
 * cola de trabajo ligera (y su desglose radar / WRF) y descartes/DLQ.
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
  protected readonly t = DASHBOARDS_TEXTS.queues;
  readonly queues = input<QueueDepths | null>(null);

  readonly tiles = computed<QueueTile[]>(() => {
    const queues = this.queues();
    const fmt = (value: number | null | undefined): string =>
      value == null ? DASHBOARDS_TEXTS.common.notAvailable : String(value);
    // N/A unless BOTH depths are known — coercing one null to 0 would understate
    // the total (e.g. work=12, light=null must read N/A, not 12).
    const total = queues?.work == null || queues?.light == null ? null : queues.work + queues.light;
    return [
      { key: this.t.totalWaiting, value: fmt(total), sub: this.t.generalPlusLight },
      { key: this.t.generalQueue, value: fmt(queues?.work), sub: this.t.waiting },
      { key: this.t.lightQueue, value: fmt(queues?.light), sub: this.t.radarPlusWrf },
      { key: this.t.lightRadar, value: fmt(queues?.radar_light), sub: this.t.waiting },
      { key: this.t.lightWrf, value: fmt(queues?.wrf_light), sub: this.t.waiting },
      { key: this.t.dlq, value: fmt(queues?.dlq), sub: this.t.messages },
    ];
  });

  /** RabbitMQ no responde: sin payload o todas las profundidades nulas. */
  readonly offline = computed<boolean>(() => {
    const queues = this.queues();
    return !queues || (queues.work == null && queues.light == null && queues.dlq == null);
  });
}
