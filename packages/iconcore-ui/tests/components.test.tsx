import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, IconButton, ButtonGroup, ToolbarDivider, Tooltip, TooltipProvider, Kbd } from '../src/index';

describe('Button', () => {
  it('defaults type to "button" (never submits)', () => {
    render(<Button>Action</Button>);
    expect(screen.getByRole('button', { name: 'Action' })).toHaveAttribute('type', 'button');
  });

  it('spread props cannot clobber the safe type (004 §9 fix)', () => {
    // `type`/`disabled` are destructured out of props, so the spread can never
    // clobber them; an explicit `type` still wins over the "button" default.
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveAttribute('type', 'submit');
  });

  it('honors disabled', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>
    );
    const btn = screen.getByRole('button', { name: 'Disabled' });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps onClick when enabled', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Live</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Live' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders left icon and children', () => {
    render(<Button iconLeft={<span data-testid="icon" />}>Go</Button>);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
  });

  it('passes className through cn() (custom class preserved)', () => {
    render(<Button className="rounded-ic-lg">Styled</Button>);
    expect(screen.getByRole('button', { name: 'Styled' })).toHaveClass('rounded-ic-lg');
  });
});

describe('IconButton', () => {
  it('requires an aria-label (a11y)', () => {
    render(<IconButton icon={<span />} aria-label="Undo" />);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('reflects selected state as aria-pressed', () => {
    const { rerender } = render(<IconButton icon={<span />} aria-label="Grid" selected />);
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
    rerender(<IconButton icon={<span />} aria-label="Grid" />);
    expect(screen.getByRole('button', { name: 'Grid' })).not.toHaveAttribute('aria-pressed');
  });

  it('forwards disabled', () => {
    render(<IconButton icon={<span />} aria-label="Locked" disabled />);
    expect(screen.getByRole('button', { name: 'Locked' })).toBeDisabled();
  });

  it('switches variant class (rail vs default)', () => {
    render(<IconButton icon={<span />} aria-label="Rail" variant="rail" />);
    const btn = screen.getByRole('button', { name: 'Rail' });
    expect(btn.className).toContain('h-[var(--ic-control-sm)]');
  });
});

describe('ButtonGroup', () => {
  it('renders as an unlabelled group', () => {
    render(
      <ButtonGroup>
        <button>A</button>
        <button>B</button>
      </ButtonGroup>
    );
    expect(screen.getByRole('group')).toBeInTheDocument();
  });

  it('renders as a labelled toolbar when label is given', () => {
    render(
      <ButtonGroup label="Zoom">
        <button>+</button>
        <button>-</button>
      </ButtonGroup>
    );
    expect(screen.getByRole('toolbar', { name: 'Zoom' })).toBeInTheDocument();
  });
});

describe('ToolbarDivider', () => {
  it('renders as a vertical separator by default', () => {
    render(<ToolbarDivider data-testid="sep" />);
    const sep = screen.getByTestId('sep');
    expect(sep).toHaveAttribute('role', 'separator');
    expect(sep).toHaveAttribute('aria-orientation', 'vertical');
    expect(sep.className).toContain('w-px');
  });

  it('renders horizontal when requested', () => {
    render(<ToolbarDivider orientation="horizontal" data-testid="sep-h" />);
    const sep = screen.getByTestId('sep-h');
    expect(sep).toHaveAttribute('aria-orientation', 'horizontal');
    expect(sep.className).toContain('h-px');
  });
});

describe('Tooltip', () => {
  it('shows content on hover of the trigger', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <Tooltip content="Undo (Ctrl+Z)" delayDuration={0}>
          <button>undo</button>
        </Tooltip>
      </TooltipProvider>
    );
    expect(screen.queryByText('Undo (Ctrl+Z)')).not.toBeInTheDocument();

    await user.hover(screen.getByRole('button', { name: 'undo' }));
    expect(await screen.findByText('Undo (Ctrl+Z)')).toBeInTheDocument();
  }, 10_000);
});

describe('Kbd', () => {
  it('renders the key label', () => {
    render(<Kbd>Ctrl+K</Kbd>);
    expect(screen.getByText('Ctrl+K')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+K').tagName).toBe('KBD');
  });
});