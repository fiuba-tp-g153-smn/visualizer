import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { RedisMemoryResponse } from '../../../models/metrics/data-metrics.models';
import { formatBytes } from '../../../services/metrics/data-metrics-chart.util';
import { domainLabel } from '../../../services/metrics/data-metrics-labels';

interface Row {
  readonly label: string;
  readonly bytes: string;
  readonly keys: string;
  readonly share: number;
}

/** Tabla de memoria Redis por dominio (bytes + claves + % del total). */
@Component({
  selector: 'app-redis-memory-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rows().length) {
      <table class="tbl">
        <thead>
          <tr>
            <th>dominio</th>
            <th class="num">memoria</th>
            <th class="num">% del total</th>
            <th class="num">claves</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.label) {
            <tr>
              <td>{{ row.label }}</td>
              <td class="num">{{ row.bytes }}</td>
              <td class="num">
                <div class="bar"><span [style.width.%]="row.share"></span></div>
                {{ row.share.toFixed(1) }}%
              </td>
              <td class="num">{{ row.keys }}</td>
            </tr>
          }
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td class="num">{{ totalBytes() }}</td>
            <td class="num">100%</td>
            <td class="num">{{ totalKeys() }}</td>
          </tr>
        </tfoot>
      </table>
    } @else {
      <div class="empty">Sin muestras de memoria todavía (el colector corre cada ~15 min).</div>
    }
  `,
  styles: `
    .tbl {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .tbl th,
    .tbl td {
      padding: 8px 10px;
      text-align: left;
      border-bottom: 1px solid var(--mat-sys-outline-variant, #ececec);
    }
    .tbl th {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--mat-sys-on-surface-variant, #5f6368);
    }
    tfoot td {
      font-weight: 600;
      border-bottom: none;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .bar {
      display: inline-block;
      width: 80px;
      height: 6px;
      margin-right: 6px;
      vertical-align: middle;
      background: var(--mat-sys-surface-container, #eceef0);
      border-radius: 3px;
      overflow: hidden;
    }
    .bar span {
      display: block;
      height: 100%;
      background: var(--metric-info, #0090d0);
    }
    .empty {
      padding: 18px;
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant, #5f6368);
    }
  `,
})
export class RedisMemoryTableComponent {
  readonly memory = input.required<RedisMemoryResponse | null>();

  readonly totalBytes = computed(() => formatBytes(this.memory()?.total_bytes ?? 0));
  readonly totalKeys = computed(() =>
    (this.memory()?.total_keys ?? 0).toLocaleString('es-AR'),
  );

  readonly rows = computed<Row[]>(() => {
    const mem = this.memory();
    if (!mem || !mem.domains.length) {
      return [];
    }
    const total = mem.total_bytes || 1;
    return mem.domains.map((d) => ({
      label: domainLabel(d.domain),
      bytes: formatBytes(d.memory_bytes),
      keys: d.key_count.toLocaleString('es-AR'),
      share: (d.memory_bytes / total) * 100,
    }));
  });
}
