import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { BasemapProviderStatus } from '../../../models/metrics/data-metrics.models';
import { ago } from '../../../services/metrics/metrics-format.util';
import { SortableTableComponent } from '../../dashboard/sortable-table/sortable-table.component';
import {
  buildTable,
  pillCell,
  textCell,
  type Cell,
  type ColumnSpec,
  type SortState,
} from '../../dashboard/sortable-table/sortable-table.models';

type State = 'respaldado' | 'respaldando' | 'con errores';

interface Summary {
  readonly hasData: boolean;
  readonly scraped: string;
  readonly failedText: string;
  readonly hasFailures: boolean;
}

/** ok / attempted como porcentaje con 2 decimales (para que 99.99% siga visible). */
function scrapedPct(ok: number, attempted: number): string {
  return attempted ? `${((ok / attempted) * 100).toFixed(2)}%` : '—';
}

function stateOf(p: BasemapProviderStatus): State {
  return p.circuit_open ? 'con errores' : p.in_progress ? 'respaldando' : 'respaldado';
}

function statePill(p: BasemapProviderStatus): Cell {
  const state = stateOf(p);
  if (state === 'con errores') {
    return pillCell('dlq', 'con errores', undefined, p.last_reason ?? '');
  }
  if (state === 'respaldando') {
    return pillCell('requeued', 'respaldando');
  }
  return pillCell('success', 'respaldado');
}

function scrapedCell(p: BasemapProviderStatus): Cell {
  const hasSweep = p.attempted > 0;
  const tip = hasSweep
    ? `${p.ok.toLocaleString('es-AR')} ok de ${p.attempted.toLocaleString('es-AR')} intentos` +
      (p.completed ? '' : ' (barrido incompleto)')
    : 'Sin barridos registrados todavía.';
  return textCell(scrapedPct(p.ok, p.attempted), {
    title: tip,
    tone: !hasSweep ? undefined : p.failed === 0 ? 'ok' : 'warn',
  });
}

const COLUMNS: ReadonlyArray<ColumnSpec<BasemapProviderStatus>> = [
  {
    header: { key: 'provider', label: 'provider', align: 'left', sortable: true },
    cell: (p) => textCell(p.name, { strong: true }),
    sortValue: (p) => p.name,
  },
  {
    header: { key: 'estado', label: 'estado', align: 'center', sortable: true },
    cell: statePill,
    sortValue: (p) => stateOf(p),
  },
  {
    header: { key: 'scrapeado', label: 'scrapeado', align: 'center', sortable: true },
    cell: scrapedCell,
    sortValue: (p) => (p.attempted ? p.ok / p.attempted : -1),
  },
  {
    header: { key: 'fallidos', label: 'fallidos', align: 'center', sortable: true },
    cell: (p) =>
      textCell(p.failed.toLocaleString('es-AR'), {
        tone: p.failed === 0 ? undefined : p.circuit_open ? 'err' : 'warn',
      }),
    sortValue: (p) => p.failed,
  },
  {
    header: { key: 'trips', label: 'trips', align: 'center', sortable: true },
    cell: (p) => textCell(String(p.consecutive_trips), { tone: p.consecutive_trips > 0 ? 'err' : undefined }),
    sortValue: (p) => p.consecutive_trips,
  },
  {
    header: { key: 'cursor', label: 'cursor', align: 'center', sortable: true },
    cell: (p) =>
      textCell(
        p.in_progress && p.cursor_zoom != null
          ? `z${p.cursor_zoom} · #${p.cursor_tile_index ?? 0}`
          : '—',
        { muted: true },
      ),
    sortValue: (p) => p.cursor_zoom ?? -1,
  },
  {
    header: { key: 'zooms', label: 'zooms', align: 'center', sortable: true },
    cell: (p) => textCell(`${p.min_zoom}–${p.max_zoom}`, { muted: true }),
    sortValue: (p) => p.min_zoom,
  },
  {
    header: { key: 'completado', label: 'último completado', align: 'center', sortable: true },
    cell: (p) =>
      textCell(
        p.last_completed == null ? '—' : ago(new Date(p.last_completed * 1000).toISOString()),
        { muted: true },
      ),
    sortValue: (p) => p.last_completed ?? -1,
  },
];

/** Tabla por provider del scraper de basemap (progreso + tasa de error), ordenable. */
@Component({
  selector: 'app-basemap-providers-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SortableTableComponent],
  template: `
    @if (summary().hasData) {
      <div class="headline">
        Mapa base · <strong>{{ summary().scraped }}</strong> scrapeado ·
        <strong [class.err]="summary().hasFailures">{{ summary().failedText }}</strong> tiles fallidos
      </div>
    }
    <app-sortable-table
      [headers]="table().headers"
      [rows]="table().tableRows"
      [initialSort]="initialSort"
      emptyText="El scraper de basemap no está activo (o no hay providers)."
    />
  `,
  styles: `
    .headline {
      margin: 0 0 10px 12px;
      font-size: 13px;
      color: var(--mat-sys-on-surface-variant, #5f6368);
    }
    .headline strong {
      color: var(--mat-sys-on-surface, #1f1f1f);
      font-variant-numeric: tabular-nums;
    }
    .headline strong.err {
      color: var(--metric-dlq, #d23b4e);
    }
  `,
})
export class BasemapProvidersTableComponent {
  readonly providers = input.required<readonly BasemapProviderStatus[]>();

  readonly initialSort: SortState = { key: 'fallidos', dir: 'desc' };

  readonly table = computed(() => buildTable(COLUMNS, this.providers()));

  readonly summary = computed<Summary>(() => {
    let attempted = 0;
    let ok = 0;
    let failed = 0;
    for (const p of this.providers()) {
      attempted += p.attempted;
      ok += p.ok;
      failed += p.failed;
    }
    return {
      hasData: attempted > 0,
      scraped: scrapedPct(ok, attempted),
      failedText: failed.toLocaleString('es-AR'),
      hasFailures: failed > 0,
    };
  });
}
