# Marca do Icon Core

**Este diretório é a fonte. `apps/*/public/branding/` e `docs/images/releases/` são
derivados — nunca edite lá.**

```bash
node scripts/build-brand.mjs           # gera os derivados (copia, sem browser)
node scripts/build-brand.mjs --check   # reprova se a cópia estiver desatualizada
node scripts/build-brand.mjs --from-template  # regenera a ARTE (release.webp) do template
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
| `logo.svg` (= default) | `apps/promo/public/branding/logo.svg`, `apps/web/public/branding/logo.svg` | `<link rel="icon">` nos dois `index.html` |
| `logo-dark.svg` | os dois `branding/logo-dark.svg` | variante escura: ícone de app (o conjunto do Tauri vem dela) |
| `logo-light.svg` | os dois `branding/logo-light.svg` | variante clara: marca e arte de release |
| `logo-mono.svg` | os dois `branding/logo-mono.svg` | variante monochrome: a quarta aparência do dock do promosite |
| `release.webp` | os dois `branding/release.webp`, **e** `docs/images/releases/release.webp` | a imagem da release no GitHub |
| `release-art.iconcore.json` | *(template; gera `release.webp`)* | o desenho da arte de release, derivado por comando |

## O set do release (lotes 1 e 2, 2026-10-19)

Três matrizes SVG em `viewBox 0 0 512 512`, mesma identidade nas três variantes:
placa arredondada (`rx 130`) + o símbolo de seis pás da marca + glifo branco.
O que muda entre elas é **só o fundo da placa** — escuro (`logo-dark.svg`),
halo grafite (`logo.svg`, a default) e lima→teal (`logo-light.svg`). O símbolo é
o mesmo da fonte anterior (os seis paths de pás estão intactos, byte a byte);
o lote acrescenta a placa e o glifo.

| Fonte (sha256:12) | Placa | sha na referência do dono |
|---|---|---|
| `logo.svg` `4dd0a732b56e` (= default) | halo grafite sobre transparência | `6568cea3901b` |
| `logo-dark.svg` `f9917168d990` | marinho quase-preto `#111827`→`#03090c` | `a7b26cbf59c4` |
| `logo-light.svg` `0810c13043d1` | lima→teal `#efef12`→`#6bb7d8` | `e2e3460e214b` |

As três foram promovidas **byte-idênticas à referência aprovada pelo dono** no
lote 1 — fidelidade total, sem redesenho — e a limpeza ficou para o lote 2, que a
mediu antes de executar:

- **A declaração `<?xml?>` aninhada não era inofensiva.** O arquivo era **XML
  inválido**: o parser do Chromium reprova (`Invalid processing instruction`), o
  `<img>` não decodifica e o próprio `<link rel="icon">` não renderizava. A
  remoção foi provada **inerte por medição**: o render do original parseado
  lenientemente e o do arquivo sem a declaração dão **PNG byte-idêntico**
  (PNGs de paridade byte-idênticos, sha256:12
  `ca257d0905a0`/`5175f7345c47`/`f51c8c9bd436` — prova não versionada).
- **Os ids foram namespaced por variante** (`default-`/`dark-`/`light-`). As três
  matrizes compartilhavam `bg-0`, `canvas-clip-2` e os ids `llayer-…` — como
  documento próprio funciona; inline na mesma página o primeiro vence e o segundo
  pinta errado. Mesma prova antes/depois: os mesmos PNGs byte-idênticos acima, e
  o conjunto do Tauri regenerado sai byte a byte igual.
- **Caveat medido, não corrigido:** o render do SVG difere do PNG de referência
  **no gradiente da placa** — cantos mais saturados (concordância 76,4% / 75,7% /
  49,8% por pixel, medido em Chromium a 1024px contra os PNGs de referência da
  mesma resolução, em prova não versionada). O PNG tem o gradiente
  *corner-to-corner* (o mesmo que o canvas do studio desenha); o SVG declara
  `14.64%→85.36%`, um span comprimido — a mesma classe de divergência que a
  fixture `gradiente` do `check-svg-parity` já isola. Nenhuma matriz foi editada
  por isso: a fonte promovida é a aprovada, e mexer na fórmula do `renderToSvg`
  é lote próprio (afeta todo export SVG).

