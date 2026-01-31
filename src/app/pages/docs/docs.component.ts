import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatButtonModule, MatIconModule],
  template: `
    <div class="docs-container">
      <div class="docs-header">
        <button mat-icon-button (click)="goBack()" aria-label="Volver">
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
export class DocsComponent implements OnInit {
  safeUrl: SafeResourceUrl | null = null;
  isLoading = true;

  constructor(
    private sanitizer: DomSanitizer,
    private router: Router,
  ) {}

  ngOnInit() {
    const url = environment.docsUrl;
    if (url) {
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    } else {
      console.error('DOCS_URL is not defined in environment');
      this.isLoading = false;
    }
  }

  onIframeLoad() {
    this.isLoading = false;
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
