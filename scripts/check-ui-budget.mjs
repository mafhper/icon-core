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
 * Run in CI: bun scripts/check-ui-budget.mjs
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
// `icon-core` (product name, e.g. the default 'icon-core-project' slug) is not
// a legacy token: negative lookbehind keeps the ratchet focused on classes
// (`bg-core-*`) and CSS vars (`--core-*`).
const CORE_RE = /(?<!icon)-core-/g;
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

for (const n of notes) console.log(n);
if (failures.length > 0) {
  console.error('\nUI budget guard FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nUI budget guard OK: no budget increased.');
