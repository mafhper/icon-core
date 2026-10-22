// Single source for project facts shown on the promo site.
export const siteConfig = {
  name: 'Icon-Core',
  version: '1.7.0',
  license: 'MIT',
  stage: 'BETA',
  repo: 'mafhper/icon-core',
  repoUrl: 'https://github.com/mafhper/icon-core',
  releasesUrl: 'https://github.com/mafhper/icon-core/releases/latest',
  webAppUrl: 'https://mafhper.github.io/icon-core/app/',
  siteUrl: 'https://mafhper.github.io/icon-core/',
} as const;

export type DesktopOS = 'windows' | 'macos' | 'linux';

export type DownloadTarget = {
  os: DesktopOS;
  label: string;
  detail: string;
  files: string[];
  note?: string;
};

export const downloadTargets: Record<DesktopOS, DownloadTarget> = {
  windows: {
    os: 'windows',
    label: 'Windows',
    detail: 'Windows 10 / 11 · x64',
    files: ['.msi', '.exe'],
  },
  macos: {
    os: 'macos',
    label: 'macOS',
    detail: 'Apple Silicon (M1 ou superior)',
    files: ['.dmg'],
    note: 'Macs com Intel ainda não têm instalador oficial.',
  },
  linux: {
    os: 'linux',
    label: 'Linux',
    detail: 'x64 · AppImage ou Debian/Ubuntu',
    files: ['.AppImage', '.deb'],
  },
};

export const exportFormats = [
  { ext: '.ico', detail: '16 – 256 px', target: 'Windows' },
  { ext: '.icns', detail: '16 – 1024 px', target: 'macOS' },
  { ext: '.png', detail: 'até 1024 px', target: 'Linux · Android' },
  { ext: '.svg', detail: 'vetor', target: 'Web' },
  { ext: '.webp', detail: 'leve', target: 'Web · PWA' },
] as const;
