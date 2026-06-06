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
const MINUTES_PER_HOUR = 60;
const OFFSET_PADDING = 2;

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
  readonly localUtcOffsetShort = this.getLocalUtcOffsetShort();
  readonly localTimezoneTooltip = this.buildLocalTimezoneTooltip();

  /** True iff the user (not the env var fallback) has provided a key. */
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

  private getLocalUtcOffsetShort(): string {
    const now = new Date();
    const offsetMinutes = -now.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absoluteMinutes = Math.abs(offsetMinutes);
    const hours = Math.floor(absoluteMinutes / MINUTES_PER_HOUR);
    const minutes = absoluteMinutes % MINUTES_PER_HOUR;

    if (minutes === 0) {
      return `${sign}${hours}`;
    }

    return `${sign}${hours}:${String(minutes).padStart(OFFSET_PADDING, '0')}`;
  }

  private buildLocalTimezoneTooltip(): string {
    const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offsetForTooltip = this.getLocalUtcOffsetForTooltip();

    if (timezoneName) {
      return `Mostrar fechas y horas en tu zona horaria local (${timezoneName}, ${offsetForTooltip})`;
    }

    return `Mostrar fechas y horas en tu zona horaria local (${offsetForTooltip})`;
  }

  private getLocalUtcOffsetForTooltip(): string {
    const now = new Date();
    const offsetMinutes = -now.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absoluteMinutes = Math.abs(offsetMinutes);
    const hours = Math.floor(absoluteMinutes / MINUTES_PER_HOUR);
    const minutes = absoluteMinutes % MINUTES_PER_HOUR;

    return `UTC${sign}${String(hours).padStart(OFFSET_PADDING, '0')}:${String(minutes).padStart(OFFSET_PADDING, '0')}`;
  }
}
