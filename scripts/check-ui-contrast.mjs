#!/usr/bin/env node
/**
 * UI contrast guard (A5).
 *
 * Parses the solid `--ic-*` color tokens from `packages/iconcore-ui` and
 * checks WCAG 2.x contrast ratios for the text-on-surface pairs the UI
 * actually renders. `color-mix()` pairs are skipped (not statically
 * resolvable) and reported as such.
 *
 * Run in CI: bun scripts/check-ui-contrast.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const tokensPath = path.join(rootDir, 'packages', 'iconcore-ui', 'src', 'tokens', 'tokens.css');

const css = fs.readFileSync(tokensPath, 'utf8');

// Split into theme blocks. Dark lives in `:root, [data-theme='dark'] {...}`
// (a second bare `:root {...}` holds theme-independent Layer 3 sizes).
const block = (selector) => {
  const esc = selector.replace(/[[\]']/g, '\\$&');
  const re = new RegExp(`(?:^|\\n)${esc}[^{]*{([^}]*)}`, 's');
  const m = css.match(re);
  return m ? m[1] : '';
};

const parseVars = (body) => {
  const vars = {};
  for (const [, name, value] of body.matchAll(/(--ic-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    vars[name.trim()] = value.trim();
  }
  return vars;
};

const resolveVar = (vars, value, depth = 0) => {
  if (depth > 5) return value;
  const m = value.match(/^var\((--ic-[a-z0-9-]+)\)$/);
  if (m && vars[m[1]]) return resolveVar(vars, vars[m[1]], depth + 1);
  return value;
};

const parseColor = (value) => {
  let m = value.match(/^#([0-9a-fA-F]{6})$/);
  if (m) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  m = value.match(/^#([0-9a-fA-F]{3})$/);
  if (m) {
    const [r, g, b] = [...m[1]].map((c) => parseInt(c + c, 16));
    return [r, g, b, 1];
  }
  m = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
  return null;
};

const luminance = ([r, g, b]) => {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const ratio = (fg, bg) => {
  // Composite translucent fg over bg first.
  const a = fg[3];
  const flat = [0, 1, 2].map((i) => Math.round(fg[i] * a + bg[i] * (1 - a)));
  const l1 = luminance(flat);
  const l2 = luminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
};

// [fg token, bg token, minimum ratio, note]
const PAIRS = [
  ['--ic-text', '--ic-bg', 4.5, 'body text'],
  ['--ic-text', '--ic-surface', 4.5, 'body text on panels'],
  ['--ic-text', '--ic-elevated', 4.5, 'body text on controls'],
  ['--ic-text-muted', '--ic-bg', 4.5, 'secondary text'],
  ['--ic-text-muted', '--ic-surface', 4.5, 'secondary text on panels'],
  ['--ic-text-muted', '--ic-elevated', 4.5, 'secondary text on controls'],
  ['--ic-text-faint', '--ic-bg', 3.0, 'decorative only (labels carry text via stronger tokens)'],
  ['--ic-on-accent', '--ic-accent', 4.5, 'text on accent fills'],
  ['--ic-accent', '--ic-bg', 3.0, 'accent as text (large/bold headings only)'],
  ['--ic-danger', '--ic-bg', 3.0, 'danger as text (large/bold only)'],
  ['--ic-success', '--ic-bg', 3.0, 'success as text (large/bold only)'],
  ['--ic-warning', '--ic-bg', 3.0, 'warning as text (large/bold only)']
];

const themes = {
  dark: parseVars(block(':root')),
  light: parseVars(block("[data-theme='light']"))
};

// A6 fixed the two pre-existing shortfalls (dark accent #4a7cf0 -> #3f6ce0,
// light faint #8f9297 -> #86898f; primary Button flattened), so every pair
// below is enforced: any regression fails the gate. `--ic-text-faint` keeps
// a 3.0 floor (decorative by contract, never the sole carrier).
const ADVISORY = new Set();

let failed = 0;
for (const [themeName, vars] of Object.entries(themes)) {
  console.log(`\n[${themeName}]`);
  for (const [fgTok, bgTok, min, note] of PAIRS) {
    const fgRaw = resolveVar(vars, vars[fgTok] ?? '');
    const bgRaw = resolveVar(vars, vars[bgTok] ?? '');
    const fg = parseColor(fgRaw);
    const bg = parseColor(bgRaw);
    if (!fg || !bg) {
      console.log(`  SKIP ${fgTok} on ${bgTok} (not statically resolvable: ${fgRaw} / ${bgRaw})`);
      continue;
    }
    const r = ratio(fg, bg);
    const advisory = ADVISORY.has(fgTok);
    const ok = r >= min ? 'OK  ' : advisory ? 'WARN' : 'FAIL';
    if (r < min && !advisory) failed += 1;
    console.log(`  ${ok} ${fgTok} on ${bgTok} = ${r.toFixed(2)}:1 (min ${min}:1 — ${note})`);
  }
}

if (failed > 0) {
  console.error(`\nUI contrast guard FAILED: ${failed} pair(s) below minimum.`);
  process.exit(1);
}
console.log('\nUI contrast guard OK: all enforced pairs meet their minimums.');
