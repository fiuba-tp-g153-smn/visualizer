import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-map-coordinates',
  standalone: true,
  imports: [DecimalPipe, MatIconModule, MatButtonModule],
  templateUrl: './map-coordinates.html',
  styleUrl: './map-coordinates.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapCoordinatesComponent {
  readonly visible = input<boolean>(false);
  readonly latitude = input<number | null>(null);
  readonly longitude = input<number | null>(null);
  readonly close = output<void>();

  onClose(): void {
    this.close.emit();
  }
}
