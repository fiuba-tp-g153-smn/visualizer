import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

export type PanelType = 'layers' | 'polygons' | 'tiles' | null;

@Injectable({
  providedIn: 'root',
})
export class UiService {
  // Panel activo
  private _activePanel = signal<PanelType>(null);
  activePanel = this._activePanel.asReadonly();

  // Polígono seleccionado (para expandir en el accordion)
  private _selectedPolygonId = signal<string | null>(null);
  selectedPolygonId = this._selectedPolygonId.asReadonly();

  // Evento para cuando se solicita abrir el panel de polígonos con uno seleccionado
  private openPolygonPanel$ = new Subject<string>();

  // Evento para cuando se cierra el panel (para finalizar acciones en curso)
  private panelClosed$ = new Subject<PanelType>();

  openPanel(panel: PanelType): void {
    // Emitir cierre del panel anterior si había uno abierto
    const previousPanel = this._activePanel();
    if (previousPanel && previousPanel !== panel) {
      this.panelClosed$.next(previousPanel);
    }
    this._activePanel.set(panel);
  }

  closePanel(): void {
    const currentPanel = this._activePanel();
    console.log('🔒 UiService.closePanel() called, currentPanel:', currentPanel);
    this._activePanel.set(null);
    this._selectedPolygonId.set(null);

    // Emitir evento de cierre para que los componentes finalicen acciones
    if (currentPanel) {
      console.log('📤 Emitting panelClosed$ event for:', currentPanel);
      this.panelClosed$.next(currentPanel);
    }
  }

  togglePanel(panel: PanelType): void {
    if (this._activePanel() === panel) {
      this.closePanel();
    } else {
      this.openPanel(panel);
    }
  }

  // Abrir panel de polígonos con uno específico seleccionado
  openPolygonPanelWithSelection(polygonId: string): void {
    this._selectedPolygonId.set(polygonId);
    this._activePanel.set('polygons');
    this.openPolygonPanel$.next(polygonId);
  }

  // Limpiar selección de polígono
  clearPolygonSelection(): void {
    this._selectedPolygonId.set(null);
  }

  // Observable para cuando se cierra el panel
  onPanelClosed() {
    return this.panelClosed$.asObservable();
  }

  // Observable para cuando se abre el panel de polígonos con selección
  onOpenPolygonPanel() {
    return this.openPolygonPanel$.asObservable();
  }
}
