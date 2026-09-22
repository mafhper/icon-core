import { useState, type ReactNode } from 'react';
import type { Fill } from '@iconcore/shared';
import {
  Button,
  Field,
  IconButton,
  NumberField,
  Section,
  SegmentedControl,
  Select,
  Slider,
  Switch,
  TextField
} from '@iconcore/ui';
import { brandGradientFill } from '../constants';
import { FillEditor } from '../components/FillEditor';

/**
 * UI Lab fixtures (ADR-012 §12).
 *
 * This is a **fixture laboratory**, not a second Composer: every fixture is
 * project-independent, holds its own local state, renders inside a 240px column
 * (the inspector minimum) and answers **one design question** that the spec can
 * reference as an approved primitive instead of re-describing it.
 *
 * `status` is the honest state of the fixture:
 * - `real` — uses the shipped component;
 * - `proposta` — a proposal built from shipped tokens/primitives;
 * - `aguarda spec` — listed so the question is not lost, to be filled by the
 *   interaction spec (Fases 2–6 of the ADR) instead of guessed here.
 *
 * The keys keep the vocabulary ADR-012 documents; the badge shows the English
 * label, since the shipped UI is English-only.
 */

export type FixtureStatus = 'real' | 'proposta' | 'aguarda spec';

const STATUS_LABELS: Record<FixtureStatus, string> = {
  real: 'Shipped',
  proposta: 'Proposed',
  'aguarda spec': 'Awaiting spec'
};

const statusClasses: Record<FixtureStatus, string> = {
  real: 'border-ic-accent/40 text-ic-accent-text',
  proposta: 'border-ic-border text-ic-text-muted',
  'aguarda spec': 'border-ic-warning/40 text-ic-warning'
};

