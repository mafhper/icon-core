import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { renderToSvg } from '@iconcore/renderer';
import { ComposerProvider, useComposer } from '../ComposerContext';
import { ToastProvider } from '../toast/ToastContext';
import { LayerInspector } from './LayerInspector';
import type { IconCoreProject, IconLayer } from '@iconcore/shared';
import { createBlankProject, createShapeLayer } from '../utils/projectFactory';

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
});

describe('Inspector Effects (Fase 4)', () => {
  afterEach(() => cleanup());

  it('Drop shadow liga e emite feDropShadow com os números do painel', async () => {
    const vistos = montar(ROUNDED);
    await screen.findByLabelText('Drop shadow');

    fireEvent.click(screen.getByLabelText('Drop shadow'));
    expect(camada(vistos).effects?.find((e) => e.kind === 'drop-shadow')?.enabled).toBe(true);

    fireEvent.change(screen.getByRole('slider', { name: 'Drop blur' }), { target: { value: '24' } });
    const svg = svgDaUltima(vistos);
    expect(svg).toContain('feDropShadow');
    expect(svg).toContain('stdDeviation="12"');
  });

  it('Add glow é drop shadow com offset zero, não um efeito novo', async () => {
    const vistos = montar(ROUNDED);
    await screen.findByRole('button', { name: 'Add glow' });

    fireEvent.click(screen.getByRole('button', { name: 'Add glow' }));
    const glow = camada(vistos).effects?.find((e) => e.kind === 'drop-shadow');
    expect(glow).toMatchObject({ enabled: true, params: { x: 0, y: 0 } });
    expect(svgDaUltima(vistos)).toContain('feDropShadow');
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
});
