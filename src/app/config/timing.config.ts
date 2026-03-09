/**
 * Configuración de delays y tiempos en la aplicación
 */

/**
 * Delays para tooltips (Material Angular)
 */
export const TOOLTIP_DELAYS = {
  /**
   * Tiempo antes de mostrar un tooltip al hacer hover
   */
  SHOW: 500,
  /**
   * Tiempo antes de ocultar un tooltip
   */
  HIDE: 100,
  /**
   * Tiempo antes de ocultar un tooltip después de touch
   */
  TOUCHEND_HIDE: 100,
} as const;

/**
 * Delays para acciones del menú contextual
 */
export const ACTION_DELAYS = {
  /**
   * Delay para cerrar el menú antes de iniciar una acción
   * Necesario para que el overlay se cierre correctamente antes de cambiar el modo de dibujo
   */
  MENU_ACTION: 50,
} as const;
