import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { InteractivityChecker } from '@angular/cdk/a11y';
import { MapContextMenuComponent } from './map-context-menu';
import { MapContextMenuState } from '../../../services/map-context-menu/map-context-menu.models';

const STATE: MapContextMenuState = {
  x: 10,
  y: 10,
  sections: [
    { items: [{ id: 'first', icon: 'straighten', label: 'Primero', run: () => undefined }] },
    { items: [{ id: 'second', icon: 'content_copy', label: 'Segundo', run: () => undefined }] },
  ],
};

describe('MapContextMenuComponent', () => {
  let fixture: ComponentFixture<MapContextMenuComponent>;
  let host: HTMLElement;

  beforeEach(async () => {
    // jsdom has no layout, so the CDK would see every element as invisible and unfocusable.
    TestBed.configureTestingModule({
      providers: [
        {
          provide: InteractivityChecker,
          useValue: {
            isDisabled: (el: HTMLElement) => el.hasAttribute('disabled'),
            isVisible: () => true,
            isTabbable: (el: HTMLElement) => el.tagName === 'BUTTON',
            isFocusable: (el: HTMLElement) => el.tagName === 'BUTTON',
          },
        },
      ],
    });
    fixture = TestBed.createComponent(MapContextMenuComponent);
    fixture.componentRef.setInput('state', STATE);
    document.body.append(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    host = fixture.nativeElement;
  });

  afterEach(() => host.remove());

  const button = (id: string) =>
    host.querySelector<HTMLButtonElement>(`[data-testid="map-menu-${id}"]`)!;

  it('renders each action as a native button, keyboard-operable by default', () => {
    expect(button('first').tagName).toBe('BUTTON');
    expect(button('second').tagName).toBe('BUTTON');
  });

  it('emits the chosen action', () => {
    const select = vi.fn();
    fixture.componentInstance.select.subscribe(select);

    button('second').click();

    expect(select).toHaveBeenCalledWith(STATE.sections[1].items[0]);
  });

  it('closes on Escape', () => {
    const close = vi.fn();
    fixture.componentInstance.close.subscribe(close);

    button('first').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(close).toHaveBeenCalled();
  });

  it('moves focus to the first action when it opens', async () => {
    await new Promise((resolve) => setTimeout(resolve));
    expect(document.activeElement).toBe(button('first'));
  });
});
