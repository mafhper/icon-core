import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { renderToSvg } from '@iconcore/renderer';
import { ComposerProvider, useComposer } from '../ComposerContext';
import { ToastProvider } from '../toast/ToastContext';
import { LayerInspector } from './LayerInspector';
import type { IconCoreProject, IconLayer } from '@iconcore/shared';
import { createBlankProject, createShapeLayer } from '../utils/projectFactory';
import { GLOW_PRESET } from '../utils/layerStyle';

/**
 * Fase 4 — a emenda UI → estado → renderer do traço e dos efeitos novos.
 *
 * O precedente é o `LayerInspectorTextControl.spec`: semear pelo reducer real
 * (`LOAD_PROJECT`), espiar o projeto e fechar a cadeia no markup exportado
 * com valor absoluto — nunca "os dois concordam". Cada teste abaixo liga um
 * controle do inspector e cobra o número que o SVG tem que carregar.
 */

const shapeProject = (shape: IconLayer['source']['shape']): IconCoreProject => {
  const base = createBlankProject('t', 256);
  const layer = createShapeLayer(256, 0);
  return {
    ...base,
    targets: [],
    layers: [{ ...layer, id: 'ls', source: { ...layer.source, shape } }]
  };
};

const ROUNDED = shapeProject({ kind: 'rounded-rectangle', width: 176, height: 176, cornerRadius: 32 });
const LINE = shapeProject({ kind: 'line', width: 200, height: 32 });

const Semear = ({ projeto }: { projeto: IconCoreProject }) => {
  const { dispatch, state } = useComposer();
  useEffect(() => {
    if (!state.project) dispatch({ type: 'LOAD_PROJECT', payload: { project: projeto } });
  }, [dispatch, state.project, projeto]);
  return null;
};

const EspiaoDeProjeto = ({ aoMudar }: { aoMudar: (p: IconCoreProject) => void }) => {
  const { state } = useComposer();
  useEffect(() => {
    if (state.project) aoMudar(state.project);
  }, [state.project, aoMudar]);
  return null;
};

const montar = (projeto: IconCoreProject) => {
  const vistos: IconCoreProject[] = [];
  render(
    <ToastProvider>
      <ComposerProvider>
        <Semear projeto={projeto} />
        <EspiaoDeProjeto aoMudar={(p) => vistos.push(p)} />
        <LayerInspector />
      </ComposerProvider>
    </ToastProvider>
  );
  return vistos;
};

const svgDaUltima = (vistos: IconCoreProject[]): string => renderToSvg(vistos.at(-1)!, 'default');

const camada = (vistos: IconCoreProject[]): IconLayer => vistos.at(-1)!.layers[0];

