# Runbook

Operações do repositório: releases, deploy e builds locais.

## Release (Release Core)

As releases são produzidas pelo protocolo **[Release Core](https://github.com/mafhper/release-core)**, consumido por `.github/workflows/release.yml` (caller) segundo o contrato `.github/release.config.json`.

```text
prepare ──► build (matriz: ubuntu/windows/macos) ──► finalize
```

- **prepare** — valida a tag contra `package.json` + `versions.files`, aplica a política da imagem, calcula a tag anterior, detecta prerelease e cria/recupera o release **como rascunho** (idempotente).
- **build** — instala a toolchain declarada (Node/npm, Rust, apt), roda `npm ci` e os gates, e o `tauri-action` gera e envia os instaladores.
- **finalize** — monta o corpo (imagem, título, tagline, notas, changelog) e publica. Nunca publica release parcial.

### Criar uma release estável

1. Escreva as notas em `.github/release-notes/vX.Y.Z.md`.
2. Dispare o workflow **release-bump** (Actions → release-bump → Run workflow) com a versão `X.Y.Z`.
3. Revise e merge o PR `chore(release): bump version to vX.Y.Z`.
4. O merge dispara **release-tag**, que cria a tag anotada `vX.Y.Z` e aciona o workflow `release`.

### Criar um release candidate (prerelease)

A tag com sufixo semver (`vX.Y.Z-rc.1`) é publicada automaticamente como **prerelease**. Como o bump workflow só aceita `X.Y.Z`, use o caminho manual:

```bash
git checkout -b rc/vX.Y.Z main
node scripts/release-bump.mjs X.Y.Z
# crie .github/release-notes/vX.Y.Z-rc.N.md
git add package.json apps/desktop/package.json \
  apps/desktop/src-tauri/tauri.conf.json \
  apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/Cargo.lock \
  .github/release-notes/vX.Y.Z-rc.N.md
git commit -m "chore(release): vX.Y.Z-rc.N"
git push origin rc/vX.Y.Z
git tag -a vX.Y.Z-rc.N -m "Release vX.Y.Z-rc.N"
git push origin vX.Y.Z-rc.N
```

> Use `git add` explícito: `git commit -am` **não** inclui o arquivo de notas recém-criado (untracked) e a release sairia sem elas.

A tag (não a branch) identifica a release. Apague a branch `rc/*` depois de validar.

> A tag deve ser empurrada por um usuário/PAT: tags empurradas com o `GITHUB_TOKEN` padrão não disparam workflows. Por isso `release-tag` também pode acionar o caller via `workflow_dispatch`.

### Reexecutar / investigar falhas

- Reruns são seguros: o Core reutiliza o rascunho existente e reenvia artefatos com `--clobber` (não duplica a release).
- Divergência de versão ou de imagem falha em **prepare**, antes de qualquer build.
- Falha de gate impede o build; a release não é publicada.

### Atualizar o Release Core

Troque o pin em `.github/workflows/release.yml` (`@vX.Y.Z`) — nunca `@main`. Verifique a compatibilidade de `.github/release.config.json` com o novo contrato.

### Atualizar Node / npm / Rust / Tauri

- **Node** — `package.json#engines`, `build.node` em `.github/release.config.json` e `node-version` no CI.
- **Rust** — `build.rust` no contrato.
- **Tauri** — bump em `apps/desktop` + `Cargo.toml`/`Tauri` conforme o caso.

### Alterar a matriz

Edite o `matrix` no caller (`release.yml`): cada célula tem `os` e `args` (`--bundles ...`).

### Signing / notarization

Ainda não configurado (adiado). Ao habilitar, declarar os secrets no caller e o Core apenas orquestra o `tauri-action`.

## GitHub Pages

Pushes para `main` publicam o Pages (workflow `deploy-pages`), independente das releases.

- Promo: `/icon-core/`
- App: `/icon-core/app/`
- Artefato: `dist-pages/`

## Builds locais

```bash
npm install
npm run dev:web      # app no :5173
npm run dev:promo    # landing no :5174
npm run build        # pacotes + web + promo + dist-pages
npm run build:desktop # instaladores em apps/desktop/src-tauri/target/release/bundle/
npm run desktop:smoke # build debug do Tauri
```

## Update remote

```bash
git remote set-url origin https://github.com/mafhper/icon-core.git
git remote -v
```
