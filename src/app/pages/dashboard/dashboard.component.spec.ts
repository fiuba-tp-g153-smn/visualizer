import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of, Subject, throwError } from 'rxjs';

import { DashboardComponent } from './dashboard.component';
import { MetricsService } from '../../services/metrics/metrics.service';
import type { RecentJob } from '../../models/metrics/metrics.models';
import { TimezoneSettingsService } from '../../services/settings/timezone-settings.service';

/** Evento sintético de un <select> (el handler lee `event.target.value`). */
function selectEvent(value: string): Event {
  return { target: { value } } as unknown as Event;
}

/** Stub mínimo de <input> (el handler lee/escribe `input.value`). */
function inputEl(value: string): HTMLInputElement {
  return { value } as HTMLInputElement;
}

describe('DashboardComponent — rango personalizado del panel "por tipo de trabajo"', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let getSummary: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getSummary = vi.fn(() => of([]));
    // El constructor del componente dispara refresh(), que toca todo el API de
    // métricas; mockeamos cada método para que la construcción no haga HTTP real.
    const metricsMock = {
      getSummary,
      getJobs: vi.fn(() => of([])),
      getThroughput: vi.fn(() => of([])),
      getTimeSeries: vi.fn(() => of([])),
      getLive: vi.fn(() => of({})),
    } as unknown as MetricsService;

    TestBed.configureTestingModule({
      providers: [
        { provide: MetricsService, useValue: metricsMock },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: TimezoneSettingsService, useValue: { mode: () => 'local' } },
      ],
    });

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    // refresh() ya llamó a getSummary durante la construcción; limpiamos el
    // historial para asertar solo las llamadas que dispara cada test.
    getSummary.mockClear();
  });

  afterEach(() => fixture.destroy());

  it('por defecto no está en modo personalizado y el <select> muestra el preset (24h)', () => {
    expect(component.summaryTableCustom()).toBe(false);
    expect(component.summaryTableSelectValue()).toBe('24');
  });

  it('elegir "personalizado" activa el modo y recarga con las horas por defecto (48)', () => {
    component.onSummaryTableWindowChange(selectEvent('custom'));

    expect(component.summaryTableCustom()).toBe(true);
    expect(component.summaryTableSelectValue()).toBe('custom');
    expect(getSummary).toHaveBeenLastCalledWith(48);
  });

  it('confirmar un valor válido consulta el resumen con ese número de horas', () => {
    component.onSummaryTableWindowChange(selectEvent('custom'));
    const el = inputEl('12');

    component.onSummaryTableCustomHoursChange(el);

    expect(component.summaryTableCustomHours()).toBe(12);
    expect(el.value).toBe('12');
    expect(getSummary).toHaveBeenLastCalledWith(12);
  });

  it('recorta por arriba a 720 (30 días) y reescribe el campo', () => {
    component.onSummaryTableWindowChange(selectEvent('custom'));
    const el = inputEl('9999');

    component.onSummaryTableCustomHoursChange(el);

    expect(component.summaryTableCustomHours()).toBe(720);
    expect(el.value).toBe('720');
    expect(getSummary).toHaveBeenLastCalledWith(720);
  });

  it('entradas inválidas (0, negativos, basura, vacío) conservan el último valor válido', () => {
    component.onSummaryTableWindowChange(selectEvent('custom'));
    component.onSummaryTableCustomHoursChange(inputEl('100')); // último válido = 100

    for (const bad of ['0', '-5', 'abc', '']) {
      const el = inputEl(bad);
      component.onSummaryTableCustomHoursChange(el);
      expect(component.summaryTableCustomHours()).toBe(100);
      expect(el.value).toBe('100'); // el campo se corrige al último válido
    }
    expect(getSummary).toHaveBeenLastCalledWith(100);
  });

  it('volver a un preset desactiva el modo y conserva el valor personalizado', () => {
    component.onSummaryTableWindowChange(selectEvent('custom'));
    component.onSummaryTableCustomHoursChange(inputEl('12'));

    component.onSummaryTableWindowChange(selectEvent('24'));
    expect(component.summaryTableCustom()).toBe(false);
    expect(component.summaryTableSelectValue()).toBe('24');
    expect(getSummary).toHaveBeenLastCalledWith(24);

    // Re-elegir "personalizado" reusa el último valor (12), no el default.
    component.onSummaryTableWindowChange(selectEvent('custom'));
    expect(getSummary).toHaveBeenLastCalledWith(12);
  });
});

