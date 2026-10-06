import { useMemo, useState } from 'react';
import { Eraser, Ratio } from 'lucide-react';
import type { Fill, IconLayer, ShapeDefinition, ShapeKind } from '@iconcore/shared';
import { defaultMaskRadius } from '@iconcore/shared';
import { Button, ColorField, NumberField, Section, SegmentedControl, Select, Slider, Switch, TextField } from '@iconcore/ui';
import { RADIUS_MARKS, radiusMarkValue } from '../utils/radiusMarks';
import { resolveWorkAreaColor } from '../utils/workArea';
import { MAX_DIVISIONS, MIN_DIVISIONS } from '../utils/gridConfig';
import {
  KEYLINE_PART_LABELS,
  KEYLINE_STANDARDS,
  availableParts,
  type KeylineStandard
} from '../utils/keylineConfig';
import { useComposer } from '../ComposerContext';
import { FontPicker } from './FontPicker';
import { DEFAULT_FONT_STACK } from '@iconcore/renderer';
import { resolveLayerVariant } from '../utils/layerResolve';
import { scopedLayerDispatch, type ScopedLayerChanges } from '../utils/layerEdit';
import { fillColor, getShadow, setShadow } from '../utils/layerStyle';
import { readSvgLayerColors } from '../utils/svgLayerColors';
import { useResetLayerAspect } from '../hooks/useResetLayerAspect';
import { FillEditor } from './FillEditor';
import { SvgPaintEditor } from './SvgPaintEditor';
import { BackgroundRemovalModal } from './BackgroundRemovalModal';

const blendModes: NonNullable<IconLayer['blendMode']>[] = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten'];
const shapeKinds: ShapeKind[] = ['circle', 'rectangle', 'rounded-rectangle', 'squircle', 'triangle', 'line', 'star'];

/**
 * Alinhamento do texto, em rótulos que dizem o que cada botão faz.
 *
 * `Left` / `Center` / `Right` e não `0` / `1` / `2`: o valor é curto e o nome **é** o
 * significado. Um campo numérico de 0 a 2 seria adivinhável, e a mesma razão que fez a
 * `VariantBar` usar palavras em vez de índices.
 */
const TEXT_ALIGN_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' }
] as const;

/**
 * Editor for the image background (`project.canvas.background`). It is the same
 * property whether reached through the Background layer handle or (historically)
 * the empty-selection panel.
 */
const BackgroundFillSection = ({
  background,
  onChange,
  onCommit
}: {
  background: Fill;
  onChange: (fill: Fill, transient?: boolean) => void;
  onCommit: () => void;
}) => (
  <Section title="Background">
    <FillEditor
      label="Background fill"
      fill={background}
      onChange={onChange}
      onCommit={onCommit}
      noneNote="The exported image has a transparent background."
    />
  </Section>
);


