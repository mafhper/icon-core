# Ícones Rune — conjunto vendorizado

**Este diretório é gerado — não edite à mão.** Os SVGs vêm do pin abaixo pelo
`scripts/vendor-runeicons.mjs`, que recusa qualquer checkout que não seja o pin; re-executar sobre
ele produz os mesmos bytes (os digests estão registrados nesta página). Mesmo padrão de vendoring
de `assets/fonts/README.md`: fonte fora do bundle, derivado gerado, verificação por hash.

```bash
git clone https://github.com/Runeicons/runeicons
git -C runeicons fetch origin 2f2a86a3a96cbf5026e4276d349c50a139bd8a88
git -C runeicons checkout FETCH_HEAD
node scripts/vendor-runeicons.mjs runeicons
```

## Pin

| | |
|---|---|
| Repositório | <https://github.com/Runeicons/runeicons> — ícones sob Apache-2.0 (`LICENSES/runeicons-LICENSE.txt`) |
| Commit | `2f2a86a3a96cbf5026e4276d349c50a139bd8a88` — 2026-10-11, "feat: replace Google Analytics with Umami" |
| Manifest do pin | `lib/icons/manifest.generated.ts`, blob sha1 `aa64f8a194d9983c432b053c8318bc05dd132586` (o script recusa outro) |
| Digest da fonte | `c95cfdf45489f78b16b50f0fae30c61897212772546506033a72a261a82d28e8` — 568 SVGs em `public/{normal,duotone,fill}`, 453 363 B |
| Digest vendorizado | `4110e8616fd6fc978ca3968e9be4b5d19884481c3f4ba5cc7d71474ddf332ef6` — 567 SVGs, 463 490 B |

Os dois digests são sha256 sobre linhas ordenadas `<estilo>/<caminho>.svg <sha256 do conteúdo>`;
o script imprime ambos a cada execução para conferência.

**Estes arquivos são modificações** dos SVGs de origem (tabela abaixo): a Apache-2.0 permite uso,
cópia, modificação e redistribuição. O registro formal de redistribuição (`files` em
`third-party/manifest.json`, `NOTICE`, `THIRD_PARTY_LICENSES.md`) é atualizado na etapa seguinte
da ingestão.

## Contagens (pin) — e a divergência 221/223, travada aqui

O cabeçalho do manifest do pin declara `Counts: normal=223, duotone=218, fill=129, pixelated=215,
glass=136`, mas `public/normal` tem **221** arquivos — e as flags de disponibilidade das próprias
entradas do mesmo manifest dizem `normal=221`. As duas entradas extras
(`gadgets-battery-medium-2`, `gadgets-battery-medium-3`) existem só em duotone/fill, não em
normal. **O manifest gerado do upstream não é autoridade de contagem: a verdade é o disco.** A
divergência fica travada assim: o acervo segue o disco (221), nunca o número declarado (223).

| Estilo | Disco no pin | Vendorizado | Nota |
|---|---|---|---|
| `normal` | 221 | **220** | `nature-plant` excluído — viewBox `0 0 26 29`, não é um ícone 24×24 |
| `duotone` | 218 | **218** | tudo |
| `fill` | 129 | **129** | cobertura parcial: só onde existe; o fallback para `normal` é do consumidor |
| ids únicos (união dos três) | 223 | 222 | `misc`: 0 — todo id tem metadado no manifest do pin (teto de 5% imposto pelo script) |

`pixelated/`, `glass-icons/` e `brand-logos/` não são vendorizados — o guard do script nunca lê
esses diretórios (brand-logos tem licença própria por logo e fica fora por decisão, não por
tamanho). Sprites também não entram nesta etapa.

## Transformações (byte da fonte → byte do derivado)

O destino é `<estilo>/<categoria>-<basename>.svg`, em kebab-case minúsculo (id = `categoria-basename`);
colisão de id é falha do script.

| De | Para | |
|---|---|---|
| `stroke="black"` / `fill="black"` | `stroke`/`fill="currentColor"` | `normal` é traço preto puro |
| `stroke`/`fill="#1C1F21"` | `currentColor` + `stroke`/`fill-opacity="0.88"` | tinta escura do `fill` |
| `stroke`/`fill="#A4A5A6"` | `currentColor` + `stroke`/`fill-opacity="0.35"` | duotone secundário |
| `stroke`/`fill="#DDDDDD"` | `currentColor` + `stroke`/`fill-opacity="0.13"` | duotone claro / corpo do `fill` |
| `stroke`/`fill="#D9D9D9"` | `currentColor` + `stroke`/`fill-opacity="0.15"` | variante do corpo |
| `stroke`/`fill="#F3F3F3"` | `currentColor` + `stroke`/`fill-opacity="0.05"` | detalhe quase branco |
| `width`/`height` do `<svg>` raiz | removidos | o tamanho é do consumidor |
| `viewBox` | exigido exatamente `0 0 24 24` | outro = falha, exceto o id excluído acima |
| declaração XML e comentários | removidos (defensivo; o pin não tem nenhum) | |
| `white` | **não normalizado** | é mecânica de recorte (`clipPath`/`mask`) e detalhe de recorte — converter quebraria o mascaramento |
| ids internos (`clipPath`/`mask`, 6 arquivos) | **reservados** — não reescritos nesta etapa | `prefixInnerIds` pertence ao estágio de inlining |

A opacidade de cada cinza é `1 − média(R,G,B)/255`, arredondada a duas casas — o valor que
preserva o cinza original sobre fundo branco.
