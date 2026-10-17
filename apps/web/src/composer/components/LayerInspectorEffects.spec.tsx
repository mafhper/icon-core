import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { renderToSvg } from '@iconcore/renderer';
import type { IconCoreProject, IconLayer } from '@iconcore/shared';
import { LayerInspectorEffects } from './LayerInspectorEffects';
import type { ScopedLayerChanges } from '../utils/layerEdit';

/**
 * Tier 2 (2.0) — spread nos modais Tier 1 + paridade modal ↔ sidebar.
 *
 * "Sidebar" aqui é a fileira do inspector (o `Switch` + botão de edição) e
 * "modal" é o `Popover` que ela abre: os dois leem e escrevem o mesmo estado
 * da camada. Cada teste trava a ida-e-volta por valor absoluto —
 * controle → estado → markup exportado — nunca "os dois concordam":
 *
 * - o modal abre mostrando o valor que a sidebar tem (legado sem spread: 0);
 * - mexer no slider do modal escreve no estado que a fileira lê (o switch
 *   continua ON — editar confirma, não desliga);
 * - o número chega ao SVG (`feMorphology`), que é a prova de que o controle age;
 * - o contrato Popover (Esc, um por vez, clique fora — incluindo o canvas —
 *   fecha) vale para os controles novos sem reedição do primitivo.
 */

const camadaBase = (effects: IconLayer['effects'] = []): IconLayer => ({
  id: 'ls',
  name: 'shape',
  kind: 'shape',
  visible: true,
  zIndex: 0,
  source: { type: 'reference', path: '', shape: { kind: 'rounded-rectangle', width: 176, height: 176, cornerRadius: 32 } },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  fill: { kind: 'solid', color: '#1565c0' },
  effects
});

const montar = (inicial: IconLayer) => {
  const vistas: IconLayer[] = [];
  let commits = 0;
  const Invólucro = () => {
    const [camada, setCamada] = useState(inicial);
    vistas.push(camada);
    const updateLayer = (changes: ScopedLayerChanges) =>
      setCamada((anterior) => ({ ...anterior, ...changes }));
    return (
      <LayerInspectorEffects
        layer={camada}
        updateLayer={updateLayer}
        commit={() => {
          commits += 1;
        }}
      />
    );
  };
  render(<Invólucro />);
  return { vistas, commits: () => commits };
};

const ultima = (vistas: IconLayer[]): IconLayer => vistas.at(-1)!;

const svgDa = (camada: IconLayer): string =>
  renderToSvg(
    {
      schemaVersion: 3,
      metadata: { name: 'p', shortName: 'p' },
      canvas: { size: 256, background: { kind: 'solid', color: '#ffffff' } },
      layers: [camada],
      variants: { default: {} },
      targets: [],
      exportProfile: { outputBaseName: 'p', quality: 0.95, generateReport: false }
    } as IconCoreProject,
    'default'
  );

