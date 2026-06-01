import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { WindCompassComponent } from './wind-compass.component';

describe('WindCompassComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [WindCompassComponent] });
  });

  it('shows the speed, unit and direction, with an arrow rotated to the bearing', () => {
    const fixture = TestBed.createComponent(WindCompassComponent);
    fixture.componentRef.setInput('speed', '12');
    fixture.componentRef.setInput('unit', 'km/h');
    fixture.componentRef.setInput('deg', 90);
    fixture.componentRef.setInput('direction', 'Este');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('12');
    expect(el.textContent).toContain('km/h');
    expect(el.textContent).toContain('desde el Este');
    const arrow = el.querySelector('g[transform="rotate(90 36 36)"] .wind-compass__arrow');
    expect(arrow).not.toBeNull();
  });

  it('omits the arrow and shows "Sin dato" when the bearing is unknown', () => {
    const fixture = TestBed.createComponent(WindCompassComponent);
    fixture.componentRef.setInput('speed', '0');
    fixture.componentRef.setInput('unit', 'km/h');
    fixture.componentRef.setInput('deg', null);
    fixture.componentRef.setInput('direction', null);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.wind-compass__arrow')).toBeNull();
    expect(el.textContent).toContain('Sin dato');
  });
});
