import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-map-zoom-controls',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './zoom-controls.html',
  styleUrl: './zoom-controls.scss',
})
export class MapZoomControlsComponent {
  readonly visible = input<boolean>(false);
  readonly currentZoom = input<number>(0);
  readonly canZoomIn = input<boolean>(false);
  readonly canZoomOut = input<boolean>(false);
  readonly zoomIn = output<void>();
  readonly zoomOut = output<void>();
}
