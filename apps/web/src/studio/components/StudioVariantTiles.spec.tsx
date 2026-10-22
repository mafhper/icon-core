import { cleanup, render } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { IconCoreProject } from '@iconcore/shared';
import { ComposerProvider, useComposer } from '../../composer/ComposerContext';
import { ToastProvider } from '../../composer/toast/ToastContext';
import { createBlankProject } from '../../composer/utils/projectFactory';
import { StudioVariantTiles } from './StudioVariantTiles';

/**
 * O tile de variante é um thumbnail do **arquivo**, não um quadrado com raio
 * fixo de CSS: ele mostra o mesmo frame do canvas central — a forma do
 * documento e o raio que o export recorta — na escala do tile.
 *
 * Este spec trava a matemática em todas as formas. O valor esperado vem da
 * conta à mão sobre o lado do canvas (512) e o lado do tile (49px, o
 * `.studio-tile img` do `studio.css`):
 *
 *   raioDoTile = raioDoCanvas / 512 * 49
 *
 * O valor medido é a moldura vazia (`.studio-tile-empty`), porque o jsdom não
 * tem canvas: com o projeto sem layers o preview devolve `null` e é a moldura
 * que aparece. A moldura e o bitmap recebem o **mesmo** valor calculado — a
 * prova do bitmap (blob recortado no pipeline) e do CSS computado é de browser
 * real (Playwright), fora desta suíte.
 */

const SIZE = 512;

const SeededTiles = ({ project }: { project: IconCoreProject }) => {
  const { dispatch } = useComposer();
  useEffect(() => {
    dispatch({ type: 'LOAD_PROJECT', payload: { project, view: 'edit-space' } });
  }, [dispatch, project]);
  return <StudioVariantTiles />;
};

const renderTiles = (project: IconCoreProject) => {
  const { container } = render(
    <ToastProvider>
      <ComposerProvider>
        <SeededTiles project={project} />
      </ComposerProvider>
    </ToastProvider>
  );
  const radii = Array.from(container.querySelectorAll<HTMLElement>('.studio-tile-empty')).map(
    (el) => parseFloat(el.style.borderRadius)
  );
  return radii;
};

afterEach(cleanup);

describe('StudioVariantTiles — o frame do tile', () => {
  it('segue a forma declarada no documento (circle), não o default da barra', () => {
    const project = createBlankProject('Circle', SIZE);
    project.canvas.maskShape = 'circle';
    // (512 / 2) / 512 * 49 = metade do tile.
    expect(renderTiles(project)).toEqual([24.5, 24.5, 24.5, 24.5]);
  });

  it('documento sem forma cai no default do estado: rounded-rectangle', () => {
    // 24 / 512 * 49 = 2.296875.
    expect(renderTiles(createBlankProject('Default', SIZE))).toEqual([
      2.296875,
      2.296875,
      2.296875,
      2.296875
    ]);
  });

  it('square fica quase reto, squircle com o superelipse do iOS', () => {
    const square = createBlankProject('Square', SIZE);
    square.canvas.maskShape = 'square';
    // 4 / 512 * 49 = 0.3828125.
    expect(renderTiles(square)).toEqual([0.3828125, 0.3828125, 0.3828125, 0.3828125]);

    const squircle = createBlankProject('Squircle', SIZE);
    squircle.canvas.maskShape = 'squircle';
    // 0.2237 (o valor que a keyline desenha) * 49, com folga de ponto flutuante.
    for (const raio of renderTiles(squircle)) {
      expect(raio).toBeCloseTo(10.9613, 6);
    }
  });

  it('raio fixado no documento ganha da forma e escala igual', () => {
    const project = createBlankProject('Pinado', SIZE);
    project.canvas.maskShape = 'circle';
    project.canvas.maskRadius = 100;
    // 100 / 512 * 49 = 9.5703125 — o pin vence o default da forma.
    expect(renderTiles(project)).toEqual([9.5703125, 9.5703125, 9.5703125, 9.5703125]);
  });
});
