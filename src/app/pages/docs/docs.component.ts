import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

interface DocsNavigationMessage {
  type: 'docs-navigation';
  path: string;
  hash?: string;
}

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
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
          *ngIf="safeUrl"
          [src]="safeUrl"
          (load)="onIframeLoad()"
          frameborder="0"
          title="Documentación Docusaurus"
        ></iframe>

        <div class="loading-overlay" *ngIf="isLoading">
          <mat-spinner diameter="50"></mat-spinner>
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
  private messageHandler = this.handleMessage.bind(this);
  private pendingFragment: string | null = null;

  ngOnInit(): void {
    window.addEventListener('message', this.messageHandler);

    const path = this.route.snapshot.paramMap.get('path');
    const fragment = this.route.snapshot.fragment;
    this.loadDocsPage(path || '', fragment);
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.messageHandler);
  }

  private loadDocsPage(path: string, fragment?: string | null): void {
    const baseUrl = environment.docsUrl;
    if (baseUrl) {
      // Store fragment to scroll after iframe loads
      this.pendingFragment = fragment || null;
      const url = `${baseUrl}/${path}`;
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    } else {
      console.error('DOCS_URL is not defined in environment');
      this.isLoading = false;
    }
  }

  private handleMessage(event: MessageEvent): void {
    const data = event.data as DocsNavigationMessage;
    if (data?.type === 'docs-navigation' && data.path) {
      const newPath = data.path.startsWith('/') ? data.path.slice(1) : data.path;
      const fragment = data.hash?.startsWith('#') ? data.hash.slice(1) : data.hash;
      this.router.navigate(['/docs', newPath], { replaceUrl: true, fragment });
    }
  }

  onIframeLoad(): void {
    this.isLoading = false;

    // After iframe loads, tell Docusaurus to scroll to anchor if needed
    if (this.pendingFragment) {
      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(
          { type: 'scroll-to-anchor', anchor: this.pendingFragment },
          '*',
        );
      }
      this.pendingFragment = null;
    }
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}
