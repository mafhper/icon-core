// @vitest-environment jsdom
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Slider } from './Slider';
import { inputValue, mount } from './testing/mount';

const rangeIn = (ui: { container: HTMLElement }): HTMLInputElement =>
  ui.container.querySelector('input[type="range"]') as HTMLInputElement;

describe('Slider', () => {
  it('is a native range control, so arrow keys move it with no script of ours', async () => {
    const ui = mount();
    await ui.render(
      createElement(Slider, { label: 'Opacity', min: 0, max: 100, step: 1, defaultValue: 40 })
    );

    const input = rangeIn(ui);
    expect(input.type).toBe('range');
    expect(input.min).toBe('0');
    expect(input.max).toBe('100');
    expect(input.step).toBe('1');
    expect(input.value).toBe('40');

    input.focus();
    expect(document.activeElement).toBe(input);
  });

  it('is named by its label', async () => {
    const ui = mount();
    await ui.render(createElement(Slider, { label: 'Corner radius' }));

    const input = rangeIn(ui);
    expect(input.labels?.[0]?.textContent?.trim()).toBe('Corner radius');
  });

  it('reports values snapped to the step', async () => {
    const onValueChange = vi.fn();
    const ui = mount();
    await ui.render(
      createElement(Slider, { label: 'Opacity', min: 0, max: 10, step: 0.5, onValueChange })
    );

    await inputValue(rangeIn(ui), '7.3');
    expect(onValueChange).toHaveBeenCalledWith(7.5);
  });

  it('keeps a decimal step free of float noise', async () => {
    const onValueChange = vi.fn();
    const ui = mount();
    await ui.render(
      createElement(Slider, { label: 'Scale', min: 0, max: 1, step: 0.1, onValueChange })
    );

    await inputValue(rangeIn(ui), '0.30000000000000004');
    expect(onValueChange).toHaveBeenCalledWith(0.3);
  });

  it('shows the formatted value and exposes it as the value text', async () => {
    const ui = mount();
    await ui.render(
      createElement(Slider, {
        label: 'Opacity',
        value: 35,
        min: 0,
        max: 100,
        formatValue: (value: number) => `${value}%`
      })
    );

    const input = rangeIn(ui);
    expect(input.value).toBe('35');
    expect(input.getAttribute('aria-valuetext')).toBe('35%');
    expect(ui.container.textContent).toContain('35%');
  });
});
