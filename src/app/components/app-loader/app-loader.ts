import { Component, OnInit, ApplicationRef, ElementRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { first } from 'rxjs';

@Component({
  selector: 'app-loader',
  imports: [CommonModule, MatProgressSpinnerModule],
  templateUrl: './app-loader.html',
  styleUrl: './app-loader.scss',
})
export class AppLoaderComponent implements OnInit {
  isHidden = false;

  constructor(
    private appRef: ApplicationRef,
    private elementRef: ElementRef,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    // Esperar a que la aplicación esté estable (standard Angular approach)
    this.appRef.isStable.pipe(first((stable) => stable)).subscribe(() => {
      this.hideLoader();
    });
  }

  private hideLoader(): void {
    // Pequeño delay para asegurar renderizado visual completo
    setTimeout(() => {
      this.isHidden = true;

      // Remover del DOM después de la transición CSS
      setTimeout(() => {
        this.renderer.removeChild(
          this.elementRef.nativeElement.parentNode,
          this.elementRef.nativeElement
        );
      }, 400);
    }, 100);
  }
}
