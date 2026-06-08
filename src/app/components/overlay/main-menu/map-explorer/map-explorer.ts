import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';

import { MenuPanelComponent } from '../menu-section.model';
import { PlaceSearchTabComponent } from './place-search-tab/place-search-tab';
import { BaseMapSelectorComponent } from './base-map-selector/base-map-selector';

/**
 * "Explorar mapa" panel: groups place search and base map selection — both are
 * ways to change what part of the world (and which imagery) is shown.
 */
@Component({
  selector: 'app-map-explorer',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatIconModule,
    PlaceSearchTabComponent,
    BaseMapSelectorComponent,
  ],
  templateUrl: './map-explorer.html',
  styleUrl: './map-explorer.scss',
})
export class MapExplorerComponent implements MenuPanelComponent {
  onPanelOpen(): void {}

  onPanelClose(): void {}
}
