import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const rawVersion = process.argv[2];
if (!rawVersion) {
  console.error('usage: bun scripts/release-bump.mjs <version>');
  process.exit(1);
}
const version = rawVersion.replace(/^v/, '');
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`invalid version: ${rawVersion} (expected e.g. 1.3.1)`);
  process.exit(1);
}

const jsonFiles = [
  'package.json',
  'apps/desktop/package.json',
  'apps/desktop/src-tauri/tauri.conf.json',
];

for (const rel of jsonFiles) {
  const file = join(repoRoot, rel);
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  const before = pkg.version;
  if (before === version) {
    console.log(`skip  ${rel} (already ${version})`);
    continue;
  }
  pkg.version = version;
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`set   ${rel}: ${before} -> ${version}`);
}

const cargoTomlPath = join(repoRoot, 'apps/desktop/src-tauri/Cargo.toml');
const cargoToml = readFileSync(cargoTomlPath, 'utf8');
const cargoTomlNext = cargoToml.replace(
  /^(version = ")\d+\.\d+\.\d+(")$/m,
  (_match, p1, p2) => `${p1}${version}${p2}`,
);
if (cargoTomlNext !== cargoToml) {
  writeFileSync(cargoTomlPath, cargoTomlNext);
  console.log(`set   apps/desktop/src-tauri/Cargo.toml: -> ${version}`);
} else {
  console.log(`skip  apps/desktop/src-tauri/Cargo.toml (version not found)`);
}

const cargoLockPath = join(repoRoot, 'apps/desktop/src-tauri/Cargo.lock');
const cargoLock = readFileSync(cargoLockPath, 'utf8');
const lines = cargoLock.split('\n');
let inIconcorePackage = false;
let found = false;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line === '[[package]]') {
    inIconcorePackage = false;
    continue;
  }
  if (line.startsWith('name = "') && line.includes('iconcore-desktop')) {
    inIconcorePackage = true;
    continue;
  }
  if (inIconcorePackage && /^version = "\d+\.\d+\.\d+"$/.test(line)) {
    lines[i] = `version = "${version}"`;
    found = true;
    inIconcorePackage = false;
  }
}
if (found) {
  writeFileSync(cargoLockPath, lines.join('\n'));
  console.log(`set   apps/desktop/src-tauri/Cargo.lock: -> ${version}`);
} else {
  console.log(`skip  apps/desktop/src-tauri/Cargo.lock (package not found)`);
}

console.log(`\nnext steps: add .github/release-notes/v${version}.md (if needed) and tag v${version}`);