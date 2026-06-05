import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

import type { StageTimings } from '../../../models/metrics/metrics.models';
import { StagePieChartComponent } from './stage-pie-chart.component';

/** Datos del diálogo: título + tiempos para la torta del desglose. */
export interface StagePieDialogData {
  readonly title: string;
  readonly stages: StageTimings;
  readonly networkSecs: number | null;
}

/**
 * Diálogo-tarjeta que muestra la torta del desglose por etapa de un tipo de
 * trabajo. Envoltorio fino porque MatDialog pasa datos por token, no por inputs.
 */
@Component({
  selector: 'app-stage-pie-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, StagePieChartComponent],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <app-stage-pie-chart [stages]="data.stages" [networkSecs]="data.networkSecs" />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cerrar</button>
    </mat-dialog-actions>
  `,
})
export class StagePieDialogComponent {
  readonly data = inject<StagePieDialogData>(MAT_DIALOG_DATA);
}
