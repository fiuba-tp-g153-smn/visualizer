import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { COMMON_TEXTS } from '../../../texts';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [],
  templateUrl: './loading-spinner.html',
  styleUrl: './loading-spinner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingSpinnerComponent {
  protected readonly t = COMMON_TEXTS.aria;
  readonly diameter = input<number>(30);

  protected readonly strokeWidth = computed(() => Math.max(2, Math.round(this.diameter() / 10)));
}