export const Fixture = ({
  title,
  question,
  status = 'real',
  width = 240,
  children
}: {
  title: string;
  question: string;
  status?: FixtureStatus;
  width?: number;
  children?: ReactNode;
}) => (
  <div className="grid gap-2 rounded-[var(--ic-radius-surface)] border border-ic-border p-3">
    <div className="flex items-start justify-between gap-2">
      <span className="text-[length:var(--ic-label-size)] font-semibold text-ic-text">{title}</span>
      <span
        className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] ${statusClasses[status]}`}
      >
        {STATUS_LABELS[status]}
      </span>
    </div>
    <p className="m-0 text-[0.72rem] leading-snug text-ic-text-muted">{question}</p>
    {children != null && (
      <div className="grid gap-2.5 rounded-[var(--ic-radius-surface)] bg-ic-surface p-3" style={{ width }}>
        {children}
      </div>
    )}
  </div>
);

/* ---------------------------------------------------------------- grammar -- */

export const RowGrammarFixtures = () => (
  <>
    <Fixture title="PropertyRow / default" question="Does a row read as “property = value” without relying on an uppercase label?">
      <TextField label="Name" defaultValue="Center" />
    </Fixture>

    <Fixture title="PropertyRow / focused" question="Is focus perceivable without an arbitrary colour (uses the kit ring)?">
      <TextField label="Name" defaultValue="Center" autoFocus />
    </Fixture>

    <Fixture title="PropertyRow / disabled" question="Is the disabled state unmistakable, not merely “dimmed”?">
      <TextField label="Name" defaultValue="Locked" disabled />
    </Fixture>

    <Fixture
      title="PropertyRow / modified"
      status="proposta"
      question="Does a property that differs from the default announce itself without cluttering the row?"
    >
      <Field label="Fill">
        <span className="flex items-center justify-between gap-2 text-[0.75rem] text-ic-text">
          <span className="font-mono">#FFAA00</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-ic-accent-text">≠ Default</span>
        </span>
      </Field>
    </Fixture>

    <Fixture title="Section / expanded" question="Card-less grouper with a title that names the intent (Appearance, Composition…)">
      <Section title="Composition">
        <NumberField label="X" defaultValue={0} />
        <NumberField label="Y" defaultValue={0} />
      </Section>
    </Fixture>

    <Fixture
      title="Section / collapsed"
      status="proposta"
      question="Does the disclosure close the section without hiding that it exists? (Phase 2 — `Section` does not collapse today)"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[length:var(--ic-label-size)] font-semibold text-ic-text">Composition</span>
        <span className="text-[0.72rem] tabular-nums text-ic-text-muted">2</span>
      </div>
    </Fixture>
  </>
);

/* ----------------------------------------------------------------- states -- */

export const StateFixtures = () => (
  <>
    <Fixture title="IconButton / default · hover · active" question="Are hover and active distinguishable from default? (`active` has no visual of its own today)">
      <div className="flex items-center gap-1">
        <IconButton icon={<span aria-hidden>⊕</span>} aria-label="Default state" />
        <IconButton icon={<span aria-hidden>⊕</span>} aria-label="Hover state (hover me)" />
        <IconButton icon={<span aria-hidden>⊕</span>} aria-label="Active state" />
      </div>
    </Fixture>

    <Fixture title="IconButton / disabled · selected" question="Is persistent selection distinguishable from focus and from disabled?">
      <div className="flex items-center gap-1">
        <IconButton icon={<span aria-hidden>⊕</span>} aria-label="Disabled state" disabled />
        <IconButton icon={<span aria-hidden>⊕</span>} aria-label="Selected state" selected />
        <IconButton variant="rail" icon={<span aria-hidden>⊕</span>} aria-label="Rail selected" />
      </div>
    </Fixture>

    <Fixture title="Field / default · focus · disabled" question="Does a flat field communicate where you can type?">
      <TextField label="Default" defaultValue="Sora" />
      <TextField label="Focus" defaultValue="Sora" autoFocus />
      <TextField label="Disabled" defaultValue="Sora" disabled />
    </Fixture>

    <Fixture title="Field / invalid" status="proposta" question="Is an error signalled by border/semantics, not text alone? (does not exist today)">
      <TextField label="Invalid" defaultValue="not-a-hex" aria-invalid className="border-ic-danger" />
    </Fixture>

    <Fixture title="Button / primary · secondary · ghost" question="Do the three action hierarchies stay legible side by side?">
      <div className="flex flex-wrap gap-1.5">
        <Button variant="primary">Export</Button>
        <Button variant="secondary">Cancel</Button>
        <Button variant="ghost">Dismiss</Button>
      </div>
    </Fixture>

    <Fixture title="Slider · Switch · SegmentedControl · Select" question="Do continuous, binary and set controls share one height and one visual weight?">
      <Slider variant="inline" label="Opacity" min="0" max="100" defaultValue={100} valueLabel="100%" />
      <Switch label="Depth shadow" defaultChecked />
      <SegmentedControl
        aria-label="Backdrop"
        options={[
          { value: 'dots', label: 'Dots' },
          { value: 'grid', label: 'Grid' }
        ]}
        value="dots"
        onChange={() => {}}
      />
      <Select label="Blend mode" defaultValue="normal">
        <option value="normal">normal</option>
        <option value="multiply">multiply</option>
      </Select>
    </Fixture>
  </>
);

/* ------------------------------------------------------------------- fill -- */

const FillFixture = ({ title, question, initial }: { title: string; question: string; initial: Fill }) => {
  const [fill, setFill] = useState<Fill>(initial);
  return (
    <Fixture title={title} question={question}>
      <FillEditor label="Fill" fill={fill} onChange={setFill} onCommit={() => {}} />
    </Fixture>
  );
};

const withStops = (count: number): Fill => {
  const base = brandGradientFill();
  const stops = Array.from({ length: count }, (_, index) => ({
    offset: index / (count - 1),
    color: index === 0 ? '#ffaa00' : index === count - 1 ? '#ff3300' : '#8b5cf6'
  }));
  return { ...base, stops };
};

export const FillFixtures = () => (
  <>
    <FillFixture
      title="Fill / solid"
      question="Does the header communicate preview + kind + opacity + actions?"
      initial={{ kind: 'solid', color: '#f8fafc', alpha: 1 }}
    />
    <FillFixture
      title="Fill / linear"
      question="Is the transition between the header and the kind-specific controls clear?"
      initial={brandGradientFill()}
    />
    <FillFixture
      title="Fill / radial"
      question="Do center/radius appear only when the kind asks for them?"
      initial={{ ...brandGradientFill(), kind: 'radial-gradient', centerX: 0.5, centerY: 0.5, radius: 0.5 }}
    />
    <FillFixture
      title="Fill / angular"
      question="Are start angle and center understandable without a canvas preview?"
      initial={{ ...brandGradientFill(), kind: 'angular-gradient', angle: 0, centerX: 0.5, centerY: 0.5 }}
    />
    <FillFixture
      title="Fill / diamond"
      question="Is the kind distinguishable from radial by more than its label?"
      initial={{ ...brandGradientFill(), kind: 'diamond-gradient', centerX: 0.5, centerY: 0.5, radius: 0.5 }}
    />
    <Fixture
      title="Fill / image"
      status="aguarda spec"
      question="Texture is a third language (Mode Fill/Fit/Crop/Tile + Scale + Position + Adjustments) — the model has no image fill yet."
    />
  </>
);

export const GradientDensityFixtures = () => (
  <>
    <FillFixture
      title="Gradient / 2 stops"
      question="Does the base case keep the bar as the visual anchor?"
      initial={withStops(2)}
    />
    <FillFixture
      title="Gradient / 3 stops"
      question="Does adding an intermediate stop stay legible at 240px?"
      initial={withStops(3)}
    />
    <FillFixture
      title="Gradient / 5 stops"
      question="Does the control stay usable at high density (aligned rows, no overflow)?"
      initial={withStops(5)}
    />
  </>
);

/* --------------------------------------------------------------- pendentes -- */

const PENDING: Array<{ title: string; question: string }> = [
  { title: 'Inspector / empty', question: 'With nothing selected, does the panel explain the next step instead of sitting empty?' },
  { title: 'Inspector / shape', question: 'Is the Section → Row hierarchy understandable?' },
  { title: 'Inspector / text', question: 'Does text coexist with composition and appearance without becoming a form?' },
  { title: 'Inspector / image', question: 'Does an image accommodate Transform / Fit / Adjustments without becoming a form?' },
  { title: 'Inspector / background', question: 'Is the background handle distinguishable from the editor backdrop?' },
  { title: 'Layers / empty', question: 'Does the empty list point to the first action (import/draw)?' },
  { title: 'Layers / 10 layers', question: 'Does the hierarchy stay readable at density?' },
  { title: 'Layers / hidden', question: 'Is visibility discoverable outside the context menu?' },
  { title: 'Layers / locked', question: 'Is lock discoverable, and does it not block selection silently?' },
  { title: 'Responsive / 1440 · 1180 · 900 · 768', question: 'Does the shell actually change strategy (drawer/sheet) or just shrink?' }
];

export const PendingFixtures = () => (
  <>
    {PENDING.map((fixture) => (
      <Fixture key={fixture.title} title={fixture.title} question={fixture.question} status="aguarda spec" />
    ))}
  </>
);
