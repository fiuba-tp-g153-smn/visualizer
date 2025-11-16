import { Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-menu-button',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './menu-button.html',
  styleUrl: './menu-button.scss'
})
export class MenuButton {
  textHover = input<string>('');
}
