import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { AlertsService } from '../../../services/polygons/alerts.service';
import { Phenomenon } from '../../../models/phenomenon.model';

/**
 * Modal para seleccionar un fenómeno meteorológico
 */
@Component({
  selector: 'app-phenomenon-selection-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatListModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  templateUrl: './phenomenon-selection-modal.html',
  styleUrl: './phenomenon-selection-modal.scss',
})
export class PhenomenonSelectionModalComponent implements OnInit {
  private readonly alertsService = inject(AlertsService);
  private readonly dialogRef = inject(MatDialogRef<PhenomenonSelectionModalComponent>);

  phenomena: Phenomenon[] = [];
  loading = true;
  error: string | null = null;

  ngOnInit(): void {
    this.loadPhenomena();
  }

  loadPhenomena(): void {
    this.loading = true;
    this.error = null;

    this.alertsService.getPhenomena().subscribe({
      next: (data) => {
        this.phenomena = data.filter((p) => p.description !== null);
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading phenomena:', err);
        this.error = 'Error al cargar los fenómenos';
        this.loading = false;
      },
    });
  }

  selectPhenomenon(phenomenon: Phenomenon): void {
    this.dialogRef.close(phenomenon);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
