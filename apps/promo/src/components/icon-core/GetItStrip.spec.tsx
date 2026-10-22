// @vitest-environment jsdom
import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearReleaseCache } from '../../lib/releases';
import { click, mount, settle } from '../../ui/testing/mount';
import { GetItStrip } from './GetItStrip';

const REPO = 'mafhper/icon-core';
const LATEST_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const LIST_URL = `https://api.github.com/repos/${REPO}/releases?per_page=4`;
const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;

interface FakeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

const respond = (payload: unknown, init: { ok?: boolean; status?: number } = {}): FakeResponse => ({
  ok: init.ok ?? true,
  status: init.status ?? 200,
  json: async () => payload,
});

const asset = (name: string, url = `https://example.test/${name}`) => ({
  name,
  browser_download_url: url,
});

const LATEST_PAYLOAD = {
  html_url: 'https://github.com/mafhper/icon-core/releases/tag/v1.7.0',
  tag_name: 'v1.7.0',
  name: 'IconCore v1.7.0',
  assets: [
    asset('IconCore_1.7.0_x64_en-US.msi', 'https://example.test/iconcore.msi'),
    asset('IconCore_1.7.0_x64.dmg', 'https://example.test/iconcore.dmg'),
    asset('IconCore_1.7.0_amd64.AppImage', 'https://example.test/iconcore.appimage'),
  ],
};

const LIST_PAYLOAD = [
  {
    id: 2,
    tag_name: 'v1.7.0',
    name: 'IconCore v1.7.0',
    published_at: '2026-10-06T12:00:00Z',
    html_url: 'https://example.test/v1.7.0',
  },
  {
    id: 1,
    tag_name: 'v1.6.0',
    name: null,
    published_at: '2026-09-26T12:00:00Z',
    html_url: 'https://example.test/v1.6.0',
  },
];

/** Answers the latest-release call and the list call from the same stub. */
function stubGitHub({
  latest = LATEST_PAYLOAD,
  list = LIST_PAYLOAD,
  latestStatus = 200
}: {
  latest?: unknown;
  list?: unknown;
  latestStatus?: number;
} = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes('/releases?')) return respond(list);
    return respond(latest, { ok: latestStatus === 200, status: latestStatus });
  });
  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

function renderStrip() {
  const onFrameChange = vi.fn();
  const ui = mount();
  const render = ui.render(createElement(GetItStrip, { frame: 'web', onFrameChange }));

  return { ui, onFrameChange, render };
}

const toggleIn = (container: HTMLElement): HTMLButtonElement =>
  container.querySelector('button[aria-expanded]') as HTMLButtonElement;

/**
 * React synthesises `onPointerEnter`/`onFocusCapture` from `pointerover`/`focusin`, so these
 * are the events a browser actually sends when the pointer or the tab key enters a side.
 */
const enter = (element: Element) =>
  act(async () => {
    element.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
  });

const focusIn = (element: Element) =>
  act(async () => {
    element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  });


beforeEach(() => {
  clearReleaseCache();
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    platform: 'Win32',
    maxTouchPoints: 0,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GetItStrip desktop downloads', () => {
  it('points the detected system at the installer asset from the latest release', async () => {
    const fetchMock = stubGitHub();
    const { ui, render } = renderStrip();

    await render;
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(LATEST_URL, { headers: { Accept: 'application/vnd.github+json' } });
    expect(ui.container.textContent).toContain('Baixar para Windows');
    expect(ui.container.textContent).toContain('Icon Core v1.7.0');

    const installer = ui.container.querySelector<HTMLAnchorElement>('a[href="https://example.test/iconcore.msi"]');
    expect(installer).not.toBeNull();
    expect(installer?.textContent).toContain('Baixar para Windows');

    // The other systems stay listed, and they point at the releases page.
    const labels = Array.from(ui.container.querySelectorAll('a')).map((anchor) => anchor.textContent);
    expect(labels.some((label) => label?.includes('macOS'))).toBe(true);
    expect(labels.some((label) => label?.includes('Linux'))).toBe(true);
  });

  it('falls back to the releases page when GitHub cannot be reached', async () => {
    stubGitHub({ latest: {}, latestStatus: 500 });
    const { ui, render } = renderStrip();

    await render;
    await settle();

    expect(ui.container.textContent).toContain('Não deu para consultar a última versão agora.');
    const fallback = ui.container.querySelector<HTMLAnchorElement>(`a[href="${RELEASES_URL}"]`);
    expect(fallback).not.toBeNull();
    expect(fallback?.textContent).toContain('Ver downloads no GitHub');
  });

  it('names the rate limit instead of reporting a generic failure', async () => {
    stubGitHub({ latest: {}, latestStatus: 403 });
    const { ui, render } = renderStrip();

    await render;
    await settle();

    expect(ui.container.textContent).toContain('O GitHub limitou as consultas agora.');
    expect(ui.container.textContent).not.toContain('Não deu para consultar a última versão agora.');
  });
});

