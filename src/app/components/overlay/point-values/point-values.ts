import { Component, input, output } from '@angular/core';
import { PointQueryDisplayData } from '../../../models';
import { PointValuePanelComponent } from '../point-value-panel/point-value-panel';

export interface MapPointValueEntry {
  layerId: string;
  layerName: string;
  data: PointQueryDisplayData | null;
  isLoading: boolean;
}

@Component({
  selector: 'app-map-point-values',
  standalone: true,
  imports: [PointValuePanelComponent],
  templateUrl: './point-values.html',
  styleUrl: './point-values.scss',
})
export class MapPointValuesComponent {
  readonly visible = input<boolean>(false);
  readonly entries = input<ReadonlyArray<MapPointValueEntry>>([]);
  readonly close = output<string>();

  onClose(layerId: string): void {
    this.close.emit(layerId);
  }
}
