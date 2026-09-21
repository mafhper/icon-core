# Icon Core

[English](README.md) | [Português (Brasil)](README.pt-BR.md) | [Español](README.es-ES.md)

Free, open-source app icons, from first sketch to finished files. Design in the browser or on the desktop. Everything runs on your machine. No account, no uploads, no server.

![Icon Core editor: layer list on the left, canvas with keylines in the center, properties on the right](docs/assets/app-editor.png)

## Start your way

Three doors, same exit: finished icon files.

### Start from scratch

![Start screen offering three ways to begin](docs/assets/app-welcome.png)

Open Edit Space on a blank canvas. Add shapes, text and images as layers, tune each one, and preview light, dark and mono variants as you go.

### Start from a file

Skip the canvas. Drop in a finished SVG, PNG, JPG or WebP and go straight to export.

### Start from a file, then refine

Open your file in Edit Space first, adjust positioning and variants, then export.

## Export once, ship everywhere

![Export Utilities with targets, format and output options](docs/assets/app-export.png)

Pick targets (favicon, PWA, Tauri, Electron, desktop), pick a format (PNG, WebP, JPEG), take a ZIP or separate files. The preview uses the same engine as export, so the files match what you saw.

## Try it

- Web app: https://mafhper.github.io/icon-core/app/
- Landing page: https://mafhper.github.io/icon-core/
- Desktop releases: https://github.com/mafhper/icon-core/releases
- Repository: https://github.com/mafhper/icon-core

[![Icon Core landing page](docs/assets/promo.png)](https://mafhper.github.io/icon-core/)

## What it does

- Layers for shapes, text, images and SVG, with position, size, rotation, opacity, color, gradients, blend and shadow
- Light, dark and mono previews, plus square, rounded and circle masks
- Safe area guides that never crop your artwork
- One click export to favicon, PWA, Tauri, Electron and desktop sets
- HTML preview sheet and per target report included

## Development

Prerequisites:

- Node.js 22+ (npm)
- Rust toolchain for desktop builds

```bash
npm install
npm run dev:web     # browser app on :5173
npm run dev:promo   # landing page on :5174
npm run build       # everything for GitHub Pages
```

```bash
npm audit --audit-level=high
npm run lint
npm run typecheck
npm run test
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
  iconcore-ui/        Design system primitives
```

## Contributing

Issues, fixes and experiments are welcome. Keep changes focused, run the relevant checks, and include validation notes in pull requests.

## License

MIT License. See [LICENSE](LICENSE).
