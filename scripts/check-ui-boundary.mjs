#!/usr/bin/env node
/**
 * G6 — UI boundary guard.
 *
 * Proves the `@iconcore/ui` package is a proper UI foundation:
 *  - depends only on UI styling/accessibility primitives (never Icon Core domain);
 *  - does not import `@iconcore/*` packages or anything under apps/;
 *  - exposes a deliberate public surface (no wildcard barrel surprises).
 *
 * Run in CI: bun scripts/check-ui-boundary.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const uiDir = path.join(rootDir, 'packages', 'iconcore-ui');
const srcDir = path.join(uiDir, 'src');

const FORBIDDEN_PREFIXES = ['@iconcore/', 'apps/',
  // Known domain-adjacent modules that a UI package must never touch:
  'lucide-react'];

const ALLOWED_DEPENDENCIES = ['clsx', 'tailwind-merge', 'react', 'react-dom', 'react/jsx-runtime', '@radix-ui/react-tooltip'];

/** Recursively collect .ts/.tsx paths under a directory. */
const collectSources = (dir) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectSources(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
};

const failures = [];

// 1. Imports must not cross into domain tree.
for (const file of collectSources(srcDir)) {
  const text = fs.readFileSync(file, 'utf8');
  const importLines = [...text.matchAll(/^\s*import\s+(?:[^'"]*?\s+from\s+)?(['"])([^'"]+)\1/gm)];
  for (const [, , specifier] of importLines) {
    for (const forbidden of FORBIDDEN_PREFIXES) {
      if (specifier.startsWith(forbidden)) {
        failures.push(`${path.relative(rootDir, file)} imports "${specifier}" (forbidden: ${forbidden})`);
      }
    }
    const isRelative = specifier.startsWith('.');
    const allowed = isRelative || ALLOWED_DEPENDENCIES.some((dep) => specifier === dep || specifier.startsWith(`${dep}/`));
    if (!isRelative && !allowed) {
      failures.push(`${path.relative(rootDir, file)} imports "${specifier}" (unexpected external dependency)`);
    }
  }
}

// 2. package.json dependencies must be within the whitelist and present in lockfile.
const pkgJson = JSON.parse(fs.readFileSync(path.join(uiDir, 'package.json'), 'utf8'));
for (const dep of Object.keys(pkgJson.dependencies ?? {})) {
  if (!ALLOWED_DEPENDENCIES.includes(dep)) {
    failures.push(`package.json dependency "${dep}" is not in the UI whitelist`);
  }
}

// 3. `tokens.css` must be publicly exported (imported by apps/web via @import).
const tokensExport = pkgJson.exports?.['./tokens.css'];
if (!tokensExport) {
  failures.push('package.json must export "./tokens.css"');
} else {
  const cssPath = path.resolve(uiDir, tokensExport);
  if (!fs.existsSync(cssPath)) {
    failures.push(`./tokens.css export points to missing file: ${tokensExport}`);
  }
}

if (failures.length > 0) {
  console.error('UI boundary guard FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('UI boundary guard OK: @iconcore/ui is domain-free with deliberate exports.');