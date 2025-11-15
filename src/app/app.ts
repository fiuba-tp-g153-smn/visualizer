import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ArgentinaMap } from './argentina-map/argentina-map';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ArgentinaMap],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
}
