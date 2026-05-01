import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';

import { MenuPanelComponent } from '../menu-section.model';
import {
  UnitsSettingsService,
  TemperatureUnit,
  DecimalPrecision,
} from '../../../../services/settings/units-settings.service';
import { TEMPERATURE_UNITS } from '../../../../constants';

@Component({
  selector: 'app-general-settings',
  standalone: true,
  imports: [CommonModule, MatTabsModule, MatRadioModule, MatTooltipModule, MatIconModule],
  templateUrl: './general-settings.html',
  styleUrl: './general-settings.scss',
})
export class GeneralSettingsComponent implements MenuPanelComponent {
  readonly unitsSettings = inject(UnitsSettingsService);
  readonly TEMPERATURE_UNITS = TEMPERATURE_UNITS;

  /**
   * MenuPanelComponent lifecycle hook
   * Called when the panel is opened
   */
  onPanelOpen(): void {
    // Hook for future initialization if needed
  }

  onTemperatureUnitChange(unit: TemperatureUnit): void {
    this.unitsSettings.setTemperatureUnit(unit);
  }

  onDecimalPrecisionInput(value: string): void {
    const precision = parseInt(value, 10);
    if (!isNaN(precision) && precision >= 0 && precision <= 3) {
      this.unitsSettings.setDecimalPrecision(precision as DecimalPrecision);
    }
  }

  onDecimalPrecisionBlur(input: HTMLInputElement): void {
    const precision = parseInt(input.value, 10);
    
    // Si el valor es inválido, restaurar el valor almacenado
    if (isNaN(precision) || precision < 0 || precision > 3) {
      input.value = this.unitsSettings.decimalPrecision().toString();
    }
  }
}
``