import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArgentinaMap } from './argentina-map';

describe('ArgentinaMap', () => {
  let component: ArgentinaMap;
  let fixture: ComponentFixture<ArgentinaMap>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArgentinaMap]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ArgentinaMap);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
