import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarSeparator,
  MenubarRadioGroup,
  MenubarRadioItem
} from '../src/index';

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

const renderFileMenu = (content: ReactNode) =>
  render(
    <Menubar aria-label="Main menu">
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>{content}</MenubarContent>
      </MenubarMenu>
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

  it('selects an item and closes the menu', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderFileMenu(<MenubarItem label="Save" onSelect={onSelect} />);

    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    expect(await screen.findByRole('menu')).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Save' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  }, 10_000);

  it('treats a label as a heading, never as an item', async () => {
    const user = userEvent.setup();
    renderFileMenu(
      <>
        <MenubarLabel>Sessions</MenubarLabel>
        <MenubarItem label="Save" onSelect={() => {}} />
      </>
    );

    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    expect(await screen.findByText('Sessions')).toBeInTheDocument();

    // A heading arrows can land on is a trap: it is not part of the item set,
    // so the first arrow-down stop is the first selectable item.
    expect(screen.queryByRole('menuitem', { name: 'Sessions' })).not.toBeInTheDocument();
    expect(screen.getByText('Sessions')).not.toHaveAttribute('tabindex');

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Save' })).toHaveFocus();
  }, 10_000);

  it('separates groups with a divider that is not an item', async () => {
    const user = userEvent.setup();
    renderFileMenu(
      <>
        <MenubarItem label="Save" onSelect={() => {}} />
        <MenubarSeparator />
        <MenubarItem label="Export" onSelect={() => {}} />
      </>
    );

    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    expect(await screen.findByRole('separator')).toBeInTheDocument();

    // A separator is a boundary, not a row: the collection is the trigger plus
    // the two items, and the divider never joins it.
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
  }, 10_000);

  it('marks the checked option of a radio group and reports a change', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderFileMenu(
      <MenubarRadioGroup value="system" onValueChange={onValueChange}>
        <MenubarRadioItem value="light" label="Light" />
        <MenubarRadioItem value="dark" label="Dark" />
        <MenubarRadioItem value="system" label="System" />
      </MenubarRadioGroup>
    );

    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    expect(await screen.findByRole('menuitemradio', { name: 'System' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'Light' })).toHaveAttribute('aria-checked', 'false');

    await user.click(screen.getByRole('menuitemradio', { name: 'Light' }));
    expect(onValueChange).toHaveBeenCalledWith('light');
  }, 10_000);

  it('shows a shortcut as display-only text and never binds it', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderFileMenu(<MenubarItem label="Save" shortcut="Ctrl+S" onSelect={onSelect} />);

    // Closed menu: the kit installs no global listener, so the combination
    // does nothing — only the app that shows the label owns the binding.
    await user.keyboard('{Control>}s{/Control}');
    expect(onSelect).not.toHaveBeenCalled();

    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    const item = await screen.findByRole('menuitem', { name: /Save/ });

    // The shortcut is display: visible text in the row.
    expect(item).toHaveTextContent('Ctrl+S');

    // …and still not a binding: pressing it selects nothing.
    await user.keyboard('{Control>}s{/Control}');
    expect(onSelect).not.toHaveBeenCalled();

    // The row itself is what selects.
    await user.click(item);
    expect(onSelect).toHaveBeenCalledTimes(1);
  }, 10_000);
});
