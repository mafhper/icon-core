import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach } from 'vitest';

/**
 * Minimal DOM harness: `react-dom/client` + `act`, both already dependencies of this app.
 * The kit has no testing-library dependency on purpose — nothing new to install, since
 * this file only needs `react-dom/client` + `act` — so it is the only test-only module
 * under `src/ui`.
 *
 * Lives in a `.ts` file (no JSX) because `react-refresh/only-export-components` warns on
 * non-component exports from `.tsx`, and lint runs with `--max-warnings 0`.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export interface Mounted {
  container: HTMLElement;
  render: (element: ReactElement) => Promise<void>;
  unmount: () => Promise<void>;
}

const mounted: Mounted[] = [];

export function mount(): Mounted {
  const container = document.createElement('div');
  document.body.append(container);
  const root: Root = createRoot(container);

  const ui: Mounted = {
    container,
    async render(element) {
      await act(async () => {
        root.render(element);
      });
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  };

  mounted.push(ui);

  return ui;
}

afterEach(async () => {
  for (const ui of mounted.splice(0)) await ui.unmount();
});

/**
 * Waits one macrotask inside `act`, which is how a promise chain started by an effect
 * (`fetch` → `json` → `setState`) settles before the next assertion.
 */
export async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

export async function press(element: Element, key: string): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

export async function click(element: Element): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

export async function pointerDown(element: Element): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  });
}

/**
 * Sets the value through the prototype setter and fires `input`. React patches `value`
 * on the instance to track changes; assigning via `element.value` updates its tracker,
 * so the following `input` event looks unchanged and React never calls `onChange`.
 */
export async function inputValue(element: HTMLInputElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw new Error('HTMLInputElement value setter unavailable');

  setter.call(element, value);

  await act(async () => {
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
