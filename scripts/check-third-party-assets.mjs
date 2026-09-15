#!/usr/bin/env node
/**
 * Guard for third-party assets (runs in CI as part of the lint gate).
 *
 * Reads `third-party/manifest.json` and fails if:
 *  - any asset is missing required license metadata (name, source, license,
 *    and exactly one of licenseFile | licenseUrl);
 *  - a declared `licenseFile` does not exist on disk;
 *  - a declared `files` path does not exist on disk (once populated with
 *    asset files, e.g. the Rune Icons SVGs in PR-09).
 *
 * Exit code 0 = all registered assets carry valid metadata.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'third-party', 'manifest.json');

const REQUIRED_STRING_FIELDS = ['id', 'name', 'source', 'license'];
const LICENSE_TEXT_OPTIONS = ['licenseFile', 'licenseUrl'];

const errors = [];

function fail(message) {
  errors.push(message);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (error) {
  console.error(`third-party guard: cannot read ${manifestPath}: ${error.message}`);
  process.exit(1);
}

if (manifest.version !== 1) {
  fail(`third-party guard: unsupported manifest version ${manifest.version} (expected 1)`);
}

const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
if (assets.length === 0) {
  fail('third-party guard: manifest declares no assets');
}

for (const asset of assets) {
  const id = asset?.id ?? '<unknown>';
  const label = `asset "${id}"`;

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof asset?.[field] !== 'string' || asset[field].trim() === '') {
      fail(`${label}: missing required field "${field}"`);
    }
  }

  const provided = LICENSE_TEXT_OPTIONS.filter((field) => typeof asset?.[field] === 'string');
  if (provided.length === 0) {
    fail(`${label}: must declare exactly one of ${LICENSE_TEXT_OPTIONS.join(' | ')}`);
  }
  if (provided.length > 1) {
    fail(`${label}: must declare exactly one of ${LICENSE_TEXT_OPTIONS.join(' | ')}, got ${provided.join(', ')}`);
  }

  if (provided[0] === 'licenseFile') {
    const filePath = join(root, asset.licenseFile);
    if (!existsSync(filePath)) {
      fail(`${label}: licenseFile "${asset.licenseFile}" does not exist`);
    }
  }

  const files = Array.isArray(asset.files) ? asset.files : [];
  for (const filePath of files) {
    if (typeof filePath !== 'string' || !existsSync(join(root, filePath))) {
      fail(`${label}: file "${String(filePath)}" listed in "files" does not exist`);
    }
  }

  if (typeof asset.files !== 'undefined' && !Array.isArray(asset.files)) {
    fail(`${label}: "files" must be an array of paths`);
  }
}

if (errors.length > 0) {
  console.error('third-party guard FAILED:');
  for (const error of errors) console.error(`  - ${error}`);
  console.error('\nRegister every redistributed asset in third-party/manifest.json with');
  console.error('license metadata + license text under LICENSES/, and reference it in');
  console.error('THIRD_PARTY_LICENSES.md and NOTICE when attribution is required.');
  process.exit(1);
}

console.log(`third-party guard OK: ${assets.length} assets registered with valid license metadata.`);