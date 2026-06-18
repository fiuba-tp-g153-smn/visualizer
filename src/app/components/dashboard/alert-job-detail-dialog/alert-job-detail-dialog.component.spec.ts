import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';

import {
  AlertJobDetailDialogComponent,
  type AlertJobDialogData,
} from './alert-job-detail-dialog.component';
import { GifPreviewDialogComponent } from '../../floating/gif-preview-dialog/gif-preview-dialog';
import type { AlertJobMetric } from '../../../models/metrics/alerts-metrics.models';

const JOB: AlertJobMetric = {
  job_id: 'abc',
  phenomenon_code: 1,
  finished_at: '2026-06-18T10:00:00+00:00',
  duration_ms: 1500,
  outcome: 'done',
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

function buildFixture(
  job: AlertJobMetric,
  dialogMock: { open: ReturnType<typeof vi.fn> },
  errorLabel: string | null = null,
) {
  const data: AlertJobDialogData = { job, phenomenon: 'TORMENTAS', errorLabel };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: MAT_DIALOG_DATA, useValue: data }],
  });
  // The component imports MatDialogModule (for the dialog directives), which
  // provides MatDialog at the component injector; override it there so the mock
  // wins over the real service.
  TestBed.overrideComponent(AlertJobDetailDialogComponent, {
    add: { providers: [{ provide: MatDialog, useValue: dialogMock }] },
  });
  return TestBed.createComponent(AlertJobDetailDialogComponent);
}

function build(job: AlertJobMetric, dialogMock: { open: ReturnType<typeof vi.fn> }) {
  return buildFixture(job, dialogMock).componentInstance;
}

describe('AlertJobDetailDialogComponent', () => {
  let dialogMock: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    dialogMock = { open: vi.fn() };
  });

  it('lists both images when both filenames are present', () => {
    const c = build(JOB, dialogMock);
    expect(c.images().map((i) => i.label)).toEqual(['Imagen del área', 'Imagen general']);
  });

  it('lists only the present image when one filename is null', () => {
    const c = build({ ...JOB, gif_gral_filename: null }, dialogMock);
    expect(c.images()).toHaveLength(1);
    expect(c.images()[0].label).toBe('Imagen del área');
  });

  it('lists no images when both filenames are null (failed/old job)', () => {
    const c = build({ ...JOB, gif_area_filename: null, gif_gral_filename: null }, dialogMock);
    expect(c.images()).toHaveLength(0);
  });

  it('openImage opens the GIF preview with the absolute /alerts URL', () => {
    const c = build(JOB, dialogMock);
    c.openImage(c.images()[0]);
    expect(dialogMock.open).toHaveBeenCalledTimes(1);
    const [component, config] = dialogMock.open.mock.calls[0];
    expect(component).toBe(GifPreviewDialogComponent);
    expect(config.data.url).toMatch(/\/alerts\/aviso_260618100000\.gif$/);
  });

  it('renders the category label and full error message for a failed job', () => {
    // No stage timings / no GIFs → no chart or buttons render, so detectChanges
    // is safe (avoids mounting ApexCharts in the test DOM).
    const failed: AlertJobMetric = {
      ...JOB,
      outcome: 'failed',
      error_code: 'area_too_large',
      error_message: 'Affected-area HTML is 2443 characters, exceeds 2000.',
      intersection_ms: null,
      filter_ms: null,
      render_ms: null,
      persist_ms: null,
      gif_area_filename: null,
      gif_gral_filename: null,
    };
    const fixture = buildFixture(failed, dialogMock, 'Área afectada demasiado grande');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Área afectada demasiado grande');
    expect(text).toContain('Affected-area HTML is 2443 characters, exceeds 2000.');
  });
});
