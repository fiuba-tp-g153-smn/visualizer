import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Single labeled row used inside alert/polygon cards (icon + label + projected
 * value/action).
 */
@Component({
  selector: 'app-detail-item',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './detail-item.html',
  styleUrl: './detail-item.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailItemComponent {
  readonly icon = input.required<string>();
  readonly label = input.required<string>();
}
