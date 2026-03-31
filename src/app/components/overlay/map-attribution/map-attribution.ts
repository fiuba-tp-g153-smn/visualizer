import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-map-attribution',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  templateUrl: './map-attribution.html',
  styleUrl: './map-attribution.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapAttributionComponent {
  readonly close = output<void>();

  onClose(): void {
    this.close.emit();
  }
}
