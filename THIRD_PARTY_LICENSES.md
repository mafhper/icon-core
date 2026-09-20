# Third-Party Licenses

Icon Core includes or distributes third-party assets and components. Each entry
lists the component, its license, the source, and where the license text lives
in this repository. The automated guard `scripts/check-third-party-assets.mjs`
validates that every registered asset carries this metadata (and, when the
asset's `files` are populated, that those files exist).

## Registered components

| Component | License | Source | License text | Attribution |
|---|---|---|---|---|
| Rune Icons (icon set) | Apache-2.0 | https://github.com/Nexvyn/runeicons (upstream used for the built-in icon library) | `LICENSES/runeicons-LICENSE.txt` | See `NOTICE` |
| Lucide (app icons) | ISC | https://lucide.dev (npm `lucide-react`) | https://github.com/lucide-icons/lucide/blob/main/LICENSE | See `NOTICE` |

### Rune Icons — Apache License 2.0

The built-in icon library (to be ingested in PR-09) is made available from the
[Rune Icons](https://github.com/Nexvyn/runeicons) project (Apache-2.0,
Copyright 2026 Runeicons). Redistribution and modifications are governed by the
terms of the Apache License, Version 2.0, a copy of which is kept at
`LICENSES/runeicons-LICENSE.txt`.

Icon Core ships only a selection of the original icon set; the original set
may contain more icons. The Source form of the icons we distribute is their
SVG source, which is not modified on ingestion (normalization happens only in
memory at runtime).

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