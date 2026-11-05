import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';

import { GraticulePart, MapInfoService } from '../../../../../services/layers/map-info.service';
import { DistanceToolService } from '../../../../../services/tools/distance-tool.service';
import { formatDistance } from '../../../../../utils/distance.utils';
import { MAP_TEXTS } from '../../../../../texts';

interface GraticulePartOption {
  readonly id: GraticulePart;
  readonly label: string;
  readonly tooltip: string;
}

const PARTS = MAP_TEXTS.tools.graticuleParts;

const GRATICULE_PART_OPTIONS: ReadonlyArray<GraticulePartOption> = [
  { id: 'major', ...PARTS.major },
  { id: 'minor', ...PARTS.minor },
  { id: 'notable', ...PARTS.notable },
  { id: 'labels', ...PARTS.labels },
];

@Component({
  selector: 'app-general-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatCheckboxModule, MatDividerModule, MatTooltipModule],
  templateUrl: './general-tab.html',
  styleUrl: './general-tab.scss',
})
export class GeneralTabComponent {
  protected readonly t = MAP_TEXTS.tools;
  readonly mapInfo = inject(MapInfoService);
  private readonly distanceTool = inject(DistanceToolService);

  readonly graticuleParts = GRATICULE_PART_OPTIONS;

  /** Checked from starting a measurement until it is cleared (measuring, done or editing). */
  readonly isMeasuring = computed(() => this.distanceTool.mode() !== 'idle');

  /** Two or more points: the status is the (live-updating) total rather than a hint. */
  readonly hasTotal = computed(() => this.distanceTool.points().length >= 2);

  readonly measureStatus = computed((): string => {
    if (this.distanceTool.points().length < 2) {
      return this.t.measurePrompt;
    }
    return this.t.measureTotal(formatDistance(this.distanceTool.totalMeters()));
  });

  onCoordinatesChange(enabled: boolean): void {
    this.mapInfo.toggleCoordinates(enabled);
  }

  onScaleChange(enabled: boolean): void {
    this.mapInfo.toggleScale(enabled);
  }

  onZoomChange(enabled: boolean): void {
    this.mapInfo.toggleZoom(enabled);
  }

  onAttributionChange(enabled: boolean): void {
    this.mapInfo.toggleAttribution(enabled);
  }

  onCursorLinesChange(enabled: boolean): void {
    this.mapInfo.toggleCursorLines(enabled);
  }

  onGraticuleChange(enabled: boolean): void {
    this.mapInfo.toggleGraticule(enabled);
  }

  onGraticulePartChange(part: GraticulePart, visible: boolean): void {
    this.mapInfo.setGraticulePart(part, visible);
  }

  /** Checking starts a measurement; unchecking removes it, whatever stage it is in. */
  onDistanceChange(enabled: boolean): void {
    if (enabled) {
      this.distanceTool.start();
    } else {
      this.distanceTool.clear();
    }
  }
}
