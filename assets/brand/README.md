# Marca do Icon Core

**Este diretório é a fonte. `apps/*/public/branding/` e `docs/images/releases/` são
derivados — nunca edite lá.**

```bash
node scripts/build-brand.mjs           # gera os derivados
node scripts/build-brand.mjs --check   # reprova se a cópia estiver desatualizada
node scripts/check-brand.mjs           # o portão, que é o que roda no CI
node scripts/inventory-images.mjs      # quem usa o quê, e o que é duplicata
```

---

## A regra, e por que ela existe

Uma identidade tem **uma** fonte, versionada. Tudo o que outro lugar consome é **derivado**,
por comando, e o portão reprova quando a cópia não corresponde à fonte.

Isso não é preferência. É o conserto de uma contradição que **este** repositório tinha, e a
medição está no `check-brand.mjs`:

- a mesma arte estava em **dois** `public/branding/`, copiada à mão, byte-idêntica
  (sha256 igual nos seis arquivos);
- e **nada comparava os dois lados**. Duas cópias feitas à mão, sem portão entre elas, é a
  DD-N48: dois arquivos que existem e que ninguém compara.

Pior: havia um **terceiro** `release.webp` em `docs/images/releases/`, em duas variantes.

| arquivo | sha256 (12) | quem consumia |
|---|---|---|
| os dois `branding/release.webp` | `5f78b11f048e` | o site (web e promo) |
| `docs/images/releases/release-new.webp` | `5f78b11f048e` | **ninguém** |
| `docs/images/releases/release.webp` | `1f4ee124cf5e` | **a imagem da release** |

O nome `-new` era a pista. A arte nova era a que o site servia; a imagem da release
(`release.config.json`, `required: true`) continuava na antiga. **O site e a release do
GitHub mostravam artes diferentes**, e nenhuma das duas era a fonte — eram as duas cópias.

Declarar qual é a fonte dissolve isso: `assets/brand/` alimenta os derivados, e quem compara
é um comando, não uma memória.

## Os arquivos

| Fonte | Derivado | Para quê |
|---|---|---|
| `logo.svg` | `apps/promo/public/branding/logo.svg`, `apps/web/public/branding/logo.svg` | `<link rel="icon">` nos dois `index.html` |
| `release.webp` | os dois `branding/release.webp`, **e** `docs/images/releases/release.webp` | a imagem da release no GitHub |

**Os nomes do derivado são fechados**, e a tabela acima é a tradução. O motivo de a tabela
existir é que a frota tinha dois nomes para a mesma arte (`release.webp` e
`release-new.webp`); nome duplicado custa caro até alguém usar o errado — e quem usou o
errado foi a release.

O portão também reprova um arquivo **inesperado** em `branding/`, que é como o
`release-new` volta.

### Por que `release.webp` tem três destinos

Porque três coisas o consomem, e as três leem o repositório de jeitos diferentes:

- `index.html` dos dois apps, via `public/` — servido **estático**;
- `.github/release.config.json` → a imagem da release, lida num job que **não roda npm**.

Por isso os derivados são **commitados**, e não gerados no build: um `prebuild` funcionaria
localmente e quebraria no Pages e no job da release. O que garante que eles não divergem é o
portão.

### SVG e raster juntos, e não só SVG

O `logo.svg` precisa servir `<link rel="icon">`; a imagem da release precisa ser **raster**,
porque o GitHub numa release não renderiza SVG. São as duas restrições que o `README` do
`tele-code` registra, e a resposta é a mesma: os dois formatos, um derivado de cada.

## Público vs. privado

Nem toda imagem do repositório é desta pasta, e a distinção importa para a passada de
normalização em todos os projetos:

| onde | o quê | regra |
|---|---|---|
| `assets/brand/` | a **fonte** da marca | editar aqui, à mão |
| `apps/*/public/branding/` | **derivado** | nunca editar; `--check` reprova |
| `docs/images/releases/` | **derivado** | nunca editar; é o que o Release Core lê |
| `docs/assets/*.png` | screenshots do README | **público e usado** — 4 referências no `README.md` |
| `apps/desktop/src-tauri/icons/` | conjunto do Tauri | **não mexer** — ver abaixo |
| `assets/archive/` | o que foi arquivado, e por quê | não é fonte de nada |

## O que **não** foi arquivado, e por que

O levantamento (`scripts/inventory-images.mjs`) achou 61 imagens versionadas. Só **uma** não
tinha consumidor, e foi arquivada. As outras duas categorias parecem sobras e não são:

**`src-tauri/icons/ios/` e `Square*Logo.png` (29 arquivos, sem referência em texto).**
`tauri.conf.json` lista **dois** ícones — `icons/icon.ico` e `icons/icon.png` — e o resto não
aparece em lugar nenhum. Mas `ios/AppIcon-*.png` e `Square*Logo.png` são consumidos **por
convenção** pelo empacotador do Tauri no macOS, não pela config. Sem build macOS nesta
máquina não dá para provar que o conjunto é dispensável, e um portão que reprova por
adivinhação treina a pessoa a rodar sem portão.

Além disso há `@2x-1.png` e `@2x.png` **byte-idênticos** (sha256 igual) em quatro grupos: o
sufixo `-1` é o que o macOS acrescenta ao copiar um arquivo para uma pasta que já tinha o
nome. São artefato de operação, não escolha — mas a decisão de removê-los é de quem tem build
macOS, não de um script rodando em Windows.

**`docs/assets/*.png` (4 arquivos).** Têm cara de lixo e são a imagem que o GitHub mostra no
README. Referenciados nas linhas 7, 15, 29 e 40.

## Arquivado

| arquivo | sha256 (12) | motivo | onde foi parar |
|---|---|---|---|
| `banner.svg` (2 cópias) | `ecbe65f98cbb` | zero consumidores em 359 arquivos de texto | `assets/archive/public-unused/banner.svg` |

Está **arquivado, não apagado**: o conteúdo está íntegro e o hash está aqui, então a reversão
é `cp` de volta para a fonte e um `node scripts/build-brand.mjs`.

## O que dá para gerar depois

Com um rasterizador disponível, a imagem de release passa a ser **derivada de um template**,
não desenhada à mão — que é a direção da normalização da frota:

```bash
# gera assets/brand/release.webp a partir do template do projeto
node scripts/build-brand.mjs --from-template
# e então os derivados + o portão cobrem o resto
node scripts/build-brand.mjs
```

Isso ainda não existe. O que existe é a **fonte declarada**, que é o pré-requisito: sem uma
fonte, um gerador só produziria mais uma cópia.
