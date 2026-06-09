import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  switchMap,
} from 'rxjs';
import { LoadingSpinnerComponent } from '../../../../shared/loading-spinner/loading-spinner';
import { PanelCloseButtonComponent } from '../../../../shared/panel-close-button/panel-close-button';
import { PlaceSearchService } from '../../../../../services/search/place-search.service';
import { MapInfoService } from '../../../../../services/layers/map-info.service';
import { STORAGE_KEYS } from '../../../../../constants';
import { LocalStorageService } from '../../../../../services/storage/local-storage.service';
import {
  IgnPlace,
  NominatimDisplayMode,
  NominatimPlace,
  PlaceSearchSource,
} from '../../../../../models';

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 3;
const INITIAL_RESULTS_LIMIT = 5;
const RESULTS_PAGE_SIZE = 5;
const MAX_RESULTS_LIMIT = 50;

const DEFAULT_SOURCE: PlaceSearchSource = PlaceSearchSource.IGN;
const DEFAULT_NOMINATIM_DISPLAY_MODE: NominatimDisplayMode = NominatimDisplayMode.POLYGON;

/**
 * Off by default: an in-flight animated fly gets cancelled (and can silently
 * no-op) when interrupted — e.g. by quickly picking another result — which
 * feels broken for a search "go to result" action.
 */
const DEFAULT_ANIMATE_FLY_TO = false;

interface PlaceSearchConfig {
  source: PlaceSearchSource;
  nominatimDisplayMode: NominatimDisplayMode;
  animateFlyTo: boolean;
}

function isPlaceSearchSource(value: unknown): value is PlaceSearchSource {
  return value === PlaceSearchSource.IGN || value === PlaceSearchSource.NOMINATIM;
}

function isNominatimDisplayMode(value: unknown): value is NominatimDisplayMode {
  return value === NominatimDisplayMode.POLYGON || value === NominatimDisplayMode.MARKER;
}

/** A search result rendered in the list, normalized from either provider for a single template. */
type SearchResultItem =
  | {
      readonly source: PlaceSearchSource.IGN;
      readonly id: number;
      readonly title: string;
      readonly subtitle: string;
      readonly icon: string;
      readonly place: IgnPlace;
    }
  | {
      readonly source: PlaceSearchSource.NOMINATIM;
      readonly id: number;
      readonly title: string;
      readonly subtitle: string;
      readonly icon: string;
      readonly place: NominatimPlace;
    };

function toIgnResultItem(place: IgnPlace): SearchResultItem {
  return {
    source: PlaceSearchSource.IGN,
    id: place.id,
    title: place.name,
    subtitle: `${place.type} · ${place.depto}, ${place.pcia}`,
    icon: 'place',
    place,
  };
}

function toNominatimResultItem(place: NominatimPlace): SearchResultItem {
  const [title, ...rest] = place.displayName.split(',');

  return {
    source: PlaceSearchSource.NOMINATIM,
    id: place.id,
    title: title?.trim() || place.displayName,
    subtitle: rest.join(',').trim() || place.displayName,
    icon: place.geometry ? 'category' : 'place',
    place,
  };
}

/**
 * Place search tab of the "Explorar mapa" panel. Queries one of two providers
 * — the IGN gazetteer (`buscador`) or Nominatim (OpenStreetMap, which can
 * also return area boundaries) — with debounced
 * input, loads further pages as the results list is scrolled, and — on
 * selection — flies the map to the place and marks it (pin or polygon).
 */
