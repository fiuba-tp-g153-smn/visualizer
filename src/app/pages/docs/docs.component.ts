import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarkdownModule } from 'ngx-markdown';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [
    CommonModule,
    MarkdownModule,
    MatButtonModule,
    MatIconModule,
    RouterLink,
    MatTooltipModule,
  ],
  templateUrl: './docs.component.html',
  styleUrl: './docs.component.scss',
})
export class DocsComponent {
  // Simple list of topics for now. In a real app potentially loaded from a manifest
  topics = [
    { id: 'intro', title: 'Introduction' },
    // Add more topics here or load dynamically
  ];

  activeTopic = 'intro';
  isDarkMode = false;

  constructor(private http: HttpClient) {}

  selectTopic(topicId: string) {
    this.activeTopic = topicId;
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
  }

  get currentDocUrl() {
    return `docs/${this.activeTopic}.md`;
  }
}
