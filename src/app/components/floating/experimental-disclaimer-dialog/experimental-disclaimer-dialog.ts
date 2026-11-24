import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { COMMON_TEXTS } from '../../../texts';

/** Modal notice that the site is experimental and not open to the public. */
@Component({
  selector: 'app-experimental-disclaimer-dialog',
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './experimental-disclaimer-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExperimentalDisclaimerDialogComponent {
  static readonly titleId = 'experimental-disclaimer-title';

  protected readonly t = COMMON_TEXTS.experimental;
  protected readonly titleId = ExperimentalDisclaimerDialogComponent.titleId;
}
