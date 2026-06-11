/**
 * Weather alert information
 */
export interface Alert {
  /**
   * Alert ID in the database
   */
  alertId: number;

  /**
   * Generation timestamp (YYMMDDHHMMSS)
   */
  timestamp: string;

  /**
   * Phenomenon code (1-92)
   */
  phenomenonCode: number;

  /**
   * Phenomenon description
   */
  phenomenon: string;

  /**
   * URL to area GIF (zoomed view)
   */
  gifAreaUrl: string;

  /**
   * URL to general GIF (full Argentina)
   */
  gifGralUrl: string;

  /**
   * Number of affected departments
   */
  affectedDepartmentsCount: number;

  /**
   * Generation date (ISO)
   */
  generatedAt: Date;
}
