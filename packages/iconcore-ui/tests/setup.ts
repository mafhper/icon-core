import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// testing-library only auto-registers cleanup when globals are on (they are
// not here), so isolate renders explicitly. Without this, queries match
// elements from earlier tests ("Found multiple elements").
afterEach(() => {
  cleanup();
});

/**
 * jsdom does not implement ResizeObserver, which Radix primitives
 * (`@radix-ui/react-use-size`) rely on. Minimal stub for tests only.
 */
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: ResizeObserverStub
  });
}