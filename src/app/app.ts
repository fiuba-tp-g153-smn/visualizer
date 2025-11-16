import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ArgentinaMap } from './argentina-map/argentina-map';
import { MainMenu } from './main-menu/main-menu';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ArgentinaMap, MainMenu],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
}
