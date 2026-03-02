# IconCore

[English](README.md) | [Português (Brasil)](README.pt-BR.md) | [Español](README.es-ES.md)

IconCore is an open-source, local-first vector asset engine for generating deterministic icon packages for web and desktop projects.

## Links

- Repository: https://github.com/mafhper/icon-core
- Promo site: https://mafhper.github.io/icon-core/
- Web app: https://mafhper.github.io/icon-core/app/
- Desktop releases: https://github.com/mafhper/icon-core/releases

## Overview

IconCore helps teams generate consistent app assets from one source logo. It supports default single-theme output and explicit light/dark themed output, with deterministic file names and folder structure.

The project is fully local-first: generation runs on the client side (web) or local machine (desktop), with no required backend.

## Web App vs Desktop App

| Mode | Best for | Notes |
| --- | --- | --- |
| Web app | Fast usage in browser | Zero install, export ZIP packages |
| Desktop app | Local filesystem workflows | Native dialogs and direct folder export |

## Core Features

- Deterministic generation pipeline (`default` and `themed` output modes)
- Manifest generation with consistent icon path resolution
- Per-asset source handling (master/light/dark/favicon variants)
- Structured export for web and desktop workflows
- UI themes and project-level configuration controls
- Localized UI (`pt-BR`, `en-US`, `es-ES`)

## Monorepo Structure

```text
apps/
  web/        Main web application
  promo/      Promo/landing site
  desktop/    Tauri desktop shell
packages/
  iconcore-engine/  Generation planning and manifest/output rules
  iconcore-shared/  Shared types, contracts, locale utilities
scripts/
  assemble-pages.mjs  Combines promo + web builds for GitHub Pages
```

## Quick Start

### Prerequisites

- Bun 1.3+
- Node.js 20+ (recommended for ecosystem tooling)
- Rust toolchain (only for desktop build)

### Install

```bash
bun install
```

### Run Web App

```bash
bun run dev:web
```

### Run Promo Site

```bash
bun run dev:promo
```

### Run Desktop (dev)

```bash
bun run --filter @iconcore/desktop tauri:dev
```

## Build and Deploy

### Build all apps and pages artifact

```bash
bun run build
```

GitHub Pages target:

- Promo site at `/icon-core/`
- Web app at `/icon-core/app/`

### Build desktop bundles

```bash
bun run build:desktop
```

## Quality and Safety Checks

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun audit
```

CI includes dependency auditing (`bun audit`) as a merge gate.

## Security

- Local-first by design (no mandatory external processing)
- Structured output generation to avoid ad-hoc packaging
- Dependency audit enforced in CI

If you find a security issue, open a private report to the maintainer before public disclosure.

## Contributing

Contributions are welcome.

Recommended flow:

1. Fork repository
2. Create feature branch
3. Run quality checks locally
4. Open a PR with clear scope and validation notes

## Maintainer

Created and maintained by [mafhper](https://github.com/mafhper).

## License

MIT License. See [LICENSE](LICENSE).
