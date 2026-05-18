import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { MenuPanelComponent } from '../menu-section.model';
import {
  UnitsSettingsService,
  TemperatureUnit,
  WindSpeedUnit,
  DecimalPrecision,
} from '../../../../services/settings/units-settings.service';
import { TEMPERATURE_UNITS, WIND_SPEED_UNITS } from '../../../../constants';
import { WeatherStationsApiKeyService } from '../../../../services/weather-stations/weather-stations-api-key.service';

@Component({
  selector: 'app-general-settings',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatRadioModule,
    MatTooltipModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './general-settings.html',
  styleUrl: './general-settings.scss',
})
export class GeneralSettingsComponent implements MenuPanelComponent {
  readonly unitsSettings = inject(UnitsSettingsService);
  readonly apiKeyService = inject(WeatherStationsApiKeyService);
  readonly TEMPERATURE_UNITS = TEMPERATURE_UNITS;
  readonly WIND_SPEED_UNITS = WIND_SPEED_UNITS;

  /** True iff the user (not the env var fallback) has provided a key. */
  readonly hasUserApiKey = computed(() => {
    this.apiKeyService.keyChanges();
    return this.apiKeyService.isUserProvided();
  });

  onPanelOpen(): void {
    // Touch the keyChanges signal so the computed re-evaluates when the
    // panel is re-opened (covers a key set/cleared in another tab).
    this.apiKeyService.keyChanges();
  }

  async setSmnApiKey(): Promise<void> {
    await this.apiKeyService.promptForKey();
  }

  clearSmnApiKey(): void {
    this.apiKeyService.clearKey();
  }

  onTemperatureUnitChange(unit: TemperatureUnit): void {
    this.unitsSettings.setTemperatureUnit(unit);
  }

  onWindSpeedUnitChange(unit: WindSpeedUnit): void {
    this.unitsSettings.setWindSpeedUnit(unit);
  }

  onDecimalPrecisionInput(value: string): void {
    const precision = parseInt(value, 10);
    if (!isNaN(precision) && precision >= 0 && precision <= 3) {
      this.unitsSettings.setDecimalPrecision(precision as DecimalPrecision);
    }
  }

  onDecimalPrecisionBlur(input: HTMLInputElement): void {
    const precision = parseInt(input.value, 10);
    if (isNaN(precision) || precision < 0 || precision > 3) {
      input.value = this.unitsSettings.decimalPrecision().toString();
    }
  }
}
