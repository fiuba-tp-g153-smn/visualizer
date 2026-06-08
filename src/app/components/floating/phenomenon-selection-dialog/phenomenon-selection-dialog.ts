import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner';
import { AlertsService } from '../../../services/polygons/alerts.service';
import { Phenomenon } from '../../../models/phenomenon.model';
import { PHENOMENON_CODES } from '../../../constants';

@Component({
  selector: 'app-phenomenon-selection-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    LoadingSpinnerComponent,
  ],
  templateUrl: './phenomenon-selection-dialog.html',
  styleUrl: './phenomenon-selection-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhenomenonSelectionDialogComponent implements OnInit {
  private readonly alertsService = inject(AlertsService);
  readonly dialogRef = inject(MatDialogRef<PhenomenonSelectionDialogComponent>);

  readonly selectedCode = signal<number | null>(null);
  readonly phenomenonCodes = signal<Phenomenon[]>([]);
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadPhenomena();
  }

  private loadPhenomena(): void {
    this.loading.set(true);
    this.error.set(null);

    this.alertsService.getPhenomena().subscribe({
      next: (phenomena) => {
        const validPhenomena = phenomena.filter((p) => p.description !== null);
        this.phenomenonCodes.set(validPhenomena);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading phenomena from backend, using fallback:', err);
        const fallbackPhenomena: Phenomenon[] = PHENOMENON_CODES.map((p) => ({
          code: p.code,
          description: p.description,
        }));
        this.phenomenonCodes.set(fallbackPhenomena);
        this.error.set('Usando datos locales (backend no disponible)');
        this.loading.set(false);
      },
    });
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onConfirm(): void {
    const code = this.selectedCode();
    if (code !== null) {
      this.dialogRef.close(code);
    }
  }

  retry(): void {
    this.loadPhenomena();
  }
}
