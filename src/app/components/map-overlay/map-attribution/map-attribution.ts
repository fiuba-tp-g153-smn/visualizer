import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-map-attribution',
  standalone: true,
  templateUrl: './map-attribution.html',
  styleUrl: './map-attribution.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapAttributionComponent {}
