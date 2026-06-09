import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { QueueDepthsComponent } from './queue-depths.component';
import type { QueueDepths } from '../../../models/metrics/metrics.models';

describe('QueueDepthsComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  function tilesFor(queues: QueueDepths | null) {
    const fixture = TestBed.createComponent(QueueDepthsComponent);
    fixture.componentRef.setInput('queues', queues);
    const byKey = new Map(fixture.componentInstance.tiles().map((t) => [t.key, t]));
    return { fixture, byKey };
  }

  it('renders the total plus the general, light and DLQ tiles from the payload', () => {
    const { byKey } = tilesFor({ work: 3, light: 5, dlq: 0 });

    expect(byKey.get('total en espera')?.value).toBe('8'); // 3 + 5, DLQ excluded
    expect(byKey.get('cola de trabajo general')?.value).toBe('3');
    expect(byKey.get('cola de trabajo ligera')?.value).toBe('5');
    expect(byKey.get('descartes (DLQ)')?.value).toBe('0');
  });

  it('shows N/A for a null light depth', () => {
    const { byKey } = tilesFor({ work: 1, light: null, dlq: 2 });
    expect(byKey.get('cola de trabajo ligera')?.value).toBe('N/A');
  });

  it('shows N/A for the total only when both work queues are null', () => {
    expect(tilesFor({ work: null, light: null, dlq: 7 }).byKey.get('total en espera')?.value).toBe(
      'N/A',
    );
    // A null on one side counts as 0 so the known queue still totals.
    expect(tilesFor({ work: 4, light: null, dlq: 0 }).byKey.get('total en espera')?.value).toBe(
      '4',
    );
  });

  it('is offline when there is no payload', () => {
    const { fixture } = tilesFor(null);
    expect(fixture.componentInstance.offline()).toBe(true);
  });

  it('is offline when all three depths are null', () => {
    const { fixture } = tilesFor({ work: null, light: null, dlq: null });
    expect(fixture.componentInstance.offline()).toBe(true);
  });

  it('is online when at least one depth has a value', () => {
    const { fixture } = tilesFor({ work: null, light: 0, dlq: null });
    expect(fixture.componentInstance.offline()).toBe(false);
  });
});
