import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button, IconButton, ButtonGroup, ToolbarDivider, Tooltip, TooltipProvider, Kbd, Section, Field, TextField, NumberField, Select, Switch, Slider, ColorField, ControlRow, InlineField, SegmentedControl, Menu, MenuItem, Popover } from '../src/index';

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

describe('Section', () => {
  it('renders title heading and children', () => {
    render(
      <Section title="Color">
        <span>body</span>
      </Section>
    );
    expect(screen.getByRole('heading', { name: 'Color' })).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('renders hint when given', () => {
    render(<Section title="Work area" hint="Backdrop hint" />);
    expect(screen.getByText('Backdrop hint')).toBeInTheDocument();
  });
});

describe('Field', () => {
  it('associates label with control', () => {
    render(
      <Field label="Name">
        <input data-testid="name-input" />
      </Field>
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByTestId('name-input')).toBeInTheDocument();
  });
});

describe('TextField', () => {
  it('renders labelled text input', () => {
    render(<TextField label="Name" defaultValue="icon" />);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('icon');
  });
});

describe('NumberField', () => {
  it('renders labelled number input', () => {
    render(<NumberField label="Opacity" defaultValue={80} />);
    expect(screen.getByRole('spinbutton', { name: 'Opacity' })).toHaveValue(80);
  });
});

describe('Select', () => {
  it('renders labelled select with options', () => {
    render(
      <Select label="Fill type" defaultValue="solid">
        <option value="solid">Solid color</option>
        <option value="linear-gradient">Linear gradient</option>
      </Select>
    );
    const select = screen.getByRole('combobox', { name: 'Fill type' });
    expect(select).toHaveValue('solid');
    expect(screen.getByRole('option', { name: 'Linear gradient' })).toBeInTheDocument();
  });
});

describe('Switch', () => {
  it('renders labelled checkbox row', () => {
    const onChange = vi.fn();
    render(<Switch label="Depth shadow" onChange={onChange} />);
    const box = screen.getByRole('checkbox', { name: 'Depth shadow' });
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('Slider', () => {
  it('renders labelled range input', () => {
    render(<Slider label="Scale (100%)" min={8} max={400} defaultValue={100} />);
    const slider = screen.getByRole('slider', { name: 'Scale (100%)' });
    expect(slider).toHaveValue('100');
  });
});

  describe('ColorField', () => {
    it('renders a labelled swatch + hex/alpha fields and opens the picker', async () => {
      const user = userEvent.setup();
      render(<ColorField label="Fill" value={{ color: '#ff0000', alpha: 0.5 }} onChange={() => {}} />);
      expect(screen.getByLabelText('Fill hex')).toHaveValue('FF0000');
      expect(screen.getByLabelText('Fill alpha percent')).toHaveValue(50);
      await user.click(screen.getByRole('button', { name: 'Choose Fill' }));
      expect(screen.getByRole('dialog', { name: 'Fill picker' })).toBeInTheDocument();
    });

    it('inline variant drops the stacked label and exposes a labelled group', () => {
      render(<ColorField variant="inline" label="Stop 1 colour" value={{ color: '#00ff00', alpha: 1 }} onChange={() => {}} />);
      expect(screen.getByRole('group', { name: 'Stop 1 colour' })).toBeInTheDocument();
      expect(screen.getByLabelText('Stop 1 colour hex')).toHaveValue('00FF00');
    });
  });

  describe('InlineField / ControlRow', () => {
    it('InlineField labels its control from the row', () => {
      render(
        <InlineField label="Fill">
          <input aria-label="probe" />
        </InlineField>
      );
      expect(screen.getByLabelText('Fill')).toBeInTheDocument();
    });

    it('ControlRow groups a composed control under the row label', () => {
      render(
        <ControlRow label="Color">
          <ColorField variant="inline" label="Color" value={{ color: '#ff0000', alpha: 1 }} onChange={() => {}} />
        </ControlRow>
      );
      expect(screen.getByRole('group', { name: 'Color' })).toBeInTheDocument();
    });
  });

describe('SegmentedControl', () => {
  const options = [
    { value: 'dots', label: 'Dots' },
    { value: 'grid', label: 'Grid' },
    { value: 'plain', label: 'Plain' },
  ] as const;

  it('marks the selected option pressed', () => {
    render(
      <SegmentedControl
        aria-label="Work area backdrop"
        options={options}
        value="grid"
        onChange={() => {}}
      />
    );
    expect(screen.getByRole('group', { name: 'Work area backdrop' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Dots' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the clicked value', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        aria-label="Work area backdrop"
        options={options}
        value="dots"
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Plain' }));
    expect(onChange).toHaveBeenCalledWith('plain');
  });
});

describe('Menu', () => {
  const renderMenu = (onSelect = vi.fn()) =>
    render(
      <Menu trigger={<IconButton icon={<span />} aria-label="Add shape" />} label="Add shape">
        <MenuItem icon={<span />} label="Rectangle" onSelect={onSelect} />
        <MenuItem icon={<span />} label="Circle" onSelect={onSelect} />
      </Menu>
    );

  it('opens on trigger click and selects an item', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderMenu(onSelect);
    expect(screen.queryByRole('menuitem', { name: 'Rectangle' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add shape' }));
    expect(await screen.findByRole('menuitem', { name: 'Rectangle' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Rectangle' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  }, 10_000);

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: 'Add shape' }));
    expect(await screen.findByRole('menuitem', { name: 'Circle' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menuitem', { name: 'Circle' })).not.toBeInTheDocument();
  }, 10_000);
});

describe('Kbd', () => {
  it('renders the key label', () => {
    render(<Kbd>Ctrl+K</Kbd>);
    expect(screen.getByText('Ctrl+K')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+K').tagName).toBe('KBD');
  });
});

describe('Popover', () => {
  const Harness = ({ onClose = () => {} }: { onClose?: () => void }) => {
    const [open, setOpen] = useState(false);
    const anchor = useRef<HTMLButtonElement>(null);
    return (
      <div>
        <button ref={anchor} type="button" onClick={() => setOpen((value) => !value)}>
          Open panel
        </button>
        <Popover
          open={open}
          anchorRef={anchor}
          onClose={() => {
            setOpen(false);
            onClose();
          }}
          aria-label="Colour picker"
        >
          <p>Panel content</p>
        </Popover>
      </div>
    );
  };

  it('renders nothing until it opens, then portals the panel to <body>', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open panel' }));

    const dialog = screen.getByRole('dialog', { name: 'Colour picker' });
    expect(dialog.parentElement).toBe(document.body);
    expect(screen.getByText('Panel content')).toBeInTheDocument();
    expect(dialog).toHaveStyle({ position: 'fixed' });
  });

  it('closes on Escape and reports it once', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open panel' }));

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on an outside press but not on a press inside the panel', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open panel' }));

    fireEvent.mouseDown(screen.getByText('Panel content'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ColorField picker', () => {
  it('opens in a portaled dialog and closes with Escape', async () => {
    const user = userEvent.setup();
    render(<ColorField label="Fill colour" value={{ color: '#f8fafc', alpha: 1 }} onChange={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Choose Fill colour' }));

    const dialog = await screen.findByRole('dialog', { name: 'Fill colour picker' });
    expect(dialog.parentElement).toBe(document.body);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Fill colour picker' })).not.toBeInTheDocument();
  }, 10_000);
});
