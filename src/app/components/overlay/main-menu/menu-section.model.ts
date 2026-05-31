import { Type } from '@angular/core';

/**
 * Interfaz base para componentes que se renderizan en el panel del menú
 * Los componentes deben ser standalone de Angular
 */
export interface MenuPanelComponent {
  onPanelOpen?(): void;
  onPanelClose?(): void;
}

/**
 * Modelo para una sección del menú
 */
export interface MenuSection {
  id: string;
  title: string;
  icon: string;
  tooltip: string;
  /**
   * Carga perezosa del componente del panel. Devuelve el `Type` en un chunk
   * aparte para que su código no entre en el bundle inicial — se descarga la
   * primera vez que se abre la sección.
   */
  loadComponent: () => Promise<Type<MenuPanelComponent>>;
}
