// Node 25+ ships its own Web Storage globals. Its `localStorage` is undefined
// unless Node runs with --localstorage-file, and both globals shadow the ones
// jsdom provides, so specs calling `localStorage.clear()` crash on Node 26.
// Point both back at jsdom's storage, which Vitest exposes as `globalThis.jsdom`.
const dom = (globalThis as { jsdom?: { window: Window } }).jsdom;

if (dom) {
  for (const key of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key],
      configurable: true,
      writable: true,
    });
  }
}