describe('GetItStrip on a phone', () => {
  it('never points the desktop call to action at an installer', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
      platform: 'iPhone',
      maxTouchPoints: 5
    });
    stubGitHub();
    const { ui, render } = renderStrip();

    await render;
    await settle();

    // A phone cannot run the desktop app, so the release API result must not leak an .msi link.
    expect(ui.container.querySelector('a[href="https://example.test/iconcore.msi"]')).toBeNull();
    expect(ui.container.querySelector('a[href="https://example.test/iconcore.dmg"]')).toBeNull();

    const cta = ui.container.querySelector<HTMLAnchorElement>(`a[href="${RELEASES_URL}"]`);
    expect(cta).not.toBeNull();
    expect(cta?.textContent).toContain('Ver downloads para computador');
    expect(ui.container.textContent).not.toContain('.msi');
  });
});

describe('GetItStrip window frame', () => {
  it('wears the frame of the side the visitor points at or focuses', async () => {
    stubGitHub();
    const { ui, onFrameChange, render } = renderStrip();

    await render;
    await settle();

    const web = ui.container.querySelector('[data-testid="getit-side-web"]');
    const desktop = ui.container.querySelector('[data-testid="getit-side-desktop"]');
    expect(web).not.toBeNull();
    expect(desktop).not.toBeNull();

    await enter(desktop as Element);
    expect(onFrameChange).toHaveBeenLastCalledWith('desktop');

    // Tabbing into a control on the web side is the same signal as pointing at it.
    await focusIn(ui.container.querySelector('a[href="https://mafhper.github.io/icon-core/app/"]') as Element);
    expect(onFrameChange).toHaveBeenLastCalledWith('web');
  });
});

describe('GetItStrip offline', () => {
  const OFFLINE_NAVIGATOR = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    platform: 'Win32',
    maxTouchPoints: 0,
    onLine: false,
  };

  const deadFetch = () =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      })
    );

  it('names the missing connection and still links to the releases page', async () => {
    vi.stubGlobal('navigator', OFFLINE_NAVIGATOR);
    deadFetch();

    const { ui, render } = renderStrip();
    await render;
    await settle();

    expect(ui.container.textContent).toContain('Sem conexão com o GitHub agora.');
    const fallback = ui.container.querySelector<HTMLAnchorElement>(`a[href="${RELEASES_URL}"]`);
    expect(fallback).not.toBeNull();
    expect(fallback?.textContent).toContain('Ver downloads no GitHub');
  });

  it('keeps the retry when the release list is opened offline', async () => {
    vi.stubGlobal('navigator', OFFLINE_NAVIGATOR);
    deadFetch();

    const { ui, render } = renderStrip();
    await render;
    await settle();

    await click(toggleIn(ui.container));
    await settle();

    expect(ui.container.textContent).toContain('Sem conexão com o GitHub agora.');
    const retry = Array.from(ui.container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Tentar de novo')
    );
    expect(retry).toBeDefined();
  });
});

describe('GetItStrip release list', () => {
  it('loads the short list only when the visitor opens it', async () => {
    const fetchMock = stubGitHub();
    const { ui, render } = renderStrip();

    await render;
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await click(toggleIn(ui.container));
    expect(toggleIn(ui.container).getAttribute('aria-expanded')).toBe('true');
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(LIST_URL, { headers: { Accept: 'application/vnd.github+json' } });
    expect(ui.container.textContent).toContain('v1.7.0');
    expect(ui.container.textContent).toContain('Icon Core v1.7.0');
    expect(ui.container.querySelector('a[href="https://example.test/v1.6.0"]')?.textContent).toContain('v1.6.0');
  });

  it('offers a retry when the list call hits the rate limit', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(LATEST_PAYLOAD))
      .mockResolvedValueOnce(respond({}, { ok: false, status: 403 }))
      .mockResolvedValueOnce(respond(LIST_PAYLOAD));
    vi.stubGlobal('fetch', fetchMock);

    const { ui, render } = renderStrip();
    await render;
    await settle();

    await click(toggleIn(ui.container));
    await settle();
    expect(ui.container.textContent).toContain('O GitHub limitou as consultas agora.');

    const retry = Array.from(ui.container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Tentar de novo')
    );
    expect(retry).toBeDefined();
    await click(retry as HTMLButtonElement);
    await settle();

    expect(ui.container.textContent).toContain('v1.7.0');
  });
});
