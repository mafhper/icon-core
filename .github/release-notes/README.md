# Release notes

Notas editoriais por versão, publicadas pelo [Release Core](https://github.com/mafhper/release-core)
(contrato em `.github/release.config.json`). Os arquivos seguem a tag, ex.: `v1.4.0.md`.

## Como uma release acontece

1. **Preparar as notas.** Escreva `.github/release-notes/vX.Y.Z.md` em `main` (ou passe
   Markdown no input `notes` do workflow de bump). Só os destaques voltados ao usuário vão
   aqui — a lista completa de commits é gerada pelo GitHub e anexada ao final da release.
2. **Bump.** Dispare o workflow `release-bump` com a versão alvo (ex.: `1.5.0`). Ele atualiza
   `package.json`, `apps/desktop/package.json`, `apps/desktop/src-tauri/tauri.conf.json`,
   `Cargo.toml`/`Cargo.lock`, prepara o arquivo de notas e abre um PR
   `chore(release): bump version to vX.Y.Z`.
3. **Merge.** O merge desse PR dispara `release-tag`, que cria a tag anotada `vX.Y.Z` e chama
   o workflow `release` (Release Core). A tag é a identidade da release.
4. **Build.** O Core cria o rascunho, valida as versões, roda os gates, monta o corpo (imagem,
   título, tagline, estas notas e o changelog automático em `<details>`) e, na matriz,
   gera e publica os instaladores no Windows, Linux e macOS — só então publica a release.

## Imagem da release

A imagem vive em `docs/images/releases/release.webp` e representa a linha `major.minor`
(hard gate): patch pode reutilizar; nova linha `major.minor` exige imagem nova.

## Alternativa manual

Se preferir taguear à mão:

```bash
node scripts/release-bump.mjs 1.5.0            # atualiza os arquivos de versão
# crie/atualize .github/release-notes/v1.5.0.md
git add -A
git commit -m "chore(release): bump version to v1.5.0"
git tag -a v1.5.0 -m "Release v1.5.0"
git push origin main v1.5.0  # tag dispara o workflow release
```

> Use `git add` explícito (ou `-A`): `git commit -am` não inclui um arquivo de notas recém-criado.

Pushes para `main` sozinhos nunca criam Release (apenas o deploy do GitHub Pages roda).
