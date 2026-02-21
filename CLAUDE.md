# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Visualizer is an Angular 21 web application for visualizing interactive maps with multiple layers, tile providers, and satellite imagery (SMN - Argentine National Weather Service). Uses Leaflet for mapping and Angular Signals for state management.

## Commands

```bash
# Development (Docker with hot-reload)
make up              # Start dev server at http://localhost:4200
make down            # Stop containers

# Production
make prod            # Build and run production Docker

# NPM commands (inside container or local)
npm start            # ng serve
npm run build        # ng build --configuration production
npm test             # Run tests (Vitest)
```

## Architecture

### Signal-Based State Management

The app uses Angular Signals for reactive state. Core state lives in `LayerService`:

```typescript
// src/app/services/layers/layer.service.ts
private readonly _layerGroups = signal<LayerGroup[]>(...)
public readonly layerGroups = this._layerGroups.asReadonly()
public readonly activeLayers = computed(() => ...)  // Filtered/sorted active layers
```

State auto-persists to localStorage via `effect()`.

### Layer System

Layers are organized hierarchically: **LayerGroup** → **LayerSubgroup** → **Layer**

Two z-index groups ensure proper layering:

- `ActiveLayerGroup.BASE` (z-index 0-999): Satellite, model data
- `ActiveLayerGroup.OVERLAY` (z-index 1000-1999): IGN reference layers (always on top)

Layers have relative z-index within their group; `getAbsoluteZIndex()` converts to absolute.

### Tile Layer Rendering

`LayerRendererService` is a factory that creates Leaflet layers based on type/category:

- `LayerType.TILE` → standard tile layer
- `LayerType.WMS` → WMS layer
- `LayerCategory.SATELLITE_ABI` → uses backend tile URLs
- `LayerCategory.IGN_WMS` → uses IGN WMS endpoint

Tile layers are pooled by `${layerId}-${tilesetId}` key. For time-based layers, adjacent indices (T-1, T, T+1) are pre-fetched.

### Time Control

ABI satellite layers support time-based playback:

```typescript
interface TimeBasedLayerConfig {
  timeIndex?: number;
  playback?: LayerPlaybackConfig; // { isPlaying, speed, minTimeIndex, maxTimeIndex }
  availablePeriods?: readonly number[]; // [1, 6, 12, 24] hours
}
```

`LayerService` manages playback intervals with automatic frame advancement.

### Configuration Loading

`LayerConfigService` lazily loads channel configs from backend:

```
GET /products/{product}/{instrument}/{channel}
```

Returns tilesets (available time steps) and URL patterns for tile construction.

## Key Files

| Path                                                | Purpose                                      |
| --------------------------------------------------- | -------------------------------------------- |
| `src/app/services/layers/layer.service.ts`          | Core state management for all layers         |
| `src/app/services/layers/layer-renderer.service.ts` | Tile layer factory with pooling              |
| `src/app/services/layers/layer-config.service.ts`   | Backend config fetching                      |
| `src/app/components/map/map-viewer.ts`              | Leaflet map initialization and layer effects |
| `src/app/config/layers/`                            | Layer definitions (ABI, IGN WMS)             |
| `src/app/config/tile-providers.config.ts`           | Base map tile providers                      |
| `src/app/models/layer.models.ts`                    | Layer type definitions                       |

## Testing

Tests use Vitest with jsdom. Test files follow `*.spec.ts` pattern.

```bash
npm test                    # Run all tests
npm test -- --run           # Single run (no watch)
```

## Environment Variables

Configured via `.env` and injected through `custom-webpack.config.js`:

- `BACKEND_BASE_URL`: API endpoint for channel configs
- `USE_MOCK_TILES`: Use mock tile URLs for development
- `TILE_FORMAT`: "png" or "webp"

## Patterns

- **Standalone components**: No NgModules; all components are standalone
- **Configuration composition**: Layer defaults spread into definitions to reduce repetition
- **Search normalization**: Uses NFD normalization for accent-insensitive search (Spanish UI)
- **TMS handling**: ArgenMAP uses TMS (Y inverted), OSM uses standard coordinates
- **Error deduplication**: LayerRendererService tracks consecutive tile failures (threshold: 5) before notifying

---

## Best Practices

### TypeScript

- **Strict mode enabled**: Use `strict: true` in tsconfig. Avoid `any`; use `unknown` when type is uncertain
- **Prefer `const` and `readonly`**: Immutability by default. Use `Readonly<T>`, `ReadonlyArray<T>`, or `as const` for literals
- **Type guards**: Create user-defined type guards (`value is Type`) for runtime type narrowing
- **Utility types**: Leverage `Partial`, `Required`, `Pick`, `Omit`, `NonNullable` instead of manual type manipulation
- **Explicit return types**: Always define function return types for public methods/functions
- **Avoid enums**: Prefer string literal unions (`type Status = 'active' | 'inactive'`) or const objects with `as const`
- **Discriminated unions**: Use `type` field in union types for exhaustive checking with `switch`

