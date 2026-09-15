# ADR — Direção Visual e Arquitetura de UI/UX 2026 (Icon Core)

- **Status:** Aceito (sprint `feat/redesign-uiux-2026`)
- **Data:** 2026-09-15
- **Contexto:** redesign completo do promo-site e do editor (web + desktop Tauri)
- **Documento master:** `.dev/docs/redesign-uiux-2026-plan.md` (execução e PRs)

## 1. Contexto

O Icon Core (editor de ícones local-first + export pipeline) precisa de uma nova experiência
visual e funcional: nova UI, biblioteca de ícones integrada, edição estrutural de paths,
onboarding e responsividade superior. Referências analisadas: Rune Icons (editor + biblioteca +
landing), direção visual Fremit, referência técnica Max/MSP (TECHNICAL_UI_DESIGN_SYSTEM_REFERENCE),
mockup Lovable (metáfora de oficina/registro de impressão) e Tauri UI Kit (tokens/componentes,
ainda em estágio inicial).

## 2. Decisão

Adotar uma **linguagem visual de ferramenta técnica/estúdio** — densa, neutra, monocromática,
com um único accent semântico — como identidade única para editor, desktop e promo-site.

Princípios (10):

1. **Workspace first** — o canvas domina a tela.
2. **Tool rails over menus** — ferramentas/modos ficam em rails compactos.
3. **Inspector as instrument panel** — propriedades densas e agrupadas por conceito.
4. **Monochrome by default** — quase tudo é neutro; superfícies diferenciadas por pequenas
   variações tonais.
5. **One strong accent** — uma cor identifica ação/estado (seleção, foco, controle ativo),
   nunca preenchimento de botões grandes.
6. **Compact typography** — UI 10–13px; dado (número, hex, dimensão, nome de arquivo) em fonte
   monoespaçada; rótulos 10px uppercase tracking-widest.
7. **Minimal borders/radius** — bordas 1px de baixo contraste; raio 0–10px (não 16–30px);
   diferenciação de superfícies por tonalidade.
8. **Collapsible complexity** — grupos colapsáveis no inspector; densidade controlada.
9. **State over decoration** — contraste e accent comunicam estado; sem cards decorativos,
   sem sombras em tudo, sem glassmorphism.
10. **Responsive-by-collapse** — em larguras menores os painéis colapsam em drawers/sheets;
    a função nunca é escondida.

## 3. Decisões estruturais

### 3.1 Shell do editor em zonas

```text
│ Header (arquivo/projeto/janela/contexto)                                │
├──────┬──────────────────────┬──────────────────────────┬───────────────┤
│ Tool │ Assets / Layers +    │ Canvas (workspace)       │ Inspector     │
│ Rail │ Library              │                          │ (seções       │
│ ~44px│                      │                          │  colapsáveis) │
├──────┴──────────────────────┴──────────────────────────┴───────────────┤
│ Action Bar contextual (undo/redo, zoom, grid, snapping, ferramenta, export) │
```

- Esquerda = encontrar e organizar; centro = trabalhar; direita = modificar; topo = contexto;
  baixo = ações contextuais.
- A biblioteca de ícones é **asset source** (alimenta o editor), não identidade do produto.

### 3.2 Interação: `InteractionTransaction`

Padrão `begin(preview) → [preview(RAF)] → commit` usado por move, resize, rotate, scrub,
path editing, color/opacity/stroke. Cada gesto gera **uma** operação semântica de histórico.

### 3.3 Estado

Separados por contrato: **persistent** (documento, `.iconcore.json`), **transient**
(não entra no histórico, some com a interação), **UI state** (localStorage — tema, painéis,
zoom, busca). Invariante: transient nunca altera HistoryState; UI state nunca altera documento.

### 3.4 Biblioteca de ícones

Pacote próprio `iconcore-library`: manifest + metadata + busca + categorias + tags + carregamento
+ metadata de licença. API **domain-only** (sem operações editoriais). Comandos de edição
(Insert/Replace/Detach) pertencem ao Composer. Acervo inicial: 217 SVGs estilo `normal` do
Rune Icons (Apache-2.0, com atribuição).

### 3.5 Path Editor

`SVG string → parser → PathCommand[] normalizado → editor → serializer → SVG`.
Suporta M/L/C/Q/Z; normaliza H/V→L. Aceite por equivalência geométrica, nunca textual.

### 3.6 Tema

Tokens preparados para claro e escuro; escuro funcional primeiro; claro obrigatório
eventualmente, não bloqueante. Promo-site: dark default + light.

## 4. O que NÃO copiar das referências

- Identidade visual literal do Rune Icons (accent elétrico, estética de biblioteca/customizer).
- Arquitetura Next.js do Rune Icons; arquitetura TanStack do mockup Lovable.
- Canvas/objetos do Max/MSP; dimensões exatas e controles proprietários.
- Blossom picker do Rune Icons (850+ linhas) — usar color wheel próprio mínimo.
- Cards/raios 16–30px, sombras suaves, glassmorphism do promo atual e do fremit atual.
- Draw Mode (fora do escopo da sprint).
- Dependência de execução do Tauri UI Kit (referência de tokens apenas nesta sprint).

## 5. Construções-padrão/tokens (direção para PR-02)

Base dedicada em `apps/web/src/index.css`:

- Neutros sem matiz: dark `#0a0b0d/#101114/#08090a`; light `#fafafa/#ffffff/#f1f1f2`.
- Border: `rgba(255,255,255,0.08)` escuro; `rgba(0,0,0,0.08)` claro; strong ×2.
- Text: `#edeef0 / #141518`; muted `#91959c / #6b6e74`.
- Accent único: ~`#3d6fe0` (dark), ~`#2f5ed6` (light); accent-dim ~16%/10% alpha.
- Radius: `xs 3px · sm 6px · md 10px · pill 999px`.
- Fontes: UI atual (Sora) mantida para interface; `IBM Plex Mono` para dados (já carregado).
- Labels: 10px, 500, `tracking 0.14em`, uppercase, muted.

## 6. Consequências

- **Positivas:** identidade própria e durável; base compartilhada com futuros apps (direção do
  Tauri UI Kit); editor mais próximo de ferramenta criativa profissional; biblioteca vira
  material de criação sem dominar o produto.
- **Negativas/custos:** esforço de migração de todos os painéis; necessidade de disciplina
  (estado sobre decoração é mais difícil de manter que um kit de cards); acervo inicial limitado
  a ícones `normal` (outros estilos ficam para depois).
- **Dívidas registradas:** integração real do Tauri UI Kit (pós-sprint); automação de visual
  regression (pós-layout estável); Draw Mode (pós-sprint); integração de mais variantes de
  ícones (duotone/fill) via mesma API.

## 7. Referências

- `.dev/tasks/2026-09-06_proposta-new_ui/runeicons/` (código Rune Icons + planos + direção Fremit)
- `.dev/tasks/2026-09-06_proposta-new_ui/technical_ui/` (TECHNICAL_UI_DESIGN_SYSTEM_REFERENCE.md)
- `.dev/tasks/2026-09-11_proposta-promo-site/lovable/` (mockup Lovable)
- `C:\Users\mafhper\Documents\Github\tauri_ui_kit_bundle\docs` (Tauri UI Kit — referência)
- `.dev/tasks/2026-09-06_proposta-new_ui/criticas-plano-01.md` e `criticas-plano-01-considerações-finais.md`