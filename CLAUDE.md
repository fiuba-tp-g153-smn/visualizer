# CLAUDE.md

## Commands

```bash
npm start          # Dev server (ng serve)
npm run build      # Production build
npm test           # Unit tests (Vitest)
make up            # Docker dev with hot-reload
make down          # Stop dev containers
make prod          # Docker production build+run
make docs          # Build docs/ -> public/docs-site (MkDocs Material image)
make docs-serve    # Live-reloading docs preview on :8000
```

## Documentation

Markdown in `docs/`, built by MkDocs Material into `public/docs-site` (gitignored)
and served by the app's own nginx at `/docs-site/`; the `/docs` route embeds it in
an iframe. Nav is explicit in `mkdocs.yml`. Builds are `--strict`.

Because the docs are same-origin, `DocsComponent` keeps the shell's URL in sync by
subscribing to the frame's own `document$` (Material's per-page observable, which
also covers `navigation.instant` swaps) — no script is injected into the docs.
`docs-url.ts` holds the base-stripping that turns `/docs-site/x/` into `/docs/x`.

Media is deferred: images carry `loading=lazy` in their `attr_list`, and videos use
`preload="none"` with a `-poster.webp` frame (regenerate with `ffmpeg -ss 0.5 -i
video.webm -frames:v 1 -vf "scale='min(1280,iw)':-2" out.webp`). `lazy-video.js`
plays them on scroll via IntersectionObserver — the `autoplay` attribute would
override `preload` and download every video whether or not it is ever seen.

Two constraints are easy to break: raw HTML in a page is emitted verbatim, so any
`src` or `poster` in it must be written relative to that page's own URL depth
(MkDocs only rewrites Markdown-syntax paths); and `toc.slugify` must stay the
unicode-preserving pymdownx one, or accented heading anchors like `#introducción`
break.

## Architecture

Angular 21 standalone-component app for interactive map visualization (GOES-19 satellite, weather radar, IGN WMS layers) rendered via Leaflet.

### Layer System

Discriminated union type system:

- `LayerType` enum (`TILE` | `WMS`) → Leaflet rendering strategy
- `LayerCategory` enum (`GOES_19` | `RADAR` | `IGN_WMS`) → behavioral config
- Union: `type Layer = ABIGoesTileLayer | GLMGoesTileLayer | RadarTileLayer | WmsLayer`
- Hierarchy: `LayerGroup → LayerSubgroup → Layer`
- Z-index: `BASE` (1–1000) for data layers; `OVERLAY` (1001–2000) for reference layers (always on top)
- Definitions: `src/app/config/layers/` organized by product (`goes/`, `radar/`, `ign-wms/`)

### Services

| Service               | Role                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `LayersService`       | Stateless layer definitions and metadata                                                  |
| `LayerControlService` | Stateful visibility/opacity/playback; persists to `localStorage` (`smn-active-layers-v3`) |
| `LayerConfigService`  | Fetches dynamic tile configs; reactive caching                                            |
| `LayerRenderService`  | Creates Leaflet layers; pools for reuse on opacity-only changes                           |
| `LayerRefreshService` | Auto-refresh polling for time-based layers                                                |
| `MapLayersService`    | Leaflet layer lifecycle on the map                                                        |
| `BaseMapService`      | Base map selection/persistence (`localStorage`: `mapasmn_selected_base_map`)              |
| `AlertsService`       | HTTP calls to alerts backend for polygon intersection                                     |

### Reactivity

- State via **Angular signals**: private `WritableSignal` + `.asReadonly()` for public access
- `computed()` for derived state; `effect()` only for side effects (DOM, localStorage, Leaflet)
- RxJS only for HTTP calls

### Environment & Config

Env vars injected at build time via custom webpack `DefinePlugin` (`custom-webpack.config.js`). `$ENV` global typed in `src/environments/environment*.ts`. URL builders in `src/app/config/backend.config.ts`.

Key vars (see `.env.example`):

