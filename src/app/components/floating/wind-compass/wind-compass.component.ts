import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

/**
 * Compact compass dial for a station's wind: an arrow pointing toward the
 * direction the wind comes *from* (meteorological bearing), with the speed in the
 * center. Mirrors Wundermap's wind widget. No arrow when the bearing is unknown
 * (calm / missing).
 */
@Component({
  selector: 'app-wind-compass',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wind-compass.component.html',
  styleUrl: './wind-compass.component.scss',
})
export class WindCompassComponent {
  /** Formatted speed number (e.g. "2"), unit shown separately. */
  @Input() speed = '—';
  @Input() unit = '';
  /** Meteorological bearing the wind comes from (0 = N, clockwise), or null. */
  @Input() deg: number | null = null;
  @Input() direction: string | null = null;

  get hasDirection(): boolean {
    return this.deg !== null && Number.isFinite(this.deg);
  }

  get rotation(): number {
    return this.deg ?? 0;
  }
}
