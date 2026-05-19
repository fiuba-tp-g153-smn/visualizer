import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PanelCloseButtonComponent } from '../../shared/panel-close-button/panel-close-button';

@Component({
  selector: 'app-map-scale',
  standalone: true,
  imports: [PanelCloseButtonComponent],
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
