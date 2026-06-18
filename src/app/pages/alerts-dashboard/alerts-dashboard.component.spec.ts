import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { AlertsDashboardComponent } from './alerts-dashboard.component';
import { AlertsMetricsService } from '../../services/metrics/alerts-metrics.service';
import { DepartmentIntersectionService } from '../../services/polygons/department-intersection.service';
import type { AlertsSummary } from '../../models/metrics/alerts-metrics.models';

// Tests are synchronous and drive signals directly (never awaiting the
// constructor's refresh), so the ApexCharts panels never mount — mirrors the
// Procesamiento dashboard spec and avoids needing a DOM ResizeObserver.

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
    avg_filter_ms: 20,
    avg_render_ms: 900,
    avg_persist_ms: 10,
  },
  processor: {
    sampled_at: '2026-06-18T10:00:00+00:00',
    queue_depth: 0,
    workers: 2,
    respawns: 0,
    jobs_queued_total: 3,
    jobs_done_total: 2,
    jobs_failed_total: 1,
    pending_alerts: 4,
  },
};

const JOB = {
  job_id: 'abc',
  phenomenon_code: 1,
  finished_at: '2026-06-18T10:00:00+00:00',
  duration_ms: 1500,
  outcome: 'done' as const,
  error_code: null,
  error_message: null,
  affected_departments: 5,
  intersection_ms: 40,
  filter_ms: 20,
  render_ms: 900,
  persist_ms: 10,
  polygon_vertices: 10,
  gif_area_filename: 'aviso_260618100000.gif',
  gif_gral_filename: 'avi_gral_260618100000.gif',
};

function selectEvent(value: string): Event {
  return { target: { value } } as unknown as Event;
}

