import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ArgentinaMapComponent } from './components/argentina-map/argentina-map.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ArgentinaMapComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
}
