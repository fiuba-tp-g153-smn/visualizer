import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LayerList } from './layer-list';

describe('LayerList', () => {
  let component: LayerList;
  let fixture: ComponentFixture<LayerList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LayerList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LayerList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
