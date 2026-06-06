import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * Chrome de un panel estilo Grafana adaptado al tema Material claro: barra de
 * título con un ícono de ayuda (tooltip explicativo) y un slot opcional de
 * acciones a la derecha. El contenido del panel se proyecta en el cuerpo.
 */
@Component({
  selector: 'app-metric-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatTooltipModule],
  template: `
    <section class="panel">
      <header class="panel__head">
        <span class="panel__title">{{ heading() }}</span>
        @if (tip(); as tipText) {
          <mat-icon
            class="panel__info"
            [matTooltip]="tipText"
            matTooltipPosition="right"
            matTooltipClass="panel__tooltip"
            >info</mat-icon
          >
        }
        <span class="panel__actions"><ng-content select="[panelActions]"></ng-content></span>
      </header>
      <div class="panel__body">
        <ng-content></ng-content>
      </div>
    </section>
  `,
  styleUrl: './metric-panel.component.scss',
})
export class MetricPanelComponent {
  // Llamado `heading` (no `title`): `title` es un atributo HTML global y, al
  // quedar en el host, el navegador lo muestra como tooltip nativo sobre todo
  // el panel, pisando los tooltips útiles.
  readonly heading = input.required<string>();
  readonly tip = input<string | null>(null);
}
