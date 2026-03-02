# Git Runbook

## Update remote

```bash
git remote set-url origin https://github.com/mafhper/icon-core.git
git remote -v
```

## GitHub Pages output

- Promo site: `/icon-core/`
- Web app: `/icon-core/app/`
- Artifact folder: `dist-pages/`

## Desktop release

Desktop bundles are generated from workflow `release-desktop.yml` when pushing tags in the format `v*`.

- Local build output (development): `apps/desktop/src-tauri/target/debug/bundle/`
- Local build output (release): `apps/desktop/src-tauri/target/release/bundle/`
- GitHub releases:
  - Created automatically from tags (`v*`)
  - Desktop artifacts uploaded per platform (Windows/macOS/Linux)
  - Release body is updated automatically with direct links to each platform artifact