Os hashes da coluna "referência do dono" são a prova de fidelidade do lote 1; os
da coluna da fonte são o estado atual (lote 2). Toda edição nas matrizes passa
pelo portão (`check-brand`) e pelos derivados, nunca à mão nos `branding/`.
A quarta variante — Monochrome — chegou em 2026-10-22; ver a seção seguinte.

## As quatro aparências do mockup (2026-10-22)

O dock do promosite mostra o ícone em quatro aparências — **Default**, **Light**, **Dark** e
**Monochrome** — e a direção é que o conjunto de ícones do app seja o mesmo. O padrão do
sample-003 continua valendo: **mesma geometria, só a placa muda**. O que faltava era medir o
que já existia contra as quatro e criar a que não existia.

| Aparência | Matriz | Placa que a matriz desenha | Placa que o mockup declara | Δ medido |
|---|---|---|---|---|
| Default | `logo.svg` | halo grafite `#1c1b1f`, opacidade 0 → 0,45, radial sobre transparência | prata radial `#f4f5f5` → `#dcdedf` → `#b9bcbe` | 35 (média 12,3) |
| Light | `logo-light.svg` | lima→teal linear `#efef12` → `#6bb7d8` | lima→menta→ciano `#e4f46a` → `#b9ec8c` → `#6fdde3` | 134 (média 28) |
| Dark | `logo-dark.svg` | marinho linear `#111827` → `#03090c` | grafite radial `#34353a` → `#28282a` → `#151517` | 59 (média 28,3) |
| Monochrome | `logo-mono.svg` | prata claro radial `#ffffff` → `#f0f0f0` → `#dadada` | a mesma | **0** |

Δ é a maior diferença por canal (0–255) entre a matriz renderizada e a placa do preset
renderizada sozinha, em seis pontos fora do símbolo (topo, base, as duas laterais e os dois
cantos), a 512 px. As três primeiras **não** são a placa do mockup: são a identidade do
sample-003, promovida byte-idêntica à referência aprovada pelo dono (ADR-025). Portar as três
para os presets do promosite mudaria o favicon, a arte de release (que compõe
`logo-light.svg`) e o conjunto do Tauri (que é gerado de `logo-dark.svg`) — é decisão do dono,
não efeito colateral deste lote.

### O que o mono muda, e por quê

`logo-mono.svg` é a matriz escura com **a placa e a pintura do símbolo trocadas** — não é
redesenho. As provas, e como repeti-las:

- **Geometria idêntica.** Os sete `d=` (seis pétalas + glifo), todos os `transform=`, o
  `viewBox` e o clip `rx 130` são byte a byte iguais aos de `logo-dark.svg`.
- **Resíduo zero.** Desfazendo o namespace (`mono-` → `dark-`), a placa e as treze linhas de
  pintura, o arquivo volta a ser **byte-idêntico** ao `logo-dark.svg` (8.089 bytes). Ou seja,
  das 57 linhas, 33 mudaram: **1** é a definição da placa, **19** são só o namespace dos ids
  (inclusive as referências no clip e no `fill`) e **13** são pintura — nenhuma é geometria.

A pintura muda porque **a placa mono é clara** e o símbolo das outras três é branco: o
contraste do glifo branco contra a placa `#ffffff` → `#dadada` é **1,04:1** — o “I” desaparece.
O mono usa então o que o próprio preset declara para o símbolo: pétalas `#8c8c8c` (opacidade
0,9) → `#c4c4c4` (0,05) e glifo `#8f8f8f`, o tom estático do núcleo mono. Com isso o glifo
fica em **3,10:1** e a pétala em **3,22:1**.

O *gloss* que o mockup desenha sobre a placa (branco a 30%) ficou de fora: é uma camada a mais
que nenhuma das outras três tem, e a diferença medida é de **Δ4** no pior canal (média 1,2).
Se o gloss entrar, é uma linha a mais no grupo da placa — e as três antigas ganham a mesma
linha ou a família continua sem ele.

Os derivados são os mesmos de sempre, agora com o mono:

```bash
node scripts/build-brand.mjs   # republica os derivados, inclusive logo-mono.svg
node scripts/check-brand.mjs   # confere os pares por conteúdo
```

