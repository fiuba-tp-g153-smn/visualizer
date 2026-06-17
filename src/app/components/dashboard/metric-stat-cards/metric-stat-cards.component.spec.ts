import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { MetricStatCardsComponent } from './metric-stat-cards.component';
import type { JobTypeSummary, StatBlock } from '../../../models/metrics/metrics.models';

const EMPTY_STAT: StatBlock = { avg: null, min: null, max: null, p95: null };

function makeSummary(
  jobType: string,
  partial: Partial<Record<'success' | 'error' | 'dlq' | 'requeued' | 'skipped', number>>,
): JobTypeSummary {
  const counts = { success: 0, error: 0, dlq: 0, requeued: 0, skipped: 0, ...partial };
  const total = counts.success + counts.error + counts.dlq + counts.requeued + counts.skipped;
  return {
    job_type: jobType,
    product_label: null,
    counts: { ...counts, total },
    error_rate: total ? (counts.error + counts.dlq) / total : 0,
    last_finished: '2026-06-04T00:00:00Z',
    total_s: EMPTY_STAT,
    download_s: EMPTY_STAT,
    process_s: EMPTY_STAT,
    stages: {},
  };
}

describe('MetricStatCardsComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('aggregates totals across job types and colours failures/DLQ', () => {
    const fixture = TestBed.createComponent(MetricStatCardsComponent);
    fixture.componentRef.setInput('summary', [
      makeSummary('a', { success: 8, error: 1, dlq: 1 }),
      makeSummary('b', { success: 5, requeued: 2, skipped: 3 }),
    ]);

    const byLabel = new Map(fixture.componentInstance.cards().map((c) => [c.label, c]));
    expect(byLabel.get('Trabajos finalizados')?.value).toBe('20');
    expect(byLabel.get('Éxitos')?.value).toBe('13');
    // 13 ÷ 18 (éxitos + fallos + omitidos; excluye 2 reencolados)
    expect(byLabel.get('Tasa de éxito')?.value).toBe('72.2%');
    expect(byLabel.get('Fallos')?.value).toBe('2');
    expect(byLabel.get('Fallos')?.accent).toBe('orange');
    expect(byLabel.get('Descartes (DLQ)')?.value).toBe('1');
    expect(byLabel.get('Descartes (DLQ)')?.accent).toBe('red');
    expect(byLabel.get('Reencolados')?.value).toBe('2');
    expect(byLabel.get('Omitidos')?.value).toBe('3');
    expect(byLabel.get('Tipos')?.value).toBe('2');
  });

  it('includes omitidos but excludes reencolados in the success rate denominator', () => {
    const fixture = TestBed.createComponent(MetricStatCardsComponent);
    fixture.componentRef.setInput('summary', [
      makeSummary('a', { success: 9, error: 1, requeued: 50, skipped: 10 }),
    ]);
    const byLabel = new Map(fixture.componentInstance.cards().map((c) => [c.label, c]));
    // denom = 9 éxitos + 1 fallo + 10 omitidos = 20; los 50 reencolados se excluyen
    // 9/20 = 45.0%
    expect(byLabel.get('Tasa de éxito')?.value).toBe('45.0%');
  });

  it('shows an em dash for the success rate when there are no jobs', () => {
    const fixture = TestBed.createComponent(MetricStatCardsComponent);
    fixture.componentRef.setInput('summary', []);
    const byLabel = new Map(fixture.componentInstance.cards().map((c) => [c.label, c]));
    expect(byLabel.get('Tasa de éxito')?.value).toBe('—');
    expect(byLabel.get('Fallos')?.accent).toBe('');
  });

  it('shows an em dash when there are only reencolados (excluded from the rate)', () => {
    const fixture = TestBed.createComponent(MetricStatCardsComponent);
    fixture.componentRef.setInput('summary', [makeSummary('a', { requeued: 4 })]);
    const byLabel = new Map(fixture.componentInstance.cards().map((c) => [c.label, c]));
    expect(byLabel.get('Tasa de éxito')?.value).toBe('—');
  });

  it('reports 0.0% when there are only omitidos (counted in the denominator)', () => {
    const fixture = TestBed.createComponent(MetricStatCardsComponent);
    fixture.componentRef.setInput('summary', [makeSummary('a', { skipped: 6 })]);
    const byLabel = new Map(fixture.componentInstance.cards().map((c) => [c.label, c]));
    // 0 éxitos ÷ 6 omitidos = 0.0% (omitidos sí pesan en la tasa)
    expect(byLabel.get('Tasa de éxito')?.value).toBe('0.0%');
  });
});
