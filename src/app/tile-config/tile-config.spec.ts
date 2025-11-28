import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TileConfig } from './tile-config';

describe('TileConfig', () => {
  let component: TileConfig;
  let fixture: ComponentFixture<TileConfig>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TileConfig],
    }).compileComponents();

    fixture = TestBed.createComponent(TileConfig);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
