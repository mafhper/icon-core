import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IconCoreProject } from '@iconcore/shared';
import { ComposerProvider, useComposer } from '../ComposerContext';
import { ToastProvider, useToast } from '../toast/ToastContext';
import { ToastViewport } from '../toast/ToastViewport';
import type { FileHandleLike } from '../utils/fileSave';
import { createBlankProject } from '../utils/projectFactory';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

/**
 * P3 — the Composer hook is the single owner of the titlebar bindings.
 *
 * The menus only *display* shortcuts, so the binding contract is proven here,
 * at the hook's seam: mount the hook under the real provider, press the
 * combination, and read what the context did. `fireEvent.keyDown` returns
 * `false` when the handler called `preventDefault` — which is half of what
 * "the binding exists" means for `Ctrl+O` and `Ctrl+Shift+S` (the browser's
 * own pickers must not race ours).
 *
 * `Ctrl+N` is pinned as *unbound*: nothing is dispatched and the event keeps
 * its browser meaning. `?` is not this hook's — the studio shell owns it, and
 * its spec lives beside the shell.
 */

const Probe = ({
  project,
  handle
}: {
  project?: IconCoreProject;
  handle?: FileHandleLike;
}) => {
  const { state, dispatch, attachFileHandle } = useComposer();
  useKeyboardShortcuts();

  useEffect(() => {
    if (!project) return;
    dispatch({ type: 'LOAD_PROJECT', payload: { project, projectId: 'p-1', view: 'edit-space' } });
    dispatch({ type: 'SET_DIRTY', payload: true });
  }, [dispatch, project]);

  useEffect(() => {
    if (state.projectId) void attachFileHandle(state.projectId, (handle ?? null) as FileSystemFileHandle | null);
  }, [state.projectId, handle, attachFileHandle]);

  return (
    <>
      <span data-testid="project">{state.project?.metadata.name ?? 'none'}</span>
      <span data-testid="dirty">{state.isDirty ? 'dirty' : 'clean'}</span>
      <span data-testid="history">{`${state.historyIndex}/${state.history.length}`}</span>
    </>
  );
};

const Toasts = () => {
  const { toasts } = useToast();
  return <span data-testid="toasts">{toasts.map((toast) => toast.message).join('|')}</span>;
};

const renderProbe = (props: { project?: IconCoreProject; handle?: FileHandleLike } = {}) =>
  render(
    <ToastProvider>
      <ComposerProvider>
        <Probe {...props} />
      </ComposerProvider>
      <ToastViewport />
      <Toasts />
    </ToastProvider>
  );

/** A writable fake handle: `planSave` writes straight through (no permission prompt). */
const writeHandle = (name: string) => {
  const written: string[] = [];
  const handle: FileHandleLike = {
    name,
    createWritable: async () => ({
      write: async (data: string) => {
        written.push(data);
      },
      close: async () => undefined
    })
  };
  return { handle, written };
};

