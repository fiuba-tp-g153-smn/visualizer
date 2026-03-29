import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-map-coordinates',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './map-coordinates.html',
  styleUrl: './map-coordinates.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapCoordinatesComponent {
  readonly visible = input<boolean>(false);
  readonly latitude = input<number | null>(null);
  readonly longitude = input<number | null>(null);
}
