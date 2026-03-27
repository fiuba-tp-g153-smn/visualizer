import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ContinuousScale, DiscreteScale, ScaleType, PaletteConfigScale } from '../../models';
import { ScaleToolEntry } from '../../services/layers/scale-tools.service';

@Component({
  selector: 'app-scale-tool-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scale-tool-panel.html',
  styleUrl: './scale-tool-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScaleToolPanelComponent {
  private readonly MAX_DISCRETE_LABELS = 10;
  private readonly PALETTE_FALLBACK_COLOR = '#cccccc';

  @Input({ required: true }) entry!: ScaleToolEntry;

  get isContinuous(): boolean {
    return this.entry.scale.type === ScaleType.CONTINUOUS;
  }

  get isDiscreteOrPaletteConfig(): boolean {
    const type = this.entry.scale.type;
    return type === ScaleType.DISCRETE || type === ScaleType.PALETTE_CONFIG;
  }

  get continuousScale(): ContinuousScale {
    return this.entry.scale as ContinuousScale;
  }

  get discreteScale(): DiscreteScale {
    return this.entry.scale as DiscreteScale;
  }

  get paletteConfigScale(): PaletteConfigScale {
    return this.entry.scale as PaletteConfigScale;
  }

  get verticalLabel(): string {
    return `${this.entry.layerName} (${this.entry.scale.unit})`;
  }

  get continuousScaleLabels(): string[] {
    return this.sortedContinuousStopsDesc.map((stop) => this.formatValue(stop.value));
  }

  get discreteScaleLabels(): string[] {
    return this.sortedDiscreteStepsDesc.map((step) => this.formatValue(step.value));
  }

  get discreteStepLabels(): readonly string[] {
    const steps = this.discreteStepsDesc;
    const total = steps.length;
    if (total === 0) {
      return [];
    }

    const stride = Math.max(1, Math.ceil((total - 1) / Math.max(1, this.MAX_DISCRETE_LABELS - 1)));

    return steps.map((step, index) => {
      const isEdge = index === 0 || index === total - 1;
      const isTick = index % stride === 0;
      return isEdge || isTick ? this.formatValue(step.value) : '';
    });
  }

  get discreteStepsDesc(): readonly { value: number; color: string; label?: string }[] {
    switch (this.entry.scale.type) {
      case ScaleType.PALETTE_CONFIG: {
        const pcScale = this.paletteConfigScale;
        return pcScale.bounds.map((bound, index) => ({
          value: bound,
          color: pcScale.hexColors[index] ?? this.PALETTE_FALLBACK_COLOR,
        }));
      }
      case ScaleType.DISCRETE:
        return this.sortedDiscreteStepsDesc;
      default:
        return [];
    }
  }

  get gradientBackground(): string {
    const sortedStops = this.sortedContinuousStopsAsc;

    if (sortedStops.length < 2) {
      return sortedStops[0]?.color ?? 'transparent';
    }

    const min = sortedStops[0].value;
    const max = sortedStops[sortedStops.length - 1].value;
    const span = max - min;

    if (span <= 0) {
      return sortedStops[sortedStops.length - 1].color;
    }

    const segments = sortedStops
      .map((stop) => {
        const ratio = (stop.value - min) / span;
        const percentFromBottom = Math.max(0, Math.min(100, ratio * 100));
        return `${stop.color} ${percentFromBottom.toFixed(2)}%`;
      })
      .join(', ');

    return `linear-gradient(to top, ${segments})`;
  }

  trackByStepValue(index: number, step: { value: number }): string {
    return `${index}-${step.value}`;
  }

  private get sortedContinuousStopsAsc(): readonly {
    value: number;
    color: string;
    label?: string;
  }[] {
    return [...this.continuousScale.stops].sort((a, b) => a.value - b.value);
  }

  private get sortedContinuousStopsDesc(): readonly {
    value: number;
    color: string;
    label?: string;
  }[] {
    return [...this.sortedContinuousStopsAsc].reverse();
  }

  private get sortedDiscreteStepsDesc(): readonly {
    value: number;
    color: string;
    label?: string;
  }[] {
    return [...this.discreteScale.steps].sort((a, b) => b.value - a.value);
  }

  private formatValue(value: number): string {
    if (Number.isInteger(value)) {
      return value.toString();
    }
    return value.toFixed(1);
  }
}