describe('AlertsDashboardComponent', () => {
  let fixture: ComponentFixture<AlertsDashboardComponent>;
  let component: AlertsDashboardComponent;
  let metricsMock: {
    getSummary: ReturnType<typeof vi.fn>;
    getJobs: ReturnType<typeof vi.fn>;
    getJobsHistory: ReturnType<typeof vi.fn>;
  };
  let dialogMock: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    metricsMock = {
      getSummary: vi.fn(() => of(SUMMARY)),
      getJobs: vi.fn(() => of([JOB])),
      getJobsHistory: vi.fn(() => of([])),
    };
    dialogMock = { open: vi.fn() };
    const deptMock = {
      getPhenomena: vi.fn(() => of([{ code: 1, description: 'TORMENTAS' }])),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AlertsMetricsService, useValue: metricsMock },
        { provide: DepartmentIntersectionService, useValue: deptMock },
        { provide: MatDialog, useValue: dialogMock },
      ],
    });
    fixture = TestBed.createComponent(AlertsDashboardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  it('builds separator cards (feminine labels, no "En cola")', () => {
    component.summary.set(SUMMARY);
    const labels = component.cards().map((c) => c.label);
    expect(labels).toContain('Alertas generadas');
    expect(labels).toContain('Exitosas');
    expect(labels).toContain('Fallidas');
    expect(labels).toContain('Pendientes');
    expect(labels).not.toContain('En cola');
  });

  it('derives the failure breakdown rows', () => {
    component.summary.set(SUMMARY);
    expect(component.failureRows()).toEqual([
      { label: 'Tiempo de generación agotado', count: 1 },
    ]);
  });

  it('builds the average-stage seconds dict for the pie', () => {
    component.summary.set(SUMMARY);
    expect(component.avgStages()).toEqual({
      intersect: 0.04,
      filter: 0.02,
      render: 0.9,
      persist: 0.01,
    });
  });

  it('resolves the phenomenon name from the loaded map', () => {
    component.phenomena.set(new Map([[1, 'TORMENTAS']]));
    expect(component.phenomenonName(1)).toBe('TORMENTAS');
  });

  it('onWindowChange updates the window and refetches', () => {
    component.loading.set(false); // clear the constructor's in-flight guard
    metricsMock.getSummary.mockClear();
    component.onWindowChange(selectEvent('168'));
    expect(component.windowHours()).toBe(168);
    expect(metricsMock.getSummary).toHaveBeenCalledWith(168);
  });

  it('onActivityRangeChange switches to a day bucket for long ranges', () => {
    metricsMock.getJobsHistory.mockClear();
    component.onActivityRangeChange(selectEvent('720'));
    expect(component.activityHours()).toBe(720);
    expect(metricsMock.getJobsHistory).toHaveBeenCalledWith(720, 'day');
  });

  it('onRefreshChange updates the auto-refresh interval', () => {
    component.onRefreshChange(selectEvent('60'));
    expect(component.refreshSecs()).toBe(60);
  });

  it('openJob opens the detail dialog with the job + phenomenon', () => {
    component.phenomena.set(new Map([[1, 'TORMENTAS']]));
    component.openJob(JOB);
    expect(dialogMock.open).toHaveBeenCalledTimes(1);
    const data = dialogMock.open.mock.calls[0][1].data;
    expect(data.job).toBe(JOB);
    expect(data.phenomenon).toBe('TORMENTAS');
  });

  it('builds the failures table with all columns sortable', () => {
    component.summary.set(SUMMARY);
    const t = component.failuresTable();
    expect(t.headers.map((h) => h.key)).toEqual(['motivo', 'cantidad']);
    expect(t.headers.every((h) => h.sortable)).toBe(true);
    expect(t.tableRows[0].sortValues[1]).toBe(1); // count is numeric-sortable
  });

  it('builds the jobs table with sortable columns, row keys and numeric sort values', () => {
    component.jobs.set([JOB]);
    const t = component.jobsTable();
    expect(t.headers.map((h) => h.key)).toEqual([
      'hora',
      'fenomeno',
      'resultado',
      'deptos',
      'duracion',
    ]);
    expect(t.headers.every((h) => h.sortable)).toBe(true);
    expect(t.tableRows[0].key).toBe('abc');
    expect(t.tableRows[0].sortValues[4]).toBe(1500); // duration sorts by raw ms
  });

  it('onJobRowClick opens the dialog for the matching job', () => {
    component.jobs.set([JOB]);
    component.onJobRowClick('abc');
    expect(dialogMock.open).toHaveBeenCalledTimes(1);
    expect(dialogMock.open.mock.calls[0][1].data.job).toBe(JOB);
  });

  it('adapts alert jobs to the timeline RecentJob shape', () => {
    component.phenomena.set(new Map([[1, 'TORMENTAS']]));
    component.timelineJobs.set([JOB]);
    const rj = component.timelineRecentJobs()[0];
    expect(rj.work_unit_id).toBe('abc'); // carries the real id for click-back
    expect(rj.outcome).toBe('success'); // done → success (green)
    expect(rj.job_type).toBe('1'); // phenomenon code
    expect(rj.product_label).toBe('TORMENTAS');
    expect(rj.total_s).toBe(1.5); // 1500 ms
    // started_at = finished_at − duration_ms
    expect(Date.parse(rj.started_at)).toBe(Date.parse(JOB.finished_at) - 1500);
  });

  it('onTimelineJobClick opens the dialog for the matching alert job', () => {
    component.timelineJobs.set([JOB]);
    component.onTimelineJobClick({ work_unit_id: 'abc' } as never);
    expect(dialogMock.open).toHaveBeenCalledTimes(1);
    expect(dialogMock.open.mock.calls[0][1].data.job).toBe(JOB);
  });

  it('onTimelineRangeChange refetches all jobs in the range (limit 0)', () => {
    metricsMock.getJobs.mockClear();
    component.onTimelineRangeChange(selectEvent('720'));
    expect(component.timelineHours()).toBe(720);
    expect(metricsMock.getJobs).toHaveBeenCalledWith(720, 0);
  });
});
