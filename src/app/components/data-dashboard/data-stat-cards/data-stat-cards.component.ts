import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import type { DataMetricsSummary } from '../../../models/metrics/data-metrics.models';
import { formatBytes } from '../../../services/metrics/data-metrics-chart.util';
import { ago } from '../../../services/metrics/metrics-format.util';

type Accent = '' | 'green' | 'orange' | 'red';

interface StatCard {
  readonly label: string;
  readonly value: string;
  readonly tooltip: string;
  readonly accent: Accent;
}

/** Tarjetas del "Resumen general" del panel del data-service. */
@Component({
  selector: 'app-data-stat-cards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatTooltipModule],
  template: `
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
            [class.card__value--green]="card.accent === 'green'"
            [class.card__value--orange]="card.accent === 'orange'"
            [class.card__value--red]="card.accent === 'red'"
          >
            {{ card.value }}
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: 10px;
    }
    .card {
      background: var(--mat-sys-surface, #fff);
      border: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
      border-radius: 8px;
      padding: 10px 12px;
    }
    .card__label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--mat-sys-on-surface-variant, #5f6368);
    }
    .card__label-text {
      flex: 1 1 auto;
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
      margin-top: 6px;
      font-size: 22px;
      font-weight: 600;
      color: var(--mat-sys-on-surface, #1f1f1f);
    }
    .card__value--green {
      color: var(--metric-success, #2e9b51);
    }
    .card__value--orange {
      color: var(--metric-error, #e8702a);
    }
    .card__value--red {
      color: var(--metric-dlq, #d23b4e);
    }
  `,
})
export class DataStatCardsComponent {
  readonly summary = input<DataMetricsSummary | null>(null);

  readonly cards = computed<StatCard[]>(() => {
    const s = this.summary();
    if (!s) {
      return [];
    }
    const topDomain = s.top_domain
      ? `${s.top_domain} · ${formatBytes(s.top_domain_bytes)}`
      : '—';
    return [
      {
        label: 'Memoria Redis usada',
        value: formatBytes(s.used_memory),
        tooltip:
          'Memoria total reportada por Redis (INFO used_memory).\nFuente: colector de Redis, muestra cada ~15 min.',
        accent: '',
      },
      {
        label: 'Claves totales',
        value: s.total_keys.toLocaleString('es-AR'),
        tooltip: 'Cantidad de claves en Redis (DBSIZE).\nFuente: colector de Redis, ~15 min.',
        accent: '',
      },
      {
        label: 'Mayor consumidor',
        value: topDomain,
        tooltip:
          'Dominio que más memoria consume y cuántos bytes ocupa.\nFuente: SCAN + MEMORY USAGE por prefijo de clave, ~15 min.',
        accent: 'orange',
      },
      {
        label: 'Memoria por dominios',
        value: formatBytes(s.total_bytes),
        tooltip:
          'Suma de MEMORY USAGE sobre todas las claves, agrupada por dominio (≈ used_memory, sin el overhead interno de Redis).\nFuente: colector de Redis, ~15 min.',
        accent: '',
      },
      {
        label: 'Dominios de sync',
        value: String(s.active_sync_domains),
        tooltip: 'Dominios con al menos un ciclo registrado en la tabla sync_cycles (SQLite).',
        accent: '',
      },
      {
        label: 'Ciclos de sync',
        value: s.sync_total_cycles.toLocaleString('es-AR'),
        tooltip:
          'Ciclos completados del loop combinado (satélite + radar + ECMWF + WRF).\nFuente: hash sync:status en Redis, actualizado cada ciclo (~60 s).',
        accent: '',
      },
      {
        label: 'Fallos consecutivos',
        value: String(s.sync_consecutive_failures),
        tooltip:
          'Ciclos con errores seguidos del loop de sync (0 = saludable).\nFuente: hash sync:status en Redis.',
        accent: s.sync_consecutive_failures > 0 ? 'red' : 'green',
      },
      {
        label: 'Último sync',
        value: ago(s.last_sync_finished),
        tooltip:
          'Hace cuánto terminó el ciclo más reciente de cualquier dominio.\nFuente: tabla sync_cycles.',
        accent: '',
      },
    ];
  });
}
