import { Component, input } from '@angular/core';
import { ScaleToolEntry } from '../../../services/layers/scale-tools.service';
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
}
