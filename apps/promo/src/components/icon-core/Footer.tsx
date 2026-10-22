import { useRef, type PointerEvent } from 'react';

import { cn } from '../../lib/cn';
import { FOOTER_GLOW_STYLE, GRID_STYLE, WORDMARK_STYLE } from '../../lib/decor';
import { siteConfig } from '../../lib/site-config';
import { ArrowUpIcon, ArrowUpRightIcon, GithubIcon } from './icons';
import { useStudio } from './studio-context';

const LINKS: { title: string; items: { label: string; href: string }[] }[] = [
  {
    title: 'Produto',
    items: [
      { label: 'Versão web', href: siteConfig.webAppUrl },
      { label: 'Baixar app', href: '#baixar' },
      { label: 'Plataformas', href: '#plataformas' },
    ],
  },
  {
    title: 'Projeto',
    items: [
      { label: 'GitHub', href: siteConfig.repoUrl },
      { label: 'Releases', href: `${siteConfig.repoUrl}/releases` },
      { label: 'Reportar um problema', href: `${siteConfig.repoUrl}/issues` },
      { label: 'Licença MIT', href: `${siteConfig.repoUrl}/blob/main/LICENSE` },
    ],
  },
];

/**
 * The footer is dark in every appearance except mono. The pointer lights the wordmark and
 * the glow behind it through `--fx` / `--fy`; both fallbacks (70% / 30%) are what renders
 * before the first move and when JavaScript never gets here.
 */
export function Footer() {
  const { appearance } = useStudio();
  const ref = useRef<HTMLElement>(null);

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const element = ref.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    element.style.setProperty('--fx', `${(((event.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`);
    element.style.setProperty('--fy', `${(((event.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`);
  };

  return (
    <footer
      ref={ref}
      onPointerMove={onPointerMove}
      className={cn(
        'relative isolate overflow-hidden bg-background text-foreground',
        appearance !== 'mono' && 'dark'
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 transition-[background] duration-300"
        style={FOOTER_GLOW_STYLE}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-40" style={GRID_STYLE} />

      <div className="mx-auto flex max-w-7xl flex-wrap items-start gap-x-16 gap-y-10 px-4 pt-16 pb-10 text-sm sm:px-6 sm:pt-20">
        {LINKS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="mb-4 font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">{column.title}</p>
            <ul className="space-y-2.5">
              {column.items.map((item) => {
                const external = item.href.startsWith('http');
                return (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
                      className="group inline-flex items-center gap-1 text-foreground/80 transition-colors hover:text-foreground"
                    >
                      {item.label}
                      {external && (
                        <ArrowUpRightIcon className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        ))}

        <a
          href="#top"
          className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Voltar ao topo <ArrowUpIcon className="size-3.5" />
        </a>
      </div>

      <div className="relative">
        <div aria-hidden className="pointer-events-none overflow-hidden select-none">
          <p
            style={WORDMARK_STYLE}
            className="-mb-[0.22em] text-center text-[clamp(4rem,19vw,17rem)] leading-[0.85] font-semibold tracking-[-0.065em]"
          >
            Icon-Core
          </p>
        </div>

        <div className="absolute inset-x-0 bottom-3 flex justify-center px-3 sm:bottom-6">
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-[-0.75rem] left-1/2 h-16 w-[min(56rem,100%)] -translate-x-1/2 rounded-full bg-background/80 blur-2xl"
          />
          <div className="relative flex max-w-full items-center gap-2.5 rounded-full border border-glass-border bg-background/60 py-1 pr-1 pl-3.5 text-[11px] text-muted-foreground shadow-float backdrop-blur-2xl sm:gap-3 sm:pl-4">
            <GithubIcon className="size-3.5 shrink-0 text-foreground" />
            <span className="hidden text-foreground sm:inline">Código aberto</span>
            <span className="font-mono">v{siteConfig.version}</span>
            <span className="rounded-full bg-primary/90 px-1.5 py-px font-mono text-[9px] font-semibold tracking-wider text-primary-foreground">
              {siteConfig.stage}
            </span>
            <span className="whitespace-nowrap">
              Licença {siteConfig.license}
              <span className="hidden md:inline"> · feito por mafhper</span>
            </span>
            <a
              href={siteConfig.repoUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Repositório ${siteConfig.repo} no GitHub`}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-foreground/85 transition-colors hover:bg-foreground/10 hover:text-foreground"
            >
              <span className="hidden sm:inline">{siteConfig.repo}</span>
              <ArrowUpRightIcon className="size-3.5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
