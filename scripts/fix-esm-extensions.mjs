/**
 * Make the emitted ESM runnable by Node.
 *
 * The workspace compiles with `moduleResolution: "Bundler"`, which is right for
 * the Vite apps — they bundle, and a bundler resolves `./plan` for them. It is
 * wrong for `@iconcore/cli`, whose `bin` ships as raw ESM: Node's ESM loader
 * does not guess extensions, so every relative specifier had to carry `.js`.
 *
 * The consequence was not subtle and not new: `node dist/cli.js --help` died
 * with `ERR_MODULE_NOT_FOUND` on `./commands/build`, and behind it 76 more
 * specifiers across five packages. The CLI had never actually run from its
 * build. Tests import from `../src`, and Vite resolves everything, so nothing in
 * CI ever executed the built binary — the one thing that would have caught it.
 *
 * Why a post-build rewrite instead of changing the source: the alternative is
 * `moduleResolution: NodeNext` plus `.js` on every relative import in every
 * package, which touches the source of packages that are perfectly fine as they
 * are. This only touches what Node actually loads, and it is deterministic.
 */
import fs from 'node:fs';
import path from 'node:path';

const PACKAGES = ['shared', 'engine', 'renderer', 'validator', 'exporters', 'cli', 'ui'];

/** `from './x'` and `import('./x')` — the two forms that need an extension. */
const SPECIFIER = /(\bfrom\s+|\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"]*)\2/g;

const HAS_EXTENSION = /\.(js|mjs|cjs|json|wasm)$/;

/**
 * Resolve a specifier to the file this build actually emitted.
 *
 * Two shapes need handling, and both are things a bundler tolerates and Node
 * does not:
 *
 * - a bare file — `./plan` must become `./plan.js`;
 * - a **directory** — `./presets` must become `./presets/index.js`. Node's ESM
 *   loader rejects directory imports outright (`ERR_UNSUPPORTED_DIR_IMPORT`),
 *   and the barrels are how these packages are organised, so this is the common
 *   case rather than an edge one.
 *
 * Anything with an extension is left alone, and so is a specifier that names
 * neither an emitted file nor an emitted directory index — appending `.js` to
 * it would point at nothing.
 */
const resolveEmitted = (fromDir, specifier) => {
  if (HAS_EXTENSION.test(specifier)) return null;

  const target = path.resolve(fromDir, specifier);
  if (fs.existsSync(`${target}.js`)) return `${specifier}.js`;
  if (fs.existsSync(path.join(target, 'index.js'))) return `${specifier.replace(/\/$/, '')}/index.js`;
  return null;
};

let changedFiles = 0;
let rewrittenSpecifiers = 0;
const unresolved = [];

for (const pkg of PACKAGES) {
  const dist = path.join('packages', `iconcore-${pkg}`, 'dist');
  if (!fs.existsSync(dist)) continue;

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.js')) continue;

      const source = fs.readFileSync(full, 'utf8');
      let touched = 0;

      const next = source.replace(SPECIFIER, (match, lead, quote, specifier) => {
        const fixed = resolveEmitted(dir, specifier);
        if (fixed) {
          touched += 1;
          return `${lead}${quote}${fixed}${quote}`;
        }
        if (!HAS_EXTENSION.test(specifier) && !specifier.endsWith('/')) {
          unresolved.push(`${full} -> ${specifier}`);
        }
        return match;
      });

      if (touched > 0) {
        fs.writeFileSync(full, next, 'utf8');
        changedFiles += 1;
        rewrittenSpecifiers += touched;
      }
    }
  };

  walk(dist);
}

console.log(`esm-extensions: ${rewrittenSpecifiers} specifier(s) em ${changedFiles} arquivo(s)`);

if (unresolved.length > 0) {
  console.error(`\n${unresolved.length} specifier(s) relativo(s) sem extensao e sem alvo emitido:`);
  for (const u of unresolved.slice(0, 10)) console.error(`  ${u}`);
  if (unresolved.length > 10) console.error(`  … e mais ${unresolved.length - 10}`);
  process.exit(1);
}