import { Injectable, signal } from '@angular/core';

export const ALERTS_PANEL_TABS = {
  GENERATE: 0,
  EMITTED: 1,
} as const;

/**
 * Shared UI state of the alerts panel, so flows that live outside the component
 * (e.g. emitting from the map context menu) can drive the selected tab.
 */
@Injectable({ providedIn: 'root' })
export class AlertsPanelStateService {
  readonly selectedTabIndex = signal<number>(ALERTS_PANEL_TABS.GENERATE);

  openEmittedTab(): void {
    this.selectedTabIndex.set(ALERTS_PANEL_TABS.EMITTED);
  }
}
