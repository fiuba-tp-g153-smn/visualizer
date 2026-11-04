import { DestroyRef, Directive, ElementRef, effect, inject, input } from '@angular/core';

export interface ContextMenuAnchor {
  /** Click position in pixels, relative to the menu's offset parent (the backdrop). */
  readonly x: number;
  readonly y: number;
}

/** Keeps the menu this far from the edges of the map. */
const EDGE_MARGIN_PX = 8;

/**
 * Positions a context menu at its anchor, opening it towards the left and/or upwards
 * when it would not fit to the right of / below the click. Measures the menu with a
 * ResizeObserver, which runs after layout and before paint, so the flip never shows.
 */
@Directive({
  selector: '[appContextMenuPosition]',
  standalone: true,
})
export class ContextMenuPositionDirective {
  readonly anchor = input.required<ContextMenuAnchor>({ alias: 'appContextMenuPosition' });

  private readonly host: HTMLElement = inject(ElementRef<HTMLElement>).nativeElement;

  constructor() {
    effect(() => this.place(this.anchor()));

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => this.place(this.anchor()));
    observer.observe(this.host);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }

  private place({ x, y }: ContextMenuAnchor): void {
    const bounds = this.host.parentElement;
    const width = this.host.offsetWidth;
    const height = this.host.offsetHeight;

    this.host.style.left = `${bounds ? fit(x, width, bounds.clientWidth) : x}px`;
    this.host.style.top = `${bounds ? fit(y, height, bounds.clientHeight) : y}px`;
  }
}

/** Start of the menu along one axis: after the anchor if it fits, else before it, clamped. */
export function fit(anchor: number, size: number, available: number): number {
  const max = available - EDGE_MARGIN_PX;
  if (anchor + size <= max) return anchor;
  const before = anchor - size;
  if (before >= EDGE_MARGIN_PX) return before;
  return Math.max(EDGE_MARGIN_PX, max - size);
}
