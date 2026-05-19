import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-panel-close-button',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './panel-close-button.html',
  styleUrl: './panel-close-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanelCloseButtonComponent {
  readonly ariaLabel = input<string>('Cerrar panel');
  readonly pressed = output<void>();

  onPressed(): void {
    this.pressed.emit();
  }
}