export const LayerInspector = () => {
  const { state, dispatch } = useComposer();
  const [showBgRemoval, setShowBgRemoval] = useState(false);
  const resetAspect = useResetLayerAspect();

  const baseLayer = state.project?.layers.find((layer) => layer.id === state.activeLayerId);
  const activeVariant = state.activeVariant;
  const layer = useMemo<IconLayer | null>(
    () => (baseLayer ? resolveLayerVariant(baseLayer, activeVariant) : null),
    [baseLayer, activeVariant]
  );

  /**
   * `IC63/1b` — as cores do arquivo, lidas do markup.
   *
   * Memoizado em `source.data`, e não em `layer`: o inspector re-renderiza a cada
   * arrasto de slider, e `atob` + varredura de markup a 60 Hz seria trabalho jogado
   * fora. A dependência é o que realmente decide a lista — o base64 — então trocar o
   * slider não relê o arquivo, e trocar o arquivo relê.
   *
   * Sai de `baseLayer` e não de `layer` de propósito: as cores são do **arquivo**, e
   * um override de variante mexe no mapa, não no markup. Ler do layer resolvido
   * gastaria o mesmo trabalho para o mesmo resultado.
   */
  const coresSvg = useMemo(() => (baseLayer ? readSvgLayerColors(baseLayer) : []), [baseLayer]);

  if (!state.project) {
    return (
      <aside className="ic-inspector">
        <p className="text-xs text-ic-text-muted text-center py-8">No project open.</p>
      </aside>
    );
  }

  if (baseLayer?.role === 'background') {
    const setCanvasBg = (next: Fill, transient = false) =>
      dispatch({ type: 'SET_CANVAS_BACKGROUND', payload: { background: next, transient } });
    return (
      <aside className="ic-inspector">
        <div className="ic-inspector-head">
          <div>
            <p>Image</p>
            <h2>Background</h2>
          </div>
        </div>
        <div className="ic-field-stack">
          <BackgroundFillSection
            background={state.project.canvas.background}
            onChange={setCanvasBg}
            onCommit={() => dispatch({ type: 'COMMIT_HISTORY' })}
          />
        </div>
      </aside>
    );
  }

  if (!layer || !baseLayer) {
    const size = state.project.canvas.size;
    /**
     * A cor **calculada** de `--ic-bg`, para a amostra do `ColorField`.
     *
     * Ler o token e nao usar um hex fixo porque a amostra tem de ser a cor que a
     * bancada esta de fato: um valor fixo mentiria no outro tema. E `try/catch`
     * porque `getComputedStyle` pode lancar num iframe sem origem — sem isto o
     * inspetor inteiro nao renderiza por causa de uma amostra.
     */
    const themeBg = (() => {
      try {
        return getComputedStyle(document.documentElement).getPropertyValue('--ic-bg').trim();
      } catch {
        return '';
      }
    })();
    const raioMaximo = Math.round(size / 2);
    const raioAtual = Math.round(
      state.project.canvas.maskRadius ?? defaultMaskRadius(state.maskShape, size)
    );
    /**
     * As marcas do slider, e o mapa que devolve a **forma** de uma marca.
     *
     * O `Slider` é domain-free — `check-ui-boundary` cobra isso, e com razão: ele não
     * pode saber o que é `maskShape`. Então o kit devolve a marca e o app traduz. A
     * tradução é por `description`, e ela só é segura porque `RADIUS_MARKS` tem
     * descrições **unicas** — o que um teste garante, porque um `Map` com chave
     * duplicada devolveria a forma errada em silêncio.
     */
    const marcasRaio = RADIUS_MARKS.map((m) => ({
      px: radiusMarkValue(m.shape, size, raioMaximo),
      label: m.label,
      description: m.description
    }));
    const formaPor = new Map(RADIUS_MARKS.map((m) => [m.description, m.shape]));

    /**
     * As partes de keyline que o **documento** sustenta.
     *
     * A `safe-area` depende de `canvas.safeArea` existir. Sem ele, o tracejado seria
     * uma caixa inventada no lugar onde a plataforma recorta, e a pessoa ajustaria a
     * arte a uma margem que não existe - o switch liga, a guia aparece, e é mentira.
     *
     * A plataforma entra aqui pelo mesmo motivo: a zona so existe onde ha **numero
     * medido**, e hoje o unico e o Android (66/108). Sem o segundo argumento, o switch da
     * zona aparecia no iOS ligando uma caixa de 2/3 que nao e de ninguem — que e como o
     * dono chegou a concluir que os presets eram iguais.
     */
    const partesDisponiveis = availableParts(
      Boolean(state.project.canvas.safeArea),
      state.keylineStandard
    );

    return (
      <aside className="ic-inspector">
        <div className="ic-inspector-head">
          <div>
            <p>Edit Space</p>
            <h2>Canvas</h2>
          </div>
        </div>
        <div className="ic-field-stack">
          <Section
            title="Work area"
          >
            <ColorField
              label="Work area color"
              value={resolveWorkAreaColor(state.workAreaColor, themeBg)}
              onChange={(next) =>
                dispatch({ type: 'SET_WORK_AREA_COLOR', payload: { color: next.color, alpha: next.alpha } })
              }
            />
            {state.workAreaColor != null && (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-[0.7rem] text-ic-text-muted hover:text-ic-accent-text hover:underline"
                  onClick={() => dispatch({ type: 'SET_WORK_AREA_COLOR', payload: null })}
                >
                  Follow the theme
                </button>
              </div>
            )}
          </Section>

          <Section
            title="Import margin"
          >
            <Slider
              variant="inline"
              label="Margin"
              unit="%"
              min="0"
              max="45"
              value={Math.round((state.project.canvas.importMargin ?? 0) * 100)}
              onChange={(event) =>
                dispatch({
                  type: 'SET_CANVAS_IMPORT_MARGIN',
                  payload: { margin: Number(event.target.value) / 100, transient: true }
                })
              }
              onCommit={() => dispatch({ type: 'COMMIT_HISTORY' })}
            />
            {/*
                O toggle da visualização, e não a margem do componente.
                `state.showKeylines` **não** serve aqui: a máscara e uma informação
                diferente da guia de plataforma, e compartilhar o flag faria o
                `Cmd/Ctrl+G` na barra de baixo (que é da keyline) apagar a margem.
            */}
            <Switch
              label="Show margin on canvas"
              checked={state.showMarginOverlay}
              onChange={() => dispatch({ type: 'TOGGLE_MARGIN_OVERLAY' })}
            />
          </Section>

{/*
              A **configuração** do grid, e não o toggle.

              O toggle continua na barra de ação inferior (`Ctrl/Ctrl+G`), que é onde a
              pessoa o procura — o dono foi explícito: "a ativacao/ ciclo deles continua
              como atalho la". O que vem para o Edit Space é só o ajuste, para o grid não
              ser um botão de liga/desliga sem nenhum ajuste.

              Aparece junto do `Toggle grid` e some com ele desligado, para não oferecer
              ajuste de algo que não está na tela.
          */}
          <Section
            title="Grid"
          >
            <Switch
              label="Show grid"
              checked={state.showGrid}
              onChange={() => dispatch({ type: 'TOGGLE_GRID' })}
            />
            {state.showGrid && (
              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  label="Columns"
                  min={MIN_DIVISIONS}
                  max={MAX_DIVISIONS}
                  step={1}
                  value={state.gridColumns}
                  onChange={(event) =>
                    dispatch({
                      type: 'SET_GRID_DIVISIONS',
                      payload: { columns: Number(event.target.value), rows: state.gridRows }
                    })
                  }
                  onBlur={() => dispatch({ type: 'COMMIT_HISTORY' })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') dispatch({ type: 'COMMIT_HISTORY' });
                  }}
                />
                <NumberField
                  label="Rows"
                  min={MIN_DIVISIONS}
                  max={MAX_DIVISIONS}
                  step={1}
                  value={state.gridRows}
                  onChange={(event) =>
                    dispatch({
                      type: 'SET_GRID_DIVISIONS',
                      payload: { columns: state.gridColumns, rows: Number(event.target.value) }
                    })
                  }
                  onBlur={() => dispatch({ type: 'COMMIT_HISTORY' })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') dispatch({ type: 'COMMIT_HISTORY' });
                  }}
                />
              </div>
            )}
          </Section>

          {/*
              A **configuração** da keyline. O toggle continua na barra inferior
              (`Ctrl/Ctrl+K`), que é onde a pessoa o procura — o dono foi explícito:
              "a ativacao/ ciclo deles continua como atalho la".
          */}
          <Section
            title="Keyline"
          >
            <Switch
              label="Show keyline"
              checked={state.showKeylines}
              onChange={() => dispatch({ type: 'TOGGLE_KEYLINES' })}
            />
            {state.showKeylines && (
              <>
                <Select
                  label="Platform"
                  value={state.keylineStandard}
                  onChange={(event) =>
                    dispatch({ type: 'SET_KEYLINE_STANDARD', payload: event.target.value as KeylineStandard })
                  }
                >
                  {Object.entries(KEYLINE_STANDARDS).map(([value, info]) => (
                    <option key={value} value={value}>
                      {info.label}
                    </option>
                  ))}
                </Select>
                <div className="grid grid-cols-1 gap-2">
                  {partesDisponiveis.map((part) => (
                    <Switch
                      key={part}
                      label={KEYLINE_PART_LABELS[part]}
                      checked={state.keylineParts.has(part)}
                      onChange={() => dispatch({ type: 'TOGGLE_KEYLINE_PART', payload: part })}
                    />
                  ))}
                </div>
                {/*
                    As recomendadas da plataforma, acionadas em um clique. Trocar o tipo
                    **nao** mexe nas partes (a pessoa escolheu), e este botao existe
                    para quem quer o conjunto sem ligar cinco switches — que e o uso
                                    comum depois de escolher a plataforma.
                */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-[0.7rem] text-ic-text-muted hover:text-ic-accent-text hover:underline"
                    onClick={() => {
                      for (const part of KEYLINE_STANDARDS[state.keylineStandard].suggestedParts) {
                        if (!state.keylineParts.has(part)) {
                          dispatch({ type: 'TOGGLE_KEYLINE_PART', payload: part });
                        }
                      }
                    }}
                  >
                    Use {KEYLINE_STANDARDS[state.keylineStandard].label} guides
                  </button>
                </div>
              </>
            )}
          </Section>

          <Section
            title="Frame radius"
          >
            <Slider
              variant="inline"
              label="Radius"
              unit="px"
              min="0"
              max={raioMaximo}
              value={raioAtual}
              marks={marcasRaio}
              onMark={(marca) => {
                const forma = formaPor.get(marca.description);
                if (!forma) return;
                /**
                 * A marca muda **a forma**, e zera o raio declarado.
                 *
                 * A primeira versao tambem gravava `radius: marca.px`. Foi um e2e que
                 * pegou o efeito: ao declarar o raio, `maskRadius` deixava de estar
                 * ausente e passava a ganhar do padrao da forma — entao clicar em
                 * "Circle" e depois girar o platform toggle **nao mexia em nada**. A
                 * marca e um atalho para "use a forma desta", e nao para "use este
                 * numero"; `radius: null` e o que devolve o valor ao contrato de
                 * "ausente = siga a forma".
                 */
                dispatch({ type: 'SET_CANVAS_MASK_RADIUS', payload: { radius: null } });
                dispatch({ type: 'SET_MASK_SHAPE', payload: forma });
                dispatch({ type: 'COMMIT_HISTORY' });
              }}
              onChange={(event) =>
                dispatch({
                  type: 'SET_CANVAS_MASK_RADIUS',
                  payload: { radius: Number(event.target.value), transient: true }
                })
              }
              onCommit={() => dispatch({ type: 'COMMIT_HISTORY' })}
            />
            <div className="flex justify-end">
              <button
                type="button"
                className="text-[0.7rem] text-ic-text-muted hover:text-ic-accent-text hover:underline"
                onClick={() =>
                  dispatch({ type: 'SET_CANVAS_MASK_RADIUS', payload: { radius: null } })
                }
                disabled={state.project.canvas.maskRadius === undefined}
              >
                Reset to {Math.round(defaultMaskRadius(state.maskShape, state.project.canvas.size))}px
                {' '}
                for {state.maskShape}
              </button>
            </div>
          </Section>
        </div>
      </aside>
    );
  }

  const scoped = activeVariant !== 'default';
  const commit = () => dispatch({ type: 'COMMIT_HISTORY' });

  // Appearance edits auto-scope to the active variant; identity (name) stays on the base layer.
  const updateLayer = (changes: ScopedLayerChanges, transient = false) => {
    scopedLayerDispatch(dispatch, activeVariant, layer.id, changes, { transient });
  };

  const updateTransform = (changes: Partial<IconLayer['transform']>, transient = true) => {
    updateLayer({ transform: { ...layer.transform, ...changes } }, transient);
  };

  // Shape geometry is structural → always written to the base layer (like name).
  const shape = baseLayer.source.shape;
  const updateShape = (patch: Partial<ShapeDefinition>, transient = false) => {
    if (!shape) return;
    dispatch({
      type: 'UPDATE_LAYER',
      payload: { id: baseLayer.id, changes: { source: { ...baseLayer.source, shape: { ...shape, ...patch } } }, transient }
    });
  };

  const shadow = getShadow(layer);
  const isImage = baseLayer.kind === 'image' || baseLayer.kind === 'svg';
  const imageFilter = layer.imageFilter ?? {};
  const updateImageFilter = (patch: Partial<typeof imageFilter>, transient = false) =>
    updateLayer({ imageFilter: { ...imageFilter, ...patch } }, transient);

  const blurRadius = Number(layer.effects?.find((effect) => effect.kind === 'surface-blur')?.params.radius ?? 0);
  const setBlur = (radius: number, transient = false) => {
    const effects = layer.effects ?? [];
    const next = radius <= 0
      ? effects.filter((effect) => effect.kind !== 'surface-blur')
      : effects.some((effect) => effect.kind === 'surface-blur')
        ? effects.map((effect) => (effect.kind === 'surface-blur' ? { ...effect, enabled: true, params: { radius } } : effect))
        : [...effects, { kind: 'surface-blur' as const, enabled: true, params: { radius } }];
    updateLayer({ effects: next }, transient);
  };

  return (
    <aside className="ic-inspector">
      <div className="ic-inspector-head">
        <div>
          <p>Edit Space</p>
          <h2>Layer Properties</h2>
        </div>
        <span>{activeVariant}</span>
      </div>

      {scoped && (
        <p className="ic-variant-scope-note">
          Editing the <strong>{activeVariant}</strong> variant — changes stay here, not the default.
        </p>
      )}

      <div className="ic-field-stack">
        {layer.kind === 'text' && (
          <Section title="Text">
            {/**
             * A ordem é um argumento, não preferência: **fonte, tamanho, estilo, alinhamento**.
             *
             * Quem escolhe a fonte só depois descobre o tamanho que preenche o canvas; e o
             * estilo (negrito, itálico) altera a largura do texto, então vem depois do tamanho
             * — mexer no peso depois do tamanho muda a quebra, e a pessoa ajusta o tamanho
             * duas vezes. O alinhamento vem por último porque age sobre o que já está medido.
             *
             * A versão anterior punha Size e Weight **antes** da fonte, e o itálico solto no
             * fim, depois do alinhamento: três controles em ordem que não corresponde a
             * nenhuma.
             */}
            <TextField
              label="Text"
              value={layer.text?.content ?? ''}
              onChange={(event) => updateLayer({ text: { ...layer.text, content: event.target.value } as IconLayer['text'] })}
            />

            <FontPicker
              value={layer.text?.fontFamily ?? DEFAULT_FONT_STACK}
              onChange={(fontFamily) => updateLayer({ text: { ...layer.text, fontFamily } as IconLayer['text'] })}
            />

            <NumberField
              label="Size"
              min="8"
              value={layer.text?.fontSize ?? 64}
              onChange={(event) => updateLayer({ text: { ...layer.text, fontSize: Number(event.target.value) } as IconLayer['text'] })}
            />

            {/**
             * Negrito e itálico, lado a lado, como pares.
             *
             * O peso saiu de um `NumberField` 100..900 para um switch, e a razão é a Cal Sans
             * embarca **dois** pesos (400 e 700): oferecer seis que a fonte não tem é deixar
             * o navegador escolher o mais próximo — um controle que promete precisão que não
             * existe. O switch mapeia 700 para 400 e vice-versa, que é o que os dois pesos
             * fazem.
             *
             * A perda de capacidade é real e fica registrada: quem precisar de 500 ou 600
             * precisa de um `Select` de peso **por fonte**, o que exige metadata de peso em
             * `fonts.ts` e saber os pesos de uma família instalada — que a Local Font Access
             * API não devolve. Fica para quando alguém precisar num logo.
             *
             * Os dois ficam na mesma linha porque são **pares**: as duas coisas que
             * inclinam ou engrossam o mesmo glifo. O itálico solto no fim do painel, como
             * estava, não era par de nada.
             */}
            <div className="grid grid-cols-2 gap-2.5">
              <Switch
                label="Bold"
                checked={(layer.text?.fontWeight ?? 700) >= 600}
                onChange={(event) =>
                  updateLayer({
                    text: { ...layer.text, fontWeight: event.target.checked ? 700 : 400 } as IconLayer['text']
                  })
                }
              />
              <Switch
                label="Italic"
                checked={layer.text?.fontStyle === 'italic'}
                onChange={(event) =>
                  updateLayer({
                    text: {
                      ...layer.text,
                      fontStyle: event.target.checked ? 'italic' : 'normal'
                    } as IconLayer['text']
                  })
                }
              />
            </div>

            {/**
             * O alinhamento com rótulo **visível**.
             *
             * O `SegmentedControl` do kit só aceita `aria-label`, então o rótulo visível é um
             * `span` com as mesmas classes que o `Field` usa no rótulo dele — é o que faz o
             * texto ter a mesma altura e cor de todos os outros rótulos do painel. Sem ele, a
             * tela mostrava "Left Center Right" sem dizer do que se tratava.
             *
             * Não é um `<label>`: o controle é um grupo de botões, não um elemento rotulável,
             * e um `<label>` em volta enviaria o clique para o primeiro botão rotulável — o
             * clique em "esquerda" marcaria "centro".
             *
             * A caixa do alinhamento é o **shape da layer** (58% da largura do canvas,
             * `createTextLayer`), não o canvas inteiro: ancorar à esquerda no meio do canvas
             * faria o texto crescer para a direita a partir do centro, que é o oposto de
             * "esquerda". A geometria mora em `textLayout.ts` e os dois pipelines consomem a
             * mesma função.
             *
             * `Left / Center / Right` em texto, e não 0/1/2: o valor é curto e o nome **é** o
             * significado — a mesma escolha da `VariantBar`.
             */}
            <div className="grid gap-1.5">
              <span className="truncate text-[length:var(--ic-label-size)] leading-none text-ic-text-muted">
                Alignment
              </span>
              <SegmentedControl
                aria-label="Text alignment"
                options={TEXT_ALIGN_OPTIONS}
                value={layer.text?.textAlign ?? 'center'}
                onChange={(textAlign) =>
                  updateLayer({ text: { ...layer.text, textAlign } as IconLayer['text'] })
                }
              />
            </div>
          </Section>
        )}


        <Section title="Layer">
          <TextField
            label="Name"
            value={baseLayer.name}
            onChange={(event) => dispatch({ type: 'UPDATE_LAYER', payload: { id: baseLayer.id, changes: { name: event.target.value } } })}
          />
        </Section>

        <Section title="Composition">
          <div className="grid grid-cols-2 gap-2.5">
            <NumberField
              label="X"
              value={Math.round(layer.transform.x)}
              onChange={(event) => updateTransform({ x: Number(event.target.value) }, false)}
            />
            <NumberField
              label="Y"
              value={Math.round(layer.transform.y)}
              onChange={(event) => updateTransform({ y: Number(event.target.value) }, false)}
            />
          </div>

          <Slider
            variant="inline"
            label="Scale"
            unit="×"
            min="0.08"
            max="4"
            step="0.01"
            value={layer.transform.scale}
            onChange={(event) => updateTransform({ scale: Number(event.target.value) })}
            onCommit={commit}
          />

          <Slider
            variant="inline"
            label="Rotation"
            unit="°"
            min="-180"
            max="180"
            step="1"
            value={layer.transform.rotation}
            onChange={(event) => updateTransform({ rotation: Number(event.target.value) })}
            onCommit={commit}
          />
        </Section>

        {baseLayer.kind === 'shape' && shape && (
          <Section title="Geometry">
            <Select
              label="Shape"
              value={shape.kind}
              onChange={(event) => updateShape({ kind: event.target.value as ShapeKind })}
            >
              {shapeKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
            </Select>
            {shape.kind === 'rounded-rectangle' && (
              <Slider
                variant="inline"
                label="Corner radius"
                unit="px"
                min="0"
                max={Math.round(Math.min(shape.width, shape.height) / 2)}
                value={Math.round(shape.cornerRadius ?? 32)}
                onChange={(event) => updateShape({ cornerRadius: Number(event.target.value) }, true)}
                onCommit={commit}
              />
            )}
          </Section>
        )}

        <Section title="Color">
          {/*
            `IC63/1b` — para `kind: 'svg'`, o `Fill` é **trocado**, não acrescido.

            A layer não tem `fill` próprio: a cor mora no markup, e o renderer injeta o
            documento verbatim (`renderToSvg.ts:391-419`), sem nunca ler `layer.fill`.
            O controle que ficava aqui mostrava "transparent" para uma camada
            desenhando branco, com a nota *"No fill — the shape is transparent"* — que
            era falsa. E mexer nele não fazia nada, nos dois sentidos.

            Deixar os dois lado a lado seria pior que qualquer um deles sozinho: um
            controle que parece funcionar, ao lado do que funciona.

            Só a **pintura** sai. `Opacity` e `Blend mode` continuam valendo para SVG —
            são aplicação de camada, e o `filterAttr`/`opacity` do renderer já os
            aplica ao group que envolve o documento.
          */}
          {layer.kind === 'svg' ? (
            <SvgPaintEditor
              colors={coresSvg}
              overrides={layer.svgPaintOverrides}
              onChange={(svgPaintOverrides, transient) => updateLayer({ svgPaintOverrides }, transient)}
              onCommit={commit}
            />
          ) : (
            <FillEditor
              label="Fill"
              fill={layer.fill ?? { kind: 'solid', color: fillColor(layer.fill) }}
              onChange={(next, transient) => updateLayer({ fill: next }, transient)}
              onCommit={commit}
            />
          )}

          <Slider
            variant="inline"
            label="Opacity"
            unit="%"
            min="0"
            max="100"
            value={Math.round(layer.opacity * 100)}
            onChange={(event) => updateLayer({ opacity: Number(event.target.value) / 100 })}
            onCommit={commit}
          />

          <Select
            label="Blend mode"
            value={layer.blendMode ?? 'normal'}
            onChange={(event) => updateLayer({ blendMode: event.target.value as IconLayer['blendMode'] })}
          >
            {blendModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
          </Select>        </Section>

        <Section title="Effects">
          <Switch
            label="Depth shadow"
            checked={shadow.enabled}
            onChange={(event) => updateLayer({ effects: setShadow(layer, { ...shadow, enabled: event.target.checked }) })}
          />

          <Slider
            variant="inline"
            label="Shadow blur"
            unit="px"
            min="0"
            max="80"
            value={Number(shadow.params.blur ?? 34)}
            onChange={(event) => updateLayer({
              effects: setShadow(layer, { ...shadow, params: { ...shadow.params, blur: Number(event.target.value) } })
            }, true)}
            onPointerUp={commit}
          />

          <Slider
            variant="inline"
            label="Layer blur"
            unit="px"
            min="0"
            max="60"
            value={blurRadius}
            onChange={(event) => setBlur(Number(event.target.value), true)}
            onCommit={commit}
          />
        </Section>

        {isImage && (
          <Section title="Image adjustments">
            <Slider
              variant="inline"
              label="Hue"
              unit="°"
              min="-180"
              max="180"
              value={imageFilter.hue ?? 0}
              onChange={(event) => updateImageFilter({ hue: Number(event.target.value) }, true)}
              onCommit={commit}
            />
            <Slider
              variant="inline"
              label="Saturation"
              unit="%"
              min="0"
              max="200"
              value={imageFilter.saturation ?? 100}
              onChange={(event) => updateImageFilter({ saturation: Number(event.target.value) }, true)}
              onCommit={commit}
            />
            <Slider
              variant="inline"
              label="Brightness"
              unit="%"
              min="0"
              max="200"
              value={imageFilter.brightness ?? 100}
              onChange={(event) => updateImageFilter({ brightness: Number(event.target.value) }, true)}
              onCommit={commit}
            />
            <Slider
              variant="inline"
              label="Contrast"
              unit="%"
              min="0"
              max="200"
              value={imageFilter.contrast ?? 100}
              onChange={(event) => updateImageFilter({ contrast: Number(event.target.value) }, true)}
              onCommit={commit}
            />
            {baseLayer.source.type === 'inline' && (
              <Button
                variant="secondary"
                iconLeft={<Ratio size={14} />}
                onClick={() => void resetAspect.reset()}
                disabled={resetAspect.busy}
                title="Restore this layer's width-to-height ratio from the asset, keeping its current size."
              >
                {resetAspect.busy ? 'Measuring…' : 'Reset aspect'}
              </Button>
            )}
            {baseLayer.source.type === 'inline' && baseLayer.source.mimeType !== 'image/svg+xml' && (
              <Button
                variant="secondary"
                iconLeft={<Eraser size={14} />}
                onClick={() => setShowBgRemoval(true)}
              >
                Remove background
              </Button>
            )}
          </Section>
        )}

        <Button
          variant="secondary"
          className="border-ic-danger/60 bg-ic-danger/10 text-ic-danger hover:bg-ic-danger/20"
          onClick={() => dispatch({ type: 'REMOVE_LAYER', payload: { id: layer.id } })}
        >
          Delete selected layer
        </Button>
      </div>

      {showBgRemoval && <BackgroundRemovalModal layer={baseLayer} onClose={() => setShowBgRemoval(false)} />}
    </aside>
  );
};
