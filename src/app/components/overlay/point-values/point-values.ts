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
  periodLabel?: string;
  runLabel?: string;
  elevationLabel?: string;
  isPlaying: boolean;
  data: PointQueryDisplayData | null;
  isLoading: boolean;
}

interface PointValueColumnEntry extends MapPointValueEntry {
  minDetailLines: number;
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

  readonly columnCount = 2;

  readonly visible = input<boolean>(false);
  readonly entries = input<ReadonlyArray<MapPointValueEntry>>([]);
  readonly layoutMode = input<PointValuesLayoutMode>(PointValuesLayoutMode.FIXED);
  readonly close = output<string>();

  readonly columns = computed<ReadonlyArray<ReadonlyArray<PointValueColumnEntry>>>(() => {
    const groups: MapPointValueEntry[][] = Array.from({ length: this.columnCount }, () => []);
    this.entries().forEach((entry, index) => groups[index % this.columnCount].push(entry));

    const rowCount = Math.max(0, ...groups.map((group) => group.length));
    const columns: PointValueColumnEntry[][] = groups.map(() => []);

    for (let row = 0; row < rowCount; row++) {
      const rowEntries = groups
        .map((group) => group[row])
        .filter((entry): entry is MapPointValueEntry => !!entry);
      const minDetailLines = Math.max(0, ...rowEntries.map(detailLineCount));

      groups.forEach((group, i) => {
        const entry = group[row];
        if (entry) columns[i].push({ ...entry, minDetailLines });
      });
    }

    return [...columns].reverse();
  });

  onClose(layerId: string): void {
    this.close.emit(layerId);
  }
}

function detailLineCount(entry: MapPointValueEntry): number {
  const hasRunLine = !!entry.runLabel;
  const hasPeriodLine = !!(entry.periodLabel || entry.elevationLabel || entry.isPlaying);
  return (hasRunLine ? 1 : 0) + (hasPeriodLine ? 1 : 0);
}
