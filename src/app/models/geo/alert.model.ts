/**
 * Información de una alerta meteorológica generada
 */
export interface Alert {
  /**
   * ID de la alerta en la base de datos
   */
  tavisoId: number;

  /**
   * Timestamp de generación (YYYYMMDD_HHMMSS)
   */
  timestamp: string;

  /**
   * Código del fenómeno (1-92)
   */
  phenomenonCode: number;

  /**
   * Descripción del fenómeno
   */
  phenomenon: string;

  /**
   * URL al GIF del área (vista zoom)
   */
  gifAreaUrl: string;

  /**
   * URL al GIF general (Argentina completa)
   */
  gifGralUrl: string;

  /**
   * Cantidad de partidos afectados
   */
  affectedPartidosCount: number;

  /**
   * Fecha de generación (ISO)
   */
  generatedAt: Date;
}
