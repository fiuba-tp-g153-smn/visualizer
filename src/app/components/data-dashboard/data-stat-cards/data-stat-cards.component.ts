import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { DataMetricsSummary } from '../../../models/metrics/data-metrics.models';
import { formatBytes } from '../../../services/metrics/data-metrics-chart.util';
import { ago } from '../../../services/metrics/metrics-format.util';
import { StatCardsComponent, type StatCard } from '../stat-cards/stat-cards.component';

/** Tarjetas del "Resumen general" del panel del data-service. */
@Component({
  selector: 'app-data-stat-cards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatCardsComponent],
  template: `<app-stat-cards [cards]="cards()" />`,
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
