import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { DashboardComponent } from './dashboard.component';
import { MetricsService } from '../../services/metrics/metrics.service';
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

  it('por defecto no está en modo personalizado y el <select> muestra el preset (7d)', () => {
    expect(component.summaryTableCustom()).toBe(false);
    expect(component.summaryTableSelectValue()).toBe('168');
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
