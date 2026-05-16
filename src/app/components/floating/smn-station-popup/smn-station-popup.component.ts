import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface SmnStationPopupItem {
  label: string;
  value: string;
}

export interface SmnStationPopupData {
  stationName: string;
  province: string;
  values: ReadonlyArray<SmnStationPopupItem>;
  updatedAt: string;
}

@Component({
  selector: 'app-smn-station-popup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './smn-station-popup.component.html',
})
export class SmnStationPopupComponent {
  @Input({ required: true }) data!: SmnStationPopupData;
}
