# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Dev server (ng serve)
npm run build      # Production build
npm test           # Run unit tests (Vitest)

make up            # Start dev environment in Docker with hot-reload
make down          # Stop dev containers
make prod          # Build and run production Docker environment
```

## Architecture

**Visualizer** is an Angular 21 standalone-component app for interactive map visualization, supporting GOES-19 satellite imagery, weather radar, and IGN WMS layers, rendered via Leaflet.

### Layer System

Layers use a **discriminated union** type system:

- `LayerType` enum (`TILE` | `WMS`) — determines Leaflet rendering strategy
- `LayerCategory` enum (`GOES_19` | `RADAR` | `IGN_WMS`) — determines behavioral config
- Union type: `type Layer = ABIGoesTileLayer | GLMGoesTileLayer | RadarTileLayer | WmsLayer`

Layer hierarchy: `LayerGroup → LayerSubgroup → Layer`

Z-index groups:

- `BASE` (1–1000): Data layers (radar, satellite)
- `OVERLAY` (1001–2000): Reference layers (IGN WMS), always on top

### Service Responsibilities

| Service | Responsibility |
|---|---|
| `LayersService` | Stateless provider of layer definitions and metadata |
| `LayerControlService` | Stateful manager of visibility/opacity/playback; persists to `localStorage` (`smn-active-layers-v2`) |
| `LayerConfigService` | Fetches dynamic tile configs from backend; reactive caching |
| `LayerRenderService` | Creates Leaflet layers; implements a pool to reuse layers when only opacity changes |
| `LayerRefreshService` | Auto-refresh polling for time-based layers |
| `BaseMapService` | Base map selection and persistence; stores selection in `localStorage` (`mapasmn_selected_base_map`) |

### Reactivity

The app uses **Angular signals and effects** (migrating away from RxJS). State changes in services propagate to components via computed signals; `MapViewer` reacts to provider/layer changes through `effect()`.

### Configuration & Environment

Environment variables are injected at build time via a custom webpack `DefinePlugin` (`custom-webpack.config.js`). The `$ENV` global is typed and used in `src/environments/environment*.ts`.

Key variables:

- `BACKEND_BASE_URL` — API base (default: `https://data.mapasmn.com`)
- `TILE_FORMAT` — `webp` or `png` (default: `webp`)
- `APP_HOST_PORT` — Docker host port (default: `6010`)

Layer definitions live in `src/app/config/layers/` organized by product (goes/, radar/, ign-wms/).

### Code Style

- Prettier: 100-char width, single quotes
- Strict TypeScript
- Standalone components (no NgModules)
- SCSS for styles
- Conventional commits: `feat:`, `fix:`, `refactor:`, `rm:`, `wip:`

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