@Component({
  selector: 'app-place-search-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatRadioModule,
    MatCheckboxModule,
    LoadingSpinnerComponent,
    PanelCloseButtonComponent,
  ],
  templateUrl: './place-search-tab.html',
  styleUrl: './place-search-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaceSearchTabComponent {
  private readonly placeSearchService = inject(PlaceSearchService);
  private readonly mapInfoService = inject(MapInfoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly storage = inject(LocalStorageService);

  private readonly queryInput$ = new Subject<{ term: string; source: PlaceSearchSource }>();
  private currentTerm = '';
  private currentSource: PlaceSearchSource = PlaceSearchSource.IGN;

  /** Exposed for the template, which can't reference TS enums directly. */
  readonly placeSearchSource = PlaceSearchSource;
  readonly nominatimDisplayModeOption = NominatimDisplayMode;

  readonly minQueryLength = MIN_QUERY_LENGTH;

  readonly query = signal('');
  readonly source = signal<PlaceSearchSource>(DEFAULT_SOURCE);
  readonly nominatimDisplayMode = signal<NominatimDisplayMode>(DEFAULT_NOMINATIM_DISPLAY_MODE);
  readonly animateFlyTo = signal<boolean>(DEFAULT_ANIMATE_FLY_TO);
  readonly configOpen = signal(false);
  readonly results = signal<ReadonlyArray<SearchResultItem>>([]);
  readonly activeIndex = signal(-1);
  readonly selectedResult = signal<SearchResultItem | null>(null);
  readonly resultsLimit = signal(INITIAL_RESULTS_LIMIT);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);

  /** Heuristic: if the API returned a full page, there's likely more to fetch. */
  readonly hasMore = computed(
    () => this.results().length >= this.resultsLimit() && this.resultsLimit() < MAX_RESULTS_LIMIT,
  );

  private readonly resultElements = viewChildren<ElementRef<HTMLElement>>('resultItem');

  constructor() {
    this.loadConfigFromStorage();

    effect(() => {
      if (this.mapInfoService.searchResult() === null) {
        this.selectedResult.set(null);
      }
    });

    effect(() => {
      const config: PlaceSearchConfig = {
        source: this.source(),
        nominatimDisplayMode: this.nominatimDisplayMode(),
        animateFlyTo: this.animateFlyTo(),
      };
      this.saveConfigToStorage(config);
    });

    this.queryInput$
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged((a, b) => a.term === b.term && a.source === b.source),
        switchMap(({ term, source }) => {
          this.currentTerm = term;
          this.currentSource = source;
          this.resultsLimit.set(INITIAL_RESULTS_LIMIT);

          if (term.length < MIN_QUERY_LENGTH) {
            this.results.set([]);
            this.activeIndex.set(-1);
            this.loading.set(false);
            this.error.set(null);
            return EMPTY;
          }

          this.loading.set(true);
          this.error.set(null);

          return this.searchWith(source, term, INITIAL_RESULTS_LIMIT).pipe(
            catchError(() => {
              this.error.set('No se pudo completar la búsqueda');
              return of<ReadonlyArray<SearchResultItem>>([]);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((items) => {
        this.results.set(items);
        this.activeIndex.set(items.length > 0 ? 0 : -1);
        this.loading.set(false);
      });
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    this.queryInput$.next({ term: value.trim(), source: this.source() });
  }

  onSourceChange(source: PlaceSearchSource): void {
    if (this.source() === source) return;

    this.source.set(source);
    this.error.set(null);
    this.queryInput$.next({ term: this.query().trim(), source });
  }

  toggleConfig(): void {
    this.configOpen.update((open) => !open);
  }

  clearQuery(): void {
    this.onQueryChange('');
  }

  onNominatimDisplayModeChange(mode: NominatimDisplayMode): void {
    this.nominatimDisplayMode.set(mode);
  }

  onAnimateFlyToChange(animate: boolean): void {
    this.animateFlyTo.set(animate);
  }

  onKeydown(event: KeyboardEvent): void {
    const total = this.results().length;

    switch (event.key) {
      case 'ArrowDown':
        if (total > 0) {
          event.preventDefault();
          this.activeIndex.set((this.activeIndex() + 1) % total);
          this.scrollActiveIntoView();
        }
        break;
      case 'ArrowUp':
        if (total > 0) {
          event.preventDefault();
          this.activeIndex.set((this.activeIndex() - 1 + total) % total);
          this.scrollActiveIntoView();
        }
        break;
      case 'Enter': {
        const active = this.results()[this.activeIndex()];
        if (active) {
          event.preventDefault();
          this.selectPlace(active);
        }
        break;
      }
    }
  }

  private scrollActiveIntoView(): void {
    this.resultElements()[this.activeIndex()]?.nativeElement.scrollIntoView({ block: 'nearest' });
  }

  selectPlace(item: SearchResultItem): void {
    this.selectedResult.set(item);

    switch (item.source) {
      case PlaceSearchSource.IGN:
        this.selectIgnPlace(item.place);
        break;
      case PlaceSearchSource.NOMINATIM:
        this.selectNominatimPlace(item.place);
        break;
    }
  }

  removeMapResult(item: SearchResultItem): void {
    if (this.selectedResult() === item) {
      this.selectedResult.set(null);
    }
    this.mapInfoService.clearSearchResult();
  }

  private selectIgnPlace(place: IgnPlace): void {
    this.error.set(null);

    const { lat, lon } = place.point;
    this.mapInfoService.setSearchResultMarker(lat, lon, this.animateFlyTo());
  }

  private selectNominatimPlace(place: NominatimPlace): void {
    if (place.geometry && this.nominatimDisplayMode() === NominatimDisplayMode.POLYGON) {
      this.mapInfoService.setSearchResultPolygon(place.geometry, this.animateFlyTo());
      return;
    }

    this.mapInfoService.setSearchResultMarker(
      place.point.lat,
      place.point.lon,
      this.animateFlyTo(),
    );
  }

  private searchWith(
    source: PlaceSearchSource,
    term: string,
    limit: number,
  ): Observable<ReadonlyArray<SearchResultItem>> {
    switch (source) {
      case PlaceSearchSource.IGN:
        return this.placeSearchService
          .search(term, limit)
          .pipe(map((places) => places.map(toIgnResultItem)));
      case PlaceSearchSource.NOMINATIM:
        return this.placeSearchService
          .searchNominatim(term, limit)
          .pipe(map((places) => places.map(toNominatimResultItem)));
    }
  }

  loadMore(): void {
    if (!this.hasMore() || this.loading() || this.loadingMore()) return;

    const term = this.currentTerm;
    const source = this.currentSource;
    const nextLimit = Math.min(this.resultsLimit() + RESULTS_PAGE_SIZE, MAX_RESULTS_LIMIT);
    this.loadingMore.set(true);

    this.searchWith(source, term, nextLimit)
      .pipe(
        catchError(() => of<ReadonlyArray<SearchResultItem>>(this.results())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((items) => {
        // The providers only support `limit`, not an offset/page — so a "next page"
        // is really a wider re-query, and a wider limit can shuffle the ranking
        // (ties resolve differently). Append only ids not already shown — slicing
        // past the previously loaded count would risk re-adding shifted items and
        // produce duplicate `track` keys (NG0955).
        const shownIds = new Set(this.results().map((result) => result.id));
        const appended = items.filter((item) => !shownIds.has(item.id));
        if (appended.length > 0) {
          this.results.update((current) => [...current, ...appended]);
        }

        this.resultsLimit.set(nextLimit);
        this.loadingMore.set(false);
      });
  }

  private loadConfigFromStorage(): void {
    const parsed = this.storage.getJson<Partial<PlaceSearchConfig>>(STORAGE_KEYS.PLACE_SEARCH_CONFIG);
    if (!parsed) return;
    if (isPlaceSearchSource(parsed.source)) {
      this.source.set(parsed.source);
    }
    if (isNominatimDisplayMode(parsed.nominatimDisplayMode)) {
      this.nominatimDisplayMode.set(parsed.nominatimDisplayMode);
    }
    if (typeof parsed.animateFlyTo === 'boolean') {
      this.animateFlyTo.set(parsed.animateFlyTo);
    }
  }

  private saveConfigToStorage(config: PlaceSearchConfig): void {
    this.storage.setJson(STORAGE_KEYS.PLACE_SEARCH_CONFIG, config);
  }
}
