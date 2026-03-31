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
  component: Type<MenuPanelComponent>;
}
