# IconCore Architecture — Current State

> ## ⚠️ SUPERSEDED — do not use this document
>
> This file describes **v1.0.0 (2026-06-12)** and the app has moved well past it.
> It is kept only as a historical record.
>
> **Verified wrong on 2026-09-30** — the code and the tests are the source of truth:
>
> | This document says | Reality |
> |---|---|
> | Runtime: Bun 1.3.5 | npm (`packageManager: npm@10.9.2`), Node 22 |
> | Vite 7.3 | Vite 8.2.2 (pinned by root `overrides`) |
> | TypeScript 5.9.2 | `^5.9.3` |
> | Tailwind CSS 3.4 | Tailwind CSS 4.3.3 |
> | Vitest 3.2 — 13 tests | 85 tests in `@iconcore/renderer` alone; 39 spec files repo-wide |
> | Playwright 1.55 — 1 test | 4 e2e spec files |
> | No layer composition | full layer system (shape / text / image / SVG) |
> | Fixed targets: web/PWA only | 9 export presets incl. Tauri, Electron, desktop |
> | Limited variants: default/light/dark | `mono` exists too |
> | No project persistence | `.iconcore.json`, `schemaVersion: 3` |
> | No CLI, no CI/CD | `@iconcore/cli` + full CI workflow set |
> | No router | hash routing (`#/export-utilities`, `#/ui`, `#/workspaces`) |
> | ZIP-only export | destination is `zip` / `folder` / `files` |
>
> It also points at three files that **no longer exist**: `App.tsx`,
> `useGeneration.ts`, `imageProcessor.ts` — and all four "Technical Debt" entries
> describe those dead files.
>
> **To learn the architecture, read the code and the tests.** Start at
> `packages/iconcore-shared/src/index.ts` (the domain types), then
> `packages/iconcore-renderer/src/composeLayers.ts` (the Canvas2D pipeline) and
> `packages/iconcore-renderer/src/renderToSvg.ts` (the SVG pipeline). Both
> pipelines are held to the same geometry by
> `packages/iconcore-renderer/tests/renderToSvgTransform.spec.ts`.

**Version:** v1.0.0 — *superseded, see the banner above*
**Last updated:** 2026-06-12 — *banner added 2026-09-30*

---

## Package Dependencies

```
@iconcore/shared (0 external deps)
       |
       v
@iconcore/engine (depends on shared)
       |
       v
@iconcore/web (depends on engine + shared)
       |
       v
@iconcore/desktop (wraps web via Tauri)

@iconcore/promo (standalone, no internal deps)
```

## Generation Pipeline (v1)

```
UploadState (user files)
       |
       v
resolveSources(SourceMatrix<T>) -> ResolvedSources<T>
  - Detects 'default' or 'themed' mode
  - Fallbacks: explicit -> light/dark favicon -> master
       |
       v
buildGenerationPlan(ResolvedSources, BuildPlanOptions) -> GenerationTask<T>[]
  - Apple touch icons: 180, 152, 120
  - Favicons: 16, 32, 48 (PNG + ICO)
  - PWA: 192, 512 (regular + maskable)
  - Social: 1200x630, 1200x600
  - Base: logo.svg (passthrough) + logo.png (1024x1024)
  - Themed: duplicates all for light/ and dark/
       |
       v
processImage(source, task, options) -> ProcessResult (blob + contrast)
  - Canvas 2D: resize + padding + background
  - WCAG contrast calculation
       |
       v
generateIco([{16,32}]) -> Blob (ICO binary)
       |
       v
buildOutputMap(tasks) -> OutputEntry[] (deduplicated, sorted)
       |
       v
generateManifest(options) -> IconManifest
       |
       v
JSZip -> download .zip
```

## Key Files

### @iconcore/shared (45 lines)
- `src/index.ts`: Locale, UiTheme, OutputMode, ThemedVariant, ProjectConfig, BRAND_COLORS, detectLocale

### @iconcore/engine (380 lines)
- `src/types.ts`: SourceMatrix, ResolvedSources, GenerationTask, OutputEntry, IconManifest
- `src/resolveSources.ts`: Mode detection + favicon fallbacks
- `src/buildGenerationPlan.ts`: Task generation per size/variant
- `src/buildOutputMap.ts`: Path deduplication
- `src/generateManifest.ts`: PWA manifest generation

### @iconcore/web (~1400 lines)
- `src/app/App.tsx` (378): Main component — state, render, handlers
- `src/features/generation/useGeneration.ts` (269): Generation orchestration hook
- `src/lib/imageProcessor.ts` (151): Canvas 2D render engine
- `src/lib/icoGenerator.ts` (40): ICO binary format writer
- `src/lib/desktopExport.ts` (57): Tauri IPC bridge

### @iconcore/desktop (shell only)
- `src-tauri/src/main.rs` (65): save_generated_files command (Rust)

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun 1.3.5 |
| Language | TypeScript 5.9.2 (strict) |
| Package build | tsc (composite project references) |
| App build | Vite 7.3 |
| UI | React 19 + JSX automatic runtime |
| CSS | Tailwind CSS 3.4 + CSS custom properties |
| Unit tests | Vitest 3.2 (13 tests) |
| E2E tests | Playwright 1.55 (1 test) |
| Lint | ESLint 9 flat config |
| Desktop | Tauri v2 (Rust) |
| Export | JSZip + FileSaver |
| Render | Canvas 2D + createImageBitmap |

## Known Limitations

1. No layer composition — single image master only
2. Fixed targets — web/PWA only, no Tauri/Electron/desktop
3. No contextual preview — no browser tab, dock, PWA card mockups
4. Limited variants — default/light/dark only
5. No automatic validation — contrast and safe area not checked
6. Monolithic UI — App.tsx has 378 lines mixing state, render, and logic
7. No project persistence — uploads lost on reload
8. No CLI — no CI/CD integration
9. No router — single page SPA
10. ZIP-only export — no direct folder save (except desktop via Tauri)

## Technical Debt

1. App.tsx (378 lines) mixes global state, handlers, and render
2. useGeneration.ts (269 lines) has inline ICO logic — extractable
3. imageProcessor.ts uses willReadFrequently — may be slow with many layers
4. No React component tests
5. No SVG invalid error handling
6. No progress feedback during generation
7. generateManifest assumes fixed folder structure
8. buildGenerationPlan uses hardcoded sizes and paths