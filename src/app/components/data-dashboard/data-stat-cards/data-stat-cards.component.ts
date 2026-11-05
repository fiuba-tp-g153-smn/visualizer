import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { DataMetricsSummary } from '../../../models/metrics/data-metrics.models';
import { formatBytes } from '../../../services/metrics/data-metrics-chart.util';
import { domainLabel } from '../../../services/metrics/data-metrics-labels';
import { ago } from '../../../services/metrics/metrics-format.util';
import { StatCardsComponent, type StatCard } from '../stat-cards/stat-cards.component';
import { DASHBOARDS_TEXTS } from '../../../texts';

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
  /** Nombres de los dominios de sync; alimentan el tooltip de "Dominios de sync". */
  readonly domains = input<readonly string[]>([]);

  readonly cards = computed<StatCard[]>(() => {
    const s = this.summary();
    if (!s) {
      return [];
    }
    const topDomain = s.top_domain ? `${s.top_domain} · ${formatBytes(s.top_domain_bytes)}` : '—';
    const domainLines = this.domains()
      .map((d) => domainLabel(d))
      .sort((a, b) => a.localeCompare(b))
      .map((label) => `• ${label}`)
      .join('\n');
    return [
      {
        label: DASHBOARDS_TEXTS.data.cards.redisMemory,
        value: formatBytes(s.used_memory),
        tooltip: DASHBOARDS_TEXTS.data.cards.redisMemoryHint,
        accent: '',
      },
      {
        label: DASHBOARDS_TEXTS.data.cards.totalKeys,
        value: s.total_keys.toLocaleString('es-AR'),
        tooltip: DASHBOARDS_TEXTS.data.cards.totalKeysHint,
        accent: '',
      },
      {
        label: DASHBOARDS_TEXTS.data.cards.topConsumer,
        value: topDomain,
        tooltip: DASHBOARDS_TEXTS.data.cards.topConsumerHint,
        accent: 'orange',
        // Valor más largo ("dominio · NNN MB"): ocupa dos columnas para no romperse.
        span: 2,
      },
      {
        label: DASHBOARDS_TEXTS.data.cards.domainMemory,
        value: formatBytes(s.total_bytes),
        tooltip: DASHBOARDS_TEXTS.data.cards.domainMemoryHint,
        accent: '',
      },
      {
        label: DASHBOARDS_TEXTS.data.cards.syncDomains,
        value: String(s.active_sync_domains),
        tooltip: domainLines
          ? DASHBOARDS_TEXTS.data.cards.syncDomainsList(domainLines)
          : DASHBOARDS_TEXTS.data.cards.syncDomainsHint,
        accent: '',
      },
      {
        label: DASHBOARDS_TEXTS.data.cards.consecutiveFailures,
        value: String(s.sync_consecutive_failures),
        tooltip: DASHBOARDS_TEXTS.data.cards.consecutiveFailuresHint,
        accent: s.sync_consecutive_failures > 0 ? 'red' : 'green',
      },
      {
        label: DASHBOARDS_TEXTS.data.cards.lastSync,
        value: ago(s.last_sync_finished),
        tooltip: DASHBOARDS_TEXTS.data.cards.lastSyncHint,
        accent: '',
      },
    ];
  });
}
