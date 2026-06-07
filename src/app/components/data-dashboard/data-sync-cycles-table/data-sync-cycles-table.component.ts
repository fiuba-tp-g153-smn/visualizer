import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { DataSyncCycle } from '../../../models/metrics/data-metrics.models';
import { domainLabel } from '../../../services/metrics/data-metrics-labels';
import { ago } from '../../../services/metrics/metrics-format.util';

interface Row {
  readonly key: string;
  readonly finished: string;
  readonly label: string;
  readonly downloaded: string;
  readonly errors: number;
  readonly duration: string;
  readonly outcome: string;
}

/** Tabla de ciclos de sync recientes (más nuevos primero). */
@Component({
  selector: 'app-data-sync-cycles-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rows().length) {
      <table class="tbl">
        <thead>
          <tr>
            <th>finalizado</th>
            <th>dominio</th>
            <th class="num">descargado</th>
            <th class="num">errores</th>
            <th class="num">duración</th>
            <th>resultado</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.key) {
            <tr>
              <td>{{ row.finished }}</td>
              <td>{{ row.label }}</td>
              <td class="num">{{ row.downloaded }}</td>
              <td class="num" [class.err]="row.errors > 0">{{ row.errors }}</td>
              <td class="num">{{ row.duration }}</td>
              <td>
                <span class="pill" [class.pill--ok]="row.outcome === 'ok'" [class.pill--err]="row.outcome === 'error'">
                  {{ row.outcome }}
                </span>
              </td>
            </tr>
          }
        </tbody>
      </table>
    } @else {
      <div class="empty">Sin ciclos en la ventana seleccionada.</div>
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
      padding: 7px 10px;
      text-align: left;
      border-bottom: 1px solid var(--mat-sys-outline-variant, #ececec);
    }
    .tbl th {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--mat-sys-on-surface-variant, #5f6368);
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .err {
      color: var(--metric-dlq, #d23b4e);
      font-weight: 600;
    }
    .pill {
      display: inline-block;
      padding: 1px 8px;
      border-radius: 999px;
      font-size: 11px;
      background: var(--metric-skipped-bg, #eceef0);
      color: var(--metric-skipped, #6b7280);
    }
    .pill--ok {
      background: var(--metric-success-bg, #e6f4ec);
      color: var(--metric-success, #2e9b51);
    }
    .pill--err {
      background: var(--metric-error-bg, #fdeee5);
      color: var(--metric-dlq, #d23b4e);
    }
    .empty {
      padding: 18px;
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant, #5f6368);
    }
  `,
})
export class DataSyncCyclesTableComponent {
  readonly cycles = input.required<readonly DataSyncCycle[]>();

  readonly rows = computed<Row[]>(() =>
    this.cycles().map((c, index) => ({
      key: `${c.domain}-${c.finished_at}-${index}`,
      finished: ago(c.finished_at),
      label: domainLabel(c.domain),
      downloaded: c.downloaded.toLocaleString('es-AR'),
      errors: c.errors,
      duration: `${(c.duration_ms / 1000).toFixed(1)}s`,
      outcome: c.outcome,
    })),
  );
}
