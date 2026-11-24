import { Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ExperimentalDisclaimerDialogComponent } from '../../components/floating/experimental-disclaimer-dialog/experimental-disclaimer-dialog';
import { LocalStorageService } from '../storage/local-storage.service';
import { environment } from '../../../environments/environment';
import { STORAGE_KEYS } from '../../constants/storage-keys.constants';

/** An accepted notice is shown again after this long, as a reminder. */
export const EXPERIMENTAL_DISCLAIMER_REMIND_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Notice that the site is an experimental, non-public build. Shown on entering the map until
 * the user accepts it; the acceptance is remembered in localStorage for a while.
 */
@Injectable({ providedIn: 'root' })
export class ExperimentalDisclaimerService {
  private readonly dialog = inject(MatDialog);
  private readonly storage = inject(LocalStorageService);

  private dialogRef: MatDialogRef<ExperimentalDisclaimerDialogComponent> | null = null;

  /** Feature flag (EXPERIMENTAL_DISCLAIMER_ENABLED): off hides both the modal and the map tag. */
  readonly enabled: boolean = environment.experimentalDisclaimer.enabled;

  /** Opens the notice unless the user accepted it recently. */
  showIfNeeded(now: number = Date.now()): void {
    if (this.enabled && !this.wasAcceptedRecently(now)) this.open();
  }

  /** Opens the notice; it can only be closed by accepting it. */
  open(): void {
    if (this.dialogRef) return;

    this.dialogRef = this.dialog.open(ExperimentalDisclaimerDialogComponent, {
      disableClose: true,
      width: '500px',
      ariaLabelledBy: ExperimentalDisclaimerDialogComponent.titleId,
    });
    this.dialogRef.afterClosed().subscribe(() => {
      this.dialogRef = null;
      this.storage.setJson(STORAGE_KEYS.EXPERIMENTAL_DISCLAIMER, Date.now());
    });
  }

  private wasAcceptedRecently(now: number): boolean {
    const acceptedAt = this.storage.getJson<number>(STORAGE_KEYS.EXPERIMENTAL_DISCLAIMER) ?? 0;
    return acceptedAt > 0 && now - acceptedAt < EXPERIMENTAL_DISCLAIMER_REMIND_AFTER_MS;
  }
}
