import { Component } from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-layer-list',
  imports: [MatListModule, MatCardModule],
  templateUrl: './layer-list.html',
  styleUrl: './layer-list.scss'
})
export class LayerList {
  layers = [
    {
      title: 'Capas de radar',
      description: 'Productos de radar con distintas elevaciones'
    },
    {
      title: 'Capas de satélite',
      description: 'GOES 19 ABI y GOES 19 GLM'
    },
    {
      title: 'Capas de EMAs',
      description: 'Estaciones de múltiples fuentes'
    },
    {
      title: 'Capas de estaciones convencionales',
      description: 'SYNOP y METAR/SPECI'
    },
    {
      title: 'Capas de modelos numéricos',
      description: 'WRF, GFS y ECMWF'
    },

  ];
}