- `DATA_SERVICE_BASE_URL` — tile/config API (default: `https://data.mapasmn.com`)
- `ALERTS_SERVICE_BASE_URL` — alerts backend (default: `http://localhost:8080`)
- `DOCS_URL` — where `/docs` loads the docs iframe from (default `/docs-site`, served by the app itself)

## Code Standards

### TypeScript

- **Strict mode** (`strict: true`). Never use `any`; use `unknown` when uncertain
- **Immutability by default**: `const`, `Readonly<T>`, `ReadonlyArray<T>`, `as const`
- **Explicit return types** on public methods/functions
- **Prefer string literal unions** over enums (e.g., `type Status = 'active' | 'inactive'`); existing enums (`LayerType`, `LayerCategory`) are fine
- **Discriminated unions** with `type` field for exhaustive `switch`
- **Utility types**: prefer `Partial`, `Pick`, `Omit`, `NonNullable` over manual manipulation
- **Type guards**: user-defined `value is Type` for runtime narrowing

### Angular Components

- **Standalone only** — no NgModules
- **`ChangeDetectionStrategy.OnPush`** everywhere
- **Signal inputs** (`input()`) over `@Input()`; `viewChild()`/`viewChildren()` over decorators
- **Smart vs Presentational**: smart components own state/services; presentational use inputs/outputs only
- **Small, single-responsibility** components; no complex logic in templates
- **`trackBy`** for `ngFor`; `takeUntilDestroyed()` / `DestroyRef` for subscription cleanup
- **Angular Material first** for consistency and accessibility
- **Lazy loading**: `loadComponent()` for routes

### Signals & State

- Private `WritableSignal` + `.asReadonly()` for public access
- `computed()` for all derived state — single source of truth
- `effect()` for side effects only (DOM, persistence, Leaflet) — never for state updates
- Batch with `untracked()` when needed; avoid signal churn
- Flatten state — no signals inside signals
- Immutable updates: `signal.set({ ...old, updated })`
- Service-based shared state; component-local state stays local

### Styling (SCSS)

- **Flexbox + `gap` + `padding`** over margin for spacing
- **CSS variables** for colors — no hardcoded hex/rgb
- **Never `!important`** — fix specificity instead
- **Scoped component styles** (`:host`) unless truly global
- **BEM or utility classes** for custom class naming
- Responsive via CSS Grid/Flexbox + media queries

### Formatting & Commits

- Prettier: 100-char width, single quotes
- Conventional commits: `feat:`, `fix:`, `refactor:`, `rm:`, `wip:`

## Testing (Vitest)

- Test **behavior**, not implementation — focus on inputs/outputs
- Mock external dependencies (services, HTTP, third-party libs)
- Use `TestBed` sparingly; instantiate services directly with mocks
- `TestBed.flushEffects()` for signal effect testing
- Arrange-Act-Assert structure

## Performance

- Virtual scrolling (`@angular/cdk/scrolling`) for long lists
- `NgOptimizedImage` with `priority` for above-fold images
- Debounce/throttle user inputs (RxJS `debounceTime`)
- Memoize expensive calculations via `computed()` or cached pure functions
- Bundle analysis: `ng build --stats-json` + webpack-bundle-analyzer

## Error Handling

- Global `ErrorHandler` for centralized logging
- HTTP interceptors for common errors (401, 500)
- User-friendly error messages; RxJS `retry()` for transient failures
- Always show loading/error states in UI

## Accessibility

- Semantic HTML (`<button>`, `<nav>`, `<main>`) over `<div>` with click handlers
- `aria-label` / `aria-describedby` where visual context is missing
- All interactive elements keyboard-accessible (Tab, Enter, Space)
- Programmatic focus management in modals, dynamic content, navigation

## Code Organization

- **Feature folders**: group components, services, models by feature — not by type
- **Barrel exports** (`index.ts`) for clean imports; avoid circular dependencies
- **Models**: `*.models.ts` or `*.types.ts` in separate files
- **Constants**: typed constants in config files — no magic numbers/strings
- **Utilities**: reusable functions in `src/app/utils/`
- **Comments**: JSDoc for public APIs; inline comments for complex logic — avoid obvious comments and excessive commenting
