import type { ReactNode } from 'react';

/**
 * The handful of line icons the sections need. They are inline SVG on purpose: the promo
 * app ships without an icon dependency, so a new glyph is a path here, not a package.
 */
type IconProps = { className?: string };

function Line({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function GlobeIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.4 2.4 3.7 5.4 3.7 9s-1.3 6.6-3.7 9c-2.4-2.4-3.7-5.4-3.7-9S9.6 5.4 12 3Z" />
    </Line>
  );
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <path d="M12 3v12" />
      <path d="m8 11 4 4 4-4" />
      <path d="M4 20h16" />
    </Line>
  );
}

export function ArrowUpIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <path d="M12 19V5" />
      <path d="m6 11 6-6 6 6" />
    </Line>
  );
}

export function ArrowUpRightIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </Line>
  );
}

export function LayersIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </Line>
  );
}

/** Inward arrows: the inverse of "separar camadas". */
export function CollapseIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <path d="M9 3v6H3" />
      <path d="M15 3v6h6" />
      <path d="M9 21v-6H3" />
      <path d="M15 21v-6h6" />
    </Line>
  );
}

export function GithubIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  );
}
