import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Fill } from '@iconcore/shared';
import { FillEditor } from './FillEditor';

const noop = () => {};

// The suite has no global testing-library auto-cleanup, so unmount explicitly.
afterEach(cleanup);

const renderFill = (fill: Fill) =>
  render(<FillEditor label="Fill" fill={fill} onChange={noop} onCommit={noop} />);

describe('FillEditor', () => {
  it('puts the kind selector above the matching adjustments, with panel labels', () => {
    renderFill({ kind: 'solid', color: '#F8FAFC', alpha: 1 });

    expect(screen.getByLabelText('Fill').tagName).toBe('SELECT');
    expect(screen.getByText('Color')).toBeInTheDocument();

    for (const label of [screen.getByText('Fill'), screen.getByText('Color')]) {
      expect(label.className).toContain('text-ic-text-muted');
      expect(label.className).not.toContain('uppercase');
      expect(label.className).not.toContain('tracking-');
      expect(label.className).not.toContain('font-bold');
    }
  });

  it('renders the colour as one flat paint field, not nested boxes', () => {
    renderFill({ kind: 'solid', color: '#F8FAFC', alpha: 1 });

    const hex = screen.getByLabelText('Color hex');
    const alpha = screen.getByRole('spinbutton', { name: /alpha percent/i });

    // Swatch, hex and alpha share a single surface.
    expect(alpha.parentElement).toBe(hex.parentElement);
    // Alpha is a percentage (0..100), never the raw 0..1 value.
    expect(alpha).toHaveValue(100);
  });

  it('shows the gradient adjustments under the same control', () => {
    renderFill({
      kind: 'linear-gradient',
      angle: 135,
      stops: [
        { offset: 0, color: '#000000' },
        { offset: 1, color: '#ffffff' }
      ]
    });

    expect(screen.getByText('Stops')).toBeInTheDocument();
    expect(screen.getByText('Angle')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Angle' })).toHaveValue(135);
    // Stops are editable as rows: position (%) + colour per stop.
    expect(screen.getByRole('spinbutton', { name: 'Stop 1 position' })).toHaveValue(0);
    expect(screen.getByRole('spinbutton', { name: 'Stop 2 position' })).toHaveValue(100);
  });

  it('explains the transparent fill instead of showing controls', () => {
    renderFill({ kind: 'none' });
    expect(screen.queryByLabelText('Color hex')).not.toBeInTheDocument();
    expect(screen.getByText(/shape is transparent/i)).toBeInTheDocument();
  });
});
