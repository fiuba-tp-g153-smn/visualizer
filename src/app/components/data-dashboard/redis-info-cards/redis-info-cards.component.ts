import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { RedisInfo } from '../../../models/metrics/data-metrics.models';
import { formatBytes } from '../../../services/metrics/data-metrics-chart.util';
import { pct } from '../../../services/metrics/metrics-format.util';
import { StatCardsComponent, type StatCard } from '../stat-cards/stat-cards.component';
import { DASHBOARDS_TEXTS } from '../../../texts';

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
      <div class="empty">{{ t.empty }}</div>
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
  protected readonly t = DASHBOARDS_TEXTS.data.redisInfo;
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
        label: this.t.usedMemory,
        value: formatBytes(i.used_memory),
        tooltip: this.t.usedMemoryHint,
        accent: '',
      },
      {
        label: this.t.rss,
        value: formatBytes(i.used_memory_rss),
        tooltip: this.t.rssHint,
        accent: '',
      },
      {
        label: this.t.peak,
        value: formatBytes(i.used_memory_peak),
        tooltip: this.t.peakHint,
        accent: '',
      },
      {
        label: this.t.maxmemory,
        value: i.maxmemory ? formatBytes(i.maxmemory) : this.t.unlimited,
        tooltip: this.t.maxmemoryHint,
        accent: '',
      },
      {
        label: this.t.fragmentation,
        value: frag == null ? '—' : frag.toFixed(2),
        tooltip: this.t.fragmentationHint,
        accent: frag != null && frag > 1.5 ? 'orange' : '',
      },
      {
        label: this.t.evicted,
        value: (i.evicted_keys ?? 0).toLocaleString('es-AR'),
        tooltip: this.t.evictedHint,
        accent: (i.evicted_keys ?? 0) > 0 ? 'red' : '',
      },
      {
        label: this.t.hitRate,
        value: pct(hitRate),
        tooltip: this.t.hitRateHint,
        accent: '',
      },
      {
        label: this.t.clients,
        value: (i.connected_clients ?? 0).toLocaleString('es-AR'),
        tooltip: this.t.clientsHint,
        accent: '',
      },
    ];
  });
}
