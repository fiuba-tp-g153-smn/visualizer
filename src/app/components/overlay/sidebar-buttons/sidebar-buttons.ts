import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SidebarMenuService } from '../main-menu/sidebar-menu.service';

@Component({
  selector: 'app-sidebar-buttons',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  templateUrl: './sidebar-buttons.html',
  styleUrl: './sidebar-buttons.scss',
})
export class SidebarButtonsComponent {
  private readonly sidebarMenuService = inject(SidebarMenuService);

  readonly sections = this.sidebarMenuService.sections;
  readonly activePanel = this.sidebarMenuService.activePanel;

  togglePanel(panelId: string): void {
    this.sidebarMenuService.togglePanel(panelId);
  }
}
