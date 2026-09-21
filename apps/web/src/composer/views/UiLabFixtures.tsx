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
 */

export type FixtureStatus = 'real' | 'proposta' | 'aguarda spec';

const statusClasses: Record<FixtureStatus, string> = {
  real: 'border-ic-accent/40 text-ic-accent',
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
  <div className="grid gap-2 rounded-ic-lg border border-ic-border p-3">
    <div className="flex items-start justify-between gap-2">
      <span className="text-[length:var(--ic-label-size)] font-semibold text-ic-text">{title}</span>
      <span
        className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] ${statusClasses[status]}`}
      >
        {status}
      </span>
    </div>
    <p className="m-0 text-[0.72rem] leading-snug text-ic-text-muted">{question}</p>
    {children != null && (
      <div className="grid gap-2.5 rounded-ic-sm bg-ic-surface p-3" style={{ width }}>
        {children}
      </div>
    )}
  </div>
);

/* ---------------------------------------------------------------- grammar -- */

export const RowGrammarFixtures = () => (
  <>
    <Fixture title="PropertyRow / default" question="Uma linha é lida como “propriedade = valor” sem depender de rótulo uppercase?">
      <TextField label="Name" defaultValue="Center" />
    </Fixture>

    <Fixture title="PropertyRow / focused" question="O foco é perceptível sem cor arbitrária (usa o ring do kit)?">
      <TextField label="Name" defaultValue="Center" autoFocus />
    </Fixture>

    <Fixture title="PropertyRow / disabled" question="O estado desabilitado é inequívoco e não parece apenas “apagado”?">
      <TextField label="Name" defaultValue="Locked" disabled />
    </Fixture>

    <Fixture
      title="PropertyRow / modified"
      status="proposta"
      question="Uma propriedade que difere do default se anuncia sem poluir a linha?"
    >
      <Field label="Fill">
        <span className="flex items-center justify-between gap-2 text-[0.75rem] text-ic-text">
          <span className="font-mono">#FFAA00</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-ic-accent">≠ Default</span>
        </span>
      </Field>
    </Fixture>

    <Fixture title="Section / expanded" question="Agrupador sem card, título que nomeia a intenção (Appearance, Composition…)">
      <Section title="Composition">
        <NumberField label="X" defaultValue={0} />
        <NumberField label="Y" defaultValue={0} />
      </Section>
    </Fixture>

    <Fixture
      title="Section / collapsed"
      status="proposta"
      question="O disclosure fecha a seção sem esconder que ela existe? (Fase 2 — hoje `Section` não colapsa)"
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
    <Fixture title="IconButton / default · hover · active" question="Hover e active são distinguíveis de default? (hoje `active` não tem visual próprio)">
      <div className="flex items-center gap-1">
        <IconButton icon={<span aria-hidden>⊕</span>} aria-label="Default state" />
        <IconButton icon={<span aria-hidden>⊕</span>} aria-label="Hover state (hover me)" />
        <IconButton icon={<span aria-hidden>⊕</span>} aria-label="Active state" />
      </div>
    </Fixture>

    <Fixture title="IconButton / disabled · selected" question="Seleção persistente se distingue de foco e de desabilitado?">
      <div className="flex items-center gap-1">
        <IconButton icon={<span aria-hidden>⊕</span>} aria-label="Disabled state" disabled />
        <IconButton icon={<span aria-hidden>⊕</span>} aria-label="Selected state" selected />
        <IconButton variant="rail" icon={<span aria-hidden>⊕</span>} aria-label="Rail selected" />
      </div>
    </Fixture>

    <Fixture title="Field / default · focus · disabled" question="Um campo plano comunica onde se pode digitar?">
      <TextField label="Default" defaultValue="Sora" />
      <TextField label="Focus" defaultValue="Sora" autoFocus />
      <TextField label="Disabled" defaultValue="Sora" disabled />
    </Fixture>

    <Fixture title="Field / invalid" status="proposta" question="Erro é sinalizado por borda/semântica, não só por texto? (não existe hoje)">
      <TextField label="Invalid" defaultValue="not-a-hex" aria-invalid className="border-ic-danger" />
    </Fixture>

    <Fixture title="Button / primary · secondary · ghost" question="As três hierarquias de ação continuam legíveis lado a lado?">
      <div className="flex flex-wrap gap-1.5">
        <Button variant="primary">Export</Button>
        <Button variant="secondary">Cancel</Button>
        <Button variant="ghost">Dismiss</Button>
      </div>
    </Fixture>

    <Fixture title="Slider · Switch · SegmentedControl · Select" question="Controles contínuos, binários e de conjunto compartilham a mesma altura e o mesmo peso visual?">
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
      question="O cabeçalho comunica preview + tipo + opacity + ações?"
      initial={{ kind: 'solid', color: '#f8fafc', alpha: 1 }}
    />
    <FillFixture
      title="Fill / linear"
      question="A transição entre o cabeçalho e os controles específicos do tipo é clara?"
      initial={brandGradientFill()}
    />
    <FillFixture
      title="Fill / radial"
      question="Centro/raio aparecem só quando o tipo pede?"
      initial={{ ...brandGradientFill(), kind: 'radial-gradient', centerX: 0.5, centerY: 0.5, radius: 0.5 }}
    />
    <FillFixture
      title="Fill / angular"
      question="Ângulo inicial e centro são compreensíveis sem preview no canvas?"
      initial={{ ...brandGradientFill(), kind: 'angular-gradient', angle: 0, centerX: 0.5, centerY: 0.5 }}
    />
    <FillFixture
      title="Fill / diamond"
      question="O tipo se distingue de radial apenas pelo rótulo?"
      initial={{ ...brandGradientFill(), kind: 'diamond-gradient', centerX: 0.5, centerY: 0.5, radius: 0.5 }}
    />
    <Fixture
      title="Fill / image"
      status="aguarda spec"
      question="Texture é uma terceira linguagem (Mode Fill/Fit/Crop/Tile + Scale + Position + Adjustments) — o modelo ainda não tem image fill."
    />
  </>
);

export const GradientDensityFixtures = () => (
  <>
    <FillFixture
      title="Gradient / 2 stops"
      question="O caso base mantém a barra como âncora visual?"
      initial={withStops(2)}
    />
    <FillFixture
      title="Gradient / 3 stops"
      question="Adicionar um stop intermediário continua legível em 240px?"
      initial={withStops(3)}
    />
    <FillFixture
      title="Gradient / 5 stops"
      question="O controle continua utilizável em alta densidade (linhas alinhadas, sem overflow)?"
      initial={withStops(5)}
    />
  </>
);

/* --------------------------------------------------------------- pendentes -- */

const PENDING: Array<{ title: string; question: string }> = [
  { title: 'Inspector / empty', question: 'Sem seleção, o painel explica o próximo passo em vez de ficar vazio?' },
  { title: 'Inspector / shape', question: 'A hierarquia Section → Row é compreensível?' },
  { title: 'Inspector / text', question: 'Texto convive com composição e aparência sem virar formulário?' },
  { title: 'Inspector / image', question: 'Imagem acomoda Transform / Fit / Adjustments sem virar formulário?' },
  { title: 'Inspector / background', question: 'O handle de fundo se distingue do backdrop do editor?' },
  { title: 'Layers / empty', question: 'Lista vazia orienta a primeira ação (importar/desenhar)?' },
  { title: 'Layers / 10 layers', question: 'A leitura da hierarquia continua clara com densidade?' },
  { title: 'Layers / hidden', question: 'Visibilidade é descobrível fora do context menu?' },
  { title: 'Layers / locked', question: 'Lock é descobrível e não bloqueia a seleção silenciosamente?' },
  { title: 'Responsive / 1440 · 1180 · 900 · 768', question: 'O shell realmente muda de estratégia (drawer/sheet) ou só encolhe?' }
];

export const PendingFixtures = () => (
  <>
    {PENDING.map((fixture) => (
      <Fixture key={fixture.title} title={fixture.title} question={fixture.question} status="aguarda spec" />
    ))}
  </>
);
