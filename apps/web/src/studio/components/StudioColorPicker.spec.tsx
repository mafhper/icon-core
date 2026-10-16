import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
});
