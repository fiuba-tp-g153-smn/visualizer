import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MainMenuButtonBar } from './main-menu-button-bar';

describe('MainMenuButtonBar', () => {
  let component: MainMenuButtonBar;
  let fixture: ComponentFixture<MainMenuButtonBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainMenuButtonBar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MainMenuButtonBar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
