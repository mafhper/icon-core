// @vitest-environment node
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { Footer } from './components/icon-core/Footer';
import { Header } from './components/icon-core/Header';
import { Hero } from './components/icon-core/Hero';
import { Platforms } from './components/icon-core/Platforms';
import { StudioProvider } from './components/icon-core/studio-context';
import { PromoApp } from './promoApp';

/**
 * The sections are also the page's server-rendered shell, so these tests render them the
 * way a static build does: no DOM, no effects, no pointer. Anchors, copy and the absence of
 * dev-only strings are the contract the section port has to keep.
 */

const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

const withStudio = (child: ReactElement) =>
  renderToStaticMarkup(createElement(StudioProvider, null, child));

beforeAll(() => {
  // One fixed visitor for the whole file: the download label and the menu depend on it.
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    platform: 'Win32',
    maxTouchPoints: 0,
  });
});

describe('promo page anchors', () => {
  it('gives every new and legacy anchor exactly one target', () => {
    const page = renderToStaticMarkup(createElement(PromoApp));
    const ids = [
      'top',
      'plataformas',
      'interface',
      'baixar',
      'workflows',
      'edit-space',
      'export-utilities',
      'desktop',
      'community',
    ];

    for (const id of ids) {
      expect(occurrences(page, `id="${id}"`), `#${id} should appear once`).toBe(1);
    }
  });

  it('has no in-page link pointing at a missing target', () => {
    const page = renderToStaticMarkup(createElement(PromoApp));
    const targets = [...page.matchAll(/href="#([^"]+)"/g)].map((match) => match[1] ?? '');

    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      expect(page, `#${target} has no element with that id`).toContain(`id="${target}"`);
    }
  });
});

describe('promo sections', () => {
  it('renders each section on its own without a DOM', () => {
    expect(withStudio(createElement(Header))).toContain('Plataformas');
    expect(withStudio(createElement(Hero))).toContain('Todas as telas.');
    expect(withStudio(createElement(Platforms))).toContain('O mesmo ícone em todo lugar.');
    expect(withStudio(createElement(Footer))).toContain('Código aberto');
  });

  it('carries the pt-BR copy of the ported sections', () => {
    const page = renderToStaticMarkup(createElement(PromoApp));
    const copy = [
      'Um ícone.',
      'Todas as telas.',
      'Exporte uma vez',
      'O mesmo ícone em todo lugar.',
      'Um editor de ícones de verdade',
      'Camadas de assets',
      'Versão web',
      'App desktop',
      'Separar camadas',
      'Raio da moldura',
      'Baixar para Windows',
      'Abrir no navegador',
      'Código aberto',
      'Licença MIT',
      'Voltar ao topo',
    ];

    for (const text of copy) expect(page, text).toContain(text);
  });

  it('does not ship dev-only strings', () => {
    const page = renderToStaticMarkup(createElement(PromoApp));

    expect(page).not.toContain('.dev');
    expect(page).not.toContain('node_modules');
  });

  it('replaces the v1 hero instead of stacking a second one', () => {
    const page = renderToStaticMarkup(createElement(PromoApp));

    expect(page).not.toContain('Create, refine, and export every icon your app needs.');
    expect(page).not.toContain('promo-nav');
  });
});

describe('download fallback without a user agent', () => {
  it('offers the neutral label when navigator is missing', () => {
    vi.stubGlobal('navigator', undefined);

    const header = withStudio(createElement(Header));
    expect(header).toContain('Baixar app');
    expect(header).not.toContain('Baixar para');
  });
});
