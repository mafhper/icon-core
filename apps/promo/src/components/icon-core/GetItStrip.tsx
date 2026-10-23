import { useEffect, useState } from 'react';

import { useDetectedOS } from '../../hooks/use-os';
import { cn } from '../../lib/cn';
import { suggestedDesktopTarget } from '../../lib/platform';
import {
  loadLatestRelease,
  loadReleases,
  ReleaseFetchError,
  type LatestRelease,
  type ReleaseFailureReason,
  type ReleaseSummary,
} from '../../lib/releases';
import { downloadTargets, siteConfig, type DesktopOS } from '../../lib/site-config';
import { buttonClass } from '../../ui/buttonStyles';
import { ChevronDownIcon } from './editor-icons';
import { DownloadIcon, GlobeIcon } from './icons';
import { OsIcon } from './os-icons';

/** Which frame the showcase window wears. The strip swaps it on hover/focus. */
export type WindowFrame = 'web' | 'desktop';

type LatestState =
  | { status: 'loading' }
  | { status: 'ready'; release: LatestRelease }
  | { status: 'error'; reason: ReleaseFailureReason };

type ListState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; releases: ReleaseSummary[] }
  | { status: 'error'; reason: ReleaseFailureReason };

const isMobile = (os: string) => os === 'ios' || os === 'android';

const RATE_LIMIT_COPY = 'O GitHub limitou as consultas agora.';
const OFFLINE_COPY = 'Sem conexão com o GitHub agora.';

/**
 * One table for both places the strip reports a failure. The two read the same three reasons,
 * and only the `network` wording differs: the latest-release line can name what it failed to
 * fetch, while the list line is already inside the panel it failed to fill.
 */
type FailureScope = 'latest' | 'list';

const FAILURE_COPY: Record<FailureScope, Record<ReleaseFailureReason, string>> = {
  latest: {
    offline: OFFLINE_COPY,
    'rate-limit': RATE_LIMIT_COPY,
    network: 'Não deu para consultar a última versão agora.',
  },
  list: {
    offline: OFFLINE_COPY,
    'rate-limit': RATE_LIMIT_COPY,
    network: 'Não deu para carregar agora.',
  },
};

const failureCopy = (scope: FailureScope, reason: ReleaseFailureReason) => FAILURE_COPY[scope][reason];

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR');
}

/**
 * Web vs desktop actions docked under the editor window, plus the release list that opens
 * on demand. Pointing at a side swaps the window frame, which is what makes the demo tell
 * the truth: the same app, in the browser or installed.
 *
 * GitHub is read with native `fetch` and a manual stale window (see `lib/releases`) instead
 * of a query library, so the section adds no dependency to the promo bundle.
 */
