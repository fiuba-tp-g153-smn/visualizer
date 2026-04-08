import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PointQueryDisplayData, PointQueryStatus, PointQueryValueData } from '../../../models';
import {
  convertValueForDisplay,
  getDisplayUnit,
  isKelvinUnit,
} from '../../../utils/unit-conversion.utils';

@Component({
  selector: 'app-point-value-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './point-value-panel.html',
  styleUrl: './point-value-panel.scss',
})
export class PointValuePanelComponent {
  readonly PointQueryStatus = PointQueryStatus;

  @Input() visible = false;
  @Input() isLoading = false;
  @Input() layerName = 'Capa de datos';
  @Input() data: PointQueryDisplayData | null = null;

  @Output() close = new EventEmitter<void>();

  private readonly decimalFormatter = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  onClose(): void {
    this.close.emit();
  }

  get valueData(): PointQueryValueData | null {
    return this.data?.status === PointQueryStatus.VALUE ? this.data : null;
  }

  get formattedValue(): string {
    if (this.data?.status !== PointQueryStatus.VALUE) {
      return '';
    }
    const value = convertValueForDisplay(this.data.value, this.data.unit);
    return this.decimalFormatter.format(value);
  }

  get displayUnit(): string {
    if (this.data?.status !== PointQueryStatus.VALUE) {
      return '';
    }
    return getDisplayUnit(this.data.unit);
  }

  get valueTooltip(): string {
    if (this.data?.status !== PointQueryStatus.VALUE) {
      return '';
    }
    const { min, max } = this.data.scaleRange;
    const displayMin = convertValueForDisplay(min, this.data.unit);
    const displayMax = convertValueForDisplay(max, this.data.unit);
    const displayUnit = getDisplayUnit(this.data.unit);
    return `Rango: ${this.format(displayMin)} - ${this.format(displayMax)} ${displayUnit}`;
  }

  private format(num: number): string {
    return this.decimalFormatter.format(num);
  }
}
