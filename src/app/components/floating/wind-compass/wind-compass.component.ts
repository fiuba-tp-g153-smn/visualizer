import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { STATIONS_TEXTS } from '../../../texts';

@Component({
  selector: 'app-wind-compass',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wind-compass.component.html',
  styleUrl: './wind-compass.component.scss',
})
export class WindCompassComponent {
  @Input() speed = '—';
  @Input() unit = '';
  @Input() deg: number | null = null;
  @Input() direction: string | null = null;

  get isCalm(): boolean {
    return this.direction === STATIONS_TEXTS.wind.calm;
  }

  get hasDirection(): boolean {
    return !this.isCalm && this.deg !== null && Number.isFinite(this.deg);
  }

  get rotation(): number {
    return this.deg ?? 0;
  }

  get caption(): string {
    if (this.isCalm) {
      return STATIONS_TEXTS.wind.calmCaption;
    }
    return this.direction ? STATIONS_TEXTS.wind.from(this.direction) : STATIONS_TEXTS.wind.noData;
  }
}
