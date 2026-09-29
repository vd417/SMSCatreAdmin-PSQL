import '@testing-library/jest-dom/vitest';

// jsdom does not implement ResizeObserver — polyfill for chart components
class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as Record<string, unknown>).ResizeObserver = ResizeObserverPolyfill;

// jsdom does not implement matchMedia either. This stand-in reports one shared
// match state for every query, which tests drive with setMediaMatches().
type MqListener = (e: MediaQueryListEvent) => void;
const mqListeners = new Set<MqListener>();
let mqMatches = false;

(globalThis as unknown as Record<string, unknown>).matchMedia = (query: string) => ({
  media: query,
  get matches() { return mqMatches; },
  onchange: null,
  addEventListener: (_: string, l: MqListener) => { mqListeners.add(l); },
  removeEventListener: (_: string, l: MqListener) => { mqListeners.delete(l); },
  addListener: (l: MqListener) => { mqListeners.add(l); },
  removeListener: (l: MqListener) => { mqListeners.delete(l); },
  dispatchEvent: () => false,
});

/** Set what every media query reports, and notify anything already listening. */
export function setMediaMatches(v: boolean): void {
  mqMatches = v;
  for (const l of mqListeners) l({ matches: v } as MediaQueryListEvent);
}
