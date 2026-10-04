import type {
  ExportArtifactSpec,
  ExportContainerSpec,
  ExportContext,
  ExportPreset,
  IconTarget
} from '@iconcore/shared';

/** Convenience builder for a square PNG raster artifact. */
const raster = (
  id: string,
  path: string,
  size: number,
  extras: Partial<
    Pick<
      ExportArtifactSpec,
      'background' | 'quality' | 'target' | 'variant' | 'safeZone' | 'maskShape'
    >
  > = {}
): ExportArtifactSpec => ({
  id,
  format: 'png',
  path,
  enabled: true,
  size,
  ...extras
});

/**
 * The Android adaptive-icon safe zone: **66 of 108dp**.
 *
 * Both layers are 108×108dp, but only the central 66×66dp is guaranteed visible — the
 * outer 18dp on each side is cropped by the launcher's mask and used for parallax. The
 * number is the one from the platform's own docs (`SAFEZONE_SCALE = 66f / 72f` in
 * `AdaptiveIconDrawable.java`), not a round number chosen for looks.
 */
const SAFE_ZONE = 66 / 108;

/**
 * A camada monocromática do adaptive icon.
 * `variant: 'mono'` porque é a variant que o app já mantém como "logo em escala de cinza"
 * — e o Android **tinge** a camada com a cor do tema, então o que importa é o alfa da
 * forma, não a cor. `background: 'transparent'` pelo mesmo motivo: fundo pintado viraria
 * um bloco sólido tingido pelo sistema, que é o oposto de um ícone tematizado.
 *
 * A safe zone é a mesma da foreground colorida, e pelo mesmo motivo: o sistema aplica a
 * mesma máscara.
 */
const MONO = {
  variant: 'mono',
  background: 'transparent',
  safeZone: SAFE_ZONE
} as const satisfies Partial<ExportArtifactSpec>;

/** Convenience builder for an SVG (vector) artifact. */
const vector = (id: string, path: string, size: number): ExportArtifactSpec => ({
  id,
  format: 'svg',
  path,
  enabled: true,
  size
});

/** Convenience builder for an ICO/ICNS container with physical `entries`. */
const container = (
  id: string,
  path: string,
  format: 'ico' | 'icns',
  entries: number[],
  extras: Partial<Pick<ExportContainerSpec, 'background' | 'target' | 'variant'>> = {}
): ExportContainerSpec => ({
  id,
  path,
  enabled: true,
  format,
  entries,
  ...extras
});

/**
 * Default artifact sets per target. These presets are the source of
 * truth for what each integration produces — notably Tauri/Electron now ship
 * real `icon.ico` + `icon.icns` containers instead of PNG-only output.
 */
