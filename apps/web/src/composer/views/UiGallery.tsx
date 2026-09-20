import { useState } from 'react';
import {
  Grid3x3,
  Magnet,
  Moon,
  Redo2,
  RotateCcw,
  Sun,
  Undo2,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import {
  Button,
  ButtonGroup,
  ColorField,
  Field,
  IconButton,
  Kbd,
  NumberField,
  Section,
  SegmentedControl,
  Select,
  Slider,
  Switch,
  TextField,
  ToolbarDivider,
  Tooltip
} from '@iconcore/ui';

type GalleryTheme = 'dark' | 'light';

const BACKDROP_OPTIONS = [
  { value: 'dots', label: 'Dots' },
  { value: 'grid', label: 'Grid' },
  { value: 'plain', label: 'Plain' }
] as const;

const readTheme = (): GalleryTheme =>
  document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

/**
 * Permanent component gallery at `#/ui` (R7).
 *
 * Project-independent: renders without a project and never under the welcome
 * modal. Every `@iconcore/ui` primitive appears here in all its meaningful
 * states so visual regressions are inspectable in one place — by a human
 * (`bun run dev:web` → `#/ui`) or by the `ui:shots` Playwright script.
 */
export const UiGallery = () => {
  const [theme, setTheme] = useState<GalleryTheme>(readTheme);
  const [backdrop, setBackdrop] = useState<'dots' | 'grid' | 'plain'>('dots');
  const [switchOn, setSwitchOn] = useState(true);

  const applyTheme = (next: GalleryTheme) => {
    setTheme(next);
    document.documentElement.dataset.theme = next;
  };

  return (
    <div className="min-h-screen bg-ic-bg text-ic-text">
      <header className="sticky top-0 z-10 border-b border-ic-border bg-ic-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-6 py-4">
          <div className="mr-auto">
            <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.14em] text-ic-accent">
              Icon Core · UI Kit
            </p>
            <h1 className="m-0 text-lg font-bold">Component gallery</h1>
          </div>
          <SegmentedControl
            aria-label="Gallery theme"
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' }
            ]}
            value={theme}
            onChange={applyTheme}
          />
          <a
            href="#/workspaces"
            className="rounded-ic-md border border-ic-border bg-ic-elevated px-3 py-2 text-[13px] text-ic-text no-underline hover:bg-ic-surface"
          >
            ← Workspaces
          </a>
        </div>
      </header>

      <main className="mx-auto grid max-w-4xl gap-8 px-6 py-8">
        <Section title="Button" hint="Actions with text labels. Primary / secondary / ghost, with icons, disabled.">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary">Export</Button>
            <Button variant="secondary">Cancel</Button>
            <Button variant="ghost">Dismiss</Button>
            <Button variant="primary" iconLeft={<Undo2 size={15} />}>
              Undo
            </Button>
            <Button variant="primary" disabled>
              Export
            </Button>
            <Button variant="secondary" disabled>
              Cancel
            </Button>
          </div>
        </Section>

        <Section
          title="IconButton"
          hint="Square icon-only actions. Default (bar) and rail variants; selected suppresses hover so the tint reads."
        >
          <Field label="Default variant">
            <div className="flex items-center gap-1">
              <Tooltip content="Undo (Ctrl+Z)">
                <IconButton icon={<Undo2 size={15} />} aria-label="Undo" />
              </Tooltip>
              <Tooltip content="Redo (Ctrl+Shift+Z)">
                <IconButton icon={<Redo2 size={15} />} aria-label="Redo" disabled title="Redo (Ctrl+Shift+Z)" />
              </Tooltip>
              <Tooltip content="Toggle grid">
                <IconButton icon={<Grid3x3 size={15} />} aria-label="Toggle grid" selected />
              </Tooltip>
              <Tooltip content="Toggle snapping">
                <IconButton icon={<Magnet size={15} />} aria-label="Toggle snapping" selected={false} />
              </Tooltip>
            </div>
          </Field>
          <Field label="Rail variant">
            <div className="flex items-center gap-1">
              <IconButton variant="rail" icon={<ZoomIn size={15} />} aria-label="Zoom in" />
              <IconButton variant="rail" icon={<ZoomOut size={15} />} aria-label="Zoom out" selected />
              <IconButton variant="rail" icon={<RotateCcw size={15} />} aria-label="Reset zoom" disabled title="Reset zoom" />
            </div>
          </Field>
        </Section>

        <Section
          title="ButtonGroup + ToolbarDivider"
          hint="Related actions share a group; groups are separated by a discrete divider, never by another control."
        >
          <div className="flex items-center gap-2">
            <ButtonGroup label="History">
              <IconButton icon={<Undo2 size={15} />} aria-label="Undo" />
              <IconButton icon={<Redo2 size={15} />} aria-label="Redo" />
            </ButtonGroup>
            <ToolbarDivider />
            <ButtonGroup label="View">
              <IconButton icon={<ZoomIn size={15} />} aria-label="Zoom in" />
              <IconButton icon={<ZoomOut size={15} />} aria-label="Zoom out" />
            </ButtonGroup>
            <ToolbarDivider />
            <ButtonGroup label="Theme">
              <IconButton icon={<Sun size={15} />} aria-label="Light theme" />
              <IconButton icon={<Moon size={15} />} aria-label="Dark theme" selected />
            </ButtonGroup>
          </div>
        </Section>

        <Section title="Tooltip + Kbd" hint="Tooltips label icon-only actions on hover/focus. Kbd is presentational only.">
          <div className="flex flex-wrap items-center gap-4">
            <Tooltip content="Toggle grid">
              <IconButton icon={<Grid3x3 size={15} />} aria-label="Toggle grid" />
            </Tooltip>
            <span className="flex items-center gap-1 text-[0.78rem] text-ic-text-muted">
              <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd> undo
            </span>
            <span className="flex items-center gap-1 text-[0.78rem] text-ic-text-muted">
              <Kbd>⇧</Kbd>+<Kbd>Z</Kbd> redo
            </span>
          </div>
        </Section>

        <Section title="TextField + NumberField" hint="Labelled text and numeric inputs. Numeric uses tabular figures.">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Name" defaultValue="App icon" />
            <TextField label="Disabled" defaultValue="Locked" disabled />
            <NumberField label="Opacity" min={0} max={100} defaultValue={80} />
            <NumberField label="Size" min={8} defaultValue={64} disabled />
          </div>
        </Section>

        <Section title="Select" hint="Native select: free keyboard and screen-reader behaviour, zero extra deps.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Fill type" defaultValue="solid">
              <option value="solid">Solid color</option>
              <option value="linear-gradient">Linear gradient</option>
              <option value="radial-gradient">Radial gradient</option>
            </Select>
            <Select label="Disabled" defaultValue="solid" disabled>
              <option value="solid">Solid color</option>
            </Select>
          </div>
        </Section>

        <Section title="Switch + Slider + ColorField" hint="Toggle row, range with baked-in value label, color swatch.">
          <div className="grid gap-3">
            <Switch label="Depth shadow" checked={switchOn} onChange={(event) => setSwitchOn(event.target.checked)} />
            <Switch label="Disabled off" disabled />
            <Slider label="Scale (100%)" min={8} max={400} defaultValue={100} />
            <Slider label="Rotation (0°)" min={-180} max={180} defaultValue={0} disabled />
            <div className="grid gap-3 sm:grid-cols-2">
              <ColorField label="Fill" defaultValue="#4a7cf0" />
              <ColorField label="Disabled" defaultValue="#4a7cf0" disabled />
            </div>
          </div>
        </Section>

        <Section
          title="SegmentedControl"
          hint="Single-select among ≤3 exclusive choices. Buttons carry aria-pressed; the group carries the name."
        >
          <SegmentedControl
            aria-label="Work area backdrop"
            options={BACKDROP_OPTIONS}
            value={backdrop}
            onChange={setBackdrop}
          />
          <p className="-mt-1 text-[0.78rem] text-ic-text-muted">
            Selected: <strong className="text-ic-text">{backdrop}</strong>
          </p>
        </Section>
      </main>
    </div>
  );
};
