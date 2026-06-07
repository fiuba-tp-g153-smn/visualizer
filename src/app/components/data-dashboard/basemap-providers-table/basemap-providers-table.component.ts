import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import type { BasemapProviderStatus } from '../../../models/metrics/data-metrics.models';
import { ago } from '../../../services/metrics/metrics-format.util';

type State = 'idle' | 'scraping' | 'tripped';

interface Row {
  readonly name: string;
  readonly state: State;
  readonly stateLabel: string;
  readonly cursor: string;
  readonly zooms: string;
  readonly lastCompleted: string;
  readonly trips: number;
  readonly reason: string;
}

/** Tabla por provider del scraper de basemap (progreso + circuit breaker). */
@Component({
  selector: 'app-basemap-providers-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatTooltipModule],
  template: `
    @if (rows().length) {
      <table class="tbl">
        <thead>
          <tr>
            <th>provider</th>
            <th>estado</th>
            <th>cursor</th>
            <th class="num">zooms</th>
            <th class="num">trips</th>
            <th>último completado</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.name) {
            <tr>
              <td>{{ row.name }}</td>
              <td>
                <span
                  class="pill"
                  [class.pill--ok]="row.state === 'scraping'"
                  [class.pill--err]="row.state === 'tripped'"
                >
                  {{ row.stateLabel }}
                  @if (row.state === 'tripped' && row.reason) {
                    <mat-icon class="reason" [matTooltip]="row.reason" matTooltipPosition="above"
                      >info</mat-icon
                    >
                  }
                </span>
              </td>
              <td>{{ row.cursor }}</td>
              <td class="num">{{ row.zooms }}</td>
              <td class="num" [class.err]="row.trips > 0">{{ row.trips }}</td>
              <td>{{ row.lastCompleted }}</td>
            </tr>
          }
        </tbody>
      </table>
    } @else {
      <div class="empty">El scraper de basemap no está activo (o no hay providers).</div>
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
      display: inline-flex;
      align-items: center;
      gap: 4px;
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
    .reason {
      font-size: 13px;
      width: 13px;
      height: 13px;
      cursor: help;
    }
    .empty {
      padding: 18px;
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant, #5f6368);
    }
  `,
})
export class BasemapProvidersTableComponent {
  readonly providers = input.required<readonly BasemapProviderStatus[]>();

  readonly rows = computed<Row[]>(() =>
    this.providers().map((p) => {
      const state: State = p.circuit_open ? 'tripped' : p.in_progress ? 'scraping' : 'idle';
      return {
        name: p.name,
        state,
        stateLabel:
          state === 'tripped' ? 'circuito abierto' : state === 'scraping' ? 'scrapeando' : 'ocioso',
        cursor:
          p.in_progress && p.cursor_zoom != null
            ? `z${p.cursor_zoom} · #${p.cursor_tile_index ?? 0}`
            : '—',
        zooms: `${p.min_zoom}–${p.max_zoom}`,
        lastCompleted:
          p.last_completed == null ? '—' : ago(new Date(p.last_completed * 1000).toISOString()),
        trips: p.consecutive_trips,
        reason: p.last_reason ?? '',
      };
    }),
  );
}
