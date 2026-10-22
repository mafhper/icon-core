/**
 * GitHub release plumbing for the promo site.
 *
 * The page needs two things from the same API: the installer for the detected system and a
 * short list of recent releases. It calls GitHub with the native `fetch` and keeps a small
 * manual cache — no query library — so a visitor that reopens the release list within the
 * ten-minute window does not spend a request against the unauthenticated rate limit.
 */

import type { DesktopOS } from './site-config';

/** Minimal response surface the loaders consume, so tests need no `Response` global. */
export interface ReleaseResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

export type FetchLike = (
  url: string,
  options?: { headers?: Record<string, string> }
) => Promise<ReleaseResponse>;

export type ReleaseFailureReason = 'rate-limit' | 'network';

export class ReleaseFetchError extends Error {
  readonly reason: ReleaseFailureReason;

  constructor(reason: ReleaseFailureReason) {
    super(reason === 'rate-limit' ? 'GitHub rate limit reached' : 'Could not read the GitHub release');
    this.name = 'ReleaseFetchError';
    this.reason = reason;
  }
}

export type ReleaseAsset = { name: string; browser_download_url: string };

export type DesktopLinks = Record<DesktopOS, string | null>;

export type LatestRelease = {
  releaseUrl: string;
  versionLabel: string;
  assets: ReleaseAsset[];
  links: DesktopLinks;
};

export type ReleaseSummary = {
  id: number;
  tag: string;
  name: string | null;
  publishedAt: string;
  url: string;
};

export type ReleaseLoaderOptions = {
  fetchImpl?: FetchLike;
  /** Clock injection for the cache; defaults to the wall clock. */
  now?: number;
};

/** GitHub's unauthenticated quota is small; ten minutes is the page's own stale window. */
export const RELEASES_TTL_MS = 10 * 60 * 1000;

const ACCEPT = 'application/vnd.github+json';

const EXTENSIONS: Record<DesktopOS, string[]> = {
  windows: ['.msi', '.exe'],
  macos: ['.dmg', '.pkg', '.app.tar.gz'],
  linux: ['.appimage', '.deb', '.rpm', '.tar.xz', '.tar.gz'],
};

const HINTS: Record<DesktopOS, string[]> = {
  windows: ['windows', 'win64', 'win32'],
  macos: ['macos', 'darwin', 'mac'],
  linux: ['linux'],
};

const cache = new Map<string, { expiresAt: number; value: unknown }>();

/** Drops the manual cache. Tests call it between cases; the page never needs to. */
export function clearReleaseCache(): void {
  cache.clear();
}

const defaultFetch: FetchLike = (url, options) => globalThis.fetch(url, options);

export function releasesPageFor(repo: string): string {
  return `https://github.com/${repo}/releases/latest`;
}

/** `IconCore` is the npm/package spelling; prose on the page uses `Icon Core`. */
function publicLabel(value: string): string {
  return value.replace(/\bIconCore\b/g, 'Icon Core');
}

export function isSignatureAsset(assetName: string): boolean {
  const lower = assetName.toLowerCase();
  return (
    lower.endsWith('.sig') ||
    lower.endsWith('.sigstore') ||
    lower.endsWith('.sha256') ||
    lower.endsWith('.sha256sum') ||
    lower.endsWith('.json')
  );
}

export function pickAssetByExtensions(assets: ReleaseAsset[], extensions: string[]): string | null {
  const usable = assets.filter((asset) => !isSignatureAsset(asset.name));
  for (const extension of extensions) {
    const match = usable.find((asset) => asset.name.toLowerCase().endsWith(extension.toLowerCase()));
    if (match) return match.browser_download_url;
  }
  return null;
}

export function pickAssetByHints(assets: ReleaseAsset[], hints: string[]): string | null {
  const usable = assets.filter((asset) => !isSignatureAsset(asset.name));
  return (
    usable.find((asset) => hints.some((hint) => asset.name.toLowerCase().includes(hint)))?.browser_download_url ??
    null
  );
}

/** One installer per desktop system, extension first and name hint as the fallback. */
export function pickDesktopLinks(assets: ReleaseAsset[]): DesktopLinks {
  const pick = (os: DesktopOS) =>
    pickAssetByExtensions(assets, EXTENSIONS[os]) ?? pickAssetByHints(assets, HINTS[os]);

  return { windows: pick('windows'), macos: pick('macos'), linux: pick('linux') };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const stringOf = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

function parseAssets(value: unknown): ReleaseAsset[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const name = stringOf(entry.name);
    const url = stringOf(entry.browser_download_url);
    return name && url ? [{ name, browser_download_url: url }] : [];
  });
}

function parseLatest(repo: string, payload: unknown): LatestRelease {
  if (!isRecord(payload)) throw new ReleaseFetchError('network');

  const assets = parseAssets(payload.assets);
  const name = stringOf(payload.name)?.trim() ?? '';
  const tag = stringOf(payload.tag_name)?.trim() ?? '';

  return {
    releaseUrl: stringOf(payload.html_url) ?? releasesPageFor(repo),
    versionLabel: publicLabel(name || tag || 'Última versão'),
    assets,
    links: pickDesktopLinks(assets),
  };
}

function parseReleases(payload: unknown): ReleaseSummary[] {
  if (!Array.isArray(payload)) throw new ReleaseFetchError('network');

  return payload.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const tag = stringOf(entry.tag_name);
    const url = stringOf(entry.html_url);
    const publishedAt = stringOf(entry.published_at);
    if (typeof entry.id !== 'number' || !tag || !url || !publishedAt) return [];

    const name = stringOf(entry.name);

    return [{ id: entry.id, tag, name: name ? publicLabel(name) : null, publishedAt, url }];
  });
}

function failureFor(status: number): ReleaseFailureReason {
  return status === 403 || status === 429 ? 'rate-limit' : 'network';
}

async function requestJson(
  url: string,
  fetchImpl: FetchLike
): Promise<unknown> {
  let response: ReleaseResponse;
  try {
    response = await fetchImpl(url, { headers: { Accept: ACCEPT } });
  } catch {
    throw new ReleaseFetchError('network');
  }

  if (!response.ok) throw new ReleaseFetchError(failureFor(response.status));

  try {
    return await response.json();
  } catch {
    throw new ReleaseFetchError('network');
  }
}

async function cached<T>(key: string, now: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && now < hit.expiresAt) return hit.value as T;

  const value = await load();
  cache.set(key, { expiresAt: now + RELEASES_TTL_MS, value });

  return value;
}

/** Latest published release plus the per-system links, served from the stale window when fresh. */
export function loadLatestRelease(
  repo: string,
  { fetchImpl = defaultFetch, now = Date.now() }: ReleaseLoaderOptions = {}
): Promise<LatestRelease> {
  return cached(`latest:${repo}`, now, async () => {
    const payload = await requestJson(`https://api.github.com/repos/${repo}/releases/latest`, fetchImpl);

    return parseLatest(repo, payload);
  });
}

/** Four most recent releases, for the list that opens on demand. */
export function loadReleases(
  repo: string,
  { fetchImpl = defaultFetch, now = Date.now() }: ReleaseLoaderOptions = {}
): Promise<ReleaseSummary[]> {
  return cached(`list:${repo}`, now, async () => {
    const payload = await requestJson(`https://api.github.com/repos/${repo}/releases?per_page=4`, fetchImpl);

    return parseReleases(payload).slice(0, 4);
  });
}
