import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { AvisosService } from '../../../../../services/avisos/avisos.service';
import { formatDateTimeLocalized } from '../../../../../utils/tileset-timestamp';

/**
 * "Activas" tab content: toggle to show active alerts ("avisos"), a manual
 * refresh button and the list of active avisos.
 */
@Component({
  selector: 'app-active-avisos',
  standalone: true,
  imports: [
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatListModule,
    MatDividerModule,
    MatMenuModule,
  ],
  templateUrl: './active-avisos.html',
  styleUrl: './active-avisos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveAvisosComponent {
  private readonly avisosService = inject(AvisosService);

  readonly showActive = this.avisosService.showActive;
  readonly avisos = this.avisosService.avisos;
  readonly loading = this.avisosService.loading;

  onToggle(checked: boolean): void {
    this.avisosService.setShowActive(checked);
  }

  refresh(): void {
    void this.avisosService.refresh();
  }

  formatDate(date: Date): string {
    return formatDateTimeLocalized(date);
  }
}
