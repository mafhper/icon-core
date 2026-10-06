# Arquivo

Imagens **arquivadas**, não apagadas. Nenhum arquivo aqui é fonte de nada, e nada aqui é
consumido por build, site ou release.

Por que existe: a limpeza de imagens precisa ser reversível, e "reversível" não é
"está no git há dois commits". Um arquivo movido para cá continua legível, com o hash ao
lado, e qualquer pessoa reverte sem precisar de `git log`.

## O que está aqui

| arquivo | sha256 (12) | motivo | revertido por |
|---|---|---|---|
| `public-unused/banner.svg` | `ecbe65f98cbb` | zero consumidores em 359 arquivos de texto versionados | `cp` para `assets/brand/`, depois `node scripts/build-brand.mjs` |

**Data:** 2026-10-05. **Levantamento:** `node scripts/inventory-images.mjs`.

O `banner.svg` estava nos dois `public/branding/` quando foi arquivado — o que, junto com o
`logo.svg` e o `release.webp` idênticos nos dois lados, era a mesma arte copiada à mão em
dois lugares. Ver `assets/brand/README.md` para a história completa e o portão que impediu
que isso voltasse.

## O que **não** está aqui, e por quê

Duas categorias parecem sobras e foram deixadas de fora de propósito:

- **`apps/desktop/src-tauri/icons/ios/` e `Square*Logo.png`** (29 arquivos, sem referência
  em texto). Consumidos **por convenção** pelo empacotador do Tauri no macOS, não pela
  config. Sem build macOS não dá para provar que são dispensáveis. Há também `@2x-1.png` e
  `@2x.png` byte-idênticos: o `-1` é o que o macOS acrescenta ao copiar para uma pasta que já
  tinha o nome. Artefato de operação — e a decisão é de quem tem build macOS.

- **`docs/assets/*.png`** (4 arquivos). Parecem lixo e são a imagem que o GitHub mostra no
  `README.md` (linhas 7, 15, 29 e 40).

## Como decidir, da próxima vez

```bash
node scripts/inventory-images.mjs
```

Ele imprime, para cada imagem versionada: quem a referencia por nome, se é duplicata por
sha256, e se é **pública** (`README.md`, `docs/`, `public/`, imagem de release) ou
**privada/dev** (fixture, baseline, conjunto exigido por ferramenta). Arquivar o que o
relatório marca `SEM REFERENCIA` **e** fora de um conjunto exigido por ferramenta.
