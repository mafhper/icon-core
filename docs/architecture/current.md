# IconCore Architecture

Orientation for reading the codebase. **The code and the tests are the source of
truth**; this document only helps you find your way. There is deliberately no
version table here — versions live in `package.json` files and go stale the day
someone writes them down twice.

If this file ever contradicts the code, the code is right and this file is a bug.
Fix it in the same commit that reveals it.

---

## 1. Shape of the workspace

An npm workspace: three apps on top of seven packages. Everything is TypeScript
with `tsc -p tsconfig.build.json` (composite projects), and every package
resolves its neighbours through `dist/`, not `src/` — so **edit a package, then
rebuild it** (`npm run build:packages`) before the apps or the tests can see the
change.

```
                 ┌──────────────────┐
                 │  shared          │  domain types, zero dependencies
                 └────────┬─────────┘
          ┌───────────────┼───────────────┐
          │               │               │
    ┌─────▼─────┐  ┌──────▼──────┐  ┌─────▼──────┐
    │  engine   │  │  renderer   │  │  validator │
    │  schema   │  │  canvas+svg │  │  audit     │
    │  migration│  └──────┬──────┘  └─────┬──────┘
    └─────┬─────┘         │               │
          │         ┌─────▼───────────────▼─────┐
          │         │  exporters               │  plan + encode + attach
          │         └─────────────┬─────────────┘
    ┌─────▼────────────────────────▼─────┐
    │  cli                                │  build / audit / create / inspect
    └─────────────────────────────────────┘

    ┌──────────────┐        ┌──────────────┐
    │  ui          │        │  (no @iconcore│  design-system primitives
    │  (React)     │        │   imports)   │
    └──────────────┘        └──────────────┘

    apps/web ──► shared, engine, renderer, exporters, validator, ui
    apps/promo ──► nothing internal (landing page is standalone)
    apps/desktop ──► wraps the apps/web build in a Tauri shell
```

The build order that falls out of this graph, and that `build:packages`
encodes, is:

```
shared → engine → renderer → validator → exporters → cli → ui
```

`packages/iconcore-ui` is deliberately independent — a guard
(`scripts/check-ui-boundary.mjs`) forbids it from importing any `@iconcore/*`
package, `apps/`, or `lucide-react`. That is what keeps the design system
portable.

---

## 2. The domain model

One file: `packages/iconcore-shared/src/index.ts`. No subdirectories, no
barrels. It holds every domain type and nothing else imports a domain type from
anywhere else.

| Type | Role |
|---|---|
| `IconCoreProject` | the document: `schemaVersion`, `metadata`, `canvas`, `layers`, `variants`, `targets`, `exportProfile` |
| `IconLayer` | one entry in the layer stack — `kind` is `shape \| text \| image \| svg` |
| `LayerSource` | `inline` (base64 in the document) or `reference` (a path), plus the optional `shape` rectangle |
| `Fill` | discriminated union: `solid \| linear-gradient \| radial-gradient \| angular-gradient \| diamond-gradient \| none` |
| `ImageFilter` | `hue \| saturation \| brightness \| contrast`, in CSS-filter units (100 = unchanged) |
| `ExportPlan` | what the export screen edits: a list of artifacts plus declared attachments |

Three details that are easy to get wrong:

- **`Fill.kind === 'none'` means "no paint", not "transparent black".** It
  preserves the alpha channel. This is what makes a transparent background
  expressible at all.
- **`layer.role === 'background'` is a UI handle, not a layer.** It is the
  selectable stand-in for `canvas.background` and never produces pixels. Both
  render pipelines filter it out. Identify it by `role`, never by
  `name === 'Background'`.
- **`schemaVersion` is `3`.** The v2 shape does not live in `shared` — it is
  `IconCoreProjectV2` inside the engine, because it exists only to be migrated
  away from. "v1" is `ProjectConfig`, a different and much smaller thing
  (name, start URL, theme) with no layers at all.

---

## 3. Two render pipelines, one geometry

This is the part worth understanding before touching anything.

The same project renders two ways, and they must agree:

```
project ─┬─► composeLayers ──► Canvas 2D ──► Blob (png/webp/jpeg/ico/icns)
         │
         └─► renderToSvg ────► SVG string ──► Blob (svg)
```

**`composeLayers.ts`** walks layers in `zIndex` order and, per layer, applies
the CSS filter, blend mode, opacity, shadow, then the transform, then paints the
text / shape / image. **The transform pivots on the canvas centre** —
`backends/canvas.ts:applyTransform` composes
`translate(S/2 + x, S/2 + y) → rotate → scale → translate(-S/2, -S/2)`, so
`x`/`y` are offsets *from* the centre and scale/rotate are *about* it.

**`renderToSvg.ts`** builds a string (no DOM) and must mirror that matrix
exactly. `layerTransformAttr` there is written as a mirror of
`applyTransform`, and a comment says the two must move together. Shapes are
drawn centred at `((S − w) / 2, (S − h) / 2)` for the same reason.

The parity contract is **tested geometrically, not by string comparison**:
`packages/iconcore-renderer/tests/renderToSvgTransform.spec.ts` evaluates the
emitted SVG transform over the layer rectangle with its own matrix evaluator and
compares the result against the geometry `composeLayers` would produce. If you
change one transform, that test is the thing that tells you whether the other
one moved with it.

`geometry.ts:layerBaseRect` is the shared answer to "what rectangle does this
layer occupy" — used by the Canvas2D renderer, the SVG renderer, and the
editor's interaction overlay, precisely so the three cannot drift.

### What the two pipelines do differently, on purpose

