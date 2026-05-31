import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { SidebarMenuService } from './sidebar-menu.service';

@Component({
  selector: 'app-main-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgComponentOutlet, MatIconModule, MatButtonModule, MatCardModule, MatToolbarModule],
  templateUrl: './main-menu.html',
  styleUrl: './main-menu.scss',
})
export class MainMenuComponent {
  private readonly sidebarMenuService = inject(SidebarMenuService);

  readonly activeSection = computed(() => this.sidebarMenuService.getActiveSection());

  // Componente del panel activo, resuelto perezosamente al abrir la sección.
  // Es null mientras el chunk se descarga (o cuando no hay panel abierto).
  readonly activeComponent = this.sidebarMenuService.activeComponent;

  closePanel(): void {
    this.sidebarMenuService.closePanel();
  }
}
