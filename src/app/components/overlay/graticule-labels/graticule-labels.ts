import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GraticuleScreenLabel } from '../../../utils/graticule.utils';

/** Degree labels for the graticule: meridians along the top edge, parallels along the right. */
@Component({
  selector: 'app-graticule-labels',
  standalone: true,
  templateUrl: './graticule-labels.html',
  styleUrl: './graticule-labels.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraticuleLabelsComponent {
  readonly labels = input<ReadonlyArray<GraticuleScreenLabel>>([]);
}
