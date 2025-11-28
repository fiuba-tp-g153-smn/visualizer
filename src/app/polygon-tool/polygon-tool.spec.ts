import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PolygonTool } from './polygon-tool';

describe('PolygonTool', () => {
  let component: PolygonTool;
  let fixture: ComponentFixture<PolygonTool>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PolygonTool],
    }).compileComponents();

    fixture = TestBed.createComponent(PolygonTool);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
