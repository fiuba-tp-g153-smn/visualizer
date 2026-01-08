import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayerService } from '../../services/layer.service';

/**
 * Lista de capas con controles de visibilidad, opacidad y orden
 */
@Component({
  selector: 'app-layer-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './layer-list.html',
  styleUrl: './layer-list.scss',
})
export class LayerListComponent {
  readonly layerService = inject(LayerService);
}
