import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { PHENOMENON_CODES } from '../../constants';

/**
 * Diálogo para seleccionar el código de fenómeno meteorológico
 * antes de generar una alerta
 */
@Component({
  selector: 'app-phenomenon-selection-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './phenomenon-selection-dialog.html',
  styleUrl: './phenomenon-selection-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhenomenonSelectionDialogComponent {
  readonly dialogRef = inject(MatDialogRef<PhenomenonSelectionDialogComponent>);
  readonly phenomenonCodes = PHENOMENON_CODES;
  readonly selectedCode = signal<number | null>(null);

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onConfirm(): void {
    const code = this.selectedCode();
    if (code !== null) {
      this.dialogRef.close(code);
    }
  }
}
