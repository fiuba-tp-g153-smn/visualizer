import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';

interface ScrollToAnchorMessage {
  type: 'scroll-to-anchor';
  anchor: string;
}

// Track if initial load has completed to avoid overwriting parent URL
let isInitialLoad = true;

/**
 * Scroll to an anchor element by ID.
 */
function scrollToAnchor(anchor: string): void {
  const element = document.getElementById(anchor);
  console.log('[Docusaurus] scrollToAnchor:', anchor, '| element found:', !!element);
  if (element) {
    element.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
}

/**
 * Listen for scroll requests from parent window.
 */
function handleParentMessage(event: MessageEvent): void {
  const data = event.data as ScrollToAnchorMessage;
  console.log('[Docusaurus] Received message:', data);
  if (data?.type === 'scroll-to-anchor' && data.anchor) {
    // Try immediately
    scrollToAnchor(data.anchor);
    // Also try after a short delay in case DOM isn't fully ready
    setTimeout(() => scrollToAnchor(data.anchor), 100);
    setTimeout(() => scrollToAnchor(data.anchor), 300);
  }
}

/**
 * Client module that handles communication with parent window.
 * Used when Docusaurus is embedded in an iframe.
 */
export function onRouteDidUpdate({ location }: { location: Location }): void {
  if (!ExecutionEnvironment.canUseDOM) {
    return;
  }

  // Only post message if we're in an iframe
  if (window.parent !== window) {
    // Skip initial load to avoid overwriting parent URL with hash
    if (isInitialLoad) {
      isInitialLoad = false;
      return;
    }

    // Decode hash to prevent double-encoding by Angular router
    const decodedHash = location.hash ? decodeURIComponent(location.hash) : '';

    window.parent.postMessage(
      {
        type: 'docs-navigation',
        path: location.pathname,
        hash: decodedHash,
      },
      '*'
    );
  }
}

// Set up message listener on module load
if (ExecutionEnvironment.canUseDOM && window.parent !== window) {
  window.addEventListener('message', handleParentMessage);
}
