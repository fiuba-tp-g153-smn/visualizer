import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface WeatherStationPopupItem {
  label: string;
  value: string;
}

export interface WeatherStationPopupData {
  stationName: string;
  province: string;
  values: ReadonlyArray<WeatherStationPopupItem>;
  updatedAt: string;
}

@Component({
  selector: 'app-weather-station-popup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './weather-station-popup.component.html',
})
export class WeatherStationPopupComponent {
  @Input({ required: true }) data!: WeatherStationPopupData;
}
