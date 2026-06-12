# IconCore Architecture — Current State

**Version:** v1.0.0
**Last updated:** 2026-06-12

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