import { cleanup, render, screen } from '@testing-library/react';
import { TooltipProvider } from '@iconcore/ui';
import { afterEach, describe, expect, it } from 'vitest';
import { UiGallery } from './UiGallery';

/** The suite has no global testing-library auto-cleanup, so unmount explicitly. */
afterEach(cleanup);

/** The app root provides the tooltip context; the Lab relies on it (as in `App.tsx`). */
const renderLab = () => render(<TooltipProvider><UiGallery /></TooltipProvider>);

/**
 * The Lab is a **fixture laboratory** (ADR-012 §12): project-independent, with one
 * design question per fixture. These guards keep it from silently becoming a
 * second Composer or losing the fixture structure.
 */
describe('UiGallery (UI Lab)', () => {
  it('renders the fixture groups', () => {
    renderLab();

    expect(screen.getByText('Fixtures — interaction grammar')).toBeInTheDocument();
    expect(screen.getByText('Fixtures — States')).toBeInTheDocument();
    expect(screen.getByText('Fixtures — Fill')).toBeInTheDocument();
    expect(screen.getByText('Fixtures — Gradient density')).toBeInTheDocument();
    expect(screen.getByText('Fixtures — pendentes do spec')).toBeInTheDocument();
  });

  it('states the question each fixture must answer', () => {
    renderLab();

    expect(screen.getAllByText(/alta densidade/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/O foco é perceptível/i)).toBeInTheDocument();
    expect(screen.getByText(/muda de estratégia/i)).toBeInTheDocument();
  });

  it('marks what still waits for the interaction spec', () => {
    renderLab();

    // Pending fixtures are registered (with their question) but carry no
    // speculative markup, so the status badge must be visible.
    expect(screen.getAllByText('aguarda spec').length).toBeGreaterThanOrEqual(10);
  });

  it('renders without a Composer project', () => {
    expect(() => renderLab()).not.toThrow();
  });
});
