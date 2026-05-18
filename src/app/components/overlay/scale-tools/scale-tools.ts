import { Component, input, output } from '@angular/core';
import { ScaleToolEntry } from '../../../services/tools/scale-tools.service';
import { ScaleToolPanelComponent } from '../scale-tool-panel/scale-tool-panel';

@Component({
  selector: 'app-map-scale-tools',
  standalone: true,
  imports: [ScaleToolPanelComponent],
  templateUrl: './scale-tools.html',
  styleUrl: './scale-tools.scss',
})
export class MapScaleToolsComponent {
  readonly visible = input<boolean>(false);
  readonly entries = input<ReadonlyArray<ScaleToolEntry>>([]);
  readonly close = output<string>();

  onClose(layerId: string): void {
    this.close.emit(layerId);
  }
}
