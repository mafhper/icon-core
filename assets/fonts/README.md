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

## O default é a Cal Sans — e por que isso não é óbvio

Antes de ser esta fonte, o padrão era uma família **genérica** (`system-ui`), e o argumento
para isso era forte: uma família genérica é a única que resolve no editor, no PNG **e** no
SVG, em qualquer máquina — inclusive onde a fonte embarcada não está. Um projeto novo
nunca receberia aviso.

O dono pediu Cal Sans, e ela **está servida**: o arquivo é do projeto, o build hasheia, e o
preview e o export rasterizado mostram exatamente a mesma coisa. O que a fonte embarcada não
garante é só o **SVG**, e esse caso já tem portão — `TEXT_FONT_NOT_EMBEDDED`.

A troca fica assim:

| | preview e PNG | SVG em outra máquina |
|---|---|---|
| `'Cal Sans', system-ui, sans-serif` (default) | exato | substitui, **com aviso** |
| `system-ui, sans-serif` | exato | exato |

Ou seja: o default é a fonte que a pessoa **vê** funcionando, e o único formato que não
acompanha tem um aviso. O contrário — um default invisível que ninguém percebe estar errado —
trocaria um defeito mensurável por um invisível.

`system-ui` continua na lista, como fallback e como opção: ele ainda é a resposta certa para
quem quer um SVG que resolve em qualquer máquina.

## Uma correção de registro: "a fonte não existia" estava errado

Duas leituras minhas, e a segunda importava:

**Errada.** Afirmei que `Sora` não estava no projeto e que a interface renderizava no
fallback. Não era verdade. `apps/web/index.html` carregava `Sora` e `IBM Plex Mono` de
`fonts.googleapis.com` por um `<link>`, então a interface **estava** com a fonte certa. Eu
procurei `@font-face` em três arquivos CSS, não encontrei, e declarei a conclusão sem ter
procurado no `index.html`. Um `@font-face` ausente **não** prova que a fonte não é carregada
por outro caminho — Google Fonts, um `link`, um `@import`.

**Certa, e o defeito real.** A fonte era **remota**. O projeto se anuncia como uma
ferramenta *offline* e roda dentro do Tauri; sem rede, `Sora` some e tudo cai no fallback com
outra métrica — o desenho que a pessoa ajustou muda de largura, e o texto quebra em outro
lugar. Embalada, o problema desaparece.

Por isso o `Sora` saiu do `<link>`: ele não é mais usado, e um `link` para CDN que o app
parou de usar é uma dependência de rede esperando o dia em que alguém volta a usá-lo.

O `--font-mono` continua vindo de CDN (`IBM Plex Mono`), porque é usado nos valores numéricos
e nos rótulos curtos, e a Cal Sans não é um mono. **É a dependência remota que resta** — e é
a próxima coisa a decidir: embutir o mono também, ou aceitar a dependência sabendo que ela só
falha sem rede.

## A interface do app usa a Cal Sans

`--font-display`, `--font-body` e o `body` apontam para a Cal Sans embarcada. Isso é o que
torna a troca do default completa: sem isso, a fonte embarcada ficaria disponível no seletor
enquanto a tela continuaria pedindo a remota, e o defeito seria apenas trocado de lugar.

O `apps/promo` **não** foi tocado: ele tem identidade própria (`Manrope` para display) e é a
landing page, não o editor. Se a padronização da frota quiser a Cal Sans lá também, é a mesma
mecânica — fonte em `assets/fonts/`, derivado, portão.

## O que o SVG ainda não entrega

Um `<text font-family="…">` carrega o **nome** da família, não o arquivo. Então um SVG com
Cal Sans sai correto no editor e no PNG, e em outra máquina quem não tiver a fonte vê uma
substituta — com quebra diferente.

Isto está escrito no validador (`TEXT_FONT_NOT_EMBEDDED`), que só avisa quando o projeto
**realmente exporta SVG** (`web-favicon` ou `electron`).

A correção de raiz é **converter o texto em `<path>` no export**, como o Figma faz no
"flatten". Não existe ainda, e é a peça que fecha o contrato de fidelidade do SVG.