describe('Effects — spread (2.0) e paridade modal ↔ sidebar', () => {
  afterEach(() => cleanup());

  it('modal Drop abre no valor da sidebar: legado sem spread mostra 0', () => {
    montar(
      camadaBase([
        { kind: 'depth-shadow', enabled: true, params: { x: 0, y: 18, blur: 34, color: 'rgba(15, 23, 42, 0.28)' } }
      ])
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Drop shadow' }));
    expect(screen.getByRole('slider', { name: 'Drop spread' })).toHaveValue('0');
  });

  it('slider de spread do modal escreve na sidebar e chega ao SVG', () => {
    const { vistas } = montar(camadaBase());
    // A fileira lê "pinta sombra?": sem efeito, OFF.
    expect(screen.getByRole('switch', { name: 'Drop shadow' })).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Drop shadow' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Drop spread' }), { target: { value: '12' } });

    // Paridade modal → sidebar: o estado que a fileira lê tem o número e ON
    // (editar materializa ligado; o switch continua sendo a saída).
    const camada = ultima(vistas);
    expect(camada.effects?.find((e) => e.kind === 'drop-shadow')).toMatchObject({
      enabled: true,
      params: { spread: 12 }
    });
    expect(screen.getByRole('switch', { name: 'Drop shadow' })).toBeChecked();
    // O controle age: o número está no markup exportado.
    expect(svgDa(camada)).toContain('operator="dilate" radius="12"');
  });

  it('modal Inner mostra o spread da sidebar e o slider negativo erode no SVG', () => {
    const { vistas } = montar(
      camadaBase([
        { kind: 'inner-shadow', enabled: true, params: { x: 0, y: 6, blur: 12, spread: -6, color: '#000000', opacity: 0.35 } }
      ])
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Inner shadow' }));
    expect(screen.getByRole('slider', { name: 'Inner spread' })).toHaveValue('-6');

    fireEvent.change(screen.getByRole('slider', { name: 'Inner spread' }), { target: { value: '-10' } });
    const camada = ultima(vistas);
    expect(camada.effects?.find((e) => e.kind === 'inner-shadow')?.params.spread).toBe(-10);
    expect(screen.getByRole('switch', { name: 'Inner shadow' })).toBeChecked();
    // Negativo na sombra interna dilata o projetor (sinal invertido — ver o
    // spec de markup): a sombra recua para dentro.
    expect(svgDa(camada)).toContain('operator="dilate" radius="10"');
  });

  it('um modal por vez: abrir o Inner fecha o Drop', () => {
    montar(camadaBase());
    fireEvent.click(screen.getByRole('button', { name: 'Edit Drop shadow' }));
    expect(screen.getByRole('slider', { name: 'Drop spread' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Inner shadow' }));
    expect(screen.queryByRole('slider', { name: 'Drop spread' })).toBeNull();
    expect(screen.getByRole('slider', { name: 'Inner spread' })).toBeInTheDocument();
  });

  it('Escape fecha o modal de efeito', () => {
    montar(camadaBase());
    fireEvent.click(screen.getByRole('button', { name: 'Edit Drop shadow' }));
    expect(screen.getByRole('slider', { name: 'Drop spread' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('slider', { name: 'Drop spread' })).toBeNull();
  });

  it('clique fora — incluindo o canvas — fecha o modal de efeito', () => {
    montar(camadaBase());
    fireEvent.click(screen.getByRole('button', { name: 'Edit Drop shadow' }));
    expect(screen.getByRole('slider', { name: 'Drop spread' })).toBeInTheDocument();

    // O Popover dispensa em `mousedown` no documento; o canvas não engole o
    // evento (só `pointerdown`/`click` param por lá), então o clique no canvas
    // chega ao documento e fecha — travado aqui, não lido no código.
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('slider', { name: 'Drop spread' })).toBeNull();
  });
});

describe('Effects — background blur (2.1) e paridade modal ↔ sidebar', () => {
  afterEach(() => cleanup());

  it('modal abre no valor da sidebar e o slider escreve de volta ligado', () => {
    const { vistas } = montar(camadaBase());
    expect(screen.getByRole('switch', { name: 'Background blur' })).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Background blur' }));
    // Sem entrada: o default que age.
    expect(screen.getByRole('slider', { name: 'Background radius' })).toHaveValue('12');

    fireEvent.change(screen.getByRole('slider', { name: 'Background radius' }), { target: { value: '20' } });
    const camada = ultima(vistas);
    expect(camada.effects?.find((e) => e.kind === 'backdrop-blur')).toMatchObject({
      enabled: true,
      params: { radius: 20 }
    });
    expect(screen.getByRole('switch', { name: 'Background blur' })).toBeChecked();
    // O controle age: a pilha-abaixo re-emitida está no markup.
    const svg = svgDa(camada);
    expect(svg).toContain('backdrop-blur-');
    expect(svg).toContain('<feGaussianBlur stdDeviation="20"/>');
  });

  it('raio zero na sidebar lê OFF: nas duas pipelines, zero é desligado', () => {
    const { vistas } = montar(
      camadaBase([{ kind: 'backdrop-blur', enabled: true, params: { radius: 0 } }])
    );
    expect(screen.getByRole('switch', { name: 'Background blur' })).not.toBeChecked();
    expect(svgDa(ultima(vistas))).not.toContain('backdrop');
  });
});

describe('Effects — glass v1 (2.2) e paridade modal ↔ sidebar', () => {
  afterEach(() => cleanup());

  it('modal abre nos defaults e cada controle escreve no estado que a fileira lê', () => {
    const { vistas } = montar(camadaBase());
    expect(screen.getByRole('switch', { name: 'Glass' })).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Glass' }));
    expect(screen.getByRole('slider', { name: 'Glass blur' })).toHaveValue('14');
    expect(screen.getByRole('slider', { name: 'Edge light' })).toHaveValue('60');
    expect(screen.getByRole('slider', { name: 'Frost' })).toHaveValue('25');

    fireEvent.change(screen.getByRole('slider', { name: 'Glass blur' }), { target: { value: '20' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Frost' }), { target: { value: '50' } });
    const camada = ultima(vistas);
    expect(camada.effects?.find((e) => e.kind === 'glass')).toMatchObject({
      enabled: true,
      params: { blurRadius: 20, frost: 0.5 }
    });
    expect(screen.getByRole('switch', { name: 'Glass' })).toBeChecked();
    // O controle age: as coats estão no markup exportado.
    const svg = svgDa(camada);
    expect(svg).toContain('<feGaussianBlur stdDeviation="20"/>');
    expect(svg).toContain('feTurbulence');
  });

  it('tudo zerado na sidebar lê OFF e emite markup zero', () => {
    const { vistas } = montar(
      camadaBase([
        {
          kind: 'glass',
          enabled: true,
          params: { tint: '#ffffff', tintOpacity: 0, blurRadius: 0, edgeHighlight: 0, frost: 0 }
        }
      ])
    );
    expect(screen.getByRole('switch', { name: 'Glass' })).not.toBeChecked();
    expect(svgDa(ultima(vistas))).not.toContain('glass');
  });
});

describe('Effects — noise (2.3) e paridade modal ↔ sidebar', () => {
  afterEach(() => cleanup());

  it('modal abre nos defaults e cada controle escreve no estado que a fileira lê', () => {
    const { vistas } = montar(camadaBase());
    expect(screen.getByRole('switch', { name: 'Noise' })).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Noise' }));
    expect(screen.getByRole('slider', { name: 'Noise amount' })).toHaveValue('30');
    expect(screen.getByRole('slider', { name: 'Grain size' })).toHaveValue('2');

    fireEvent.change(screen.getByRole('slider', { name: 'Noise amount' }), { target: { value: '70' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Grain size' }), { target: { value: '4' } });
    const camada = ultima(vistas);
    expect(camada.effects?.find((e) => e.kind === 'noise-grain')).toMatchObject({
      enabled: true,
      params: { amount: 0.7, size: 4 }
    });
    expect(screen.getByRole('switch', { name: 'Noise' })).toBeChecked();
    // O controle age: a turbulência está no markup exportado.
    const svg = svgDa(camada);
    expect(svg).toContain('feTurbulence');
    expect(svg).toContain('baseFrequency="0.225"');
  });

  it('amount zero na sidebar lê OFF e emite markup zero', () => {
    const { vistas } = montar(
      camadaBase([{ kind: 'noise-grain', enabled: true, params: { amount: 0, size: 2, monochrome: true } }])
    );
    expect(screen.getByRole('switch', { name: 'Noise' })).not.toBeChecked();
    const svg = svgDa(ultima(vistas));
    expect(svg).not.toContain('noise');
    expect(svg).not.toContain('feTurbulence');
  });
});

describe('Effects — bloom (Tier 3) e paridade modal ↔ sidebar', () => {
  afterEach(() => cleanup());

  it('modal abre nos defaults e cada controle escreve no estado que a fileira lê', () => {
    const { vistas } = montar(camadaBase());
    expect(screen.getByRole('switch', { name: 'Bloom' })).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Bloom' }));
    expect(screen.getByRole('slider', { name: 'Bloom blur' })).toHaveValue('18');
    expect(screen.getByRole('slider', { name: 'Bloom intensity' })).toHaveValue('2');

    fireEvent.change(screen.getByRole('slider', { name: 'Bloom blur' }), { target: { value: '24' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Bloom intensity' }), { target: { value: '3' } });
    const camada = ultima(vistas);
    expect(camada.effects?.find((e) => e.kind === 'bloom')).toMatchObject({
      enabled: true,
      params: { blur: 24, intensity: 3 }
    });
    expect(screen.getByRole('switch', { name: 'Bloom' })).toBeChecked();
    // O controle age: os coats estão no markup exportado.
    const svg = svgDa(camada);
    expect(svg.match(/<feDropShadow[^>]*stdDeviation="12"[^>]*>/g)).toHaveLength(3);
  });

  it('o switch liga nos defaults e desliga preservando os params', () => {
    const { vistas } = montar(camadaBase());
    fireEvent.click(screen.getByRole('switch', { name: 'Bloom' }));
    expect(ultima(vistas).effects?.find((e) => e.kind === 'bloom')).toMatchObject({
      enabled: true,
      params: { blur: 18, intensity: 2 }
    });
    expect(svgDa(ultima(vistas))).toContain('feDropShadow');

    fireEvent.click(screen.getByRole('switch', { name: 'Bloom' }));
    expect(ultima(vistas).effects?.find((e) => e.kind === 'bloom')).toMatchObject({
      enabled: false,
      params: { blur: 18, intensity: 2 }
    });
    expect(svgDa(ultima(vistas))).not.toContain('feDropShadow');
  });

  it('blur zero na sidebar lê OFF e emite markup zero', () => {
    const { vistas } = montar(
      camadaBase([{ kind: 'bloom', enabled: true, params: { color: '#66aaff', opacity: 0.9, blur: 0, intensity: 2 } }])
    );
    expect(screen.getByRole('switch', { name: 'Bloom' })).not.toBeChecked();
    expect(svgDa(ultima(vistas))).not.toContain('feDropShadow');
  });

  it('um modal por vez: abrir o bloom fecha o glow', async () => {
    montar(camadaBase());

    fireEvent.click(screen.getByRole('button', { name: 'Edit Glow' }));
    await screen.findByRole('dialog', { name: 'Glow settings' });

    fireEvent.click(screen.getByRole('button', { name: 'Edit Bloom' }));
    await screen.findByRole('dialog', { name: 'Bloom settings' });
    expect(screen.queryByRole('dialog', { name: 'Glow settings' })).toBeNull();
  });

  it('Esc confirma o arrasto em vez de perder: o blur sobrevive', async () => {
    const { vistas } = montar(camadaBase());

    fireEvent.click(screen.getByRole('button', { name: 'Edit Bloom' }));
    fireEvent.change(await screen.findByRole('slider', { name: 'Bloom blur' }), { target: { value: '30' } });
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(ultima(vistas).effects?.find((e) => e.kind === 'bloom')).toMatchObject({
      enabled: true,
      params: { blur: 30 }
    });
    expect(svgDa(ultima(vistas))).toContain('stdDeviation="15"');
  });
});
