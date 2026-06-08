import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';

import { BasemapDashboardComponent } from '../basemap-dashboard/basemap-dashboard.component';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { DataDashboardComponent } from '../data-dashboard/data-dashboard.component';

type StatusTab = 'processing' | 'cache' | 'basemap';

/**
 * Shell de la ruta `/status`: una barra superior (volver + tres pestañas) y, en
 * el cuerpo, uno de los tres paneles. Solo se instancia el panel de la pestaña
 * activa (`@if`), así nada más uno hace polling a la vez; cambiar de pestaña
 * destruye el anterior (corta su intervalo) y monta el otro con datos frescos.
 */
@Component({
  selector: 'app-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    DashboardComponent,
    DataDashboardComponent,
    BasemapDashboardComponent,
  ],
  templateUrl: './status.component.html',
  styleUrl: './status.component.scss',
})
export class StatusComponent {
  private readonly router = inject(Router);
  readonly tab = signal<StatusTab>('processing');

  setTab(tab: StatusTab): void {
    this.tab.set(tab);
  }

  goBack(): void {
    void this.router.navigate(['/']);
  }
}