- **Gradients.** SVG has no conic gradient, so `angular` and `diamond` fills are
  approximated with ~180 primitive wedges in both pipelines — the Canvas side
  via `createConicGradient` where available, the SVG side via clipped polygons.
- **Raster layers in SVG.** They are embedded as `data:` URIs only when the
  caller resolved the natural size. Without a size the layer is **omitted with
  a warning** rather than emitted at the wrong dimensions.
- **The safe area is a guide, never a crop.** `renderProject` deliberately
  passes `undefined` for it. Icons export full bleed and each platform applies
  its own mask; the safe-area shape is drawn in the editor overlay and checked
  by the validator.

---

## 4. Export: validate → plan → execute → attach

`packages/iconcore-exporters/src/pipeline/` is the whole flow, orchestrated by
`executePlan`:

| Stage | File | Does |
|---|---|---|
| validate | `validate.ts` | structural problems **block** (duplicate ids, extension ≠ format, a container with no valid `entries`); nature warnings **do not** (JPEG with no alpha, `opaque` requested on a transparent canvas, ICO without a 256 entry) |
| plan | `plan.ts` | expands enabled artifacts and variants, resolves output paths from `{name} {variant} {format} {size} {target}` tokens, and derives each artifact's `kind`/`mime`/`size`. Purely structural — nothing is rendered here |
| execute | `../encoders/` | one `encodeArtifact` per planned artifact, dispatched by **nature derived from the format** |
| attach | `attachments.ts` | only the attachments the plan **declares**: web manifest, browserconfig, report, preview sheet, readme — plus `WARNINGS.txt` when anything warned |

Nature is derived, never stored: `kindOf(format)` maps a format to `raster`,
`vector` or `container`. `encodeArtifact` switches on that.

Nine presets live in `presets/registry.ts` (`tauri`, `electron`, `web`, `pwa`,
`windows`, `macos`, `desktop-generic`, `marketing`, `custom`). A preset is a
convenience generator for an initial plan; once you have a plan, the plan is what
the editor manipulates.

---

## 5. Supporting packages

**`engine`** — in practice this is now *only* schema migration
(`schema-v2/migration.ts`: v1→v2, v2→v3, and `migrateToCurrent` as the
composition). The v1 generation pipeline that also lives here
(`buildGenerationPlan`, `resolveSources`, `buildOutputMap`, `generateManifest`)
is consumed only by this package's own tests and its snapshot — no app or
package imports it. Treat it as legacy until someone deletes it or wires it up.

**`validator`** — a single file exporting `auditProject(project)`. Seven checks:
metadata, layers, WCAG contrast between the canvas background and each visible
solid layer fill, safe-area containment, minimum stroke width, and a note on
text in icons. Returns `{ valid, issues, score }`.

**`cli`** — `iconcore build | audit | create | inspect`. `create`, `inspect` and
`audit` work. **`build` does not run**: it calls `createNodeBackend()`, which
throws unconditionally, and no test covers that command. The web app is the
working export path.

**`ui`** — the design system: ~74 semantic `--ic-*` tokens per theme plus 19
React primitives. Apps import the CSS subpath and let the Tailwind `@source`
glob pick up the class names, so a token that is not mapped into the app's
`@theme` silently compiles to nothing.

---

## 6. Apps

**`apps/web`** — the editor. All logic lives in `src/composer/`: a reducer
(`composerReducer.ts`) holding the project, selection, variants and history;
a context that adds `localStorage` restore, a debounced autosave, and hash
routing (`#/workspaces`, `#/edit-space`, `#/export-utilities`, `#/ui`); and the
views and panels. Export runs `executePlan` against a canvas backend, then ships
the files as a zip, as individual saves, or to a folder on desktop.

**`apps/promo`** — the landing page. It imports nothing from `@iconcore/*` on
purpose; its icon pack in `public/branding/` is real generated output, not
mock-ups. This is the app the Playwright suite and the Pages deploy target.

**`apps/desktop`** — a Tauri shell around the `apps/web` build. One Rust
command: `save_generated_files`, which opens a folder picker, validates that
every path is relative and free of `..`, and writes the base64 blobs there.

---

## 7. Where the seams are

If you are adding a capability, these are the places that will push back:

- **A new layer property** has to be added in three places or it will render in
  one pipeline and not the other: the type in `shared`, `composeLayers`, and
  `renderToSvg`. The parity test will catch the third.
- **A new export format** needs a MIME, an extension, and a nature in
  `shared`'s format tables, an encoder, and — if it is a container — its own
  writer. `EXTENSION_FOR_FORMAT` and `kindOf` must agree or validation fails.
- **A new UI token** needs to be defined in `tokens.css` for both themes, and —
  if it is used as text — added to `scripts/check-ui-contrast.mjs`, which
  enforces the WCAG minimum and fails CI otherwise.
- **A schema change** needs a migration step and must remain idempotent:
  projects get re-opened and re-saved repeatedly.

---

## 8. Honest gaps

Things a reader will otherwise waste time rediscovering:

- The **engine's v1 generation pipeline is dead** in the app (see §5).
- **`createWorkerBackend` is unreachable**: it is not exported from the
  renderer's public entry point and imported nowhere.
- **`createNodeBackend` throws**, which is why `iconcore build` cannot run.
- **Geometry between the two pipelines is still partly duplicated.** They agree
  on the transform, on layer placement and on polygon outlines because tests
  say so, not because one shared implementation serves both. Adding a shape kind
  means touching both.
- No visual gate compares a rasterised Canvas render against the SVG export
  with a tolerance. The parity tests work on geometry, which is cheaper and
  catches the class of bug that actually shipped, but it is not the same thing
  as pixel agreement.