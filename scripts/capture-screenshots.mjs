// One-off helper to capture README screenshots of the app and promo site.
// Requires both dev servers running: `bun run dev:web` (5173) and `bun run dev:promo` (5174).
//   node scripts/capture-screenshots.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const APP = 'http://localhost:5173/icon-core/app/';
const PROMO = 'http://localhost:5174/icon-core/';
const OUT = 'docs/assets';
mkdirSync(OUT, { recursive: true });

// A tasteful sample project seeded via localStorage so the editor has content.
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
      kind: 'shape', visible: true, zIndex: 0,
      source: { type: 'reference', path: '', shape: { kind: 'squircle', width: 320, height: 320, cornerRadius: 88 } },
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      opacity: 1,
      fill: { kind: 'linear-gradient', angle: 135, stops: [{ offset: 0, color: '#f3d18a' }, { offset: 1, color: '#6bb7d8' }] },
      effects: [{ kind: 'depth-shadow', enabled: true, params: { x: 0, y: 18, blur: 34, color: 'rgba(15,23,42,0.28)' } }]
    },
    {
      id: 'layer-accent',
      name: 'Accent',
      kind: 'shape', visible: true, zIndex: 1,
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
    outputBaseName: 'aurora', quality: 0.92, generateReport: true,
    format: 'png', structure: 'nested', zip: true, compression: 'deflate', compressionLevel: 6, includePreview: true
  }
};

const shoot = async (page, url, path, { seed, clear, beforeShot } = {}) => {
  if (seed) await page.addInitScript((p) => localStorage.setItem('iconcore-composer-project', JSON.stringify(p)), project);
  if (clear) await page.addInitScript(() => localStorage.removeItem('iconcore-composer-project'));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1400);
  if (beforeShot) await beforeShot(page);
  await page.screenshot({ path });
  console.log('saved', path);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1320, height: 840 }, deviceScaleFactor: 1.5 });

// Editor (seeded project, with a layer selected so the inspector is populated)
const editor = await ctx.newPage();
await shoot(editor, APP + '#/edit-space', `${OUT}/app-editor.png`, {
  seed: true,
  beforeShot: async (page) => {
    try { await page.click('.ic-layer-row', { timeout: 3000 }); await page.waitForTimeout(700); } catch { /* no row */ }
  }
});
await shoot(editor, APP + '#/export-utilities', `${OUT}/app-export.png`);
await editor.close();

// Welcome modal (no project)
const welcome = await ctx.newPage();
await shoot(welcome, APP + '#/workspaces', `${OUT}/app-welcome.png`, { clear: true });
await welcome.close();

// Promo / landing
const promo = await ctx.newPage();
await shoot(promo, PROMO, `${OUT}/promo.png`);
await promo.close();

await browser.close();
console.log('done');
