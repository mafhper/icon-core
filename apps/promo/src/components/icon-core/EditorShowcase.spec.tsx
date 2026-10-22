// @vitest-environment jsdom
import { createElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { click, inputValue, mount, press } from '../../ui/testing/mount';
import { EditorShowcase } from './EditorShowcase';
import { StudioProvider } from './studio-context';

/**
 * The showcase is the one interactive section on the page: the tabs swap the properties
 * panel, the keyline switch draws guides over the icon, and the radius control writes the
 * same studio state the hero reads. These tests drive it the way a visitor does.
 */

function renderShowcase() {
  const ui = mount();

  return { ui, render: ui.render(createElement(StudioProvider, null, createElement(EditorShowcase))) };
}

const buttonWithLabel = (container: HTMLElement, label: string) =>
  container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

const presetButton = (container: HTMLElement, label: string) =>
  container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

const displayMenuTrigger = (container: HTMLElement) =>
  container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]');

const displayMenuItems = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitemcheckbox"]'));

const layerRows = (container: HTMLElement) => container.querySelectorAll('[data-testid="editor-layer"]');

beforeEach(() => {
  // jsdom does not implement matchMedia; the provider only reads it for theme/motion.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {}
    })
  });
});

describe('EditorShowcase tabs', () => {
  it('starts on Design and swaps the properties panel on the tab', async () => {
    const { ui, render } = renderShowcase();
    await render;

    const tabs = Array.from(ui.container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Design', 'Export']);
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(ui.container.textContent).toContain('Margem de importação');
    expect(ui.container.textContent).not.toContain('Formatos');

    await click(tabs[1] as HTMLButtonElement);

    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('false');
    expect(ui.container.textContent).toContain('Formatos');
    expect(ui.container.textContent).not.toContain('Margem de importação');

    await click(tabs[0] as HTMLButtonElement);
    expect(ui.container.textContent).toContain('Margem de importação');
  });
});

describe('EditorShowcase keylines', () => {
  it('draws the guides only while the switch is on', async () => {
    const { ui, render } = renderShowcase();
    await render;

    const keyline = buttonWithLabel(ui.container, 'Mostrar keyline') as HTMLButtonElement;
    expect(keyline.getAttribute('aria-checked')).toBe('false');
    expect(ui.container.querySelector('[data-testid="editor-keylines"]')).toBeNull();

    await click(keyline);

    expect(keyline.getAttribute('aria-checked')).toBe('true');
    expect(ui.container.querySelector('[data-testid="editor-keylines"]')).not.toBeNull();

    await click(keyline);
    expect(ui.container.querySelector('[data-testid="editor-keylines"]')).toBeNull();
  });
});

describe('EditorShowcase frame radius', () => {
  it('writes the shared radius as a percentage and reports it in pixels', async () => {
    const { ui, render } = renderShowcase();
    await render;

    const slider = ui.container.querySelector<HTMLInputElement>('#editor-frame-radius');
    expect(slider).not.toBeNull();

    await inputValue(slider as HTMLInputElement, '50');

    // 50% of a 512 px canvas is 256 px — independent of how the control formats it.
    expect(slider?.getAttribute('aria-valuetext')).toBe('256 px');
    expect(presetButton(ui.container, 'Círculo')?.getAttribute('aria-pressed')).toBe('true');

    await inputValue(slider as HTMLInputElement, '0');
    expect(slider?.getAttribute('aria-valuetext')).toBe('0 px');
    expect(presetButton(ui.container, 'Quadrado')?.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('EditorShowcase layers', () => {
  it('duplicates and deletes a mock layer, and undo brings it back', async () => {
    const { ui, render } = renderShowcase();
    await render;

    const rows = () => ui.container.querySelectorAll('[data-testid="editor-layer"]');

    expect(rows().length).toBe(3);

    await click(buttonWithLabel(ui.container, 'Duplicar Pétalas') as HTMLButtonElement);
    expect(rows().length).toBe(4);
    expect(buttonWithLabel(ui.container, 'Apagar Pétalas 2')).not.toBeNull();

    await click(buttonWithLabel(ui.container, 'Apagar Pétalas 2') as HTMLButtonElement);
    expect(rows().length).toBe(3);
    expect(buttonWithLabel(ui.container, 'Apagar Pétalas 2')).toBeNull();

    await click(buttonWithLabel(ui.container, 'Desfazer') as HTMLButtonElement);
    expect(rows().length).toBe(4);
    expect(buttonWithLabel(ui.container, 'Apagar Pétalas 2')).not.toBeNull();
  });
});

describe('EditorShowcase history', () => {
  it('walks a visibility change back and forth through undo and redo', async () => {
    const { ui, render } = renderShowcase();
    await render;

    const undo = buttonWithLabel(ui.container, 'Desfazer') as HTMLButtonElement;
    const redo = buttonWithLabel(ui.container, 'Refazer') as HTMLButtonElement;

    // Nothing to walk yet: both ends of the history start disabled.
    expect(undo.disabled).toBe(true);
    expect(redo.disabled).toBe(true);

    await click(buttonWithLabel(ui.container, 'Ocultar Pétalas') as HTMLButtonElement);

    expect(buttonWithLabel(ui.container, 'Mostrar Pétalas')).not.toBeNull();
    expect(undo.disabled).toBe(false);

    await click(undo);
    expect(buttonWithLabel(ui.container, 'Ocultar Pétalas')).not.toBeNull();
    expect(redo.disabled).toBe(false);

    await click(redo);
    expect(buttonWithLabel(ui.container, 'Mostrar Pétalas')).not.toBeNull();
    expect(redo.disabled).toBe(true);
  });
});

describe('EditorShowcase toolbar tools', () => {
  it('keeps exactly one of select and move pressed', async () => {
    const { ui, render } = renderShowcase();
    await render;

    const select = buttonWithLabel(ui.container, 'Selecionar') as HTMLButtonElement;
    const move = buttonWithLabel(ui.container, 'Mover') as HTMLButtonElement;

    expect(select.getAttribute('aria-pressed')).toBe('true');
    expect(move.getAttribute('aria-pressed')).toBe('false');

    await click(move);

    expect(move.getAttribute('aria-pressed')).toBe('true');
    expect(select.getAttribute('aria-pressed')).toBe('false');
  });

  it('opens and closes both side panels from the chrome', async () => {
    const { ui, render } = renderShowcase();
    await render;

    const layersPanel = ui.container.querySelector('[data-testid="editor-layers-panel"]') as HTMLElement;
    const propertiesPanel = ui.container.querySelector('[data-testid="editor-properties-panel"]') as HTMLElement;
    const layersToggle = buttonWithLabel(ui.container, 'Painel de camadas') as HTMLButtonElement;
    const propertiesToggle = buttonWithLabel(ui.container, 'Painel de propriedades') as HTMLButtonElement;

    expect(layersPanel.hidden).toBe(false);
    expect(propertiesPanel.hidden).toBe(false);
    expect(layersToggle.getAttribute('aria-pressed')).toBe('true');
    expect(propertiesToggle.getAttribute('aria-pressed')).toBe('true');

    await click(layersToggle);
    expect(layersPanel.hidden).toBe(true);
    expect(layersToggle.getAttribute('aria-pressed')).toBe('false');

    await click(propertiesToggle);
    expect(propertiesPanel.hidden).toBe(true);

    await click(layersToggle);
    expect(layersPanel.hidden).toBe(false);
  });
});

describe('EditorShowcase display options', () => {
  it('toggles keylines and grid from the toolbar menu, and Escape returns focus', async () => {
    const { ui, render } = renderShowcase();
    await render;

    const trigger = displayMenuTrigger(ui.container) as HTMLButtonElement;

    expect(trigger.textContent).toContain('Opções de exibição');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(displayMenuItems(ui.container)).toHaveLength(0);

    await click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const items = displayMenuItems(ui.container);
    expect(items.map((item) => item.textContent?.trim())).toEqual(['Keylines', 'Grade']);
    // Unchecked is a state the visitor can hear, not just an empty slot in the menu.
    expect(items[0]?.getAttribute('aria-checked')).toBe('false');
    expect(items[1]?.getAttribute('aria-checked')).toBe('false');
    expect(document.activeElement).toBe(items[0]);

    await press(items[0] as HTMLButtonElement, 'Escape');

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(displayMenuItems(ui.container)).toHaveLength(0);
    expect(document.activeElement).toBe(trigger);

    // Selecting an item closes the menu and really toggles the guide it names.
    await click(trigger);
    expect(displayMenuItems(ui.container)[0]?.getAttribute('aria-checked')).toBe('false');
    await click(displayMenuItems(ui.container)[0] as HTMLButtonElement);

    expect(ui.container.querySelector('[data-testid="editor-keylines"]')).not.toBeNull();
    expect(displayMenuItems(ui.container)).toHaveLength(0);
    expect(document.activeElement).toBe(trigger);

    // Grid is the same state the properties panel switch reads, whichever way it is set.
    await click(trigger);
    await click(displayMenuItems(ui.container)[1] as HTMLButtonElement);

    expect(buttonWithLabel(ui.container, 'Mostrar grade')?.getAttribute('aria-checked')).toBe('true');
    expect(buttonWithLabel(ui.container, 'Grade')?.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('EditorShowcase add layer', () => {
  it('adds sequential layers and never reuses a name that is still on screen', async () => {
    const { ui, render } = renderShowcase();
    await render;

    const add = buttonWithLabel(ui.container, 'Adicionar camada') as HTMLButtonElement;
    expect(add).not.toBeNull();

    await click(add);
    expect(layerRows(ui.container).length).toBe(4);
    expect(buttonWithLabel(ui.container, 'Apagar Camada 1')).not.toBeNull();

    await click(add);
    expect(layerRows(ui.container).length).toBe(5);
    expect(buttonWithLabel(ui.container, 'Apagar Camada 2')).not.toBeNull();

    // Deleting the first and adding again reuses that number instead of colliding.
    await click(buttonWithLabel(ui.container, 'Apagar Camada 1') as HTMLButtonElement);
    await click(add);

    expect(buttonWithLabel(ui.container, 'Apagar Camada 1')).not.toBeNull();
    expect(buttonWithLabel(ui.container, 'Apagar Camada 3')).toBeNull();
    expect(layerRows(ui.container).length).toBe(5);
  });
});

describe('EditorShowcase empty canvas', () => {
  it('names the empty state and lets the plus put the canvas back', async () => {
    const { ui, render } = renderShowcase();
    await render;

    for (const name of ['Pétalas', 'Núcleo', 'Fundo']) {
      await click(buttonWithLabel(ui.container, `Apagar ${name}`) as HTMLButtonElement);
    }

    const emptyState = ui.container.querySelector('[data-testid="editor-empty-state"]');
    expect(emptyState).not.toBeNull();
    expect(emptyState?.textContent).toContain('Nenhuma camada');
    // The canvas is empty, not broken: no glyph and an instruction to leave the state.
    expect(ui.container.querySelector('[aria-label="Ícone no editor"]')).toBeNull();
    expect(emptyState?.textContent).toContain('adicionar');

    await click(buttonWithLabel(ui.container, 'Adicionar camada') as HTMLButtonElement);

    expect(ui.container.querySelector('[data-testid="editor-empty-state"]')).toBeNull();
    expect(ui.container.querySelector('[aria-label="Ícone no editor"]')).not.toBeNull();
    expect(layerRows(ui.container).length).toBe(1);

    // Deleting the last layer is undoable, like every other edit.
    await click(buttonWithLabel(ui.container, 'Apagar Camada 1') as HTMLButtonElement);
    expect(ui.container.querySelector('[data-testid="editor-empty-state"]')).not.toBeNull();

    await click(buttonWithLabel(ui.container, 'Desfazer') as HTMLButtonElement);
    expect(ui.container.querySelector('[data-testid="editor-empty-state"]')).toBeNull();
  });
});

describe('EditorShowcase zoom readout', () => {
  it('reports the live zoom, clamped to the 60–120 % the toolbar offers', async () => {
    const { ui, render } = renderShowcase();
    await render;

    const readout = () => ui.container.querySelector('[data-testid="canvas-zoom"]')?.textContent?.trim();
    const zoomIn = buttonWithLabel(ui.container, 'Aumentar zoom') as HTMLButtonElement;
    const zoomOut = buttonWithLabel(ui.container, 'Diminuir zoom') as HTMLButtonElement;

    expect(readout()).toBe('100%');

    await click(zoomIn);
    expect(readout()).toBe('110%');

    await click(zoomIn);
    expect(readout()).toBe('120%');
    await click(zoomIn);
    expect(readout()).toBe('120%');

    for (let step = 0; step < 7; step += 1) await click(zoomOut);
    expect(readout()).toBe('60%');

    await click(buttonWithLabel(ui.container, 'Ajustar') as HTMLButtonElement);
    expect(readout()).toBe('100%');
  });
});

describe('EditorShowcase history cap', () => {
  // 50 snapshots plus 50 undos is 100 UI actions, each a full React commit: ~5 s idle, but
  // several times that when the suite runs with many workers on one machine.
  // The ceiling is wall-clock room for that contention, not a smaller cap.
  it(
    'keeps the 50 most recent edits undoable',
    async () => {
      const { ui, render } = renderShowcase();
      await render;

      const add = buttonWithLabel(ui.container, 'Adicionar camada') as HTMLButtonElement;
      for (let step = 0; step < 51; step += 1) await click(add);

      expect(layerRows(ui.container).length).toBe(54);

      const undo = buttonWithLabel(ui.container, 'Desfazer') as HTMLButtonElement;
      let steps = 0;
      while (!undo.disabled) {
        await click(undo);
        steps += 1;
      }

      // 51 edits, 50 snapshots: the oldest one is beyond the documented ceiling.
      expect(steps).toBe(50);
      expect(layerRows(ui.container).length).toBe(4);
    },
    60_000
  );
});
