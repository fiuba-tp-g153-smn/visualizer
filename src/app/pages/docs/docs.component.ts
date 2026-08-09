import { Component, ElementRef, NgZone, OnDestroy, OnInit, inject, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LoadingSpinnerComponent } from '../../components/shared/loading-spinner/loading-spinner';
import { docsPageUrl, docsRouteFor } from './docs-url';

/**
 * MkDocs Material publishes `document$` on its own window: it emits once per
 * page the reader sees, including the instant navigations that replace the
 * document without firing `load`.
 */
interface MaterialWindow extends Window {
  readonly document$?: { subscribe(next: () => void): { unsubscribe(): void } };
}

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    LoadingSpinnerComponent,
  ],
  template: `
    <div class="docs-container">
      <div class="docs-header">
        <button mat-icon-button (click)="goBack()" aria-label="Volver" matTooltip="Ir al mapa">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <span class="docs-title">Documentación</span>
      </div>

      <div class="iframe-wrapper">
        <iframe
          #docsFrame
          *ngIf="safeUrl"
          [src]="safeUrl"
          (load)="onIframeLoad()"
          frameborder="0"
          title="Documentación"
        ></iframe>

        <div class="loading-overlay" *ngIf="isLoading">
          <app-loading-spinner [diameter]="50" />
          <p>Cargando documentación...</p>
        </div>
      </div>
    </div>
  `,
  styleUrl: './docs.component.scss',
})
export class DocsComponent implements OnInit, OnDestroy {
  safeUrl: SafeResourceUrl | null = null;
  isLoading = true;

  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly zone = inject(NgZone);

  private readonly docsFrame = viewChild<ElementRef<HTMLIFrameElement>>('docsFrame');
  private pageSubscription: { unsubscribe(): void } | null = null;

  ngOnInit(): void {
    this.loadDocsPage(this.route.snapshot.paramMap.get('path') ?? '', this.route.snapshot.fragment);
  }

  ngOnDestroy(): void {
    this.pageSubscription?.unsubscribe();
  }

  onIframeLoad(): void {
    this.isLoading = false;
    this.watchDocsNavigation();
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  private loadDocsPage(path: string, fragment: string | null): void {
    const baseUrl = environment.docsUrl;
    if (!baseUrl) {
      console.error('DOCS_URL is not defined in environment');
      this.isLoading = false;
      return;
    }

    // The fragment rides along in the URL, so the browser scrolls to the heading
    // by itself — the shell never has to ask the docs page to do it.
    const url = docsPageUrl(baseUrl, path, fragment);
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  /**
   * The docs are served from this same origin, so the shell watches the frame
   * directly instead of exchanging messages with a script injected into them.
   */
  private watchDocsNavigation(): void {
    this.pageSubscription?.unsubscribe();
    this.pageSubscription = null;

    const frame = this.docsFrame()?.nativeElement.contentWindow as MaterialWindow | null;
    if (!frame) {
      return;
    }

    try {
      const pages = frame.document$;
      if (pages) {
        this.pageSubscription = pages.subscribe(() => this.syncUrlWithFrame(frame));
      }
    } catch {
      // A cross-origin DOCS_URL denies access. The docs still render; they just
      // stop driving the shell's URL.
    }
  }

  private syncUrlWithFrame(frame: Window): void {
    const { commands, fragment } = docsRouteFor(
      environment.docsUrl,
      frame.location.pathname,
      frame.location.hash,
    );

    // The emission comes from the frame's own execution context, which is
    // outside Angular's zone.
    this.zone.run(() => {
      this.router.navigate([...commands], { replaceUrl: true, fragment });
    });
  }
}