**Os nomes do derivado são fechados**, e a tabela de "Os arquivos" é a tradução. O motivo de a tabela
existir é que a frota tinha dois nomes para a mesma arte (`release.webp` e
`release-new.webp`); nome duplicado custa caro até alguém usar o errado — e quem usou o
errado foi a release.

O portão também reprova um arquivo **inesperado** em `branding/`, que é como o
`release-new` volta.

### Por que `release.webp` tem três destinos

Porque três coisas o consomem, e as três leem o repositório de jeitos diferentes:

- os dois `public/` dos apps — a arte é servida **estática** (`og:image`/manifest voltam
  com o pipeline do IC61F; hoje o `<link>` é só o favicon SVG);
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
| `apps/desktop/src-tauri/icons/` | conjunto do Tauri | **gerado** pelo `tauri icon` a partir de `logo-dark.svg` — ver "O lote 2", abaixo; nunca editar à mão |
| `assets/archive/` | o que foi arquivado, e por quê | não é fonte de nada |

## O que **não** foi arquivado, e por que

O levantamento (`scripts/inventory-images.mjs`) mediu **631 imagens versionadas** na
última execução (2026-10-19). Só **uma** não tinha consumidor, e foi arquivada. As outras duas
categorias parecem sobras e não são:

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

## O lote 2 (`@build` — raster e wiring), executado em 2026-10-19

A spec do lote 1 pedia quatro passos; todos rodaram com o portão verificando cada um:

1. **Pipeline estendido.** `logo-dark.svg` e `logo-light.svg` declarados no
   `DERIVADOS` de `scripts/build-brand.mjs` e `scripts/check-brand.mjs` (destinos:
   os dois `public/branding/`). `node scripts/build-brand.mjs` → exit 0;
   `node scripts/check-brand.mjs` → exit 0, **15/15** pares OK (a nota do lote 1
   dizia "12/12" para um total de 11; agora são 2 logos default + 2 dark + 2
   light + 3 release + 6 fontes).
2. **`release.webp` regenerada da nova identidade.** Deixou de ser um PNG
   composto à mão: o desenho agora é o template `release-art.iconcore.json`,
   rasterizado pelo motor Canvas num Chromium headless (ADR-017,
   `canvas.toBlob('image/webp')` na página, sem sharp) por
   `node scripts/build-brand.mjs --from-template`. A arte saiu de 1490×850
   (`5f78b11f048e`) para **1280×640** — o tamanho do `github-social` do ADR-018 —
   com `38d7c13aabd4`; duas execuções seguidas dão o mesmo sha (determinístico).
   Os três destinos são republicados pelo passo normal do `build-brand`.
3. **Ícones de app.** O conjunto do Tauri foi regenerado pelo próprio gerador:

   ```bash
   cd apps/desktop
   npx tauri icon ../../assets/brand/logo-dark.svg
   ```

   A variante é a **escura** (decisão do dono, 2026-10-19): placa marinho sólida
   — silhueta de ícone de app de verdade, legível em barra clara e escura. O PNG
   de 512 do gerador foi medido contra o PNG de referência aprovado: 0,2% dos
   pixels fora de tolerância. PWA/manifest e favicons raster continuam fora do
   site de propósito (voltam com o pipeline do IC61F, como o `index.html`
   documenta); o favicon SVG é o `logo.svg`.
4. **Limpeza das matrizes** — executada com prova de paridade; ver
   "O set do release", acima. O namespacing de ids por variante também está
   aplicado (`default-`/`dark-`/`light-`).

## A arte de release é derivada de um template

`release-art.iconcore.json` **é** o desenho (abre no studio; diffável; versionado).
O fluxo, na ordem:

```bash
# gera assets/brand/release.webp a partir do template do projeto
node scripts/build-brand.mjs --from-template
# e então os derivados + o portão cobrem o resto
node scripts/build-brand.mjs
node scripts/check-brand.mjs
```

Uma convenção do template, e o motivo dela: uma layer `inline` de
`mimeType: "image/svg+xml"` com `path` (sem `data`) é resolvida **no render**
contra esta pasta — `logo-light.svg` entra pelo nome, e a arte nunca carrega uma
cópia embutida da fonte. (Se o studio re-exportar o template, ele grava `data`
embutido; aí a cópia passa a existir e o diff mostra.) O carregador vive em
`scripts/release-art.mjs`, ao lado do `build-brand.mjs`.
