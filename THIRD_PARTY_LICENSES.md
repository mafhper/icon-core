# Third-Party Licenses

Icon Core includes or distributes third-party assets and components. Each entry
lists the component, its license, the source, and where the license text lives
in this repository. The automated guard `scripts/check-third-party-assets.mjs`
validates that every registered asset carries this metadata (and, when the
asset's `files` are populated, that those files exist).

## Registered components

| Component | License | Source | License text | Attribution |
|---|---|---|---|---|
| Lucide (app icons) | ISC | https://lucide.dev (npm `lucide-react`) | https://github.com/lucide-icons/lucide/blob/main/LICENSE | See `NOTICE` |

> **Rune Icons is registered but not yet redistributed.** It is listed in
> `third-party/manifest.json` as the accepted source of the built-in icon library
> (`ADR-009`, Apache-2.0), and its license text is kept in `LICENSES/`. **No Rune
> SVG is in this repository yet** — the 217 live in a local research corpus outside
> version control, and ingesting them is the `IC10` work. Until that lands, the
> guard runs vacuously on `files: []` and nothing about Rune ships.

### Rune Icons — Apache License 2.0 (accepted source, not yet redistributed)

The built-in icon library will be made available from the
[Rune Icons](https://github.com/Nexvyn/runeicons) project (Apache-2.0,
Copyright 2026 Runeicons), as decided in `ADR-009`. Redistribution and
modifications will be governed by the terms of the Apache License, Version 2.0, a
copy of which is kept at `LICENSES/runeicons-LICENSE.txt`.

**Status: not redistributed.** When the icons land, this section will state what
ships — most likely a selection rather than the whole set, whose Source form is the
unmodified SVG (normalization happens only in memory at runtime) — and
`third-party/manifest.json` will carry the `files` globs so the guard verifies them
rather than passing on an empty array.

### Lucide — ISC License

Application chrome icons are provided by the [Lucide](https://lucide.dev)
project (ISC License, Copyright (c) Lucide Contributors). See the original
LICENSE for full terms:
https://github.com/lucide-icons/lucide/blob/main/LICENSE

## Adding a component

1. Add the license text under `LICENSES/` (e.g. `LICENSES/<component>-LICENSE.txt`).
2. Register the component in `third-party/manifest.json` (id, name, source,
   license, licenseFile, attribution, and — once files are added — `files`).
3. When the component's files are present in the repo, populate `files` with
   glob patterns so the guard can verify they exist.
4. Reference the component here and in `NOTICE` when attribution is required.