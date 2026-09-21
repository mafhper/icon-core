#!/usr/bin/env node
/**
 * UI budget guard — G1 (CSS hygiene) + legacy `-core-` ratchet + hex ratchet (A5).
 *
 * Reads `.ui-budget.json` and fails on ANY increase:
 *  - `cssLineBudget`: lines per CSS file (plus `ratchetSlack` headroom);
 *  - `coreTsxBudget`: occurrences of `-core-` in scanned `.tsx` (only goes down;
 *    A6 drives it to zero and removes the compat layer);
 *  - `hexTsxBudget`: hex color literals in scanned `.ts/.tsx` (only goes down;
 *    exceptions listed in `hexExceptions`).
 *
 * Ratchet philosophy (004): numbers only descend. To lower a budget after a
 * cleanup PR, edit `.ui-budget.json` in the same commit. Never raise one.
 *
 * Run in CI: node scripts/check-ui-budget.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const budgetPath = path.join(rootDir, '.ui-budget.json');

const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));
const slack = budget.ratchetSlack ?? 0;
const failures = [];
const notes = [];

const countLines = (rel) => fs.readFileSync(path.join(rootDir, rel), 'utf8').split('\n').length;

// --- G1: CSS line budgets -------------------------------------------------
for (const [rel, max] of Object.entries(budget.cssLineBudget ?? {})) {
  const actual = countLines(rel);
  const limit = max + slack;
  const status = actual <= limit ? 'OK  ' : 'FAIL';
  if (actual > limit) failures.push(`${rel}: ${actual} lines > budget ${max} + slack ${slack} = ${limit}`);
  else notes.push(`${status} ${rel}: ${actual} lines (budget ${max} + slack ${slack})`);
}

// --- Legacy `-core-` ratchet ----------------------------------------------
const collectTs = (dir) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectTs(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
};

const scanDirs = ['apps/web/src'];
// `icon-core-project` (default project slug) is not a legacy token: skip
// `core-` followed by `project`. Catches classes (`bg-core-*`), CSS vars
// (`--core-*`) and bare legacy names (`.core-btn`).
const CORE_RE = /(?<![a-zA-Z])core-(?!project\b)/g;
let coreCount = 0;
for (const dir of scanDirs) {
  for (const file of collectTs(path.join(rootDir, dir))) {
    const text = fs.readFileSync(file, 'utf8');
    coreCount += (text.match(CORE_RE) ?? []).length;
  }
}
if (budget.coreTsxBudget !== undefined) {
  if (coreCount > budget.coreTsxBudget) {
    failures.push(`-core- in tsx: ${coreCount} > budget ${budget.coreTsxBudget} (ratchet: only down)`);
  } else {
    notes.push(`OK   -core- in tsx: ${coreCount} (budget ${budget.coreTsxBudget})`);
  }
}

// --- Hex literal ratchet ----------------------------------------------------
const hexExceptions = new Set(budget.hexExceptions ?? []);
let hexCount = 0;
for (const dir of budget.hexScanDirs ?? []) {
  for (const file of collectTs(path.join(rootDir, dir))) {
    const rel = path.relative(rootDir, file).replace(/\\/g, '/');
    if (hexExceptions.has(rel)) continue;
    const text = fs.readFileSync(file, 'utf8');
    hexCount += (text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
  }
}
if (budget.hexTsxBudget !== undefined) {
  if (hexCount > budget.hexTsxBudget) {
    failures.push(`hex literals in ts/tsx: ${hexCount} > budget ${budget.hexTsxBudget} (ratchet: only down)`);
  } else {
    notes.push(`OK   hex literals in ts/tsx: ${hexCount} (budget ${budget.hexTsxBudget})`);
  }
}

// --- Orphan class ratchet (D2) ----------------------------------------------
// A class counts as *used* when the sources reference it literally, or when it
// matches an explicitly declared dynamic pattern (template literals such as
// `is-${side}`). Patterns are declared, never auto-derived: a new dynamic class
// must be acknowledged in `.ui-budget.json`, which keeps the ratchet honest.
// Anything ambiguous stays in `allow` with a justification — D2 removes known
// debt, it does not anticipate product decisions.
//
// Declared patterns (D2, 2026-09-21):
//   `ic-toast-`  → ToastViewport: `ic-toast-${toast.variant}` (success/error/info)
//   `is-`        → PanelResizer `is-${side}` (left/right) and QualityWarnings `is-${tone}` (error/warning)
//   allow: `react-colorful` → third-party class targeted by the `.ic-picker` override (not ours to remove)
const orphan = budget.orphanCheck ?? {};
if (orphan.css) {
  const orphanCss = fs.readFileSync(path.join(rootDir, orphan.css), 'utf8');
  const classNames = new Set();
  for (const match of orphanCss.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) classNames.add(match[1]);

  const sources = [];
  for (const dir of orphan.scanDirs ?? []) {
    for (const file of collectTs(path.join(rootDir, dir))) sources.push(fs.readFileSync(file, 'utf8'));
  }

  const allow = new Set(orphan.allow ?? []);
  const dynamicPatterns = orphan.dynamicPatterns ?? [];
  const orphans = [...classNames]
    .filter((name) => !allow.has(name))
    .filter((name) => !dynamicPatterns.some((pattern) => name.startsWith(pattern)))
    .filter((name) => !sources.some((text) => text.includes(name)))
    .sort();

  if (orphans.length > 0) {
    failures.push(`orphan CSS classes in ${orphan.css}: ${orphans.join(', ')}`);
  } else {
    notes.push(`OK   orphan CSS classes in ${orphan.css}: 0 (of ${classNames.size} scanned)`);
  }
}

for (const n of notes) console.log(n);
if (failures.length > 0) {
  console.error('\nUI budget guard FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nUI budget guard OK: no budget increased.');
