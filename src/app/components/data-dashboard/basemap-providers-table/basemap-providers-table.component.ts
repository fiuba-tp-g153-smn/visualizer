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

type State = 'respaldado' | 'respaldando' | 'pendiente' | 'con errores';

/** ok / attempted como porcentaje con 2 decimales (para que 99.99% siga visible). */
function scrapedPct(ok: number, attempted: number): string {
  return attempted ? `${((ok / attempted) * 100).toFixed(2)}%` : '—';
}

function stateOf(p: BasemapProviderStatus): State {
  if (p.circuit_open) {
    return 'con errores';
  }
  if (p.in_progress) {
    return 'respaldando';
  }
  // Nunca se completó un respaldo ni se intentó ningún tile: aún no respaldado.
  if (p.last_completed == null && p.attempted === 0) {
    return 'pendiente';
  }
  return 'respaldado';
}

function statePill(p: BasemapProviderStatus): Cell {
  const state = stateOf(p);
  if (state === 'con errores') {
    return pillCell('dlq', 'con errores', undefined, p.last_reason ?? '');
  }
  if (state === 'respaldando') {
    return pillCell('requeued', 'respaldando');
  }
  if (state === 'pendiente') {
    return pillCell('skipped', 'pendiente', undefined, 'Sin barridos registrados todavía.');
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
    header: { key: 'respaldado', label: 'respaldado', align: 'center', sortable: true },
    cell: scrapedCell,
    sortValue: (p) => (p.attempted ? p.ok / p.attempted : -1),
  },
  {
    header: { key: 'fallidos', label: 'fallidos', align: 'center', sortable: true },
    cell: (p) =>
      textCell(p.failed.toLocaleString('es-AR'), {
        tone: p.failed === 0 ? undefined : p.circuit_open ? 'err' : 'warn',
        title: p.attempted ? `de ${p.attempted.toLocaleString('es-AR')} intentos` : '',
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
  imports: [SortableTableComponent, StatCardsComponent],
  template: `
    @if (summaryCards().length) {
      <app-stat-cards [cards]="summaryCards()" />
    }
    <app-sortable-table
      [headers]="table().headers"
      [rows]="table().tableRows"
      [initialSort]="initialSort"
      emptyText="El scraper de basemap no está activo (o no hay providers)."
    />
  `,
})
export class BasemapProvidersTableComponent {
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
        label: 'Respaldado',
        value: scrapedPct(ok, attempted),
        tooltip: 'ok / intentos del último barrido, sumado sobre todos los providers.',
        accent: attempted === 0 ? '' : failed === 0 ? 'green' : 'orange',
      },
      {
        label: 'Tiles fallidos',
        value: failed.toLocaleString('es-AR'),
        suffix: attempted ? ` / ${attempted.toLocaleString('es-AR')}` : undefined,
        tooltip:
          'Tiles que fallaron sobre el total de intentos del último barrido (ok + fallidos), sumado sobre todos los providers.',
        accent: failed > 0 ? 'red' : '',
      },
      {
        label: 'Providers',
        value: String(providers.length),
        tooltip: 'Providers de mapa base configurados.',
        accent: '',
      },
      {
        label: 'Con errores',
        value: String(tripped),
        tooltip: 'Providers con el circuito abierto (su tasa de error superó el umbral).',
        accent: tripped > 0 ? 'red' : 'green',
      },
    ];
  });
}
