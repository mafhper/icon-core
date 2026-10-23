#!/usr/bin/env node
/**
 * Public surface guard — the published repository must not cite the private workspace.
 *
 * The flow rule is absolute: a public document never names the local workspace, neither its
 * contents nor its existence. Only the `.gitignore` may name it, because that is the mechanism
 * that keeps it private; it has no extension and is therefore outside the scanned set.
 *
 * Scope is every tracked text file (`git ls-files`), which keeps build output out by
 * construction — `dist/`, `target/` and the private workspace are untracked or ignored.
 * The Tauri ACL schemas are excluded explicitly: they quote remote-domain examples
 * (`*.mydomain.dev`), which are not references. Matching is case-sensitive and token-bounded,
 * so the Apple ICNS type codes (`ic07`…`ic14`) in the encoder cannot pose as internal task ids.
 *
 * Ratchet philosophy, same as `check-ui-budget.mjs`: the numbers only descend. To lower the
 * baseline after a cleanup, edit `.public-surface-baseline.json` in the same commit. Never raise.
 *
 * Measurement correction (2026-10-23): the spec recorded 118 references / 53 files. That count
 * wrapped the workspace-path pattern in a trailing word boundary, which matches the hostname in
 * `vitest.dev/guide` but never matches a real workspace path followed by whitespace or end of
 * line — so it counted one false positive and missed the 11 true workspace-path references.
 * The honest baseline is the number printed by this guard with the correct boundary; this
 * correction is stated here rather than hidden in slack.
 *
 * Run in CI: node scripts/check-public-surface.mjs
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const baselinePath = path.join(rootDir, '.public-surface-baseline.json');

const TEXT_FILE = /\.(md|mdx|txt|ts|tsx|js|jsx|mjs|cjs|css|scss|html|json|yml|yaml|toml|rs|svg|snap|sh|ps1|xml)$/i;

// Build output and generated/vendored artefacts that are tracked but are not prose we author.
const EXCLUDED_PATHS = [
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)dist-pages\//,
  // Assembled from fragments so the guard does not match its own exclusion list.
  new RegExp('(^|/)' + '\\.' + 'dev' + '/'),
  /(^|\/)apps\/desktop\/src-tauri\/target\//,
  /(^|\/)apps\/desktop\/src-tauri\/gen\/schemas\//,
  /(^|\/)apps\/desktop\/src-tauri\/icons\//,
  /\.icns$/i,
];

// A leading non-identifier guard keeps a decision id from matching inside a word; a trailing
// one keeps a task id from matching the start of a longer token. The plan and workspace-path
// patterns are assembled from fragments so this file does not match itself.
const PATTERNS = [
  { label: 'adr', regex: /(?<![A-Za-z0-9_])ADR-\d+(?![A-Za-z0-9_])/g },
  { label: 'task', regex: /(?<![A-Za-z0-9_])[A-Z]{2,4}-N\d+(?![A-Za-z0-9_])/g },
  { label: 'ic', regex: /(?<![A-Za-z0-9_])IC\d{2}(\/\d+|[A-Z])?(?![A-Za-z0-9_])/g },
  { label: 'suggestion', regex: /(?<![A-Za-z0-9_])SUG\d+(?![A-Za-z0-9_])/g },
  { label: 'plan', regex: new RegExp(['system', 'plan'].join('-'), 'g') },
  // A hostname such as `vitest.dev/guide` is not a workspace path: require that the dot is not
  // glued to a domain label. A workspace path is quoted, parenthesised or at a path boundary.
  { label: 'workspace-path', regex: /(?<![A-Za-z0-9.-])\.dev[/\\]/g },
];

if (!fs.existsSync(baselinePath)) {
  console.error('Public surface guard: missing .public-surface-baseline.json (it is versioned; restore it).');
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const baselineReferences = baseline.references;
const baselineFiles = baseline.filesWithReferences;

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: rootDir, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const scanned = tracked
  .filter((rel) => TEXT_FILE.test(rel))
  .filter((rel) => !EXCLUDED_PATHS.some((pattern) => pattern.test(rel)));

const hits = [];
let references = 0;
const hitFiles = new Set();

for (const rel of scanned) {
  const text = fs.readFileSync(path.join(rootDir, rel), 'utf8');
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    let lineReferences = 0;
    for (const { regex } of PATTERNS) {
      regex.lastIndex = 0;
      lineReferences += (line.match(regex) ?? []).length;
    }
    if (lineReferences > 0) {
      references += lineReferences;
      hitFiles.add(rel);
      hits.push({ rel, line: index + 1, text: line.trim() });
    }
  }
}

const files = hitFiles.size;

for (const hit of hits) console.log(`${hit.rel}:${hit.line}  ${hit.text}`);

const remainingReferences = baselineReferences - references;
const remainingFiles = baselineFiles - files;
const failures = [];
if (references > baselineReferences) {
  failures.push(`references: ${references} > baseline ${baselineReferences} (ratchet: only down)`);
}
if (files > baselineFiles) {
  failures.push(`files with references: ${files} > baseline ${baselineFiles} (ratchet: only down)`);
}

if (failures.length > 0) {
  console.error('\nPublic surface guard FAILED:');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error('  To lower the baseline after a cleanup, edit .public-surface-baseline.json in the same commit. Never raise it.');
  process.exit(1);
}

console.log(`OK   public surface: ${references} references in ${files} files (baseline ${baselineReferences} in ${baselineFiles}; ${remainingReferences} references and ${remainingFiles} files of slack left).`);
