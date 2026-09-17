import '@testing-library/jest-dom/vitest';

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