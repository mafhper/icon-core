import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearReleaseCache,
  isSignatureAsset,
  loadLatestRelease,
  loadReleases,
  pickAssetByExtensions,
  pickAssetByHints,
  RELEASES_TTL_MS,
  ReleaseFetchError,
  type FetchLike,
  type ReleaseAsset,
} from './releases';
const REPO = 'mafhper/icon-core';
const LATEST_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const LIST_URL = `https://api.github.com/repos/${REPO}/releases?per_page=4`;

const asset = (name: string, url = `https://example.test/${name}`): ReleaseAsset => ({
  name,
  browser_download_url: url,
});

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

/** Records the URL/headers the loader used and answers with a fixed payload. */
function fetcher(payload: unknown, init: { ok?: boolean; status?: number } = {}) {
  const calls: Array<{ url: string; headers?: Record<string, string> }> = [];
  const fetchImpl: FetchLike = async (url, options) => {
    calls.push({ url, headers: options?.headers });
    return respond(payload, init);
  };
  return { fetchImpl, calls };
}

const LATEST_PAYLOAD = {
  html_url: 'https://github.com/mafhper/icon-core/releases/tag/v1.7.0',
  tag_name: 'v1.7.0',
  name: 'IconCore v1.7.0',
  assets: [
    asset('IconCore_1.7.0_x64-setup.exe', 'https://example.test/iconcore.exe'),
    asset('IconCore_1.7.0_x64_en-US.msi', 'https://example.test/iconcore.msi'),
    asset('IconCore_1.7.0_x64.dmg', 'https://example.test/iconcore.dmg'),
    asset('IconCore_1.7.0_amd64.AppImage', 'https://example.test/iconcore.appimage'),
    asset('IconCore_1.7.0_amd64.deb', 'https://example.test/iconcore.deb'),
    asset('IconCore_1.7.0_x64_en-US.msi.sha256', 'https://example.test/iconcore.msi.sha256'),
  ],
} as const;

beforeEach(() => {
  clearReleaseCache();
});

describe('asset picking', () => {
  it('flags every signature wrapper so no one downloads a checksum by accident', () => {
    for (const name of ['app.zip.sig', 'app.zip.sigstore', 'app.zip.sha256', 'app.zip.sha256sum', 'latest.json']) {
      expect(isSignatureAsset(name), name).toBe(true);
    }
    expect(isSignatureAsset('IconCore_1.7.0_x64_en-US.msi')).toBe(false);
    expect(isSignatureAsset('IconCore_1.7.0_x64.dmg')).toBe(false);
  });

  it('prefers the first extension in the list, not the first asset', () => {
    const assets = [
      asset('app-setup.exe'),
      asset('app-installer.msi'),
      asset('app-installer.msi.sha256'),
    ];

    expect(pickAssetByExtensions(assets, ['.msi', '.exe'])).toBe('https://example.test/app-installer.msi');
    expect(pickAssetByExtensions([asset('app-setup.exe')], ['.msi', '.exe'])).toBe(
      'https://example.test/app-setup.exe'
    );
    expect(pickAssetByExtensions([asset('app.msi.sha256')], ['.msi'])).toBeNull();
  });

  it('falls back to a name hint when no extension matches, ignoring case', () => {
    const assets = [asset('IconCore_windows_x64.zip')];

    expect(pickAssetByHints(assets, ['windows'])).toBe('https://example.test/IconCore_windows_x64.zip');
    expect(pickAssetByHints(assets, ['macos'])).toBeNull();
  });
});

describe('loadLatestRelease', () => {
  it('maps the GitHub payload to one link per desktop system', async () => {
    const { fetchImpl, calls } = fetcher(LATEST_PAYLOAD);

    const release = await loadLatestRelease(REPO, { fetchImpl });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(LATEST_URL);
    expect(calls[0]?.headers).toEqual({ Accept: 'application/vnd.github+json' });
    expect(release.links).toEqual({
      windows: 'https://example.test/iconcore.msi',
      macos: 'https://example.test/iconcore.dmg',
      linux: 'https://example.test/iconcore.appimage',
    });
    expect(release.releaseUrl).toBe('https://github.com/mafhper/icon-core/releases/tag/v1.7.0');
    expect(release.versionLabel).toBe('Icon Core v1.7.0');
  });

  it('falls back to the releases page when the payload has no assets', async () => {
    const { fetchImpl } = fetcher({});

    const release = await loadLatestRelease(REPO, { fetchImpl });

    expect(release.links).toEqual({ windows: null, macos: null, linux: null });
    expect(release.releaseUrl).toBe(`https://github.com/${REPO}/releases/latest`);
    expect(release.versionLabel).toBe('Última versão');
  });

  it('tells a rate limit apart from a failed request', async () => {
    const rateLimited = fetcher({}, { ok: false, status: 403 });
    const broken = fetcher({}, { ok: false, status: 500 });

    await expect(loadLatestRelease(REPO, { fetchImpl: rateLimited.fetchImpl })).rejects.toMatchObject({
      name: 'ReleaseFetchError',
      reason: 'rate-limit',
    });
    await expect(loadLatestRelease(REPO, { fetchImpl: broken.fetchImpl })).rejects.toMatchObject({
      reason: 'network',
    });
    await expect(loadLatestRelease(REPO, { fetchImpl: broken.fetchImpl })).rejects.toBeInstanceOf(
      ReleaseFetchError
    );
  });

  it('keeps a successful answer fresh for ten minutes', async () => {
    const { fetchImpl, calls } = fetcher(LATEST_PAYLOAD);

    await loadLatestRelease(REPO, { fetchImpl, now: 0 });
    await loadLatestRelease(REPO, { fetchImpl, now: RELEASES_TTL_MS - 1 });
    expect(calls).toHaveLength(1);

    await loadLatestRelease(REPO, { fetchImpl, now: RELEASES_TTL_MS });
    expect(calls).toHaveLength(2);
  });

  it('does not cache a failure, so the next visit can retry', async () => {
    const broken = fetcher({}, { ok: false, status: 500 });

    await expect(loadLatestRelease(REPO, { fetchImpl: broken.fetchImpl })).rejects.toBeInstanceOf(
      ReleaseFetchError
    );

    const healthy = fetcher(LATEST_PAYLOAD);
    const release = await loadLatestRelease(REPO, { fetchImpl: healthy.fetchImpl });

    expect(release.versionLabel).toBe('Icon Core v1.7.0');
  });
});

