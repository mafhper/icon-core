// @vitest-environment jsdom
import { createElement, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Switch } from './Switch';
import { click, mount, press } from './testing/mount';

const switchIn = (ui: { container: HTMLElement }): HTMLButtonElement =>
  ui.container.querySelector('[role="switch"]') as HTMLButtonElement;

describe('Switch', () => {
  it('announces itself as a switch that is off by default', async () => {
    const ui = mount();
    await ui.render(createElement(Switch, { 'aria-label': 'Dark mode' }));

    const control = switchIn(ui);
    expect(control).not.toBeNull();
    expect(control.getAttribute('aria-checked')).toBe('false');
    expect(control.getAttribute('aria-label')).toBe('Dark mode');
  });

  it('toggles once per Space press and reports the resulting state', async () => {
    const onCheckedChange = vi.fn();
    const ui = mount();
    await ui.render(createElement(Switch, { 'aria-label': 'Dark mode', onCheckedChange }));

    const control = switchIn(ui);

    await press(control, ' ');
    expect(control.getAttribute('aria-checked')).toBe('true');
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);
    expect(onCheckedChange).toHaveBeenCalledTimes(1);

    await press(control, ' ');
    expect(control.getAttribute('aria-checked')).toBe('false');
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
    expect(onCheckedChange).toHaveBeenCalledTimes(2);
  });

  it('toggles with Enter as well', async () => {
    const onCheckedChange = vi.fn();
    const ui = mount();
    await ui.render(createElement(Switch, { 'aria-label': 'Motion', onCheckedChange }));

    await press(switchIn(ui), 'Enter');
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(switchIn(ui).getAttribute('aria-checked')).toBe('true');
  });

  it('toggles on click', async () => {
    const onCheckedChange = vi.fn();
    const ui = mount();
    await ui.render(createElement(Switch, { 'aria-label': 'Grid', onCheckedChange }));

    await click(switchIn(ui));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(switchIn(ui).getAttribute('aria-checked')).toBe('true');
  });

  it('stays inert while disabled', async () => {
    const onCheckedChange = vi.fn();
    const ui = mount();
    await ui.render(createElement(Switch, { 'aria-label': 'Snap', disabled: true, onCheckedChange }));

    const control = switchIn(ui);
    expect(control.disabled).toBe(true);

    await press(control, ' ');
    await click(control);

    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(control.getAttribute('aria-checked')).toBe('false');
  });

  it('follows the owner state when controlled', async () => {
    function Controlled(): ReturnType<typeof createElement> {
      const [checked, setChecked] = useState(false);
      return createElement(Switch, {
        'aria-label': 'Presets',
        checked,
        onCheckedChange: setChecked
      });
    }

    const ui = mount();
    await ui.render(createElement(Controlled));

    expect(switchIn(ui).getAttribute('aria-checked')).toBe('false');
    await click(switchIn(ui));
    expect(switchIn(ui).getAttribute('aria-checked')).toBe('true');
  });
});
