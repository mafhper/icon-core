// @vitest-environment jsdom
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';
import { click, mount } from './testing/mount';

describe('Button', () => {
  it('is a plain button and does not submit a surrounding form', async () => {
    const ui = mount();
    await ui.render(createElement(Button, null, 'Export'));

    const button = ui.container.querySelector('button');
    expect(button?.type).toBe('button');
  });

  it('lets the caller ask for submit semantics', async () => {
    const ui = mount();
    await ui.render(createElement(Button, { type: 'submit' }, 'Save'));

    expect(ui.container.querySelector('button')?.type).toBe('submit');
  });

  it('calls the handler when pressed and keeps the caller className', async () => {
    const onAction = vi.fn();
    const ui = mount();
    await ui.render(createElement(Button, { onClick: onAction, className: 'hero-cta' }, 'Get it'));

    const button = ui.container.querySelector('button');
    expect(button?.className).toContain('hero-cta');

    await click(button as HTMLButtonElement);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('drops the click when disabled', async () => {
    const onAction = vi.fn();
    const ui = mount();
    await ui.render(createElement(Button, { onClick: onAction, disabled: true }, 'Soon'));

    await click(ui.container.querySelector('button') as HTMLButtonElement);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('renders the primary role token by default and a different surface for outline', async () => {
    const ui = mount();
    await ui.render(createElement(Button, null, 'Primary'));
    const primary = ui.container.querySelector('button')?.className ?? '';
    expect(primary).toContain('bg-primary');
    expect(primary).toContain('text-primary-foreground');

    await ui.render(createElement(Button, { variant: 'outline' }, 'Outline'));
    const outline = ui.container.querySelector('button')?.className ?? '';
    expect(outline).toContain('border-input');
    expect(outline).not.toContain('bg-primary');
  });
});