describe('offline fallback', () => {
  const deadFetch: FetchLike = async () => {
    throw new TypeError('Failed to fetch');
  };

  it('reports a disconnected browser as offline, not as a generic network failure', async () => {
    await expect(loadLatestRelease(REPO, { fetchImpl: deadFetch, isOnline: false })).rejects.toMatchObject({
      name: 'ReleaseFetchError',
      reason: 'offline',
    });
  });

  it('reads the connection from a probe when the caller passes one', async () => {
    const probe = vi.fn(() => false);

    await expect(loadLatestRelease(REPO, { fetchImpl: deadFetch, isOnline: probe })).rejects.toMatchObject({
      reason: 'offline',
    });
    expect(probe).toHaveBeenCalled();
  });

  it('keeps the generic reason when the browser believes it is connected', async () => {
    await expect(loadLatestRelease(REPO, { fetchImpl: deadFetch, isOnline: true })).rejects.toMatchObject({
      reason: 'network',
    });
  });

  it('calls an unreadable body a network failure even on a disconnected browser', async () => {
    const malformed: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    });

    await expect(loadLatestRelease(REPO, { fetchImpl: malformed, isOnline: false })).rejects.toMatchObject({
      name: 'ReleaseFetchError',
      reason: 'network',
    });
  });

  it('serves the answer already in the ten-minute window when the network disappears', async () => {
    const online = fetcher(LATEST_PAYLOAD);
    await loadLatestRelease(REPO, { fetchImpl: online.fetchImpl, now: 0 });

    const second = await loadLatestRelease(REPO, {
      fetchImpl: deadFetch,
      isOnline: false,
      now: RELEASES_TTL_MS - 1,
    });

    expect(second.versionLabel).toBe('Icon Core v1.7.0');
    expect(second.links.windows).toBe('https://example.test/iconcore.msi');
  });
});

describe('loadReleases', () => {
  const LIST_PAYLOAD = [
    { id: 2, tag_name: 'v1.7.0', name: 'IconCore v1.7.0', published_at: '2026-10-06T12:00:00Z', html_url: 'https://example.test/v1.7.0' },
    { id: 1, tag_name: 'v1.6.0', name: null, published_at: '2026-09-26T12:00:00Z', html_url: 'https://example.test/v1.6.0' },
    { id: 'not-a-release' },
  ];

  it('asks for the four latest releases and discards malformed entries', async () => {
    const { fetchImpl, calls } = fetcher(LIST_PAYLOAD);

    const releases = await loadReleases(REPO, { fetchImpl });

    expect(calls[0]?.url).toBe(LIST_URL);
    expect(releases).toEqual([
      { id: 2, tag: 'v1.7.0', name: 'Icon Core v1.7.0', publishedAt: '2026-10-06T12:00:00Z', url: 'https://example.test/v1.7.0' },
      { id: 1, tag: 'v1.6.0', name: null, publishedAt: '2026-09-26T12:00:00Z', url: 'https://example.test/v1.6.0' },
    ]);
  });

  it('shares the manual stale window with the latest-release call', async () => {
    const latest = fetcher(LATEST_PAYLOAD);
    const list = fetcher(LIST_PAYLOAD);

    await loadLatestRelease(REPO, { fetchImpl: latest.fetchImpl, now: 0 });
    await loadReleases(REPO, { fetchImpl: list.fetchImpl, now: 10 });
    await loadReleases(REPO, { fetchImpl: list.fetchImpl, now: 20 });

    expect(list.calls).toHaveLength(1);
  });

  it('rejects instead of pretending an empty list when GitHub answers garbage', async () => {
    const { fetchImpl } = fetcher({ message: 'Not Found' });

    await expect(loadReleases(REPO, { fetchImpl })).rejects.toBeInstanceOf(ReleaseFetchError);
  });
});
