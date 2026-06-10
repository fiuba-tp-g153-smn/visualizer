import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner';
import { PanelCloseButtonComponent } from '../../shared/panel-close-button/panel-close-button';

import { PointQueryDisplayData, PointQueryStatus, PointQueryValueData } from '../../../models';
import { UnitsSettingsService } from '../../../services/settings/units-settings.service';
import { convertValueForDisplay, getDisplayUnit } from '../../../utils/unit-conversion.utils';
import { impliedMinFractionDigits } from '../../../utils/number-format.utils';

@Component({
  selector: 'app-point-value-panel',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent, MatTooltipModule, PanelCloseButtonComponent],
  templateUrl: './point-value-panel.html',
  styleUrl: './point-value-panel.scss',
})
export class PointValuePanelComponent {
  readonly PointQueryStatus = PointQueryStatus;
  private readonly unitsSettings = inject(UnitsSettingsService);

  @Input() visible = false;
  @Input() isLoading = false;
  @Input() layerName = 'Capa de datos';
  @Input() data: PointQueryDisplayData | null = null;

  @Output() close = new EventEmitter<void>();

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
    const value = convertValueForDisplay(this.data.value, this.data.unit, this.unitsSettings);
    return this.formatNumber(value);
  }

  get displayUnit(): string {
    if (this.data?.status !== PointQueryStatus.VALUE) {
      return '';
    }
    return getDisplayUnit(this.data.unit, this.unitsSettings);
  }

  get valueTooltip(): string {
    if (this.data?.status !== PointQueryStatus.VALUE) {
      return '';
    }
    const { min, max } = this.data.scaleRange;
    const displayMin = convertValueForDisplay(min, this.data.unit, this.unitsSettings);
    const displayMax = convertValueForDisplay(max, this.data.unit, this.unitsSettings);
    const displayUnit = getDisplayUnit(this.data.unit, this.unitsSettings);
    return `Rango: ${this.formatNumber(displayMin)} - ${this.formatNumber(displayMax)} ${displayUnit}`;
  }

  private formatNumber(value: number): string {
    const minFractionDigits = impliedMinFractionDigits(value);
    if (minFractionDigits === 0) {
      return this.unitsSettings.numberFormatter().format(value);
    }

    const effectiveFractionDigits = Math.max(
      this.unitsSettings.decimalPrecision(),
      minFractionDigits,
    );

    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: effectiveFractionDigits,
      maximumFractionDigits: effectiveFractionDigits,
    }).format(value);
  }
}