export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'tauri',
    label: 'Tauri desktop app',
    description: 'Windows/macOS/Linux icons for a Tauri app: icon.ico + icon.icns + Linux PNG set.',
    platforms: ['windows', 'macos', 'linux'],
    recommended: true,
    documentation: 'tauri.conf.json → bundle.icon (icon.ico + icon.icns at source root)',
    createArtifacts: () => [
      raster('tauri-png-512', 'icons/icon.png', 512),
      raster('tauri-png-256', 'icons/128x128@2x.png', 256),
      raster('tauri-png-128', 'icons/128x128.png', 128),
      raster('tauri-png-32', 'icons/32x32.png', 32),
      container('tauri-ico', 'icon.ico', 'ico', [16, 24, 32, 48, 64, 256]),
      container('tauri-icns', 'icon.icns', 'icns', [16, 32, 64, 128, 256, 512, 1024])
    ]
  },
  {
    id: 'electron',
    label: 'Electron desktop app',
    description: 'Source SVG + ICO/ICNS containers + PNG set for electron-builder resources.',
    platforms: ['windows', 'macos', 'linux'],
    documentation: 'electron-builder buildResources (icon.ico, icon.icns, icons/*.png)',
    createArtifacts: () => [
      vector('electron-svg', 'icon.svg', 1024),
      raster('electron-png-512', 'build/icon.png', 512),
      raster('electron-png-128', 'build/icons/128x128.png', 128),
      container('electron-ico', 'build/icon.ico', 'ico', [16, 24, 32, 48, 64, 256]),
      container('electron-icns', 'build/icon.icns', 'icns', [16, 32, 64, 128, 256, 512, 1024])
    ]
  },
  {
    id: 'web',
    label: 'Web favicon set',
    description: 'Favicons for a site: PNG/ICO/SVG plus apple-touch-icon and the manifest/browserconfig pair.',
    platforms: ['web'],
    recommended: true,
    // A browser asks for `/favicon.ico` by path, so `default` stays at the root;
    // the other variants go in folders instead of overwriting each other.
    variantLayout: 'per-folder',
    documentation: 'site.webmanifest + browserconfig.xml are produced as attachments',
    createArtifacts: () => [
      raster('web-png-16', 'favicon-16x16.png', 16),
      raster('web-png-32', 'favicon-32x32.png', 32),
      raster('web-png-48', 'favicon-48x48.png', 48),
      raster('web-png-180', 'apple-touch-icon-180x180.png', 180),
      container('web-ico', 'favicon.ico', 'ico', [16, 32]),
      vector('web-svg', 'favicon.svg', 1024)
    ]
  },
  {
    id: 'pwa',
    label: 'PWA install icons',
    description: 'Install icons (192/512) plus an opaque maskable version, with the web manifest.',
    platforms: ['web'],
    recommended: true,
    // The manifest lists icons by path, so the same contract as `web`.
    variantLayout: 'per-folder',
    createArtifacts: () => [
      raster('pwa-png-192', 'icon-192x192.png', 192),
      raster('pwa-png-512', 'icon-512x512.png', 512),
      raster('pwa-maskable-512', 'icon-maskable-512x512.png', 512, { background: 'opaque' })
    ]
  },
  {
    id: 'windows',
    label: 'Windows app icon',
    description: 'Single ICO with the classic Windows size ladder (16–256).',
    platforms: ['windows'],
    createArtifacts: () => [container('windows-ico', 'icon.ico', 'ico', [16, 24, 32, 48, 64, 256])]
  },
  {
    id: 'macos',
    label: 'macOS app icon',
    description: 'Single ICNS containing the full Apple size ladder (16–1024).',
    platforms: ['macos'],
    createArtifacts: () => [container('macos-icns', 'icon.icns', 'icns', [16, 32, 64, 128, 256, 512, 1024])]
  },
  {
    id: 'desktop-generic',
    label: 'Linux icon set',
    description: 'Plain PNG icon set for Linux desktops/freedesktop (32/128/256/512).',
    platforms: ['linux'],
    createArtifacts: () => [
      raster('linux-png-32', 'linux/32x32.png', 32),
      raster('linux-png-128', 'linux/128x128.png', 128),
      raster('linux-png-256', 'linux/256x256.png', 256),
      raster('linux-png-512', 'linux/512x512.png', 512)
    ]
  },
  {
    id: 'marketing',
    label: 'Marketing / social icons',
    description: 'Large PNGs (256/512/1024) for web and social previews.',
    platforms: ['web'],
    // Consumed by humans and by social scrapers, never by a build config.
    variantLayout: 'per-folder',
    createArtifacts: () => [
      raster('marketing-png-256', 'marketing/icon-256.png', 256),
      raster('marketing-png-512', 'marketing/icon-512.png', 512),
      raster('marketing-png-1024', 'marketing/icon-1024.png', 1024)
    ]
  },
  {
    id: 'android',
    label: 'Android app icon',
    description:
      'Adaptive icon layers + legacy launcher bitmaps + Play Store listing, all raster. ' +
      'The foreground is inset to the 66dp safe zone of the 108dp layer.',
    platforms: ['android'],
    documentation:
      'res/mipmap-* for the bitmaps; res/mipmap-anydpi-v26/*.xml is produced as an attachment',
    createArtifacts: () => [
      // ── Adaptive layers ────────────────────────────────────────────────────────
      // Both layers are 108×108dp; only the central 66×66dp of the foreground is
      // guaranteed visible. `safeZone: 66/108` is that inset — WITHOUT it the logo is
      // cropped by every launcher mask (circle, squircle, teardrop).
      raster('android-foreground-mdpi', 'mipmap-mdpi/ic_launcher_foreground.png', 108, { safeZone: SAFE_ZONE }),
      raster('android-foreground-hdpi', 'mipmap-hdpi/ic_launcher_foreground.png', 162, { safeZone: SAFE_ZONE }),
      raster('android-foreground-xhdpi', 'mipmap-xhdpi/ic_launcher_foreground.png', 216, { safeZone: SAFE_ZONE }),
      raster('android-foreground-xxhdpi', 'mipmap-xxhdpi/ic_launcher_foreground.png', 324, { safeZone: SAFE_ZONE }),
      raster('android-foreground-xxxhdpi', 'mipmap-xxxhdpi/ic_launcher_foreground.png', 432, { safeZone: SAFE_ZONE }),
      // The background is full bleed on purpose — it is what fills the mask.
      raster('android-background-mdpi', 'mipmap-mdpi/ic_launcher_background.png', 108, { background: 'opaque' }),
      raster('android-background-hdpi', 'mipmap-hdpi/ic_launcher_background.png', 162, { background: 'opaque' }),
      raster('android-background-xhdpi', 'mipmap-xhdpi/ic_launcher_background.png', 216, { background: 'opaque' }),
      raster('android-background-xxhdpi', 'mipmap-xxhdpi/ic_launcher_background.png', 324, { background: 'opaque' }),
      raster('android-background-xxxhdpi', 'mipmap-xxxhdpi/ic_launcher_background.png', 432, { background: 'opaque' }),
      // ── Legacy launcher, below API 26 ───────────────────────────────────────────
      raster('android-legacy-mdpi', 'mipmap-mdpi/ic_launcher.png', 48),
      raster('android-legacy-hdpi', 'mipmap-hdpi/ic_launcher.png', 72),
      raster('android-legacy-xhdpi', 'mipmap-xhdpi/ic_launcher.png', 96),
      raster('android-legacy-xxhdpi', 'mipmap-xxhdpi/ic_launcher.png', 144),
      raster('android-legacy-xxxhdpi', 'mipmap-xxxhdpi/ic_launcher.png', 192),
      raster('android-round-mdpi', 'mipmap-mdpi/ic_launcher_round.png', 48, { maskShape: 'circle' }),
      raster('android-round-hdpi', 'mipmap-hdpi/ic_launcher_round.png', 72, { maskShape: 'circle' }),
      raster('android-round-xhdpi', 'mipmap-xhdpi/ic_launcher_round.png', 96, { maskShape: 'circle' }),
      raster('android-round-xxhdpi', 'mipmap-xxhdpi/ic_launcher_round.png', 144, { maskShape: 'circle' }),
      raster('android-round-xxxhdpi', 'mipmap-xxxhdpi/ic_launcher_round.png', 192, { maskShape: 'circle' }),
      // ── Play Store listing ─────────────────────────────────────────────────────
      // 512×512 and **opaque**: Play rejects alpha, and applies its own rounding.
      raster('android-play-512', 'play-store-512.png', 512, { background: 'opaque' }),
      // ── Camada monocromática, Android 13+ ─────────────────────────────────────
      // Ícone tematizado: o sistema tinge a camada com a cor do tema. Por isso ela é
      // **fundo transparente** com a forma no alfa, e sai da variant `mono` do projeto —
      // que já é o logo em escala de cinza, e que o `mono` do app mantém.
      //
      // **A safe zone também vale aqui.** O guia da plataforma mostra a camada monocromática
      // centralizada nos mesmos 66dp, e o arquivo do Android usa a mesma fórmula. Sem o
      // inset, o ícone tematizado é cortado exatamente como o colorido — e é o único que a
      // pessoa vê no tema escuro do sistema, então o defeito aparece mais.
      raster('android-monochrome-mdpi', 'mipmap-mdpi/ic_launcher_monochrome.png', 108, MONO),
      raster('android-monochrome-hdpi', 'mipmap-hdpi/ic_launcher_monochrome.png', 162, MONO),
      raster('android-monochrome-xhdpi', 'mipmap-xhdpi/ic_launcher_monochrome.png', 216, MONO),
      raster('android-monochrome-xxhdpi', 'mipmap-xxhdpi/ic_launcher_monochrome.png', 324, MONO),
      raster('android-monochrome-xxxhdpi', 'mipmap-xxxhdpi/ic_launcher_monochrome.png', 432, MONO)
    ]
  },
  {
    id: 'custom',
    label: 'Custom (start empty)',
    description: 'Start from a blank plan and add artifacts yourself.',
    platforms: [],
    createArtifacts: () => []
  }
];

/** Maps the legacy `IconTarget` ids to the preset that supersedes them. */
export const PRESET_ID_BY_TARGET: Record<IconTarget, string> = {
  'web-favicon': 'web',
  pwa: 'pwa',
  tauri: 'tauri',
  electron: 'electron',
  'desktop-generic': 'desktop-generic',
  marketing: 'marketing'
};

/** Re-export the context type so callers don't have to reach into shared. */
export type { ExportContext };