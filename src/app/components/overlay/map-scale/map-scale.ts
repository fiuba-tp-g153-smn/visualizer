import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-map-scale',
  standalone: true,
  templateUrl: './map-scale.html',
  styleUrl: './map-scale.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapScaleComponent {
  readonly visible = input<boolean>(false);
  readonly scaleText = input<string>('');
  readonly scaleWidth = input<number>(100);
}