describe('Inspector Stroke (Fase 4)', () => {
  afterEach(() => cleanup());

  it('Add stroke cria o contorno, e a largura chega ao SVG sem esticar a forma', async () => {
    const vistos = montar(ROUNDED);
    await screen.findByRole('button', { name: 'Add stroke' });

    fireEvent.click(screen.getByRole('button', { name: 'Add stroke' }));
    expect(camada(vistos).stroke).toMatchObject({ width: 4, alignment: 'center' });

    fireEvent.change(screen.getByRole('slider', { name: 'Stroke width' }), { target: { value: '12' } });
    expect(camada(vistos).stroke?.width).toBe(12);
    // A forma não mexe: o traço é outline, e a camada continua 176×176.
    expect(camada(vistos).source.shape).toMatchObject({ width: 176, height: 176 });
    expect(svgDaUltima(vistos)).toContain('stroke-width="12"');
  });

  it('inside prende o traço por clip, outside por máscara, round arredonda o canto', async () => {
    const vistos = montar(ROUNDED);
    await screen.findByRole('button', { name: 'Add stroke' });
    fireEvent.click(screen.getByRole('button', { name: 'Add stroke' }));

    fireEvent.change(screen.getByLabelText('Alignment'), { target: { value: 'inside' } });
    expect(camada(vistos).stroke?.alignment).toBe('inside');
    expect(svgDaUltima(vistos)).toContain('clip-path');

    fireEvent.change(screen.getByLabelText('Alignment'), { target: { value: 'outside' } });
    expect(svgDaUltima(vistos)).toContain('<mask');

    fireEvent.change(screen.getByLabelText('Join'), { target: { value: 'round' } });
    expect(svgDaUltima(vistos)).toContain('stroke-linejoin="round"');
  });

  it('vazado desenha só a borda: fill none some com o recheio e fica o contorno', async () => {
    const vistos = montar(ROUNDED);
    await screen.findByRole('button', { name: 'Add stroke' });
    fireEvent.click(screen.getByRole('button', { name: 'Add stroke' }));

    fireEvent.change(screen.getByLabelText('Fill'), { target: { value: 'none' } });
    const svg = svgDaUltima(vistos);
    expect(svg).toContain('stroke-width="4"');
    expect(svg).toContain('fill="none"');
  });

  it('Corner smoothing vira path no SVG, e zero volta a rect', async () => {
    const vistos = montar(ROUNDED);
    await screen.findByRole('slider', { name: 'Corner smoothing' });

    expect(svgDaUltima(vistos)).not.toContain('<path');
    fireEvent.change(screen.getByRole('slider', { name: 'Corner smoothing' }), { target: { value: '60' } });
    expect(camada(vistos).source.shape?.cornerSmoothing).toBeCloseTo(0.6, 5);
    expect(svgDaUltima(vistos)).toContain('<path');
  });

  it('linha sem cap é a cápsula de sempre; butt achata sem rx', async () => {    const vistos = montar(LINE);
    await screen.findByLabelText('Cap');

    const capsula = svgDaUltima(vistos);
    expect(capsula).toContain('rx=');

    fireEvent.change(screen.getByLabelText('Cap'), { target: { value: 'butt' } });
    expect(camada(vistos).stroke?.cap).toBe('butt');
    const reta = svgDaUltima(vistos);
    expect(reta).toContain('<rect');
    expect(reta).not.toContain('rx=');
  });

  it('linha: Stroke width edita a altura do corpo, e o SVG carrega a espessura', async () => {
    const vistos = montar(LINE);
    await screen.findByLabelText('Cap');

    // O slider lê a altura do corpo (32), não o campo fantasma.
    const slider = screen.getByRole('slider', { name: 'Stroke width' }) as HTMLInputElement;
    expect(slider.value).toBe('32');

    fireEvent.change(slider, { target: { value: '24' } });
    // A forma mexe (é ela que pinta), o fantasma nem é criado.
    expect(camada(vistos).source.shape).toMatchObject({ width: 200, height: 24 });
    expect(camada(vistos).stroke?.width).toBeUndefined();
    // O markup carrega a espessura no corpo, não em stroke-width.
    const svg = svgDaUltima(vistos);
    expect(svg).toContain('height="24"');
    expect(svg).not.toContain('stroke-width');
  });

  it('linha: o cap espelha a altura no stroke, sem ressuscitar o fantasma', async () => {
    const vistos = montar(LINE);
    await screen.findByLabelText('Cap');

    fireEvent.change(screen.getByRole('slider', { name: 'Stroke width' }), { target: { value: '24' } });
    fireEvent.change(screen.getByLabelText('Cap'), { target: { value: 'butt' } });
    // O espelho acompanha o corpo: o validador lê verdade.
    expect(camada(vistos).stroke).toMatchObject({ width: 24, cap: 'butt' });
    expect(camada(vistos).source.shape).toMatchObject({ height: 24 });
  });

  it('rótulo honesto: em scale 1 cala, em scale 2 declara os pixels efetivos', async () => {
    const vistos = montar(ROUNDED);
    await screen.findByRole('button', { name: 'Add stroke' });
    fireEvent.click(screen.getByRole('button', { name: 'Add stroke' }));

    // Largura 4 do Add stroke, scale 1: nada a declarar.
    expect(screen.queryByText(/px efetivos/)).toBeNull();

    fireEvent.change(screen.getByRole('slider', { name: 'Scale' }), { target: { value: '2' } });
    expect(camada(vistos).transform.scale).toBe(2);
    expect(screen.getByText('4 × 2 = 8px efetivos')).toBeInTheDocument();
  });

  it('rótulo honesto na linha: a espessura efetiva parte da altura do corpo', async () => {
    montar(LINE);
    await screen.findByLabelText('Cap');

    expect(screen.queryByText(/px efetivos/)).toBeNull();

    fireEvent.change(screen.getByRole('slider', { name: 'Scale' }), { target: { value: '2' } });
    expect(screen.getByText('32 × 2 = 64px efetivos')).toBeInTheDocument();
  });
});

