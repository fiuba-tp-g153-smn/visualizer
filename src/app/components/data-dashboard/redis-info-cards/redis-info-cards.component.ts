import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import type { RedisInfo } from '../../../models/metrics/data-metrics.models';
import { formatBytes } from '../../../services/metrics/data-metrics-chart.util';
import { pct } from '../../../services/metrics/metrics-format.util';

interface InfoCard {
  readonly label: string;
  readonly value: string;
  readonly tooltip: string;
  readonly accent: '' | 'orange' | 'red';
}

/** Tarjetas con las estadísticas globales de Redis INFO. */
@Component({
  selector: 'app-redis-info-cards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatTooltipModule],
  template: `
    @if (cards().length) {
      <div class="cards">
        @for (card of cards(); track card.label) {
          <div class="card">
            <div class="card__label">
              <span class="card__label-text">{{ card.label }}</span>
              <mat-icon
                class="card__info"
                [matTooltip]="card.tooltip"
                matTooltipClass="stat-tip"
                matTooltipPosition="above"
                >info</mat-icon
              >
            </div>
            <div
              class="card__value"
              [class.card__value--orange]="card.accent === 'orange'"
              [class.card__value--red]="card.accent === 'red'"
            >
              {{ card.value }}
            </div>
          </div>
        }
      </div>
    } @else {
      <div class="empty">Sin snapshot de Redis INFO todavía.</div>
    }
  `,
  styles: `
    // Grilla con divisores (estilo tiles-processor); el marco lo da el panel.
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    }
    .card {
      padding: 12px 14px;
      border-right: 1px solid var(--mat-sys-outline-variant, #ececec);
      border-bottom: 1px solid var(--mat-sys-outline-variant, #ececec);
    }
    .card__label {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .card__label-text {
      font-size: 10px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--mat-sys-on-surface-variant, #5f6368);
    }
    .card__info {
      font-size: 13px;
      width: 13px;
      height: 13px;
      line-height: 13px;
      cursor: help;
      color: var(--mat-sys-on-surface-variant, #5f6368);
    }
    .card__value {
      margin-top: 5px;
      font-size: 30px;
      font-weight: 600;
      line-height: 1.15;
      color: var(--mat-sys-on-surface, #1f1f1f);
      font-variant-numeric: tabular-nums;
    }
    .card__value--orange {
      color: var(--metric-error, #e8702a);
    }
    .card__value--red {
      color: var(--metric-dlq, #d23b4e);
    }
    .empty {
      padding: 18px;
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant, #5f6368);
    }
  `,
})
export class RedisInfoCardsComponent {
  readonly info = input.required<RedisInfo | null>();

  readonly cards = computed<InfoCard[]>(() => {
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
        label: 'Max',
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
