# Release notes

Per-version release notes used by the `release-desktop` workflow to compose the
GitHub Release body for the desktop app. Files are named after the tag, e.g.
`v1.3.1.md` for release `v1.3.1`.

## How a release happens

1. **Prepare the notes.** Write `.github/release-notes/vX.Y.Z.md` on `main` (or pass
   Markdown in the `notes` input of the bump workflow). Only the user-facing highlights
   go here — the full list of commits is generated automatically by GitHub and added at
   the end of the release page.
2. **Bump.** Dispatch the `release-bump` workflow with the target version (e.g. `1.3.1`).
   It updates the version in `package.json`, `apps/desktop/package.json`,
   `apps/desktop/src-tauri/tauri.conf.json`, `Cargo.toml` and `Cargo.lock`, prepares the
   release-notes file and opens a PR `chore(release): bump version to vX.Y.Z`.
3. **Merge.** Merging that PR triggers `release-tag`, which creates the annotated tag
   `vX.Y.Z` on main and dispatches `release-desktop`.
4. **Build.** `release-desktop` builds installers on Windows, Linux and macOS and
   uploads them to the `vX.Y.Z` GitHub Release. The release body includes:
   - a banner image (`public/releases/release-feed-VERSION.png`) when the file exists
     on the tag — see below;
   - the "O que tem de novo nesta versão" section (this file);
   - an install table per platform;
   - the auto-generated commit list in a `<details>` block.

## Banner image (optional)

Drop a screenshot named `public/releases/release-feed-{VERSION}.png` in the tag commit
(e.g. `release-feed-1.3.1.png`) and `release-desktop` will show it at the top of the
release page.

## Manual alternative

If you prefer to bump by hand:

```bash
bun run release:bump 1.3.1   # updates the version files above
git commit -am "chore(release): bump version to v1.3.1"
git tag -a v1.3.1 -m "Release v1.3.1"
git push origin main v1.3.1  # tag push triggers release-desktop
```

Pushes to `main` alone never create a Release (only GitHub Pages deploy runs).