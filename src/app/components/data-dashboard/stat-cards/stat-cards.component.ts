import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export type StatCardAccent = '' | 'green' | 'orange' | 'red';

export interface StatCard {
  readonly label: string;
  readonly value: string;
  readonly tooltip: string;
  readonly accent: StatCardAccent;
  /** Optional trailing text rendered muted (never accented), e.g. " / 240.000". */
  readonly suffix?: string;
  /** Columnas que ocupa en la grilla (default 1); súbelo para valores más largos. */
  readonly span?: number;
}

/**
 * Grilla de tarjetas estilo tiles-processor (celdas con divisores, sin tarjetas
 * con borde propio). Presentacional: recibe `StatCard[]` ya computadas. El marco
 * lo da el panel contenedor (borde redondeado + overflow:hidden, body padding:0).
 */
@Component({
  selector: 'app-stat-cards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatTooltipModule],
  template: `
    <div class="cards">
      @for (card of cards(); track card.label) {
        <div class="card" [style.grid-column]="card.span ? 'span ' + card.span : null">
          <div class="card__label">
            <span class="card__label-text">{{ card.label }}</span>
            <mat-icon
              class="card__info"
              [matTooltip]="card.tooltip"
              matTooltipClass="stat-tip"
              matTooltipPosition="above"
              >info</mat-icon
            >
          </div>
          <div
            class="card__value"
            [class.card__value--green]="card.accent === 'green'"
            [class.card__value--orange]="card.accent === 'orange'"
            [class.card__value--red]="card.accent === 'red'"
          >
            {{ card.value }}@if (card.suffix) {<span class="card__suffix">{{
              card.suffix
            }}</span>}
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    }
    .card {
      padding: 12px 14px;
      border-right: 1px solid var(--mat-sys-outline-variant, #ececec);
      border-bottom: 1px solid var(--mat-sys-outline-variant, #ececec);
    }
    .card__label {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .card__label-text {
      font-size: 10px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--mat-sys-on-surface-variant, #5f6368);
    }
    .card__info {
      font-size: 13px;
      width: 13px;
      height: 13px;
      line-height: 13px;
      cursor: help;
      color: var(--mat-sys-on-surface-variant, #5f6368);
    }
    .card__value {
      margin-top: 5px;
      font-size: 30px;
      font-weight: 600;
      line-height: 1.15;
      color: var(--mat-sys-on-surface, #1f1f1f);
      font-variant-numeric: tabular-nums;
    }
    .card__value--green {
      color: var(--metric-success, #2e9b51);
    }
    .card__value--orange {
      color: var(--metric-error, #e8702a);
    }
    .card__value--red {
      color: var(--metric-dlq, #d23b4e);
    }
    /* El sufijo (p. ej. el total "/ 240.000") va siempre neutro, sin el acento. */
    .card__suffix {
      color: var(--mat-sys-on-surface-variant, #5f6368);
      font-weight: 400;
    }
  `,
})
export class StatCardsComponent {
  readonly cards = input.required<readonly StatCard[]>();
}
