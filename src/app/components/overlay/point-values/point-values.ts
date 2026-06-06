import { Component, computed, input, output } from '@angular/core';
import { PointQueryDisplayData } from '../../../models';
import { PointValuePanelComponent } from '../point-value-panel/point-value-panel';

export enum PointValuesLayoutMode {
  FIXED = 'fixed',
  NEAR_MARKER = 'near-marker',
}

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
  readonly PointValuesLayoutMode = PointValuesLayoutMode;

  readonly visible = input<boolean>(false);
  readonly entries = input<ReadonlyArray<MapPointValueEntry>>([]);
  readonly layoutMode = input<PointValuesLayoutMode>(PointValuesLayoutMode.FIXED);
  readonly close = output<string>();

  readonly entryColumns = computed(
    (): Readonly<{
      left: ReadonlyArray<MapPointValueEntry>;
      right: ReadonlyArray<MapPointValueEntry>;
    }> => {
      const left: MapPointValueEntry[] = [];
      const right: MapPointValueEntry[] = [];

      this.entries().forEach((entry, index) => {
        if (index % 2 === 0) {
          right.push(entry);
        } else {
          left.push(entry);
        }
      });

      return { left, right };
    },
  );

  onClose(layerId: string): void {
    this.close.emit(layerId);
  }
}
