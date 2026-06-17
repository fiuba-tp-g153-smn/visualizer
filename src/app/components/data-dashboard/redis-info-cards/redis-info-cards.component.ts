import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { RedisInfo } from '../../../models/metrics/data-metrics.models';
import { formatBytes } from '../../../services/metrics/data-metrics-chart.util';
import { pct } from '../../../services/metrics/metrics-format.util';
import { StatCardsComponent, type StatCard } from '../stat-cards/stat-cards.component';

/** Tarjetas con las estadísticas globales de Redis INFO. */
@Component({
  selector: 'app-redis-info-cards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatCardsComponent],
  template: `
    @if (cards().length) {
      <app-stat-cards [cards]="cards()" />
    } @else {
      <div class="empty">Sin snapshot de Redis INFO todavía.</div>
    }
  `,
  styles: `
    .empty {
      padding: 18px;
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant, #5f6368);
    }
  `,
})
export class RedisInfoCardsComponent {
  readonly info = input.required<RedisInfo | null>();

  readonly cards = computed<StatCard[]>(() => {
    const i = this.info();
    if (!i || i.sampled_at == null) {
      return [];
    }
    const hits = i.keyspace_hits ?? 0;
    const misses = i.keyspace_misses ?? 0;
    const hitRate = hits + misses > 0 ? hits / (hits + misses) : null;
    const frag = i.mem_fragmentation_ratio;
    return [
      {
        label: 'used_memory',
        value: formatBytes(i.used_memory),
        tooltip: 'Memoria asignada por Redis a su dataset (INFO used_memory).',
        accent: '',
      },
      {
        label: 'RSS',
        value: formatBytes(i.used_memory_rss),
        tooltip: 'Memoria física reservada por el SO para el proceso Redis (used_memory_rss).',
        accent: '',
      },
      {
        label: 'Max alcanzado',
        value: formatBytes(i.used_memory_peak),
        tooltip: 'Máximo histórico de used_memory desde el arranque (used_memory_peak).',
        accent: '',
      },
      {
        label: 'maxmemory',
        value: i.maxmemory ? formatBytes(i.maxmemory) : 'sin límite',
        tooltip: 'Tope de memoria configurado (0 = sin límite).',
        accent: '',
      },
      {
        label: 'Fragmentación',
        value: frag == null ? '—' : frag.toFixed(2),
        tooltip:
          'mem_fragmentation_ratio = RSS / used_memory. ~1.0 es ideal; >1.5 indica fragmentación alta.',
        accent: frag != null && frag > 1.5 ? 'orange' : '',
      },
      {
        label: 'Claves desalojadas',
        value: (i.evicted_keys ?? 0).toLocaleString('es-AR'),
        tooltip:
          'Claves desalojadas por presión de memoria (evicted_keys). >0 indica que Redis está descartando datos.',
        accent: (i.evicted_keys ?? 0) > 0 ? 'red' : '',
      },
      {
        label: 'Hit rate',
        value: pct(hitRate),
        tooltip: 'keyspace_hits / (hits + misses): proporción de lecturas que encontraron la clave.',
        accent: '',
      },
      {
        label: 'Clientes',
        value: (i.connected_clients ?? 0).toLocaleString('es-AR'),
        tooltip: 'Conexiones de cliente activas (connected_clients).',
        accent: '',
      },
    ];
  });
}
