# Icon Core

[English](README.md) | [Português (Brasil)](README.pt-BR.md) | [Español](README.es-ES.md)

Icon Core is a free, open-source workspace for app icons. Start from a blank canvas or an existing SVG/PNG/JPG/WebP file, adjust the icon, and export ready-to-use assets for web and desktop projects.

Everything runs locally in the browser or desktop app. No account, upload service, or backend is required.

![Icon Core Edit Space](docs/assets/app-editor.png)

| Start a new icon | Export Utilities |
| --- | --- |
| ![Welcome](docs/assets/app-welcome.png) | ![Export Utilities](docs/assets/app-export.png) |

## Try It

- Web app: https://mafhper.github.io/icon-core/app/
- Landing page: https://mafhper.github.io/icon-core/
- Desktop releases: https://github.com/mafhper/icon-core/releases
- Repository: https://github.com/mafhper/icon-core

[![Icon Core landing page](docs/assets/promo.png)](https://mafhper.github.io/icon-core/)

## Workflows

| Workspace | Use it when |
| --- | --- |
| Create in Edit Space | You want to build an icon from layers, text, shapes, and images. |
| Upload to Export Utilities | You already have a final source file and only need generated assets. |
| Upload, Adjust, Export | You want to import a file, tune it, then generate the final package. |

## Features

- **WYSIWYG canvas** — the live preview renders through the exact same engine as export, so what you see is what you ship
- Layer editing for images, SVG, shapes, and text, with position, scale, rotation, opacity, color, gradient, blend mode, and shadow controls
- Appearance and platform previews (default / light / dark / mono · square / rounded / circle) and per-variant overrides
- Safe area shown as a guide only — icons stay full-bleed so each platform applies its own mask
- Export targets for favicon, PWA, Tauri, Electron, and generic desktop assets
- Flexible output: PNG / WebP / JPEG, quality, nested or flat structure, ZIP or a chosen folder (desktop), compression, an HTML preview sheet, and per-target reports
- Web and desktop apps built from the same project model

## Development

Prerequisites:

- Bun 1.3+
- Node.js 20+
- Rust toolchain for desktop builds

Install dependencies:

```bash
bun install
```

Run the web app:

```bash
bun run dev:web
```

Run the landing page:

```bash
bun run dev:promo
```

Build everything for GitHub Pages:

```bash
bun run build
```

Run validation:

```bash
bun audit --audit-level=high
bun run lint
bun run typecheck
bun run test
```

Build desktop bundles:

```bash
bun run build:desktop
```

## Repository

```text
apps/
  promo/      Public landing page
  web/        Browser app
  desktop/    Tauri desktop shell
packages/
  iconcore-shared/     Shared project types
  iconcore-renderer/   Canvas/SVG rendering
  iconcore-exporters/  Asset targets and ZIP inputs
  iconcore-engine/     Planning and schema utilities
  iconcore-validator/  Project validation
  iconcore-cli/        Command-line tools
```

## Contributing

Issues, fixes, and experiments are welcome. Keep changes focused, run the relevant checks, and include validation notes in pull requests.

## License

MIT License. See [LICENSE](LICENSE).
