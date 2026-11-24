import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PanelCloseButtonComponent } from '../../shared/panel-close-button/panel-close-button';
import { COMMON_TEXTS, MAP_TEXTS } from '../../../texts';

/**
 * Tag on the map saying the site is experimental, styled like the attribution. Clicking it
 * shows the notice again; it can be hidden, and turned back on from Herramientas.
 */
@Component({
  selector: 'app-experimental-badge',
  imports: [MatTooltipModule, PanelCloseButtonComponent],
  templateUrl: './experimental-badge.html',
  styleUrl: './experimental-badge.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExperimentalBadgeComponent {
  protected readonly t = COMMON_TEXTS.experimental;
  protected readonly widgets = MAP_TEXTS.widgets;

  readonly open = output<void>();
  readonly close = output<void>();
}