### Angular Signals

- **Private signals, readonly access**: Expose signals via `.asReadonly()` to prevent external mutation
- **Computed for derived state**: Use `computed()` for any state derived from other signals
- **Effects for side effects only**: Use `effect()` for DOM updates, logging, persistence—not for state updates
- **Avoid signal churn**: Batch updates with `untracked()` or update objects directly instead of replacing entire signal values
- **Signal inputs**: Prefer `input()` over `@Input()` for component inputs in Angular 17.1+
- **Signal queries**: Use `viewChild()`, `viewChildren()`, `contentChild()` instead of `@ViewChild` decorators

### Angular Components

- **Smart vs Presentational**: Smart components manage state and services; presentational components use `@Input/@Output` (or signal inputs) only
- **OnPush everywhere**: Use `ChangeDetectionStrategy.OnPush` by default. Signals make this seamless
- **Small, focused components**: Single responsibility. Split complex components into composable pieces
- **No logic in templates**: Complex expressions belong in component properties or pipes
- **TrackBy for ngFor**: Always provide `trackBy` functions to optimize list rendering
- **Destroy subscriptions**: Use `takeUntilDestroyed()` or `DestroyRef` for automatic cleanup
- **Typed template variables**: Use `$any()` sparingly; prefer typed template references
- **Angular Material first**: Use Angular Material components whenever possible for consistency and accessibility
- **Follow Angular style guide**: Adhere to official Angular coding conventions and best practices

### Styling

- **Flexbox with gap**: Prefer `display: flex` + `gap` + `padding` over `margin` for spacing
- **CSS variables for colors**: Use globally defined color variables instead of hardcoded hex/rgb values
- **Avoid !important**: Never use `!important`; fix specificity issues instead
- **Component styles scoped**: Keep styles in component files (`:host` selector) unless truly global
- **BEM or utility classes**: Use consistent naming convention for custom classes
- **Responsive design**: Use CSS Grid/Flexbox and media queries for responsive layouts

### State Management

- **Service-based state**: For shared state, use services with signals (like `LayerService`)
- **Local state in components**: Keep component-specific state local using signals
- **Immutable updates**: Replace entire objects/arrays when updating signals: `signal.set({ ...old, updated })`
- **Avoid nested signals**: Flatten state structure. Don't create signals inside signals
- **Single source of truth**: Derive all related state from one canonical source using `computed()`

### Performance

- **Lazy loading**: Load features/routes on demand. Use `loadComponent()` for routes
- **Virtual scrolling**: Use `@angular/cdk/scrolling` for long lists
- **Image optimization**: Use `NgOptimizedImage` directive with `priority` for above-fold images
- **Debounce/throttle inputs**: For search/filter inputs, debounce user input (use RxJS `debounceTime`)
- **Memoize expensive calculations**: Cache results of pure functions outside components or use `computed()`
- **Bundle analysis**: Run `ng build --stats-json` and analyze with webpack-bundle-analyzer

### Code Organization

- **Barrel exports**: Use `index.ts` for clean imports, but avoid circular dependencies
- **Feature folders**: Group by feature (components, services, models together), not by type
- **Models in separate files**: Keep interfaces/types in `*.models.ts` or `*.types.ts`
- **Constants in config files**: Extract magic numbers/strings to typed constants
- **Shared utilities**: Create reusable utility functions in `src/app/utils/`

### Testing

- **Test behavior, not implementation**: Focus on component inputs/outputs, not internal methods
- **Mock external dependencies**: Mock services, HTTP, and third-party libraries
- **Use TestBed sparingly**: For unit tests, instantiate services directly with mocked dependencies
- **Signal testing**: Use `TestBed.flushEffects()` to trigger effects in tests
- **Arrange-Act-Assert**: Structure tests clearly with setup, action, and verification phases

### Accessibility

- **Semantic HTML**: Use `<button>`, `<nav>`, `<main>` over generic `<div>` with click handlers
- **ARIA labels**: Add `aria-label`, `aria-describedby` for screen readers when visual context is missing
- **Keyboard navigation**: Ensure all interactive elements are keyboard accessible (Tab, Enter, Space)
- **Focus management**: Manage focus programmatically in modals, dynamic content, and navigation changes

### Error Handling

- **Global error handler**: Implement `ErrorHandler` for centralized error logging
- **HTTP interceptors**: Handle common HTTP errors (401, 500) in interceptors
- **User-friendly messages**: Translate technical errors to actionable user feedback
- **Retry logic**: Use RxJS `retry()` or `retryWhen()` for transient failures
- **Loading/error states**: Always show loading spinners and error messages in UI
