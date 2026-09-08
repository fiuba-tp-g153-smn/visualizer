/**
 * Fake cursor + click ripple, injected into every page before first paint.
 *
 * Playwright renders no pointer in screenshots or in recorded video, so a clip
 * of "clicking around" shows things happening with nothing causing them. This
 * script draws a small arrow that follows the real pointer position (the
 * runner moves it with `page.mouse.move(x, y, { steps })` so it glides) and a
 * ripple on every mousedown. It touches nothing in the app: no app CSS class,
 * no app element, only two fixed-position nodes on <body> with the highest
 * z-index the browser allows and `pointer-events: none`.
 *
 * Exported as a string so `context.addInitScript()` can inject it verbatim.
 */
const CURSOR_CSS = [
  '#docs-cursor {',
  '  position: fixed; left: 0; top: 0; width: 22px; height: 30px;',
  '  pointer-events: none; z-index: 2147483647;',
  '  transform: translate(-3px, -2px);',
  '  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));',
  '  transition: opacity 0.15s ease; opacity: 0;',
  '}',
  '#docs-cursor.visible { opacity: 1; }',
  '#docs-cursor-ripple {',
  '  position: fixed; width: 44px; height: 44px; border-radius: 50%;',
  '  pointer-events: none; z-index: 2147483646;',
  '  border: 3px solid #0090d0; background: rgba(0, 144, 208, 0.25);',
  '  transform: translate(-50%, -50%) scale(0.3); opacity: 0;',
  '}',
  '#docs-cursor-ripple.play { animation: docs-ripple 0.45s ease-out forwards; }',
  '@keyframes docs-ripple {',
  '  0%   { transform: translate(-50%, -50%) scale(0.3); opacity: 0.9; }',
  '  100% { transform: translate(-50%, -50%) scale(1.3); opacity: 0; }',
  '}',
].join('\n');

const CURSOR_SVG =
  '<svg viewBox="0 0 22 30" width="22" height="30" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M2 2 L2 24 L8 18 L12 28 L16 26 L12 17 L20 17 Z" fill="#ffffff" ' +
  'stroke="#111827" stroke-width="1.8" stroke-linejoin="round"/></svg>';

export const CURSOR_INIT_SCRIPT = `
(() => {
  if (window.__docsCursorInstalled) return;
  window.__docsCursorInstalled = true;

  const style = document.createElement('style');
  style.textContent = ${JSON.stringify(CURSOR_CSS)};

  const cursor = document.createElement('div');
  cursor.id = 'docs-cursor';
  cursor.innerHTML = ${JSON.stringify(CURSOR_SVG)};
  const ripple = document.createElement('div');
  ripple.id = 'docs-cursor-ripple';

  const install = () => {
    document.head.appendChild(style);
    document.body.appendChild(cursor);
    document.body.appendChild(ripple);
  };
  if (document.body) install(); else document.addEventListener('DOMContentLoaded', install);

  window.addEventListener('mousemove', (e) => {
    cursor.style.transform = 'translate(' + (e.clientX - 3) + 'px, ' + (e.clientY - 2) + 'px)';
    cursor.classList.add('visible');
  }, { capture: true, passive: true });

  window.addEventListener('mousedown', (e) => {
    ripple.style.left = e.clientX + 'px';
    ripple.style.top = e.clientY + 'px';
    ripple.classList.remove('play');
    void ripple.offsetWidth; // restart the animation
    ripple.classList.add('play');
  }, { capture: true, passive: true });
})();
`;
