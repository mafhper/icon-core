#!/usr/bin/env node
/**
 * Promo contrast guard (IC79 S5, ADR-026).
 *
 * The landing page carries its own palette (`apps/promo/src/index.css`, zero
 * `--ic-*` tokens) and had no instrument at all: the light `--primary` /
 * `--primary-foreground` pair shipped at 3.95:1 while the app's kit was already
 * gated at 4.5:1. This script measures the pairs the promo actually paints, in
 * every theme the appearance control can reach (light, dark, mono), and fails
 * below 4.5:1.
 *
 * Deliberately unlike `check-ui-contrast.mjs` in one place: a value that cannot
 * be resolved is a FAILURE, not a SKIP. The sibling script prints `SKIP` for
 * `color-mix()` tokens, and a skipped pair is a gate that silently stops gating.
 * Here the five pairs are an explicit list, so anything unresolvable is a
 * decision someone has to make, not a line in the log.
 *
 * Run in CI: node scripts/check-promo-contrast.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const cssPath = path.join(rootDir, 'apps', 'promo', 'src', 'index.css');

// Comments are stripped first: the token blocks are introduced by comments that
// mention the selectors, and a first-match parser would latch onto the prose
// (the sibling guard documents exactly this failure).
const css = fs.readFileSync(cssPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Bodies of every rule whose selector is exactly `selector`.
 *
 * The file declares `:root` twice (legacy page tokens, then the shell tokens),
 * so all matches are returned in source order and merged by the caller — same
 * cascade a browser applies for equal specificity. The selector must be
 * followed by its brace, so `.dark` cannot latch onto `.dark-foo {` and
 * `.mono` cannot latch onto `.monospace {`.
 */
const blocks = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
  const rx = new RegExp(`(?:^|[}\\s])${escaped}\\s*\\{`, 'g');
  const bodies = [];
  let match;
  while ((match = rx.exec(css)) !== null) {
    const open = match.index + match[0].length - 1;
    let depth = 0;
    for (let i = open; i < css.length; i++) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          bodies.push(css.slice(open + 1, i));
          break;
        }
      }
    }
  }
  return bodies;
};

const parseVars = (body) => {
  const vars = {};
  for (const [, name, value] of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    vars[name.trim()] = value.trim();
  }
  return vars;
};

const merge = (selector) => Object.assign({}, ...blocks(selector).map(parseVars));

// Theme maps as the stylesheet composes them. `<html>` gets `.dark` or `.mono`
// toggled by `studio-context.tsx` (never both, and mono renders its own light
// greyscale set), so both are the light base with one override block on top.
const themes = {
  light: merge(':root'),
  dark: { ...merge(':root'), ...merge('.dark') },
  mono: { ...merge(':root'), ...merge('.mono') }
};

const resolveVar = (vars, value, depth = 0) => {
  if (value === undefined) return null;
  if (depth > 5) return null;
  const m = value.match(/^var\((--[a-z0-9-]+)\)$/);
  if (!m) return value;
  return resolveVar(vars, vars[m[1]], depth + 1);
};

/** oklch -> sRGB, channels as floats in 0..255 (no 8-bit rounding: the ratio a
 *  browser paints is computed from the unrounded color). Clipping happens in
 *  linear space, which is exact for the in-gamut colors this palette uses. */
const oklchToRgb = (L, C, H) => {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ];

  return linear.map((channel) => {
    const c = Math.min(1, Math.max(0, channel));
    const srgb = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.min(1, Math.max(0, srgb)) * 255;
  });
};

/** [r, g, b, a] with channels 0..255, or null when the value is not a color
 *  this guard can resolve statically. */
const parseColor = (value) => {
  if (typeof value !== 'string') return null;
  const text = value.trim();

  let m = text.match(/^#([0-9a-fA-F]{6})$/);
  if (m) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  m = text.match(/^#([0-9a-fA-F]{3})$/);
  if (m) {
    const [r, g, b] = [...m[1]].map((c) => parseInt(c + c, 16));
    return [r, g, b, 1];
  }
  m = text.match(/^rgba?\(\s*([\d.]+)\s*,?\s*([\d.]+)\s*,?\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (m) {
    const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
    return [Number(m[1]), Number(m[2]), Number(m[3]), alpha];
  }
  m = text.match(/^oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+)(?:deg)?(?:\s*\/\s*([\d.]+%?))?\s*\)$/);
  if (m) {
    const num = (raw) => (raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 : Number(raw));
    const alpha = m[4] === undefined ? 1 : num(m[4]);
    return [...oklchToRgb(num(m[1]), num(m[2]), Number(m[3])), alpha];
  }
  return null;
};

const toHex = ([r, g, b]) =>
  `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

const luminance = ([r, g, b]) => {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const ratio = (fg, bg) => {
  const flat = fg[3] < 1 ? [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])) : fg;
  const l1 = luminance(flat);
  const l2 = luminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
};

// [fg token, bg token, minimum ratio, what the pair paints]
// 4.5:1 throughout: all five pairs carry small text (body copy, card copy,
// button/pill/badge labels, secondary copy), so the AA normal-text floor
// applies. A 3:1 floor would only fit decorative roles, and none of these is.
const PAIRS = [
  ['--foreground', '--background', 4.5, 'body copy'],
  ['--card-foreground', '--card', 4.5, 'copy on cards'],
  ['--primary-foreground', '--primary', 4.5, 'primary button, active pill, footer badge'],
  ['--muted-foreground', '--background', 4.5, 'secondary copy'],
  ['--muted-foreground', '--card', 4.5, 'secondary copy on cards']
];

let failed = 0;

const checkPairs = (themeName, vars) => {
  console.log(`\n[${themeName}]`);
  for (const [fgToken, bgToken, min, note] of PAIRS) {
    const fgRaw = resolveVar(vars, vars[fgToken]);
    const bgRaw = resolveVar(vars, vars[bgToken]);
    const fg = parseColor(fgRaw);
    const bg = parseColor(bgRaw);

    if (!fg || !bg) {
      failed += 1;
      console.log(`  FAIL ${fgToken} on ${bgToken} — unresolved (${fgRaw ?? 'missing'} / ${bgRaw ?? 'missing'})`);
      continue;
    }
    // A translucent background has no statically known backdrop: refusing it is
    // the honest answer, and it keeps the gate from measuring the wrong pixel.
    if (bg[3] < 1) {
      failed += 1;
      console.log(`  FAIL ${fgToken} on ${bgToken} — background is translucent (${bgRaw})`);
      continue;
    }

    const r = ratio(fg, bg);
    const ok = r >= min;
    if (!ok) failed += 1;
    console.log(
      `  ${ok ? 'OK  ' : 'FAIL'} ${fgToken} on ${bgToken} = ${r.toFixed(2)}:1 ` +
        `(min ${min}:1 — ${note}) [${toHex(fg)} on ${toHex(bg)}]`
    );
  }
};

for (const [themeName, vars] of Object.entries(themes)) checkPairs(themeName, vars);

if (failed > 0) {
  console.error(`\nPromo contrast guard FAILED: ${failed} pair(s) below minimum or unresolved.`);
  process.exit(1);
}
console.log('\nPromo contrast guard OK: all promo pairs meet their minimums.');
