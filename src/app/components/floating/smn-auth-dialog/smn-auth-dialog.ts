import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface SmnAuthDialogData {
  token?: string;
  errorMessage?: string;
}

export interface SmnAuthDialogResult {
  token: string;
}

@Component({
  selector: 'app-smn-auth-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './smn-auth-dialog.html',
  styleUrl: './smn-auth-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SmnAuthDialogComponent {
  readonly dialogRef = inject(MatDialogRef<SmnAuthDialogComponent, SmnAuthDialogResult | null>);
  readonly data = inject<SmnAuthDialogData>(MAT_DIALOG_DATA, {
    optional: true,
  });

  token = this.data?.token ?? '';
  validationError: string | null = null;

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onSubmit(): void {
    const token = this.token.trim();

    if (!token) {
      this.validationError = 'Ingresa un token para continuar.';
      return;
    }

    this.dialogRef.close({ token });
  }
}
