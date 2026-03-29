import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PointQueryDisplayData, PointQueryStatus, PointQueryValueData } from '../../../models';

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
    return this.decimalFormatter.format(this.data.value);
  }

  get valueTooltip(): string {
    if (this.data?.status !== PointQueryStatus.VALUE) {
      return '';
    }
    const { min, max } = this.data.scaleRange;
    return `Rango: ${this.format(min)} - ${this.format(max)} ${this.data.unit}`;
  }

  private format(num: number): string {
    return this.decimalFormatter.format(num);
  }
}
