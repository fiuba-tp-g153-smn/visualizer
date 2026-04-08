import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ContinuousScale, DiscreteScale, ScaleType, PaletteConfigScale } from '../../../models';
import { ScaleToolEntry } from '../../../services/layers/scale-tools.service';
import {
  convertValueForDisplay,
  getDisplayUnit,
  isKelvinUnit,
} from '../../../utils/unit-conversion.utils';

@Component({
  selector: 'app-scale-tool-panel',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './scale-tool-panel.html',
  styleUrl: './scale-tool-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScaleToolPanelComponent {
  private readonly MAX_DISCRETE_LABELS = 10;
  private readonly PALETTE_FALLBACK_COLOR = '#cccccc';

  @Input({ required: true }) entry!: ScaleToolEntry;
  @Output() close = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }

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
    return `${this.entry.layerName} (${getDisplayUnit(this.entry.scale.unit)})`;
  }

  get scaleTooltip(): string {
    const { min, max } = this.scaleRange;
    return `${this.entry.layerName}\nRango: ${this.formatValue(min)} - ${this.formatValue(max)} ${getDisplayUnit(this.entry.scale.unit)}`;
  }

  get scaleRange(): { min: number; max: number } {
    let min: number;
    let max: number;

    switch (this.entry.scale.type) {
      case ScaleType.CONTINUOUS: {
        const stops = this.sortedContinuousStopsAsc;
        min = stops[0]?.value ?? 0;
        max = stops[stops.length - 1]?.value ?? 0;
        break;
      }
      case ScaleType.DISCRETE: {
        const steps = this.sortedDiscreteStepsDesc;
        min = steps[steps.length - 1]?.value ?? 0;
        max = steps[0]?.value ?? 0;
        break;
      }
      case ScaleType.PALETTE_CONFIG: {
        const bounds = this.paletteConfigScale.bounds;
        min = bounds[0] ?? 0;
        max = bounds[bounds.length - 1] ?? 0;
        break;
      }
      default:
        min = 0;
        max = 0;
    }

    if (isKelvinUnit(this.entry.scale.unit)) {
      min = convertValueForDisplay(min, this.entry.scale.unit);
      max = convertValueForDisplay(max, this.entry.scale.unit);
    }

    return { min, max };
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
        const steps = pcScale.bounds.map((bound, index) => ({
          value: bound,
          color: pcScale.hexColors[index] ?? this.PALETTE_FALLBACK_COLOR,
        }));
        // Invertir orden para que valores positivos queden arriba
        return steps.slice().reverse();
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
    const displayValue = convertValueForDisplay(value, this.entry.scale.unit);

    if (Number.isInteger(displayValue)) {
      return displayValue.toString();
    }
    return displayValue.toFixed(1);
  }
}
