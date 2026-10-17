import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GradientFill } from '@iconcore/shared';
import { StudioColorPicker, type StudioColorValue } from './StudioColorPicker';

afterEach(cleanup);

const renderPicker = (value: StudioColorValue = { color: '#3f6ce0', alpha: 1 }, props = {}) => {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  render(<StudioColorPicker label="Paint" value={value} onChange={onChange} onCommit={onCommit} {...props} />);
  return { onChange, onCommit };
};

const expand = () => fireEvent.click(screen.getByRole('button', { name: 'Expand Paint picker' }));

describe('StudioColorPicker', () => {
  it('keeps the header contract: hex field, alpha percent, collapsed body', () => {
    renderPicker();
    expect(screen.getByLabelText('Paint hex')).toHaveValue('3F6CE0');
    expect(screen.getByRole('spinbutton', { name: 'Paint alpha percent' })).toHaveValue(100);
    expect(screen.queryByLabelText('Paint hue')).not.toBeInTheDocument();
  });

  it('opens the OpenPencil surface: 2D area, hue and alpha sliders, format fields', () => {
    renderPicker();
    expand();
    expect(screen.getByLabelText('Paint saturation and brightness. Arrow keys adjust.')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Paint hue' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Paint alpha' })).toBeInTheDocument();
    expect(screen.getByLabelText('Paint format')).toBeInTheDocument();
    expect(screen.getByLabelText('Paint hex value')).toHaveValue('#3f6ce0');
  });

  it('normalises header hex typing live, and commits on blur', () => {
    const { onChange, onCommit } = renderPicker();
    const hex = screen.getByLabelText('Paint hex');
    fireEvent.change(hex, { target: { value: 'ff0000' } });
    expect(onChange).toHaveBeenCalledWith({ color: '#ff0000', alpha: 1 }, true);
    fireEvent.blur(hex);
    expect(onCommit).toHaveBeenCalled();
  });

  it('switches the value field across hex, rgb, hsl and hsb', () => {
    const { onChange } = renderPicker({ color: '#ff0000', alpha: 1 });
    expand();
    const format = screen.getByLabelText('Paint format');

    fireEvent.change(format, { target: { value: 'rgb' } });
    expect(screen.getByLabelText('Paint rgb value')).toHaveValue('255, 0, 0');

    fireEvent.change(format, { target: { value: 'hsb' } });
    const hsb = screen.getByLabelText('Paint hsb value');
    expect(hsb).toHaveValue('0, 100%, 100%');
    fireEvent.change(hsb, { target: { value: '120, 100%, 100%' } });
    expect(onChange).toHaveBeenCalledWith({ color: '#00ff00', alpha: 1 }, true);
  });

  it('refuses what is not a colour and keeps the old value', () => {
    const { onChange } = renderPicker();
    expand();
    const field = screen.getByLabelText('Paint hex value');
    fireEvent.change(field, { target: { value: 'nope' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(field);
    expect(screen.getByLabelText('Paint hex value')).toHaveValue('#3f6ce0');
  });

  it('hides alpha when the document has no channel for it', () => {
    renderPicker({ color: '#3f6ce0', alpha: 1 }, { showAlpha: false });
    expect(screen.queryByLabelText('Paint alpha percent')).not.toBeInTheDocument();
    expand();
    expect(screen.queryByLabelText('Paint alpha')).not.toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Paint hue' })).toBeInTheDocument();
  });

  it('opens the same picker as a floating dialog from the swatch', () => {
    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Choose Paint color' }));
    const dialog = screen.getByRole('dialog', { name: 'Paint picker' });
    expect(dialog).toBeInTheDocument();
    // The body floats inside the dialog, not embedded in the sidebar.
    expect(
      dialog.contains(screen.getByLabelText('Paint saturation and brightness. Arrow keys adjust.'))
    ).toBe(true);
    expect(screen.getByRole('slider', { name: 'Paint hue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose Paint color' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('toggles the floating picker off from the swatch', () => {
    renderPicker();
    const swatch = screen.getByRole('button', { name: 'Choose Paint color' });
    fireEvent.click(swatch);
    expect(screen.getByRole('dialog', { name: 'Paint picker' })).toBeInTheDocument();
    fireEvent.click(swatch);
    expect(screen.queryByRole('dialog', { name: 'Paint picker' })).not.toBeInTheDocument();
  });

  it('dismisses the floating picker on Escape', () => {
    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Choose Paint color' }));
    expect(screen.getByRole('dialog', { name: 'Paint picker' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Paint picker' })).not.toBeInTheDocument();
  });

  it('dismisses the floating picker on outside click', () => {
    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Choose Paint color' }));
    expect(screen.getByRole('dialog', { name: 'Paint picker' })).toBeInTheDocument();
    fireEvent.mouseDown(document.body, { button: 0 });
    expect(screen.queryByRole('dialog', { name: 'Paint picker' })).not.toBeInTheDocument();
  });

  it('keeps the arrow trigger inline and exclusive with the swatch', () => {
    renderPicker();
    expand();
    // Chevron still embeds in place: no dialog, body outside one.
    expect(screen.queryByRole('dialog', { name: 'Paint picker' })).not.toBeInTheDocument();
    expect(
      screen.getByLabelText('Paint saturation and brightness. Arrow keys adjust.')
    ).toBeInTheDocument();
    // Opening the swatch moves the same body into the dialog.
    fireEvent.click(screen.getByRole('button', { name: 'Choose Paint color' }));
    const dialog = screen.getByRole('dialog', { name: 'Paint picker' });
    expect(
      dialog.contains(screen.getByLabelText('Paint saturation and brightness. Arrow keys adjust.'))
    ).toBe(true);
    expect(screen.getByRole('button', { name: 'Expand Paint picker' })).toBeInTheDocument();
  });

  it('confirms an explicit value edit in the floating picker and returns focus', () => {
    const { onCommit } = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Choose Paint color' }));
    const field = screen.getByLabelText('Paint hex value');
    fireEvent.change(field, { target: { value: '#00ff00' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Paint picker' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose Paint color' })).toHaveFocus();
  });

  /**
   * What jsdom can and cannot prove about the floating picker.
   *
   * jsdom has no layout, no compositor and no scrolling viewport: every
   * scroll offset reads back unchanged and every scroll event is delivered
   * synchronously. The real-browser self-dismiss race — the opening
   * interaction's own scroll arriving a frame or two LATE, after the
   * popover's scroll listener attaches — cannot happen here, which is why
   * the suite stayed green while the defect existed. The tests below lock
   * everything lockable at this level: the entry focus must not ask for
   * scrolling, a scroll reporting unchanged offsets must be ignored, a
   * scroll reporting changed offsets must still dismiss, and a scroll in a
   * container that does not hold the swatch must never dismiss.
   *
   * Browser-only proof, re-run on every change to this behaviour: serve the
   * built app, real-click the swatch, wait two seconds, assert the picker
   * dialog is still visible, and capture a screenshot of the open panel.
   */
  it('moves the opening focus without asking for any scroll', async () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    try {
      renderPicker();
      fireEvent.click(screen.getByRole('button', { name: 'Choose Paint color' }));
      await screen.findByRole('dialog', { name: 'Paint picker' });
      await vi.waitFor(() => {
        expect(
          focusSpy.mock.calls.some(
            (args) =>
              typeof args[0] === 'object' &&
              args[0] !== null &&
              (args[0] as FocusOptions).preventScroll === true
          )
        ).toBe(true);
      });
    } finally {
      focusSpy.mockRestore();
    }
    expect(screen.getByRole('dialog', { name: 'Paint picker' })).toBeInTheDocument();
  });

  it('ignores the opening scroll but still closes on a real scroll of its own sidebar', () => {
    const scroller = document.createElement('div');
    document.body.appendChild(scroller);
    try {
      // jsdom reports no layout: declare the wrapper scrollable by hand.
      Object.defineProperties(scroller, {
        scrollHeight: { value: 2000, configurable: true },
        clientHeight: { value: 500, configurable: true },
        scrollWidth: { value: 800, configurable: true },
        clientWidth: { value: 800, configurable: true }
      });
      scroller.scrollTop = 120;
      const onChange = vi.fn();
      render(
        <StudioColorPicker label="Paint" value={{ color: '#3f6ce0', alpha: 1 }} onChange={onChange} />,
        { container: scroller }
      );
      fireEvent.click(screen.getByRole('button', { name: 'Choose Paint color' }));
      expect(screen.getByRole('dialog', { name: 'Paint picker' })).toBeInTheDocument();
      // The opening interaction's own scroll, delivered late with unchanged
      // offsets: must not dismiss what just opened.
      fireEvent.scroll(scroller);
      expect(screen.getByRole('dialog', { name: 'Paint picker' })).toBeInTheDocument();
      // A genuine later scroll moves the anchor under the fixed panel.
      scroller.scrollTop = 200;
      fireEvent.scroll(scroller);
      expect(screen.queryByRole('dialog', { name: 'Paint picker' })).not.toBeInTheDocument();
    } finally {
      scroller.remove();
    }
  });

  it('stays open when a container that does not hold the swatch scrolls', () => {
    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Choose Paint color' }));
    expect(screen.getByRole('dialog', { name: 'Paint picker' })).toBeInTheDocument();
    const outsider = document.createElement('div');
    document.body.appendChild(outsider);
    try {
      fireEvent.scroll(outsider);
      expect(screen.getByRole('dialog', { name: 'Paint picker' })).toBeInTheDocument();
    } finally {
      outsider.remove();
    }
  });

  it('keeps the fill-type header out of the inline body', () => {
    render(
      <StudioColorPicker
        label="Paint"
        value={{ color: '#3f6ce0', alpha: 1 }}
        onChange={() => {}}
        fillKind="solid"
        onFillKindChange={() => {}}
      />
    );
    // Inline already has the kind selector above it: no second switcher.
    expect(screen.queryByRole('group', { name: 'Paint fill type' })).not.toBeInTheDocument();
    expand();
    expect(screen.queryByRole('group', { name: 'Paint fill type' })).not.toBeInTheDocument();
  });

  it('switches the fill kind by header icon in the floating picker', () => {
    const onFillKindChange = vi.fn();
    render(
      <StudioColorPicker
        label="Paint"
        value={{ color: '#3f6ce0', alpha: 1 }}
        onChange={() => {}}
        fillKind="solid"
        onFillKindChange={onFillKindChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Choose Paint color' }));

    const group = screen.getByRole('group', { name: 'Paint fill type' });
    const solid = screen.getByRole('button', { name: 'Paint fill type: Solid color' });
    const gradient = screen.getByRole('button', { name: 'Paint fill type: Linear gradient' });
    expect(group.contains(solid)).toBe(true);
    expect(group.contains(gradient)).toBe(true);
    expect(solid).toHaveAttribute('aria-pressed', 'true');
    expect(gradient).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(gradient);
    expect(onFillKindChange).toHaveBeenCalledWith('linear-gradient');
    // The pressed tab never refires: like the reference, a no-op, not an event.
    fireEvent.click(solid);
    expect(onFillKindChange).not.toHaveBeenCalledWith('solid');
  });

  it('reads any gradient kind as gradient and offers nothing the engine cannot paint', () => {
    const onFillKindChange = vi.fn();
    render(
      <StudioColorPicker
        label="Paint"
        value={{ color: '#3f6ce0', alpha: 1 }}
        onChange={() => {}}
        fillKind="radial-gradient"
        onFillKindChange={onFillKindChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Choose Paint color' }));

    expect(screen.getByRole('button', { name: 'Paint fill type: Linear gradient' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(
      screen.getByRole('group', { name: 'Paint fill type' }).querySelectorAll('button')
    ).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /image|shader|pattern|video/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Paint fill type: Solid color' }));
    expect(onFillKindChange).toHaveBeenCalledWith('solid');
  });

  describe('floating gradient body', () => {
    const gradientFill: GradientFill = {
      kind: 'linear-gradient',
      angle: 90,
      stops: [
        { offset: 0, color: '#ff0000', alpha: 1 },
        { offset: 1, color: '#0000ff', alpha: 1 }
      ]
    };

    const renderGradient = (fill: GradientFill = gradientFill, extra = {}) => {
      const onGradientChange = vi.fn();
      const onGradientCommit = vi.fn();
      const utils = render(
        <StudioColorPicker
          label="Paint"
          value={{ color: '#ff0000', alpha: 1 }}
          onChange={() => {}}
          fillKind={fill.kind}
          onFillKindChange={() => {}}
          gradientFill={fill}
          onGradientChange={onGradientChange}
          onGradientCommit={onGradientCommit}
          {...extra}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Choose Paint color' }));
      const dialog = screen.getByRole('dialog', { name: 'Paint picker' });
      return { ...utils, dialog, onGradientChange, onGradientCommit };
    };

    it('keeps the panel open across the kind switch and swaps the body to the gradient editor', () => {
      const onFillKindChange = vi.fn();
      const { rerender } = render(
        <StudioColorPicker
          label="Paint"
          value={{ color: '#ff0000', alpha: 1 }}
          onChange={() => {}}
          fillKind="solid"
          onFillKindChange={onFillKindChange}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Choose Paint color' }));
      expect(screen.getByRole('dialog', { name: 'Paint picker' })).toBeInTheDocument();
      // Solid body first.
      expect(screen.getByLabelText('Paint saturation and brightness. Arrow keys adjust.')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Paint fill type: Linear gradient' }));
      expect(onFillKindChange).toHaveBeenCalledWith('linear-gradient');

      // The parent converts and re-renders with the gradient: the same panel
      // stays open, now with the gradient body instead of the solid one.
      rerender(
        <StudioColorPicker
          label="Paint"
          value={{ color: '#ff0000', alpha: 1 }}
          onChange={() => {}}
          fillKind="linear-gradient"
          onFillKindChange={onFillKindChange}
          gradientFill={gradientFill}
          onGradientChange={() => {}}
          onGradientCommit={() => {}}
        />
      );
      const dialog = screen.getByRole('dialog', { name: 'Paint picker' });
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Paint gradient type')).toBeInTheDocument();
      expect(within(dialog).getByRole('slider', { name: 'Stop 1' })).toBeInTheDocument();
      expect(within(dialog).getByRole('spinbutton', { name: 'Stop 1 position' })).toBeInTheDocument();
      expect(screen.queryByLabelText('Paint saturation and brightness. Arrow keys adjust.')).not.toBeInTheDocument();
    });

    it('offers the four gradient subtypes in the floating select', () => {
      const { dialog, onGradientChange } = renderGradient();
      const select = within(dialog).getByLabelText('Paint gradient type') as HTMLSelectElement;
      const values = Array.from(select.querySelectorAll('option')).map((option) => option.value);
      expect(values).toEqual(['linear-gradient', 'radial-gradient', 'angular-gradient', 'diamond-gradient']);

      fireEvent.change(select, { target: { value: 'radial-gradient' } });
      expect(onGradientChange).toHaveBeenCalledTimes(1);
      const next = onGradientChange.mock.calls[0][0] as GradientFill;
      expect(next.kind).toBe('radial-gradient');
      // Stops survive the subtype switch.
      expect(next.stops?.map((stop) => stop.color)).toEqual(['#ff0000', '#0000ff']);
    });

    it('adds, moves and removes stops without leaving the panel', () => {
      const { dialog, onGradientChange } = renderGradient();
      const scoped = within(dialog);

      // Two stops to start.
      expect(scoped.getByRole('spinbutton', { name: 'Stop 1 position' })).toHaveValue(0);
      expect(scoped.getByRole('spinbutton', { name: 'Stop 2 position' })).toHaveValue(100);

      fireEvent.click(scoped.getByRole('button', { name: 'Add gradient stop' }));
      expect(onGradientChange).toHaveBeenCalledTimes(1);
      const added = onGradientChange.mock.calls[0][0] as GradientFill;
      expect(added.stops).toHaveLength(3);
      expect(screen.getByRole('dialog', { name: 'Paint picker' })).toBeInTheDocument();

      // Move the first stop: position field drives the model transiently.
      fireEvent.change(scoped.getByRole('spinbutton', { name: 'Stop 1 position' }), { target: { value: '25' } });
      const moved = onGradientChange.mock.calls.at(-1)?.[0] as GradientFill;
      expect(moved.stops?.[0].offset).toBeCloseTo(0.25);

      // Alpha field drives the same stop.
      fireEvent.change(scoped.getByRole('spinbutton', { name: 'Stop 1 alpha' }), { target: { value: '50' } });
      const faded = onGradientChange.mock.calls.at(-1)?.[0] as GradientFill;
      expect(faded.stops?.[0].alpha).toBeCloseTo(0.5);
    });

    it('removes a stop only when more than two remain', () => {
      const three: GradientFill = {
        kind: 'linear-gradient',
        angle: 90,
        stops: [
          { offset: 0, color: '#ff0000' },
          { offset: 0.5, color: '#00ff00' },
          { offset: 1, color: '#0000ff' }
        ]
      };
      const { dialog, onGradientChange } = renderGradient(three);
      const scoped = within(dialog);

      fireEvent.click(scoped.getByRole('button', { name: 'Remove stop 2' }));
      expect(onGradientChange).toHaveBeenCalledTimes(1);
      expect((onGradientChange.mock.calls[0][0] as GradientFill).stops).toHaveLength(2);

      // With two stops the remove buttons disable: nothing left to remove.
      cleanup();
      const { dialog: dialog2 } = renderGradient();
      expect(within(dialog2).getByRole('button', { name: 'Remove stop 1' })).toBeDisabled();
    });

    it('edits the active stop through the shared colour surface', () => {
      const { dialog, onGradientChange } = renderGradient();
      const scoped = within(dialog);

      // The first stop is active by default: its colour surface is shown.
      expect(scoped.getByLabelText('Stop 1 color hex value')).toHaveValue('#ff0000');

      fireEvent.change(scoped.getByLabelText('Stop 1 color hex value'), { target: { value: '#00ff00' } });
      const first = onGradientChange.mock.calls.at(-1)?.[0] as GradientFill;
      expect(first.stops?.[0].color).toBe('#00ff00');
      expect(first.stops?.[1].color).toBe('#0000ff');

      // Selecting the second stop swaps the surface to it.
      fireEvent.click(scoped.getByRole('button', { name: 'Select stop 2' }));
      expect(scoped.getByLabelText('Stop 2 color hex value')).toHaveValue('#0000ff');

      fireEvent.change(scoped.getByLabelText('Stop 2 color hex value'), { target: { value: '#ffff00' } });
      const second = onGradientChange.mock.calls.at(-1)?.[0] as GradientFill;
      expect(second.stops?.[1].color).toBe('#ffff00');
    });

    it('round-trips the first stop colour back to solid', () => {
      const onFillKindChange = vi.fn();
      renderGradient(gradientFill, { onFillKindChange });
      fireEvent.click(screen.getByRole('button', { name: 'Paint fill type: Solid color' }));
      expect(onFillKindChange).toHaveBeenCalledWith('solid');
      // The panel is still open after asking to go back to solid.
      expect(screen.getByRole('dialog', { name: 'Paint picker' })).toBeInTheDocument();
    });

    it('shows geometry only for the kinds that use it', () => {
      const { dialog } = renderGradient();
      expect(within(dialog).getByRole('slider', { name: 'Angle' })).toBeInTheDocument();
      expect(within(dialog).queryByRole('slider', { name: 'Center X' })).not.toBeInTheDocument();

      cleanup();
      const radial: GradientFill = {
        kind: 'radial-gradient',
        centerX: 0.5,
        centerY: 0.5,
        radius: 0.5,
        stops: [
          { offset: 0, color: '#ff0000' },
          { offset: 1, color: '#0000ff' }
        ]
      };
      const { dialog: radialDialog } = renderGradient(radial);
      expect(within(radialDialog).getByRole('slider', { name: 'Center X' })).toBeInTheDocument();
      expect(within(radialDialog).getByRole('slider', { name: 'Radius' })).toBeInTheDocument();
      expect(within(radialDialog).queryByRole('slider', { name: 'Angle' })).not.toBeInTheDocument();
    });
  });
});
