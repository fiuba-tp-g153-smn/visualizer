import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AlertsDashboardComponent } from './alerts-dashboard.component';
import { AlertsMetricsService } from '../../services/metrics/alerts-metrics.service';
import type { AlertsSummary } from '../../models/metrics/alerts-metrics.models';

const SUMMARY: AlertsSummary = {
  window_hours: 24,
  jobs: {
    total: 3,
    done: 2,
    failed: 1,
    failure_breakdown: { timeout: 1 },
    avg_duration_ms: 1500,
    p95_duration_ms: 3000,
    avg_intersection_ms: 40,
    avg_render_ms: 900,
  },
  processor: {
    sampled_at: '2026-06-17T10:00:00+00:00',
    queue_depth: 1,
    workers: 2,
    respawns: 0,
    jobs_queued_total: 3,
    jobs_done_total: 2,
    jobs_failed_total: 1,
    pending_alerts: 4,
  },
};

function selectEvent(value: string): Event {
  return { target: { value } } as unknown as Event;
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('AlertsDashboardComponent', () => {
  let fixture: ComponentFixture<AlertsDashboardComponent>;
  let component: AlertsDashboardComponent;
  let metricsMock: {
    getSummary: ReturnType<typeof vi.fn>;
    getJobs: ReturnType<typeof vi.fn>;
    getJobsHistory: ReturnType<typeof vi.fn>;
    getProcessorHistory: ReturnType<typeof vi.fn>;
    getLayers: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    metricsMock = {
      getSummary: vi.fn(() => of(SUMMARY)),
      getJobs: vi.fn(() => of([])),
      getJobsHistory: vi.fn(() => of([])),
      getProcessorHistory: vi.fn(() => of([])),
      getLayers: vi.fn(() => of([])),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: AlertsMetricsService, useValue: metricsMock }],
    });
    fixture = TestBed.createComponent(AlertsDashboardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  it('loads metrics on init and derives cards + failure rows', async () => {
    await settle();
    expect(component.hasLoaded()).toBe(true);
    expect(component.summary()?.jobs.total).toBe(3);
    expect(component.cards().length).toBeGreaterThan(0);
    expect(component.failureRows()).toEqual([
      { label: 'Tiempo de generación agotado', count: 1 },
    ]);
  });

  it('onWindowChange updates the window and refetches', async () => {
    await settle();
    metricsMock.getSummary.mockClear();
    component.onWindowChange(selectEvent('168'));
    expect(component.windowHours()).toBe(168);
    expect(metricsMock.getSummary).toHaveBeenCalledWith(168);
  });

  it('onRefreshChange updates the auto-refresh interval', () => {
    component.onRefreshChange(selectEvent('60'));
    expect(component.refreshSecs()).toBe(60);
  });
});
