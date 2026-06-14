import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DetailItemComponent } from '../../../../shared/detail-item/detail-item';

export type AlertListItemMode = 'draft' | 'pending' | 'active';

/** Data-driven definition of a simple icon + label + value detail row. */
export interface DetailRowConfig {
  readonly icon: string;
  readonly label: string;
  readonly value: string;
  /** Extra class(es) applied to the value span (e.g. for emphasis). */
  readonly valueClass?: string;
  /** Inline color applied to the value span. */
  readonly valueColor?: string;
  /** Renders a divider above this row. */
  readonly dividerBefore?: boolean;
  /** Tooltip shown when hovering the row's value. */
  readonly tooltip?: string;
  /** Highlights the row (icon + value) with the warning/error color. */
  readonly warn?: boolean;
}

/**
 * Shared card shell for the ACP panel lists (drafts, pending and active
 * alerts): title + action buttons header, data-driven detail rows, optional
 * custom rows via content projection, and an optional footer (e.g. the
 * "Generar aviso" button for drafts).
 */
@Component({
  selector: 'app-alert-list-item',
  standalone: true,
  imports: [MatDividerModule, MatIconModule, MatTooltipModule, DetailItemComponent],
  templateUrl: './alert-list-item.html',
  styleUrl: './alert-list-item.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertListItemComponent {
  readonly mode = input.required<AlertListItemMode>();
  readonly title = input.required<string>();
  readonly hidden = input<boolean>(false);
  readonly details = input<ReadonlyArray<DetailRowConfig>>([]);

  /** Emitted when the title is clicked, to e.g. fly the map to this item's geometry. */
  readonly titleClick = output<void>();
}