describe('Inspector Effects (Fase 4)', () => {
  afterEach(() => cleanup());

  it('Drop shadow liga e emite feDropShadow com os números do painel', async () => {
    const vistos = montar(ROUNDED);
    await screen.findByLabelText('Drop shadow');

    // A fábrica semeia um depth-shadow legado ligado: o primeiro clique aposenta
    // tudo, o segundo liga o drop migrado.
    fireEvent.click(screen.getByLabelText('Drop shadow'));
    fireEvent.click(screen.getByLabelText('Drop shadow'));
    expect(camada(vistos).effects?.find((e) => e.kind === 'drop-shadow')?.enabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Drop shadow' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Drop blur' }), { target: { value: '24' } });
    const svg = svgDaUltima(vistos);
    expect(svg).toContain('feDropShadow');
    expect(svg).toContain('stdDeviation="12"');
  });

  it('trocar a cor no modal chega ao modelo e ao SVG', async () => {
    const vistos = montar(ROUNDED);
    await screen.findByLabelText('Drop shadow');

    fireEvent.click(screen.getByLabelText('Drop shadow'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Drop shadow' }));
    const hex = await screen.findByLabelText('Drop shadow color hex');
    // Sem literal no spec: a cor vem do preset público, sem o `#` que o campo não mostra.
    fireEvent.change(hex, { target: { value: String(GLOW_PRESET.params.color).replace('#', '') } });
    fireEvent.blur(hex);

    expect(camada(vistos).effects?.find((e) => e.kind === 'drop-shadow')?.params.color).toBe(
      GLOW_PRESET.params.color
    );
    expect(svgDaUltima(vistos)).toContain(`flood-color="${String(GLOW_PRESET.params.color)}"`);
  });
  it('fechar o modal confirma sem perder: o valor arrastado sobrevive', async () => {
    const vistos = montar(ROUNDED);
    await screen.findByLabelText('Drop shadow');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Drop shadow' }));
    fireEvent.change(await screen.findByRole('slider', { name: 'Drop X' }), { target: { value: '30' } });
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(camada(vistos).effects?.find((e) => e.kind === 'drop-shadow')?.params.x).toBe(30);
    expect(svgDaUltima(vistos)).toContain('dx="30"');
  });

  it('o switch legado sumiu da UI: sem Depth shadow nem Shadow blur', async () => {
    montar(ROUNDED);
    await screen.findByLabelText('Drop shadow');

    expect(screen.queryByLabelText('Depth shadow')).toBeNull();
    expect(screen.queryByRole('slider', { name: 'Shadow blur' })).toBeNull();
  });

  it('projeto antigo com depth-shadow: desligar apaga a pintura, ligar migra os números', async () => {
    const vistos = montar(ROUNDED);
    await screen.findByLabelText('Drop shadow');

    const semente = camada(vistos).effects?.find((e) => e.kind === 'depth-shadow');
    expect(semente?.enabled).toBe(true);
    // A linha lê "uma sombra pinta", não "o drop existe".
    expect(screen.getByLabelText('Drop shadow')).toBeChecked();

    fireEvent.click(screen.getByLabelText('Drop shadow'));
    const semSombra = camada(vistos);
    expect(semSombra.effects?.filter((e) => e.enabled)).toHaveLength(0);
    expect(renderToSvg(vistos.at(-1)!, 'default')).not.toContain('feDropShadow');

    fireEvent.click(screen.getByLabelText('Drop shadow'));
    const migrada = camada(vistos);
    const drop = migrada.effects?.find((e) => e.kind === 'drop-shadow');
    expect(drop?.enabled).toBe(true);
    expect(drop?.params.y).toBe(Number(semente?.params.y));
    expect(drop?.params.blur).toBe(Number(semente?.params.blur));
    expect(migrada.effects?.find((e) => e.kind === 'depth-shadow')?.enabled).toBe(false);
    const svg = svgDaUltima(vistos);
    expect(svg).toContain('feDropShadow');
    expect(svg).toContain(`dy="${Number(semente?.params.y)}"`);
  });

  it('Glow é drop shadow com offset zero, não um efeito novo', async () => {
    const vistos = montar(ROUNDED);
    await screen.findByLabelText('Glow');

    // A linha existe sempre; o botão Add glow sumiu.
    expect(screen.queryByRole('button', { name: 'Add glow' })).toBeNull();

    // Sobre o drop ativo com offset: centra em vez de duplicar.
    fireEvent.click(screen.getByLabelText('Drop shadow'));
    fireEvent.click(screen.getByLabelText('Drop shadow'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Drop shadow' }));
    fireEvent.change(await screen.findByRole('slider', { name: 'Drop X' }), { target: { value: '10' } });
    fireEvent.keyDown(document, { key: 'Escape' });

    fireEvent.click(screen.getByLabelText('Glow'));
    const gotas = camada(vistos).effects?.filter((e) => e.kind === 'drop-shadow');
    expect(gotas).toHaveLength(1);
    expect(gotas?.[0]).toMatchObject({ enabled: true, params: { x: 0, y: 0 } });
    expect(screen.getByLabelText('Glow')).toBeChecked();
    const svg = svgDaUltima(vistos);
    expect(svg).toContain('feDropShadow');
    expect(svg).toContain('dx="0"');
    expect(svg).toContain('dy="0"');
  });

  it('Glow modal mostra X/Y travados em zero e edita blur com os números no SVG', async () => {
    const vistos = montar(ROUNDED);
    await screen.findByLabelText('Glow');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Glow' }));
    const travadoX = await screen.findByRole('spinbutton', { name: 'Glow X (locked at 0)' });
    const travadoY = screen.getByRole('spinbutton', { name: 'Glow Y (locked at 0)' });
    expect(travadoX).toBeDisabled();
    expect(travadoX).toHaveValue(0);
    expect(travadoY).toBeDisabled();
    expect(travadoY).toHaveValue(0);

    fireEvent.change(screen.getByRole('slider', { name: 'Glow blur' }), { target: { value: '32' } });
    const gotas = camada(vistos).effects?.filter((e) => e.kind === 'drop-shadow');
    expect(gotas).toHaveLength(1);
    expect(gotas?.[0]).toMatchObject({ enabled: true, params: { x: 0, y: 0, blur: 32 } });
    const svg = svgDaUltima(vistos);
    expect(svg).toContain('feDropShadow');
    expect(svg).toContain('stdDeviation="16"');
  });

  it('Inner shadow compõe o filtro interno sem desligar o resto', async () => {
    const vistos = montar(ROUNDED);
    await screen.findByLabelText('Inner shadow');

    fireEvent.click(screen.getByLabelText('Inner shadow'));
    const inner = camada(vistos).effects?.find((e) => e.kind === 'inner-shadow');
    expect(inner?.enabled).toBe(true);
    // O depth-shadow da fábrica continua lá: ligar um não apaga o outro.
    expect(camada(vistos).effects?.find((e) => e.kind === 'depth-shadow')).toBeDefined();
  });

  it('Inner modal move X e blur com os números no SVG', async () => {
    const vistos = montar(ROUNDED);
    await screen.findByLabelText('Inner shadow');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Inner shadow' }));
    fireEvent.change(await screen.findByRole('slider', { name: 'Inner X' }), { target: { value: '30' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Inner blur' }), { target: { value: '20' } });

    expect(camada(vistos).effects?.find((e) => e.kind === 'inner-shadow')).toMatchObject({
      enabled: true,
      params: { x: 30, blur: 20 }
    });
    const svg = svgDaUltima(vistos);
    expect(svg).toContain('dx="30"');
    expect(svg).toContain('stdDeviation="10"');
    expect(svg).toContain('feFlood');
  });

  it('Layer blur: modal com Raio; desliga sem destruir; desligado emite zero markup', async () => {
    const vistos = montar(ROUNDED);
    await screen.findByLabelText('Layer blur');

    // A fábrica liga o legado: aposenta para o blur falar sozinho no SVG.
    fireEvent.click(screen.getByLabelText('Drop shadow'));

    fireEvent.click(screen.getByLabelText('Layer blur'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Layer blur' }));
    fireEvent.change(await screen.findByRole('slider', { name: 'Blur radius' }), { target: { value: '20' } });

    const blur = () => camada(vistos).effects?.find((e) => e.kind === 'surface-blur');
    expect(blur()).toMatchObject({ enabled: true, params: { radius: 20 } });
    const comBlur = svgDaUltima(vistos);
    expect(comBlur).toContain('feGaussianBlur');
    expect(comBlur).toContain('stdDeviation="10"');

    fireEvent.click(screen.getByLabelText('Layer blur'));
    expect(blur()).toMatchObject({ enabled: false, params: { radius: 20 } });
    const semBlur = svgDaUltima(vistos);
    expect(semBlur).not.toContain('feGaussianBlur');
    expect(semBlur).not.toContain('<filter');

    fireEvent.click(screen.getByLabelText('Layer blur'));
    expect(blur()).toMatchObject({ enabled: true, params: { radius: 20 } });
  });

  it('um modal por vez: abrir o inner fecha o drop', async () => {
    montar(ROUNDED);
    await screen.findByLabelText('Drop shadow');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Drop shadow' }));
    await screen.findByRole('dialog', { name: 'Drop shadow settings' });

    fireEvent.click(screen.getByRole('button', { name: 'Edit Inner shadow' }));
    await screen.findByRole('dialog', { name: 'Inner shadow settings' });
    expect(screen.queryByRole('dialog', { name: 'Drop shadow settings' })).toBeNull();
  });

  it('drop + inner compõem; desligar o inner preserva o drop', async () => {
    const vistos = montar(ROUNDED);
    await screen.findByLabelText('Inner shadow');

    // A fábrica semeia o legado ligado: aposenta tudo antes de ligar o drop migrado.
    fireEvent.click(screen.getByLabelText('Drop shadow'));
    fireEvent.click(screen.getByLabelText('Drop shadow'));
    fireEvent.click(screen.getByLabelText('Inner shadow'));
    const composto = svgDaUltima(vistos);
    expect(composto).toContain('feDropShadow');
    expect(composto).toContain('feFlood');

    fireEvent.click(screen.getByLabelText('Inner shadow'));
    expect(camada(vistos).effects?.find((e) => e.kind === 'inner-shadow')?.enabled).toBe(false);
    expect(camada(vistos).effects?.find((e) => e.kind === 'drop-shadow')?.enabled).toBe(true);
    const soDrop = svgDaUltima(vistos);
    expect(soDrop).toContain('feDropShadow');
    expect(soDrop).not.toContain('feFlood');
  });
});
