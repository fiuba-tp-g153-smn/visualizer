import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { DataSyncDomainStatus } from '../../../models/metrics/data-metrics.models';
import { domainLabel } from '../../../services/metrics/data-metrics-labels';
import { ago } from '../../../services/metrics/metrics-format.util';

interface Row {
  readonly label: string;
  readonly outcome: string;
  readonly last: string;
  readonly duration: string;
  readonly downloaded: string;
  readonly errors: number;
}

/** Tabla de estado por dominio de sincronización (último ciclo de cada uno). */
@Component({
  selector: 'app-data-sync-status-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rows().length) {
      <table class="tbl">
        <thead>
          <tr>
            <th>dominio</th>
            <th>resultado</th>
            <th class="num">descargado</th>
            <th class="num">errores</th>
            <th class="num">duración</th>
            <th>último ciclo</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.label) {
            <tr>
              <td>{{ row.label }}</td>
              <td>
                <span class="pill" [class.pill--ok]="row.outcome === 'ok'" [class.pill--err]="row.outcome === 'error'">
                  {{ row.outcome === 'ok' ? 'ok' : row.outcome === 'error' ? 'error' : row.outcome }}
                </span>
              </td>
              <td class="num">{{ row.downloaded }}</td>
              <td class="num" [class.err]="row.errors > 0">{{ row.errors }}</td>
              <td class="num">{{ row.duration }}</td>
              <td>{{ row.last }}</td>
            </tr>
          }
        </tbody>
      </table>
    } @else {
      <div class="empty">Sin ciclos de sync registrados todavía.</div>
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
export class DataSyncStatusTableComponent {
  readonly domains = input.required<readonly DataSyncDomainStatus[]>();

  readonly rows = computed<Row[]>(() =>
    [...this.domains()]
      .sort((a, b) => domainLabel(a.domain).localeCompare(domainLabel(b.domain)))
      .map((d) => ({
        label: domainLabel(d.domain),
        outcome: d.outcome ?? '—',
        last: ago(d.last_finished),
        duration: d.last_duration_ms == null ? '—' : `${(d.last_duration_ms / 1000).toFixed(1)}s`,
        downloaded: d.last_downloaded == null ? '—' : d.last_downloaded.toLocaleString('es-AR'),
        errors: d.last_errors ?? 0,
      })),
  );
}
