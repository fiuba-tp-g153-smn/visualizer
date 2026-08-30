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
import {
  TimezoneSettingsService,
  TIMEZONE_MODES,
  TimezoneMode,
} from '../../../../services/settings/timezone-settings.service';
import { TEMPERATURE_UNITS, WIND_SPEED_UNITS } from '../../../../constants';
import { WeatherStationsApiKeyService } from '../../../../services/weather-stations/weather-stations-api-key.service';

const DECIMAL_BASE_10 = 10;
const MIN_DECIMAL_PRECISION: DecimalPrecision = 0;
const MAX_DECIMAL_PRECISION: DecimalPrecision = 3;

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
  readonly timezoneSettings = inject(TimezoneSettingsService);
  readonly apiKeyService = inject(WeatherStationsApiKeyService);
  readonly TEMPERATURE_UNITS = TEMPERATURE_UNITS;
  readonly WIND_SPEED_UNITS = WIND_SPEED_UNITS;
  readonly TIMEZONE_MODES = TIMEZONE_MODES;

  /** True iff the user has provided an API key. */
  readonly hasUserApiKey = computed(() => {
    this.apiKeyService.keyChanges();
    return this.apiKeyService.isUserProvided();
  });

  onPanelOpen(): void {
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

  onTimezoneModeChange(mode: TimezoneMode): void {
    this.timezoneSettings.setMode(mode);
  }

  onDecimalPrecisionInput(value: string): void {
    const precision = parseInt(value, DECIMAL_BASE_10);
    if (
      !isNaN(precision) &&
      precision >= MIN_DECIMAL_PRECISION &&
      precision <= MAX_DECIMAL_PRECISION
    ) {
      this.unitsSettings.setDecimalPrecision(precision as DecimalPrecision);
    }
  }

  onDecimalPrecisionBlur(input: HTMLInputElement): void {
    const precision = parseInt(input.value, DECIMAL_BASE_10);
    if (
      isNaN(precision) ||
      precision < MIN_DECIMAL_PRECISION ||
      precision > MAX_DECIMAL_PRECISION
    ) {
      input.value = this.unitsSettings.decimalPrecision().toString();
    }
  }
}
