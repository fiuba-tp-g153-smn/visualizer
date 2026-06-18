import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/**
 * Shell de la ruta `/status`: una barra superior (volver + tres pestañas) y, en
 * el cuerpo, un `<router-outlet>` con el panel de la ruta hija activa
 * (`processing` | `cache` | `basemap`). Las pestañas son anclas `routerLink`, así
 * el navegador puede abrirlas en una pestaña nueva (click central / Ctrl-click).
 * El outlet solo instancia el panel activo, de modo que nada más uno hace polling
 * a la vez; navegar destruye el anterior (corta su intervalo) y monta el otro con
 * datos frescos.
 */
@Component({
  selector: 'app-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
  ],
  templateUrl: './status.component.html',
  styleUrl: './status.component.scss',
})
export class StatusComponent {
  private readonly router = inject(Router);

  goBack(): void {
    void this.router.navigate(['/']);
  }
}
