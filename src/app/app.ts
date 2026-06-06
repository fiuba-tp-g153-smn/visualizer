import { ApplicationRef, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { first } from 'rxjs';
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
  private readonly appRef = inject(ApplicationRef);

  ngOnInit() {
    this.timezoneSettings.mode();
    this.removeSplashWhenStable();
  }

  /**
   * Removes the static #app-splash (defined in index.html) once the app reaches
   * its first stable state. Replaces the former separate loader Angular app —
   * same hide-then-remove timing, but without a second bootstrap.
   */
  private removeSplashWhenStable(): void {
    let removed = false;
    const remove = (): void => {
      if (removed) return;
      removed = true;
      const splash = document.getElementById('app-splash');
      if (!splash) return;
      splash.classList.add('hidden');
      setTimeout(() => splash.remove(), 400); // wait out the CSS fade
    };

    this.appRef.isStable.pipe(first((stable) => stable)).subscribe(() => {
      // Brief delay so the first real frame paints before the fade-out.
      setTimeout(remove, 100);
    });

    // Safety net: never let the full-screen splash block the UI indefinitely if
    // the app never reports stable (e.g. a long-lived background task).
    setTimeout(remove, 12000);
  }
}