describe('DashboardComponent — rango personalizado del panel de throughput', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let getThroughput: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getThroughput = vi.fn(() => of([]));
    const metricsMock = {
      getSummary: vi.fn(() => of([])),
      getJobs: vi.fn(() => of([])),
      getThroughput,
      getTimeSeries: vi.fn(() => of([])),
      getLive: vi.fn(() => of({})),
    } as unknown as MetricsService;

    TestBed.configureTestingModule({
      providers: [
        { provide: MetricsService, useValue: metricsMock },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: TimezoneSettingsService, useValue: { mode: () => 'local' } },
      ],
    });

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    // El constructor ya disparó getThroughput (loadTp10 + loadCharts); limpiamos
    // para asertar solo las llamadas de cada test. El panel de 10 min usa '10min'.
    getThroughput.mockClear();
  });

  afterEach(() => fixture.destroy());

  it('por defecto no está en modo personalizado y el <select> muestra el preset (6h)', () => {
    expect(component.tpCustom()).toBe(false);
    expect(component.tpSelectValue()).toBe('6');
  });

  it('elegir "personalizado" activa el modo y recarga con las horas por defecto (12)', () => {
    component.onTpWindowChange(selectEvent('custom'));

    expect(component.tpCustom()).toBe(true);
    expect(component.tpSelectValue()).toBe('custom');
    expect(getThroughput).toHaveBeenLastCalledWith('10min', 12);
  });

  it('confirmar un valor válido consulta el throughput con ese número de horas', () => {
    component.onTpWindowChange(selectEvent('custom'));
    const el = inputEl('5');

    component.onTpCustomHoursChange(el);

    expect(component.tpCustomHours()).toBe(5);
    expect(el.value).toBe('5');
    expect(getThroughput).toHaveBeenLastCalledWith('10min', 5);
  });

  it('recorta por arriba a 48 (2 días) y reescribe el campo', () => {
    component.onTpWindowChange(selectEvent('custom'));
    const el = inputEl('9999');

    component.onTpCustomHoursChange(el);

    expect(component.tpCustomHours()).toBe(48);
    expect(el.value).toBe('48');
    expect(getThroughput).toHaveBeenLastCalledWith('10min', 48);
  });

  it('entradas inválidas (0, negativos, basura, vacío) conservan el último valor válido', () => {
    component.onTpWindowChange(selectEvent('custom'));
    component.onTpCustomHoursChange(inputEl('8')); // último válido = 8

    for (const bad of ['0', '-5', 'abc', '']) {
      const el = inputEl(bad);
      component.onTpCustomHoursChange(el);
      expect(component.tpCustomHours()).toBe(8);
      expect(el.value).toBe('8'); // el campo se corrige al último válido
    }
    expect(getThroughput).toHaveBeenLastCalledWith('10min', 8);
  });

  it('volver a un preset desactiva el modo y conserva el valor personalizado', () => {
    component.onTpWindowChange(selectEvent('custom'));
    component.onTpCustomHoursChange(inputEl('5'));

    component.onTpWindowChange(selectEvent('3'));
    expect(component.tpCustom()).toBe(false);
    expect(component.tpSelectValue()).toBe('3');
    expect(getThroughput).toHaveBeenLastCalledWith('10min', 3);

    // Re-elegir "personalizado" reusa el último valor (5), no el default.
    component.onTpWindowChange(selectEvent('custom'));
    expect(getThroughput).toHaveBeenLastCalledWith('10min', 5);
  });
});

