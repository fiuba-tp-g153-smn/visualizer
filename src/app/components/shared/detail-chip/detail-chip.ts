import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * Small pill-shaped action button for inline counts/actions inside a
 * detail-item row (e.g. department count + expand arrow, "Buscar").
 */
@Component({
  selector: 'app-detail-chip',
  standalone: true,
  imports: [MatTooltipModule],
  templateUrl: './detail-chip.html',
  styleUrl: './detail-chip.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailChipComponent {
  readonly disabled = input<boolean>(false);
  readonly tooltip = input<string>('');
  readonly expanded = input<boolean | undefined>(undefined);

  readonly clicked = output<void>();
}
