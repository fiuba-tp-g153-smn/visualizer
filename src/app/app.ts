import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { NotificationPanelComponent } from './components/floating/notification-panel/notification-panel';
import { TimezoneSettingsService } from './services/settings/timezone-settings.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NotificationPanelComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly timezoneSettings = inject(TimezoneSettingsService);

  ngOnInit() {
    this.timezoneSettings.mode();
    console.log('Environment values:', environment);
  }
}
