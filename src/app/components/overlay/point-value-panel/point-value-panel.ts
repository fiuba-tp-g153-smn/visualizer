import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PointQueryDisplayData, PointQueryStatus } from '../../../models';

@Component({
  selector: 'app-point-value-panel',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
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

  get hasDataValue(): boolean {
    return !!this.data && this.data.status === PointQueryStatus.VALUE && this.data.value !== null;
  }

  get formattedValue(): string {
    const value = this.data?.value;
    if (!this.hasDataValue || value === null || value === undefined) {
      return '';
    }

    return this.decimalFormatter.format(value);
  }
}
