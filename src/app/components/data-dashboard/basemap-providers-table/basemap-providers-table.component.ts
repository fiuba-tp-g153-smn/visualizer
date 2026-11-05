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
import { StatCardsComponent, type StatCard } from '../stat-cards/stat-cards.component';
import { DASHBOARDS_TEXTS } from '../../../texts';

const BP = DASHBOARDS_TEXTS.basemapProviders;

type State = keyof typeof BP.states;

/** ok / attempted como porcentaje con 2 decimales (para que 99.99% siga visible). */
function scrapedPct(ok: number, attempted: number): string {
  return attempted ? `${((ok / attempted) * 100).toFixed(2)}%` : '—';
}

function stateOf(p: BasemapProviderStatus): State {
  if (p.circuit_open) {
    return 'errors';
  }
  if (p.in_progress) {
    return 'backing';
  }
  // Nunca se completó un respaldo ni se intentó ningún tile: aún no respaldado.
  if (p.last_completed == null && p.attempted === 0) {
    return 'pending';
  }
  return 'backed';
}

function statePill(p: BasemapProviderStatus): Cell {
  const state = stateOf(p);
  if (state === 'errors') {
    return pillCell('dlq', BP.states.errors, undefined, p.last_reason ?? '');
  }
  if (state === 'backing') {
    return pillCell('requeued', BP.states.backing);
  }
  if (state === 'pending') {
    return pillCell('skipped', BP.states.pending, undefined, BP.noSweeps);
  }
  return pillCell('success', BP.states.backed);
}

function scrapedCell(p: BasemapProviderStatus): Cell {
  const hasSweep = p.attempted > 0;
  const tip = hasSweep
    ? BP.sweepTip(p.ok.toLocaleString('es-AR'), p.attempted.toLocaleString('es-AR')) +
      (p.completed ? '' : BP.incompleteSweep)
    : BP.noSweeps;
  return textCell(scrapedPct(p.ok, p.attempted), {
    title: tip,
    tone: !hasSweep ? undefined : p.failed === 0 ? 'ok' : 'warn',
  });
}

const COLUMNS: ReadonlyArray<ColumnSpec<BasemapProviderStatus>> = [
  {
    header: { key: 'provider', label: BP.columns.provider, align: 'left', sortable: true },
    cell: (p) => textCell(p.name, { strong: true }),
    sortValue: (p) => p.name,
  },
  {
    header: { key: 'estado', label: BP.columns.state, align: 'center', sortable: true },
    cell: statePill,
    sortValue: (p) => BP.states[stateOf(p)],
  },
  {
    header: { key: 'respaldado', label: BP.columns.backed, align: 'center', sortable: true },
    cell: scrapedCell,
    sortValue: (p) => (p.attempted ? p.ok / p.attempted : -1),
  },
  {
    header: { key: 'fallidos', label: BP.columns.failed, align: 'center', sortable: true },
    cell: (p) =>
      textCell(p.failed.toLocaleString('es-AR'), {
        tone: p.failed === 0 ? undefined : p.circuit_open ? 'err' : 'warn',
        title: p.attempted ? BP.ofAttempts(p.attempted.toLocaleString('es-AR')) : '',
      }),
    sortValue: (p) => p.failed,
  },
  {
    header: { key: 'trips', label: BP.columns.trips, align: 'center', sortable: true },
    cell: (p) =>
      textCell(String(p.consecutive_trips), { tone: p.consecutive_trips > 0 ? 'err' : undefined }),
    sortValue: (p) => p.consecutive_trips,
  },
  {
    header: { key: 'cursor', label: BP.columns.cursor, align: 'center', sortable: true },
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
    header: { key: 'zooms', label: BP.columns.zooms, align: 'center', sortable: true },
    cell: (p) => textCell(`${p.min_zoom}–${p.max_zoom}`, { muted: true }),
    sortValue: (p) => p.min_zoom,
  },
  {
    header: { key: 'completado', label: BP.columns.lastCompleted, align: 'center', sortable: true },
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
  imports: [SortableTableComponent, StatCardsComponent],
  template: `
    @if (summaryCards().length) {
      <app-stat-cards [cards]="summaryCards()" />
    }
    <app-sortable-table
      [headers]="table().headers"
      [rows]="table().tableRows"
      [initialSort]="initialSort"
      [emptyText]="t.empty"
    />
  `,
})
export class BasemapProvidersTableComponent {
  protected readonly t = DASHBOARDS_TEXTS.basemapProviders;
  readonly providers = input.required<readonly BasemapProviderStatus[]>();

  readonly initialSort: SortState = { key: 'fallidos', dir: 'desc' };

  readonly table = computed(() => buildTable(COLUMNS, this.providers()));

  readonly summaryCards = computed<StatCard[]>(() => {
    const providers = this.providers();
    if (!providers.length) {
      return [];
    }
    let attempted = 0;
    let ok = 0;
    let failed = 0;
    let tripped = 0;
    for (const p of providers) {
      attempted += p.attempted;
      ok += p.ok;
      failed += p.failed;
      if (p.circuit_open) {
        tripped += 1;
      }
    }
    return [
      {
        label: BP.cards.backed,
        value: scrapedPct(ok, attempted),
        tooltip: BP.cards.backedHint,
        accent: attempted === 0 ? '' : failed === 0 ? 'green' : 'orange',
      },
      {
        label: BP.cards.failedTiles,
        value: failed.toLocaleString('es-AR'),
        suffix: attempted ? ` / ${attempted.toLocaleString('es-AR')}` : undefined,
        tooltip: BP.cards.failedTilesHint,
        accent: failed > 0 ? 'red' : '',
      },
      {
        label: BP.cards.providers,
        value: String(providers.length),
        tooltip: BP.cards.providersHint,
        accent: '',
      },
      {
        label: BP.cards.withErrors,
        value: String(tripped),
        tooltip: BP.cards.withErrorsHint,
        accent: tripped > 0 ? 'red' : 'green',
      },
    ];
  });
}
