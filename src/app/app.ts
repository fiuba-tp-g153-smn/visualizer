import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { NotificationPanelComponent } from './components/notification-panel/notification-panel';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NotificationPanelComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  ngOnInit() {
    console.log('Environment values:', environment);
  }
}
