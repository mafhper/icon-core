import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Menubar, MenubarMenu, MenubarTrigger, MenubarContent } from '../src/index';

const renderBar = () =>
  render(
    <Menubar aria-label="Main menu">
      {['Icon', 'Edit', 'View', 'Help'].map((name) => (
        <MenubarMenu key={name}>
          <MenubarTrigger>{name}</MenubarTrigger>
          <MenubarContent />
        </MenubarMenu>
      ))}
    </Menubar>
  );

describe('Menubar', () => {
  it('renders four triggers inside a named menubar', () => {
    renderBar();
    expect(screen.getByRole('menubar', { name: 'Main menu' })).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(4);
  });

  it('moves focus across triggers with the arrow keys', async () => {
    const user = userEvent.setup();
    renderBar();

    await user.tab();
    const [first, second] = screen.getAllByRole('menuitem');
    expect(first).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(second).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(first).toHaveFocus();
  }, 10_000);

  it('opens the content from its trigger and closes on Escape', async () => {
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getAllByRole('menuitem')[0]);
    expect(await screen.findByRole('menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  }, 10_000);
});
