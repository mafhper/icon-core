// Captures the four screenshots the READMEs link to. One-off helper, kept in the
// repo so the images can be refreshed instead of hand-stitched.
//
// Requires both dev servers running: `npm run dev:web` (5173) and `npm run dev:promo` (5174).
//   node scripts/capture-screenshots.mjs
//
// What it writes, all under `docs/assets/`:
//   app-editor.png   Studio, sample project, a layer selected
//   app-export.webp  the Inspector's Export tab (Playwright only encodes PNG/JPEG,
//                    so the capture is converted here through `sharp`; the raw PNG
//                    is never written to disk, so no stale `app-export.png` can
//                    appear beside it)
//   app-welcome.png  the entry modal with no stored project
//   promo.png        the landing hero
//
// **Three capture settings are pinned, and each one is a correctness decision.**
//
// 1. `colorScheme: 'dark'`. Both surfaces are system-first, so without pinning the
//    run inherits the machine's preference and the four assets stop agreeing with
//    each other: the landing and the editor could be captured in different themes
//    by two runs of the same script.
// 2. `reducedMotion: 'reduce'`. The landing backdrop is an animated shader; the
//    product already freezes it for reduced motion, so the same escape hatch makes
//    the capture reproducible instead of a different frame per run.
// 3. A fresh context per screenshot. Contexts share IndexedDB, and the seeded
//    sample project would survive into the welcome capture — which then opens on
//    "Your projects" with the sample listed twice, instead of the three ways in.
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const APP = 'http://localhost:5173/icon-core/app/';
const PROMO = 'http://localhost:5174/icon-core/';
const OUT = 'docs/assets';
mkdirSync(OUT, { recursive: true });

const VIEWPORT = { width: 1320, height: 840 };

/**
 * The Layers panel minimum is 205px, and at that width the row spends its space on
 * the thumbnail and the action cluster: the layer name clips to two characters and
 * a click on the row's centre lands on the eye/lock/duplicate/delete cluster — the
 * capture then shows a layer the Inspector claims is selected and the canvas does
 * not draw. Both are products of the default width, not of the app, so the capture
 * seeds a resized panel (the same values the resize handles persist).
 */
const PANELS = { left: 300, right: 320 };

/** A tasteful sample project seeded through the legacy slot, which the app migrates. */
const project = {
  schemaVersion: 2,
  metadata: { name: 'Aurora', shortName: 'Aurora' },
  canvas: {
    size: 512,
    background: { kind: 'linear-gradient', angle: 160, stops: [{ offset: 0, color: '#eef2ff' }, { offset: 1, color: '#c7d2fe' }] },
    safeArea: { inset: 0.08, shape: 'rounded-rectangle' }
  },
  layers: [
    {
      id: 'layer-card',
      name: 'Card',
      kind: 'shape',
      visible: true,
      zIndex: 0,
      source: { type: 'reference', path: '', shape: { kind: 'squircle', width: 320, height: 320, cornerRadius: 88 } },
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      opacity: 1,
      fill: { kind: 'linear-gradient', angle: 135, stops: [{ offset: 0, color: '#f3d18a' }, { offset: 1, color: '#6bb7d8' }] },
      effects: [{ kind: 'depth-shadow', enabled: true, params: { x: 0, y: 18, blur: 34, color: 'rgba(15,23,42,0.28)' } }]
    },
    {
      id: 'layer-accent',
      name: 'Accent',
      kind: 'shape',
      visible: true,
      zIndex: 1,
      source: { type: 'reference', path: '', shape: { kind: 'circle', width: 120, height: 120 } },
      transform: { x: -72, y: -72, scale: 1, rotation: 0 },
      opacity: 0.92,
      fill: { kind: 'solid', color: '#ffffff' }
    }
  ],
  variants: {
    default: {},
    light: { canvas: { background: { kind: 'solid', color: '#f8fafc' } } },
    dark: { canvas: { background: { kind: 'solid', color: '#0f172a' } } },
    mono: { canvas: { background: { kind: 'solid', color: '#ffffff' } } }
  },
  targets: [
    { target: 'web-favicon', enabled: true },
    { target: 'pwa', enabled: true },
    { target: 'tauri', enabled: false },
    { target: 'electron', enabled: false },
    { target: 'desktop-generic', enabled: false },
    { target: 'marketing', enabled: false }
  ],
  exportProfile: {
    outputBaseName: 'aurora',
    quality: 0.92,
    generateReport: true,
    format: 'png',
    structure: 'nested',
    zip: true,
    compression: 'deflate',
    compressionLevel: 6,
    includePreview: true
  }
};

const browser = await chromium.launch();

/**
 * One screenshot, one context. `deviceScaleFactor` is per shot because the two
 * surfaces want different densities: UI text is the subject of the app captures
 * (1.5), while the landing is one large colour field where 1.25 already resolves
 * twice the width the README displays and keeps the PNG about a third smaller.
 */
const capture = async (name, { url, seed = false, scale = 1.5, beforeShot } = {}) => {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: scale,
    colorScheme: 'dark',
    reducedMotion: 'reduce'
  });
  const page = await context.newPage();

  await page.addInitScript((panels) => {
    window.localStorage.setItem('iconcore:panel-left', String(panels.left));
    window.localStorage.setItem('iconcore:panel-right', String(panels.right));
  }, PANELS);
  if (seed) {
    await page.addInitScript((sample) => {
      window.localStorage.setItem('iconcore-composer-project', JSON.stringify(sample));
    }, project);
  }

  await page.goto(url, { waitUntil: 'load' });
  // The editor mounts the canvas, the variant tiles and the fonts in stages; a
  // fixed settle is honest about that without pinning this to internal selectors.
  await page.waitForTimeout(2200);
  if (beforeShot) await beforeShot(page);

  if (name.endsWith('.webp')) {
    const png = await page.screenshot();
    const webp = await sharp(png).webp({ quality: 82 }).toBuffer();
    writeFileSync(`${OUT}/${name}`, webp);
    console.log('saved', `${OUT}/${name}`, `${Math.round(webp.length / 1024)} KB`);
  } else {
    await page.screenshot({ path: `${OUT}/${name}` });
    console.log('saved', `${OUT}/${name}`);
  }
  await context.close();
};

// Editor: the sample project with the squircle selected, so the Inspector has
// real geometry (320 × 320, squircle) and the canvas shows the selection box.
await capture('app-editor.png', {
  url: APP + '#/edit-space',
  seed: true,
  beforeShot: async (page) => {
    // The layer's name button, not the row: see `PANELS` for why the row centre
    // is the wrong target.
    const layerName = page.getByRole('button', { name: 'Card', exact: true });
    try {
      await layerName.click({ timeout: 4000 });
      await page.waitForTimeout(900);
    } catch {
      // A renamed sample layer should not fail the run; the canvas is still true.
    }
  }
});

// Export: a **tab inside the Inspector** (`#/export-utilities` is the legacy
// deep-link that lands on it and focuses the tab — the promo still links it).
await capture('app-export.webp', { url: APP + '#/export-utilities', seed: true });

// Welcome: no seeded project, so the modal offers the three ways in.
await capture('app-welcome.png', { url: APP + '#/workspaces' });

// Landing: the hero, its appearance dock and the version badge.
await capture('promo.png', { url: PROMO, scale: 1.25 });

await browser.close();
console.log('done');
