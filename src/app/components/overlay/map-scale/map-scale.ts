import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-map-scale',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  templateUrl: './map-scale.html',
  styleUrl: './map-scale.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapScaleComponent {
  readonly visible = input<boolean>(false);
  readonly scaleText = input<string>('');
  readonly scaleWidth = input<number>(100);
  readonly close = output<void>();

  onClose(): void {
    this.close.emit();
  }
}