export function GetItStrip({
  frame,
  onFrameChange
}: {
  frame: WindowFrame;
  onFrameChange: (frame: WindowFrame) => void;
}) {
  const os = useDetectedOS();
  const mobile = isMobile(os);
  const target = suggestedDesktopTarget(os);
  const main = target ? downloadTargets[target] : downloadTargets.windows;
  const others = (Object.keys(downloadTargets) as DesktopOS[]).filter((key) => key !== main.os);

  const [latest, setLatest] = useState<LatestState>({ status: 'loading' });
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [list, setList] = useState<ListState>({ status: 'idle' });

  useEffect(() => {
    let alive = true;
    setLatest({ status: 'loading' });

    loadLatestRelease(siteConfig.repo)
      .then((release) => {
        if (alive) setLatest({ status: 'ready', release });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setLatest({
          status: 'error',
          reason: error instanceof ReleaseFetchError ? error.reason : 'network'
        });
      });

    return () => {
      alive = false;
    };
    // `attempt` is the retry trigger shared with the list: bumping it refetches
    // without a reload, and the cached success is still served inside the window.
  }, [attempt]);

  useEffect(() => {
    if (!open) return;

    let alive = true;
    setList({ status: 'loading' });

    loadReleases(siteConfig.repo)
      .then((releases) => {
        if (alive) setList({ status: 'ready', releases });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setList({
          status: 'error',
          reason: error instanceof ReleaseFetchError ? error.reason : 'network'
        });
      });

    return () => {
      alive = false;
    };
    // `attempt` is the retry trigger: bumping it re-runs the request without closing the panel.
  }, [open, attempt]);

  // A phone cannot run the desktop app: there is no installer link to offer, only the
  // releases page (same rule as `DownloadButton`). Letting the API result through put an
  // .msi download one tap away on iOS and Android.
  const installer = !mobile && latest.status === 'ready' ? latest.release.links[main.os] : null;
  const ctaLabel = mobile
    ? 'Ver downloads para computador'
    : latest.status === 'error' || !target
      ? 'Ver downloads no GitHub'
      : `Baixar para ${main.label}`;

  const side = (id: WindowFrame) =>
    cn('relative flex flex-col gap-4 p-5 transition-colors sm:p-6', frame === id ? 'bg-card' : 'bg-card/50');

  return (
    <div id="baixar" className="mt-4 scroll-mt-24">
      {/* Legacy anchor: `#desktop` aliased the download block in the v1 section. */}
      <span id="desktop" className="block scroll-mt-24" aria-hidden />

      <div className="grid overflow-hidden rounded-2xl border md:grid-cols-2 md:divide-x">
        <div
          data-testid="getit-side-web"
          className={side('web')}
          onPointerEnter={() => onFrameChange('web')}
          onFocusCapture={() => onFrameChange('web')}
        >
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-primary">
              <GlobeIcon className="size-4" />
            </span>
            <div>
              <h3 className="font-semibold tracking-tight">Versão web</h3>
              <p className="text-sm text-muted-foreground">Abre no navegador. Nada para instalar.</p>
            </div>
          </div>
          <a
            href={siteConfig.webAppUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonClass({ variant: 'outline', className: 'mt-auto self-start rounded-full' })}
          >
            Abrir no navegador
          </a>
        </div>

        <div
          data-testid="getit-side-desktop"
          className={cn(side('desktop'), 'border-t md:border-t-0')}
          onPointerEnter={() => onFrameChange('desktop')}
          onFocusCapture={() => onFrameChange('desktop')}
        >
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-primary">
              {target ? <OsIcon os={main.os} className="size-4" /> : <DownloadIcon className="size-4" />}
            </span>
            <div>
              <h3 className="font-semibold tracking-tight">App desktop</h3>
              <p className="text-sm text-muted-foreground">
                {mobile
                  ? 'Para computador. No celular, use a versão web.'
                  : target
                    ? `${main.detail} · Tauri`
                    : 'Windows, macOS e Linux no GitHub.'}
              </p>
            </div>
          </div>

          {latest.status === 'ready' && (
            <p className="font-mono text-xs text-muted-foreground">{latest.release.versionLabel}</p>
          )}

          {latest.status === 'error' && (
            <p className="text-xs text-muted-foreground" role="status">
              {failureCopy('latest', latest.reason)}{' '}
              <a
                href={`${siteConfig.repoUrl}/releases`}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4"
              >
                Ver no GitHub
              </a>{' '}
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
                className="cursor-pointer underline underline-offset-4"
              >
                Tentar de novo
              </button>
            </p>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2.5">
            {latest.status === 'loading' ? (
              /*
                Disabled, and it says why: the request is the only thing between the visitor
                and a working installer, so the affordance itself carries the status instead
                of looking like a link that does nothing.
              */
              <span
                role="status"
                aria-live="polite"
                className={buttonClass({
                  className: 'pointer-events-none rounded-full opacity-60'
                })}
              >
                <DownloadIcon className="size-4" />
                Verificando a última versão…
              </span>
            ) : (
              <a
                href={installer ?? siteConfig.releasesUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonClass({ className: 'rounded-full shadow-float' })}
              >
                {target && latest.status === 'ready' ? (
                  <OsIcon os={main.os} className="size-4" />
                ) : (
                  <DownloadIcon className="size-4" />
                )}
                {ctaLabel}
                {installer && (
                  <span className="font-mono text-[11px] opacity-75">{main.files.join(' ')}</span>
                )}
              </a>
            )}

            {target && (
              <span className="flex items-center gap-3 text-xs text-muted-foreground">
                ou
                {others.map((key) => (
                  <a
                    key={key}
                    href={siteConfig.releasesUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
                  >
                    <OsIcon os={key} className="size-3" />
                    {downloadTargets[key].label}
                  </a>
                ))}
              </span>
            )}
          </div>

          {main.note && !mobile && <p className="-mt-1 text-xs text-muted-foreground">{main.note}</p>}
        </div>
      </div>

      <div className="mt-3 px-1 text-sm">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex cursor-pointer items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="size-1.5 rounded-full bg-primary" />v{siteConfig.version} · últimas releases
          <ChevronDownIcon className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="mt-2 rounded-xl border bg-card/60 px-4 py-2">
            {list.status === 'loading' && <p className="py-1.5 text-muted-foreground">Carregando do GitHub…</p>}

            {list.status === 'error' && (
              <p className="py-1.5 text-muted-foreground">
                {failureCopy('list', list.reason)}{' '}
                <a
                  href={`${siteConfig.repoUrl}/releases`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4"
                >
                  Ver no GitHub
                </a>{' '}
                <button
                  type="button"
                  onClick={() => setAttempt((value) => value + 1)}
                  className="cursor-pointer underline underline-offset-4"
                >
                  Tentar de novo
                </button>
              </p>
            )}

            {list.status === 'ready' && (
              <ul className="divide-y">
                {list.releases.length === 0 && (
                  <li className="py-1.5 text-muted-foreground">Nenhuma release pública ainda.</li>
                )}
                {list.releases.map((release) => (
                  <li key={release.id}>
                    <a
                      href={release.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-4 py-2 hover:text-primary"
                    >
                      <span className="w-20 font-mono text-xs">{release.tag}</span>
                      <span className="flex-1 truncate">{release.name || release.tag}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatDate(release.publishedAt)}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