/** Both pickers must exist for `supportsFileSystemAccess` to take the FSA path. */
const stubPickers = (options: { openText?: string; saveName?: string } = {}) => {
  const open = vi.fn(async () =>
    options.openText == null
      ? []
      : [
          {
            name: 'disco.iconcore.json',
            getFile: async () => ({ text: async () => options.openText! })
          }
        ]
  );
  const save = vi.fn(async () => writeHandle(options.saveName ?? 'novo.iconcore.json').handle);
  (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker = open;
  (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker = save;
  return { open, save };
};

beforeEach(() => {
  window.localStorage.clear();
  document.body.innerHTML = '';
});

afterEach(() => {
  cleanup();
  delete (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;
  delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
});

describe('useKeyboardShortcuts — Ctrl+O (Abrir)', () => {
  it('opens the picker, prevents the browser default and loads the project', async () => {
    const fromDisk = createBlankProject('Do disco', 512);
    stubPickers({ openText: JSON.stringify(fromDisk) });
    renderProbe();

    // A plain Ctrl+O is the binding: the handler takes the event from the
    // browser (`false`) and drives the open flow itself.
    const handled = fireEvent.keyDown(window, { key: 'o', ctrlKey: true });
    expect(handled).toBe(false);

    await waitFor(() => expect(screen.getByTestId('project')).toHaveTextContent('Do disco'));
    expect(screen.getByTestId('toasts')).toHaveTextContent('Opened Do disco');
  });

  it('works with the macOS modifier too, and ignores Ctrl+Shift+O', async () => {
    stubPickers({ openText: JSON.stringify(createBlankProject('Meta', 512)) });
    renderProbe();

    // Shift+O was never promised by any label; it must not borrow the binding.
    expect(fireEvent.keyDown(window, { key: 'O', ctrlKey: true, shiftKey: true })).toBe(true);

    expect(fireEvent.keyDown(window, { key: 'o', metaKey: true })).toBe(false);
    await waitFor(() => expect(screen.getByTestId('project')).toHaveTextContent('Meta'));
  });
});

describe('useKeyboardShortcuts — Ctrl+Shift+S (Salvar como)', () => {
  it('runs Save as, while plain Ctrl+S keeps saving into the open file', async () => {
    const inPlace = writeHandle('atual.iconcore.json');
    const { save } = stubPickers();
    renderProbe({ project: createBlankProject('Salvar', 512), handle: inPlace.handle });
    await waitFor(() => expect(screen.getByTestId('project')).toHaveTextContent('Salvar'));

    // Ctrl+S — the open file, no picker.
    expect(fireEvent.keyDown(window, { key: 's', ctrlKey: true })).toBe(false);
    await waitFor(() => expect(screen.getByTestId('dirty')).toHaveTextContent('clean'));
    expect(inPlace.written).toHaveLength(1);
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByTestId('toasts')).toHaveTextContent('Saved to atual.iconcore.json');

    // Ctrl+Shift+S — the picker, even with a handle already attached. The
    // browser reports the letter SHIFT-transformed here, so the binding has
    // to normalize case to be reachable at all.
    expect(fireEvent.keyDown(window, { key: 'S', ctrlKey: true, shiftKey: true })).toBe(false);
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('toasts')).toHaveTextContent('Saved to novo.iconcore.json'));
  });
});

describe('useKeyboardShortcuts — not bound and guarded', () => {
  it('leaves Ctrl+N unbound: no picker, no dispatch, the event keeps its meaning', () => {
    const { open, save } = stubPickers();
    renderProbe();

    expect(fireEvent.keyDown(window, { key: 'n', ctrlKey: true })).toBe(true);
    expect(open).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByTestId('project')).toHaveTextContent('none');
  });

  it('does not fire under a modal, a menu or a text input — and recovers after', () => {
    const { open } = stubPickers({ openText: JSON.stringify(createBlankProject('Guardado', 512)) });
    renderProbe();

    const modal = document.createElement('div');
    modal.setAttribute('aria-modal', 'true');
    document.body.append(modal);
    expect(fireEvent.keyDown(window, { key: 'o', ctrlKey: true })).toBe(true);
    modal.remove();

    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    document.body.append(menu);
    expect(fireEvent.keyDown(window, { key: 'o', ctrlKey: true })).toBe(true);
    menu.remove();

    const input = document.createElement('input');
    document.body.append(input);
    expect(fireEvent.keyDown(input, { key: 'o', ctrlKey: true })).toBe(true);
    input.remove();

    expect(open).not.toHaveBeenCalled();

    // The guard releases with the obstruction; the binding is still there.
    expect(fireEvent.keyDown(window, { key: 'o', ctrlKey: true })).toBe(false);
  });
});

describe('useKeyboardShortcuts — history letters', () => {
  it('undoes with Ctrl+Z and redoes with the SHIFT-transformed Ctrl+Shift+Z', async () => {
    renderProbe({ project: createBlankProject('Histórico', 512) });
    await waitFor(() => expect(screen.getByTestId('project')).toHaveTextContent('Histórico'));

    // One real edit: a new history entry.
    fireEvent.keyDown(window, { key: 'l', ctrlKey: true });
    await waitFor(() => expect(screen.getByTestId('history')).toHaveTextContent('1/2'));

    expect(fireEvent.keyDown(window, { key: 'z', ctrlKey: true })).toBe(false);
    await waitFor(() => expect(screen.getByTestId('history')).toHaveTextContent('0/2'));

    // A browser reports "Z" for Shift+z — the redo branch must accept it.
    expect(fireEvent.keyDown(window, { key: 'Z', ctrlKey: true, shiftKey: true })).toBe(false);
    await waitFor(() => expect(screen.getByTestId('history')).toHaveTextContent('1/2'));
  });
});