describe('DashboardComponent — orden de carga', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let getSummary: ReturnType<typeof vi.fn>;
  let getJob: ReturnType<typeof vi.fn>;
  let openDialog: ReturnType<typeof vi.fn>;
  let timeline$: Subject<RecentJob[]>;

  /** Deja correr las promesas pendientes (firstValueFrom + awaits encadenados). */
  const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
  const job = (id: number): RecentJob => ({ id, finished_at: '2026-10-25T12:00:00Z' }) as RecentJob;

  beforeEach(() => {
    getSummary = vi.fn(() => of([]));
    timeline$ = new Subject<RecentJob[]>();
    getJob = vi.fn((id: number) => of({ ...job(id), image_id: 'full' }));
    openDialog = vi.fn();
    // La línea de tiempo queda pendiente hasta que el test emita.
    const metricsMock = {
      getSummary,
      getJobs: vi.fn(() => of([])),
      getTimeline: vi.fn(() => timeline$),
      getJob,
      getThroughput: vi.fn(() => of([])),
      getTimeSeries: vi.fn(() => of([])),
      getLive: vi.fn(() => of({})),
    } as unknown as MetricsService;

    TestBed.configureTestingModule({
      providers: [
        { provide: MetricsService, useValue: metricsMock },
        { provide: MatDialog, useValue: { open: openDialog } },
        { provide: TimezoneSettingsService, useValue: { mode: () => 'local' } },
      ],
    });
    // Estos tests esperan a que terminen las cargas; sin plantilla no se montan
    // los gráficos (ApexCharts necesita ResizeObserver, ausente en jsdom).
    TestBed.overrideComponent(DashboardComponent, { set: { template: '' } });

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  it('muestra los paneles sin esperar a la línea de tiempo, que queda cargando', async () => {
    await settle();

    expect(component.hasLoaded()).toBe(true);
    expect(component.loading()).toBe(false);
    expect(component.timelineLoading()).toBe(true);
    expect(component.timelineShowChart()).toBe(false);

    timeline$.next([job(1)]);
    timeline$.complete();
    await settle();

    expect(component.timelineLoading()).toBe(false);
    expect(component.timelineJobs()).toHaveLength(1);
    expect(component.timelineShowChart()).toBe(true);
  });

  it('con la misma ventana, una sola consulta de resumen alimenta ambos paneles', async () => {
    await settle();

    expect(getSummary).toHaveBeenCalledTimes(1);
    expect(getSummary).toHaveBeenCalledWith(24);
    expect(component.summaryTable()).toBe(component.summary());
  });

  it('con ventanas distintas consulta el resumen una vez por ventana', async () => {
    await settle();
    component.onSummaryTableWindowChange(selectEvent('168'));
    await settle();
    getSummary.mockClear();

    component.refreshNow();
    await settle();

    expect(getSummary).toHaveBeenCalledTimes(2);
    expect(getSummary).toHaveBeenCalledWith(24);
    expect(getSummary).toHaveBeenCalledWith(168);
  });

  it('un fallo de la línea de tiempo queda en su panel, sin el banner general', async () => {
    await settle();

    timeline$.error(new Error('boom'));
    await settle();

    expect(component.timelineError()).toBe('boom');
    expect(component.timelineLoading()).toBe(false);
    expect(component.errorMsg()).toBeNull();
    expect(component.timelineShowChart()).toBe(false);
  });

  it('descarta la respuesta de una carga reemplazada por un cambio de rango', async () => {
    await settle();
    const first = timeline$;
    timeline$ = new Subject<RecentJob[]>();

    component.onTimelineWindowChange(selectEvent('6'));
    first.next([job(1), job(2)]);
    first.complete();
    await settle();

    expect(component.timelineJobs()).toHaveLength(0);
    expect(component.timelineLoading()).toBe(true);

    timeline$.next([job(3)]);
    timeline$.complete();
    await settle();

    expect(component.timelineJobs().map((j) => j.id)).toEqual([3]);
    expect(component.timelineLoading()).toBe(false);
  });

  it('el clic en una barra pide el trabajo completo y abre el detalle con él', async () => {
    await component.onTimelineJobClick(job(7));

    expect(getJob).toHaveBeenCalledWith(7);
    const data = openDialog.mock.calls[0][1].data as RecentJob;
    expect(data.image_id).toBe('full');
  });

  it('si falla el pedido del detalle, abre el diálogo con el registro parcial', async () => {
    getJob.mockReturnValue(throwError(() => new Error('down')));
    const slim = job(7);

    await component.onTimelineJobClick(slim);

    expect(openDialog.mock.calls[0][1].data).toBe(slim);
  });
});
