import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { PanelCloseButtonComponent } from '../../shared/panel-close-button/panel-close-button';
import { MAP_TEXTS } from '../../../texts';

@Component({
  selector: 'app-map-attribution',
  standalone: true,
  imports: [PanelCloseButtonComponent],
  templateUrl: './map-attribution.html',
  styleUrl: './map-attribution.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapAttributionComponent {
  protected readonly t = MAP_TEXTS.widgets;
  readonly close = output<void>();

  onClose(): void {
    this.close.emit();
  }
}
