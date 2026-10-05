# Fontes

**Este diretório é a fonte. `apps/web/src/fonts/` é derivado — nunca edite lá.**

```bash
node scripts/build-brand.mjs           # gera os derivados (arte e fonte)
node scripts/build-brand.mjs --check   # reprova se a cópia estiver desatualizada
node scripts/check-brand.mjs           # o portão, que é o que roda no CI
```

---

## Cal Sans — a fonte embarcada

| | |
|---|---|
| Origem | <https://github.com/calcom/sans> |
| Licença | SIL Open Font License 1.1 — texto em `LICENSES/cal-sans-OFL.txt` |
| Pesos embarcados | 400 (Regular), 700 (Bold) |
| Formato | WOFF2 — 69 KB por peso, contra 226 KB do TTF com o mesmo contorno |

A OFL permite redistribuição e embutimento. O `third-party/manifest.json` declara a licença
com metadado, e `scripts/check-third-party-assets.mjs` reprova se o arquivo sumir.

### Por que WOFF2 e não TTF

69 KB contra 226 KB por peso, com o mesmo contorno, e o WOFF2 e o único formato que todos os
destinos deste projeto carregam: o browser, o WebView2 do Tauri e o rasterizador do GitHub.
O TTF seria 3× maior pelo mesmo desenho.

### Por que dois pesos, e não a variável

Cal Sans publica uma fonte variável (`calsans-var-flex`). Ela seria um arquivo para todos os
pesos, e traria dois problemas aqui: eixo de peso contínuo num editor onde o peso é um
`NumberField` de 100 a 900, e um arquivo que nenhuma versão do rasterizador de outra máquina
precisa ter. Dois pesos estáticos são o que a UI e o export pedem.

## O derivado vai para dentro de `src/`, e isso não é acaso

Duas alternativas parecem corretas e **falham em silêncio**:

**`url('../../assets/fonts/…')` a partir de `apps/web/src/index.css`.** Sai da raiz do
projeto Vite. O build avisa `didn't resolve at build time, it will remain unchanged to be
resolved at runtime` e emite o caminho **literal** no CSS — e do `dist/assets/` esse caminho
relativo aponta para `apps/web/assets/fonts/` e dá 404. O `@font-face` fica no CSS e a fonte
nunca carrega, que é o pior desfecho: nenhum erro, nenhum texto trocado.

**`apps/web/public/fonts/`.** O `public/` é servido na raiz do site, e o app vive em
`/icon-core/app/`. Um `/fonts/…` absoluto não respeita a base.

Dentro de `src/`, o Vite resolve, **hasheia** e respeita `base`. O build emite
`dist/assets/CalSans-Regular-Dm1Envc1.woff2`, que é o que a página precisa.

`build-brand.mjs` copia e `check-brand.mjs` compara por SHA-256, então a cópia não divergir é
uma **verificação**, não uma expectativa.

## `font-display: block`, e não `swap`

O canvas **mede** o texto e escreve o resultado em pixels. Com `swap`, o preview mostraria uma
substituta, mediria com ela, e só depois trocaria — um texto com quebra diferente do que a
pessoa ajustou. Aqui a fonte tem de estar pronta antes do primeiro desenho.

## O default NÃO é uma fonte embarcada

O `createTextLayer` grava `system-ui`, e não Cal Sans.

O default é o que **ninguém escolheu**: é o que toda camada nova usa e o que ninguém vai
olhar duas vezes. Ele tem de ser o que não falha — e uma família genérica é a única que
resolve no editor, no PNG e no SVG, em qualquer máquina. Quem quiser desenho com
personalidade escolhe Cal Sans no seletor, e ela vem com o app.

Ver `packages/iconcore-renderer/src/fonts.ts` para as três origens e o que cada uma promete
no export.

## A interface do app ainda pede 'Sora', que não existe

`--font-display` e `--font-body` no `@theme` declaram `"Sora", sans-serif`, e **não há Sora no
projeto**. A interface renderiza no fallback — hoje e antes desta mudança, igualmente.

Trocá-la por Cal Sans mudaria a cara do app inteiro, e isso é **decisão do dono**, não
consequência de embutir uma fonte para o seletor de texto. Fica declarado aqui como a próxima
decisão, não como efeito colateral.

O mesmo vale para `--font-mono: "IBM Plex Mono", monospace` no app e no promo.

## O que o SVG ainda não entrega

Um `<text font-family="…">` carrega o **nome** da família, não o arquivo. Então um SVG com
Cal Sans sai correto no editor e no PNG, e em outra máquina quem não tiver a fonte vê uma
substituta — com quebra diferente.

Isto está escrito no validador (`TEXT_FONT_NOT_EMBEDDED`), que só avisa quando o projeto
**realmente exporta SVG** (`web-favicon` ou `electron`).

A correção de raiz é **converter o texto em `<path>` no export**, como o Figma faz no
"flatten". Não existe ainda, e é a peça que fecha o contrato de fidelidade do SVG.
