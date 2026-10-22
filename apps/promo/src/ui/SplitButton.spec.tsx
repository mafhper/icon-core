// @vitest-environment jsdom
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SplitButton, type SplitButtonItem, type SplitButtonProps } from './SplitButton';
import { click, mount, pointerDown, press } from './testing/mount';

const TARGETS = ['PNG', 'SVG', 'Copy path'];

function items(onSelect: (id: string) => void = () => {}): SplitButtonItem[] {
  return TARGETS.map((label) => ({
    id: label.toLowerCase(),
    label,
    onSelect: () => onSelect(label)
  }));
}

const triggerIn = (ui: { container: HTMLElement }): HTMLButtonElement =>
  ui.container.querySelector('[aria-haspopup="menu"]') as HTMLButtonElement;

const menuIn = (ui: { container: HTMLElement }): HTMLElement | null =>
  ui.container.querySelector('[role="menu"]');

const menuItemsIn = (ui: { container: HTMLElement }): HTMLButtonElement[] =>
  Array.from(ui.container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));

describe('SplitButton', () => {
  it('pairs its main action with a menu trigger', async () => {
    const onAction = vi.fn();
    const ui = mount();
    await ui.render(createElement(SplitButton, { label: 'Export', onAction, items: items() }));

    const [primary, trigger] = Array.from(ui.container.querySelectorAll('button'));
    expect(primary.textContent).toContain('Export');
    expect(primary.getAttribute('aria-haspopup')).toBeNull();

    expect(trigger).toBe(triggerIn(ui));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(menuIn(ui)).toBeNull();

    await click(primary);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('opens on the trigger, reports expanded and selects an item', async () => {
    const onSelect = vi.fn();
    const ui = mount();
    await ui.render(
      createElement(SplitButton, { label: 'Export', onAction: () => {}, items: items(onSelect) })
    );

    await click(triggerIn(ui));
    expect(triggerIn(ui).getAttribute('aria-expanded')).toBe('true');
    expect(menuItemsIn(ui)).toHaveLength(TARGETS.length);

    await click(menuItemsIn(ui)[1]);
    expect(onSelect).toHaveBeenCalledWith('SVG');
    expect(menuIn(ui)).toBeNull();
    expect(triggerIn(ui).getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(triggerIn(ui));
  });

  it('opens with ArrowDown, moving focus into the menu', async () => {
    const ui = mount();
    await ui.render(createElement(SplitButton, { label: 'Export', onAction: () => {}, items: items() }));

    triggerIn(ui).focus();
    await press(triggerIn(ui), 'ArrowDown');

    expect(triggerIn(ui).getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(menuItemsIn(ui)[0]);
  });

  it('closes on Escape and gives focus back to the trigger', async () => {
    const ui = mount();
    await ui.render(createElement(SplitButton, { label: 'Export', onAction: () => {}, items: items() }));

    await click(triggerIn(ui));
    await press(document.activeElement as HTMLElement, 'Escape');

    expect(menuIn(ui)).toBeNull();
    expect(triggerIn(ui).getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(triggerIn(ui));
  });

  it('walks the items with the arrow keys and wraps at both ends', async () => {
    const ui = mount();
    await ui.render(createElement(SplitButton, { label: 'Export', onAction: () => {}, items: items() }));

    triggerIn(ui).focus();
    await press(triggerIn(ui), 'ArrowDown');
    const [first, second, third] = menuItemsIn(ui);

    await press(document.activeElement as HTMLElement, 'ArrowDown');
    expect(document.activeElement).toBe(second);

    await press(document.activeElement as HTMLElement, 'ArrowDown');
    expect(document.activeElement).toBe(third);

    await press(document.activeElement as HTMLElement, 'ArrowDown');
    expect(document.activeElement).toBe(first);

    await press(document.activeElement as HTMLElement, 'ArrowUp');
    expect(document.activeElement).toBe(third);

    await press(document.activeElement as HTMLElement, 'Home');
    expect(document.activeElement).toBe(first);

    await press(document.activeElement as HTMLElement, 'End');
    expect(document.activeElement).toBe(third);
  });

  it('opens on ArrowUp with focus on the last item', async () => {
    const ui = mount();
    await ui.render(createElement(SplitButton, { label: 'Export', onAction: () => {}, items: items() }));

    triggerIn(ui).focus();
    await press(triggerIn(ui), 'ArrowUp');
    expect(document.activeElement).toBe(menuItemsIn(ui)[TARGETS.length - 1]);
  });

  it('skips disabled items while walking', async () => {
    const entries: SplitButtonItem[] = [
      { id: 'png', label: 'PNG', onSelect: () => {}, disabled: true },
      { id: 'svg', label: 'SVG', onSelect: () => {} },
      { id: 'path', label: 'Copy path', onSelect: () => {} }
    ];
    const ui = mount();
    await ui.render(createElement(SplitButton, { label: 'Export', onAction: () => {}, items: entries }));

    triggerIn(ui).focus();
    await press(triggerIn(ui), 'ArrowDown');
    expect(document.activeElement).toBe(menuItemsIn(ui)[1]);

    await press(document.activeElement as HTMLElement, 'ArrowDown');
    expect(document.activeElement).toBe(menuItemsIn(ui)[2]);

    await press(document.activeElement as HTMLElement, 'ArrowDown');
    expect(document.activeElement).toBe(menuItemsIn(ui)[1]);
  });

  it('activates the focused item with Enter', async () => {
    const onSelect = vi.fn();
    const ui = mount();
    await ui.render(
      createElement(SplitButton, { label: 'Export', onAction: () => {}, items: items(onSelect) })
    );

    triggerIn(ui).focus();
    await press(triggerIn(ui), 'ArrowDown');
    await press(document.activeElement as HTMLElement, 'ArrowDown');
    await press(document.activeElement as HTMLElement, 'Enter');

    expect(onSelect).toHaveBeenCalledWith('SVG');
    expect(menuIn(ui)).toBeNull();
    expect(document.activeElement).toBe(triggerIn(ui));
  });

  it('closes when the pointer goes down outside', async () => {
    const ui = mount();
    await ui.render(createElement(SplitButton, { label: 'Export', onAction: () => {}, items: items() }));

    await click(triggerIn(ui));
    expect(menuIn(ui)).not.toBeNull();

    await pointerDown(document.body);
    expect(menuIn(ui)).toBeNull();
  });

  it('renders the primary as a real link when it navigates', async () => {
    const ui = mount();
    await ui.render(
      createElement(SplitButton, {
        label: 'Download',
        actionHref: 'https://example.com/releases',
        items: items()
      })
    );

    const link = ui.container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.com/releases');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noreferrer');

    await click(triggerIn(ui));
    expect(menuItemsIn(ui)).toHaveLength(TARGETS.length);
  });

  it('drops the primary and warns when it has neither an action nor a link', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ui = mount();

    // Bypasses the props union on purpose: this is the shape a plain JavaScript caller can
    // still pass, and the runtime guard is what keeps it from rendering a dead control.
    await ui.render(
      createElement(SplitButton, {
        label: 'Export',
        items: items()
      } as unknown as SplitButtonProps)
    );

    const buttons = Array.from(ui.container.querySelectorAll('button'));
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toBe(triggerIn(ui));
    expect(ui.container.querySelector('a')).toBeNull();
    expect(ui.container.textContent).not.toContain('Export');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('onAction'));

    await click(triggerIn(ui));
    expect(menuItemsIn(ui)).toHaveLength(TARGETS.length);

    warn.mockRestore();
  });

  it('rounds only the outer edges when pill is requested', async () => {
    const ui = mount();
    await ui.render(createElement(SplitButton, { label: 'Export', onAction: () => {}, items: items(), pill: true }));

    const [primary, trigger] = Array.from(ui.container.querySelectorAll('button'));
    expect(primary.className).toContain('rounded-s-full');
    expect(trigger.className).toContain('rounded-e-full');
  });
});
