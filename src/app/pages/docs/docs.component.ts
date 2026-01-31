import { Component, HostListener } from '@angular/core';
import { CommonModule, ViewportScroller } from '@angular/common';
import { MarkdownModule } from 'ngx-markdown';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [CommonModule, MarkdownModule, MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './docs.component.html',
  styleUrl: './docs.component.scss',
})
export class DocsComponent {
  // Simple list of topics for now. In a real app potentially loaded from a manifest
  topics = [
    { id: 'manual-de-uso', title: 'Manual de Uso' },
    // Add more topics here or load dynamically
  ];

  activeTopic = 'manual-de-uso';

  constructor(
    private http: HttpClient,
    private viewportScroller: ViewportScroller,
    private router: Router,
  ) {}

  selectTopic(topicId: string) {
    this.activeTopic = topicId;
  }

  get currentDocUrl() {
    return `docs/${this.activeTopic}.md`;
  }

  @HostListener('click', ['$event'])
  onAnchorClick(event: Event) {
    const target = event.target as HTMLElement;
    if (target.tagName === 'A') {
      const href = target.getAttribute('href');
      if (href && href.startsWith('#')) {
        event.preventDefault();
        const anchorId = href.substring(1);

        const element = document.getElementById(anchorId);
        const container = document.querySelector('.content-area');

        if (element && container) {
          const elementRect = element.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const relativeTop = elementRect.top - containerRect.top;

          container.scrollBy({
            top: relativeTop - 20, // Add some padding
            behavior: 'smooth',
          });

          // Update URL hash without navigation
          this.router.navigate([], {
            fragment: anchorId,
            replaceUrl: true,
            queryParamsHandling: 'preserve',
          });
        }
      }
    }
  }
}
