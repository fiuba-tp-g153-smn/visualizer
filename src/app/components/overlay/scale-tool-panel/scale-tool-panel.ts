import {
  ChangeDetectionStrategy,
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PanelCloseButtonComponent } from '../../shared/panel-close-button/panel-close-button';

import { LayerScale, ScaleColorStop, ScaleLabelScale, ScaleType } from '../../../models';
import { ScaleToolEntry } from '../../../services/tools/scale-tools.service';
import { UnitsSettingsService } from '../../../services/settings/units-settings.service';
import {
  convertValueForDisplay,
  getDisplayUnit,
  isKelvinUnit,
} from '../../../utils/unit-conversion.utils';
import { impliedMinFractionDigits } from '../../../utils/number-format.utils';

@Component({
  selector: 'app-scale-tool-panel',
  standalone: true,
  imports: [CommonModule, MatTooltipModule, PanelCloseButtonComponent],
  templateUrl: './scale-tool-panel.html',
  styleUrl: './scale-tool-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScaleToolPanelComponent {
  private readonly DEFAULT_LABEL_COUNT = 10;
  private readonly DEFAULT_SUBTICK_COUNT = 4;
  private readonly unitsSettings = inject(UnitsSettingsService);

  @Input({ required: true }) entry!: ScaleToolEntry;
  @Output() close = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }

  get isContinuous(): boolean {
    return this.entry.scale.type === ScaleType.CONTINUOUS;
  }

  get isLogContinuous(): boolean {
    return this.isContinuous && this.continuousScale.labelScale === ScaleLabelScale.LOG;
  }

  get continuousScale(): LayerScale {
    return this.entry.scale as LayerScale;
  }

  get discreteScale(): LayerScale {
    return this.entry.scale as LayerScale;
  }

  get verticalLabel(): string {
    return `${this.entry.layerName} (${getDisplayUnit(this.entry.scale.unit, this.unitsSettings)})`;
  }

  get scaleTooltip(): string {
    const { min, max } = this.scaleRange;
    return `${this.entry.layerName}\nRango: ${this.formatValue(min)} - ${this.formatValue(max)} ${getDisplayUnit(this.entry.scale.unit, this.unitsSettings)}`;
  }

  get scaleRange(): { min: number; max: number } {
    let min: number;
    let max: number;

    switch (this.entry.scale.type) {
      case ScaleType.CONTINUOUS: {
        const entries = this.sortedContinuousDisplayEntriesAsc;
        min = entries[0]?.value ?? 0;
        max = entries[entries.length - 1]?.value ?? 0;
        break;
      }
      case ScaleType.DISCRETE: {
        const entries = this.sortedDiscreteEntriesDesc;
        min = entries[entries.length - 1]?.value ?? 0;
        max = entries[0]?.value ?? 0;
        break;
      }
      default:
        min = 0;
        max = 0;
    }

    if (isKelvinUnit(this.entry.scale.unit)) {
      min = convertValueForDisplay(min, this.entry.scale.unit, this.unitsSettings);
      max = convertValueForDisplay(max, this.entry.scale.unit, this.unitsSettings);
    }

    return { min, max };
  }

  get continuousScaleLabels(): readonly string[] {
    const entries = this.sortedContinuousDisplayEntriesDesc;
    if (entries.length === 0) {
      return [];
    }

    if (!this.continuousScale.labelCount) {
      return entries.map((entry) => this.formatValue(entry.value));
    }

    const displayEntriesAsc = this.sortedContinuousDisplayEntriesAsc;
    const min = displayEntriesAsc[0]?.value ?? 0;
    const max = displayEntriesAsc[displayEntriesAsc.length - 1]?.value ?? 0;
    return this.buildRangeBasedContinuousLabels(this.getConfiguredLabelCount(), min, max);
  }

  get continuousLabelEntries(): readonly { text: string; top: number }[] {
    const values = this.continuousScale.labelValues;
    if (!values) return [];
    const [domainMin, domainMax] = this.getContinuousLabelDomain();
    const positions = this.isLogContinuous
      ? this.logPositionsForDomain(values, domainMin, domainMax)
      : null;
    return values.map((value, index) => ({
      text: this.formatValue(value),
      top: positions?.[index] ?? this.linearPosition(value, domainMin, domainMax),
    }));
  }

  get continuousLabelSizerText(): string {
    return this.continuousLabelEntries.reduce(
      (longest, entry) => (entry.text.length > longest.length ? entry.text : longest),
      '',
    );
  }

  get discreteLabels(): readonly string[] {
    return this.discreteLabelEntries.map((entry) => entry.text);
  }

  get discreteLabelEntries(): readonly {
    text: string;
    top: number;
  }[] {
    const entries = this.discreteEntriesDesc;
    const total = entries.length;
    if (total === 0) {
      return [];
    }

    const configuredLabelCount = this.getConfiguredLabelCount();

    if (this.entry.scale.type === ScaleType.DISCRETE && this.discreteScale.labelValues) {
      return this.buildExplicitDiscreteLabelEntries(this.discreteScale.labelValues);
    }

    const clipRange = this.getScaleClipRange();
    if (this.entry.scale.type === ScaleType.DISCRETE && clipRange) {
      const [rangeMin, rangeMax] = clipRange;
      return this.buildRangeBasedDiscreteLabelEntries(configuredLabelCount, rangeMin, rangeMax);
    }

    return this.buildBucketBasedDiscreteLabels(entries, configuredLabelCount);
  }

  get discreteLabelSizerText(): string {
    return this.discreteLabelEntries.reduce((longest, entry) => {
      return entry.text.length > longest.length ? entry.text : longest;
    }, '');
  }

  get discreteColorBlocks(): readonly { color: string }[] {
    const entries = this.discreteEntriesDesc;
    if (entries.length === 0) return [];
    const blocks: { color: string }[] = [{ color: entries[0].color }];
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].color.toLowerCase() !== entries[i - 1].color.toLowerCase()) {
        blocks.push({ color: entries[i].color });
      }
    }
    return blocks;
  }

  get discreteEntriesDesc(): readonly { value: number; color: string; label?: string }[] {
    return this.sortedDiscreteEntriesDesc;
  }

  get continuousTickEntries(): readonly { top: number; major: boolean }[] {
    if (this.isLogContinuous && this.continuousScale.labelValues) {
      return this.buildLogTickEntries(
        this.continuousLabelEntries,
        this.continuousScale.labelValues,
        ...this.getContinuousLabelDomain(),
      );
    }

    const labelCount = this.getConfiguredLabelCount();
    const subTickCount = this.getConfiguredSubTickCount();
    if (labelCount < 2) return [{ top: 0, major: true }];

    const result: { top: number; major: boolean }[] = [];
    const totalIntervals = labelCount - 1;

    for (let i = 0; i <= totalIntervals; i++) {
      const majorTop = (i / totalIntervals) * 100;
      result.push({ top: majorTop, major: true });

      if (i < totalIntervals) {
        const nextTop = ((i + 1) / totalIntervals) * 100;
        for (let j = 1; j <= subTickCount; j++) {
          result.push({
            top: majorTop + (j / (subTickCount + 1)) * (nextTop - majorTop),
            major: false,
          });
        }
      }
    }
    return result;
  }

  get discreteTickEntries(): readonly { top: number; major: boolean }[] {
    const labels = this.discreteLabelEntries;
    const subTickCount = this.getConfiguredSubTickCount();
    if (labels.length === 0) return [];

    const isLogDiscrete =
      this.entry.scale.type === ScaleType.DISCRETE &&
      this.discreteScale.labelScale === ScaleLabelScale.LOG &&
      !!this.discreteScale.labelValues;

    if (isLogDiscrete && this.discreteScale.labelValues) {
      const [domainMin, domainMax] = this.getDiscreteLabelDomain();
      return this.buildLogTickEntries(labels, this.discreteScale.labelValues, domainMin, domainMax);
    }

    const result: { top: number; major: boolean }[] = [];
    for (let i = 0; i < labels.length; i++) {
      result.push({ top: labels[i].top, major: true });
      if (i < labels.length - 1) {
        const topA = labels[i].top;
        const topB = labels[i + 1].top;
        for (let j = 1; j <= subTickCount; j++) {
          result.push({ top: topA + (j / (subTickCount + 1)) * (topB - topA), major: false });
        }
      }
    }
    return result;
  }

  get gradientBackground(): string {
    const sortedEntries = this.sortedContinuousDisplayEntriesAsc;

    if (sortedEntries.length < 2) {
      return sortedEntries[0]?.color ?? 'transparent';
    }

    const min = sortedEntries[0].value;
    const max = sortedEntries[sortedEntries.length - 1].value;

    const toPosition: (value: number) => number =
      this.isLogContinuous && min > 0
        ? (v) => (Math.log10(v) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))
        : (v) => (max > min ? (v - min) / (max - min) : 0);

    if (!Number.isFinite(toPosition(max)) || toPosition(max) <= 0) {
      return sortedEntries[sortedEntries.length - 1].color;
    }

    const segments: string[] = [];
    for (let i = 0; i < sortedEntries.length; i++) {
      const entry = sortedEntries[i];
      const pct = Math.max(0, Math.min(100, toPosition(entry.value) * 100)).toFixed(2);
      if (entry.hardStop && i > 0) {
        segments.push(`${sortedEntries[i - 1].color} ${pct}%`);
      }
      segments.push(`${entry.color} ${pct}%`);
    }

    return `linear-gradient(to top, ${segments.join(', ')})`;
  }

  private get sortedContinuousEntriesAsc(): readonly ScaleColorStop[] {
    return [...this.continuousScale.entries].sort((a, b) => a.value - b.value);
  }

  private get sortedContinuousDisplayEntriesAsc(): readonly ScaleColorStop[] {
    const clipRange = this.getScaleClipRange();
    const entries = this.sortedContinuousEntriesAsc;
    if (!clipRange) return entries;
    return this.clipEntriesToRange(entries, clipRange[0], clipRange[1]);
  }

  private get sortedContinuousDisplayEntriesDesc(): readonly ScaleColorStop[] {
    return [...this.sortedContinuousDisplayEntriesAsc].reverse();
  }

  private get sortedDiscreteEntriesDesc(): readonly {
    value: number;
    color: string;
    label?: string;
  }[] {
    const sorted = [...this.discreteScale.entries].sort((a, b) => b.value - a.value);
    const clipRange = this.getScaleClipRange();
    if (!clipRange) {
      return sorted;
    }

    const [min, max] = clipRange;
    return sorted.filter((entry) => entry.value >= min && entry.value <= max);
  }

  private formatValue(value: number): string {
    const displayValue = convertValueForDisplay(value, this.entry.scale.unit, this.unitsSettings);
    const minFractionDigits = impliedMinFractionDigits(displayValue);
    if (minFractionDigits === 0) {
      return this.unitsSettings.numberFormatter().format(displayValue);
    }

    const effectiveFractionDigits = Math.max(
      this.unitsSettings.decimalPrecision(),
      minFractionDigits,
    );

    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: effectiveFractionDigits,
      maximumFractionDigits: effectiveFractionDigits,
    }).format(displayValue);
  }

  private getConfiguredLabelCount(): number {
    const raw = this.entry.scale.labelCount;
    if (!raw || !Number.isFinite(raw)) {
      return this.DEFAULT_LABEL_COUNT;
    }

    return Math.max(2, Math.floor(raw));
  }

  private getConfiguredSubTickCount(): number {
    const raw = this.entry.scale.subTickCount;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      return this.DEFAULT_SUBTICK_COUNT;
    }
    return Math.max(0, Math.floor(raw));
  }

  private buildRangeBasedDiscreteLabelEntries(
    labelCount: number,
    min: number,
    max: number,
  ): readonly { text: string; top: number }[] {
    const effectiveLabelCount = Math.max(2, labelCount);
    return Array.from({ length: effectiveLabelCount }, (_, index) => {
      const ratio = effectiveLabelCount === 1 ? 0 : index / (effectiveLabelCount - 1);
      // Orden descendente para coincidir con el eje visual (valor mayor arriba).
      const interpolatedValue = max - ratio * (max - min);
      return { text: this.formatValue(interpolatedValue), top: ratio * 100 };
    });
  }

  private buildRangeBasedContinuousLabels(
    labelCount: number,
    min: number,
    max: number,
  ): readonly string[] {
    const effectiveLabelCount = Math.max(2, labelCount);
    return Array.from({ length: effectiveLabelCount }, (_, index) => {
      const ratio = effectiveLabelCount === 1 ? 0 : index / (effectiveLabelCount - 1);
      // Orden descendente para coincidir con el eje visual (valor mayor arriba).
      const interpolatedValue = max - ratio * (max - min);
      return this.formatValue(interpolatedValue);
    });
  }

  private buildBucketBasedDiscreteLabels(
    entries: readonly { value: number; color: string; label?: string }[],
    labelCount: number,
  ): readonly { text: string; top: number }[] {
    const total = entries.length;
    const effectiveLabelCount = Math.max(2, Math.min(labelCount, total));

    return Array.from({ length: effectiveLabelCount }, (_, index) => {
      const ratio = effectiveLabelCount === 1 ? 0 : index / (effectiveLabelCount - 1);
      const stepIndex = Math.round(ratio * (total - 1));
      return {
        text: this.formatValue(entries[stepIndex].value),
        top: ratio * 100,
      };
    });
  }

  private buildExplicitDiscreteLabelEntries(values: readonly number[]): readonly {
    text: string;
    top: number;
  }[] {
    const [domainMin, domainMax] = this.getDiscreteLabelDomain();
    const positions =
      this.discreteScale.labelScale === ScaleLabelScale.LOG
        ? this.logPositionsForDomain(values, domainMin, domainMax)
        : null;

    return values.map((value, index) => ({
      text: this.formatValue(value),
      top: positions?.[index] ?? this.linearPosition(value, domainMin, domainMax),
    }));
  }

  private buildLogTickEntries(
    labels: readonly { top: number }[],
    values: readonly number[],
    domainMin: number,
    domainMax: number,
  ): readonly { top: number; major: boolean }[] {
    const subTickCount = this.getConfiguredSubTickCount();
    const safeMin = domainMin > 0 ? domainMin : (values.find((v) => v > 0) ?? 1);
    const safeMax = domainMax > safeMin ? domainMax : safeMin * 10;
    const result: { top: number; major: boolean }[] = labels.map((l) => ({
      top: l.top,
      major: true,
    }));

    const decadeStep = Math.max(1, Math.round(8 / subTickCount));
    const startExp = Math.floor(Math.log10(safeMin));
    const endExp = Math.ceil(Math.log10(safeMax));

    for (let exp = startExp; exp < endExp; exp++) {
      const base = Math.pow(10, exp);
      for (let k = 2; k <= 9; k += decadeStep) {
        const tickValue = k * base;
        if (tickValue <= safeMin || tickValue >= safeMax) continue;
        const isLabel = values.some(
          (v) => Math.abs(v - tickValue) / Math.max(v, tickValue) < 0.001,
        );
        if (isLabel) continue;
        const pos = this.logPositionsForDomain([tickValue], safeMin, safeMax);
        if (pos) result.push({ top: pos[0], major: false });
      }
    }
    return result;
  }

  private getDiscreteLabelDomain(): readonly [number, number] {
    const clipRange = this.getScaleClipRange();
    if (clipRange) return clipRange;

    const domain = this.discreteScale.labelDomain;
    if (domain) return domain;
    const entries = this.sortedDiscreteEntriesDesc;
    return [entries[entries.length - 1]?.value ?? 0, entries[0]?.value ?? 0];
  }

  private getContinuousLabelDomain(): readonly [number, number] {
    const clipRange = this.getScaleClipRange();
    if (clipRange) return clipRange;

    const domain = this.continuousScale.labelDomain;
    if (domain) return domain;
    const entries = this.sortedContinuousEntriesAsc;
    return [entries[0]?.value ?? 0, entries[entries.length - 1]?.value ?? 0];
  }

  private getScaleClipRange(): readonly [number, number] | undefined {
    const clipRange = this.entry.scale.clipRange;
    if (!clipRange) {
      return undefined;
    }

    const [start, end] = clipRange;
    return start <= end ? [start, end] : [end, start];
  }

  tickTopStyle(percentTop: number): string {
    return `calc(${percentTop}% - ${percentTop / 100}px)`;
  }

  labelTopStyle(percentTop: number): string {
    return `calc(${percentTop}% - var(--scale-value-center-offset))`;
  }

  private linearPosition(value: number, min: number, max: number): number {
    if (max <= min) return 0;
    const ratio = (value - min) / (max - min);
    return Math.max(0, Math.min(100, (1 - ratio) * 100));
  }

  private logPositionsForDomain(
    values: readonly number[],
    min: number,
    max: number,
  ): readonly number[] | null {
    const safeMin = min > 0 ? min : (values.find((v) => v > 0) ?? 1);
    const safeMax = max > safeMin ? max : safeMin * 10;
    const logMin = Math.log10(safeMin);
    const logMax = Math.log10(safeMax);
    if (!Number.isFinite(logMin) || !Number.isFinite(logMax) || logMax <= logMin) return null;
    return values.map((value) => {
      const ratio = (Math.log10(Math.max(value, safeMin)) - logMin) / (logMax - logMin);
      return Math.max(0, Math.min(100, (1 - ratio) * 100));
    });
  }

  private clipEntriesToRange(
    entries: readonly ScaleColorStop[],
    minValue: number,
    maxValue: number,
  ): readonly ScaleColorStop[] {
    const result: ScaleColorStop[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const next = entries[i + 1];
      if (entry.value < minValue) {
        if (next && next.value > minValue) {
          const t = (minValue - entry.value) / (next.value - entry.value);
          result.push({
            value: minValue,
            color: this.interpolateHexColor(entry.color, next.color, t),
          });
        }
        continue;
      }
      if (entry.value > maxValue) break;
      result.push(entry);
      if (next && next.value > maxValue) {
        const t = (maxValue - entry.value) / (next.value - entry.value);
        result.push({
          value: maxValue,
          color: this.interpolateHexColor(entry.color, next.color, t),
        });
      }
    }
    return result;
  }

  private interpolateHexColor(colorA: string, colorB: string, t: number): string {
    const parse = (hex: string) => {
      const h = hex.replace('#', '');
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
      ];
    };
    const [rA, gA, bA] = parse(colorA);
    const [rB, gB, bB] = parse(colorB);
    const ch = (a: number, b: number) =>
      Math.round(a + t * (b - a))
        .toString(16)
        .padStart(2, '0');
    return `#${ch(rA, rB)}${ch(gA, gB)}${ch(bA, bB)}`;
  }
}
