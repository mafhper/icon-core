# IconCore

[English](README.md) | [Português (Brasil)](README.pt-BR.md) | [Español](README.es-ES.md)

IconCore é um motor open source e local-first para geração determinística de pacotes de ícones para projetos web e desktop.

## Links

- Repositório: https://github.com/mafhper/icon-core
- Site promocional: https://mafhper.github.io/icon-core/
- Aplicação web: https://mafhper.github.io/icon-core/app/
- Releases desktop: https://github.com/mafhper/icon-core/releases

## Visão Geral

O IconCore ajuda equipes a gerar ativos consistentes de aplicação a partir de um único logo. Ele suporta output padrão de tema único e output temático explícito light/dark, com nomes de arquivos e estrutura de pastas determinísticos.

O projeto é totalmente local-first: a geração roda no lado do cliente (web) ou na máquina local (desktop), sem backend obrigatório.

## Aplicação Web vs Aplicação Desktop

| Modo | Melhor para | Observações |
| --- | --- | --- |
| Aplicação web | Uso rápido no navegador | Sem instalação, exporta pacotes ZIP |
| Aplicação desktop | Fluxos com filesystem local | Diálogos nativos e export direto para pasta |

## Funcionalidades Principais

- Pipeline de geração determinístico (modos de output `default` e `themed`)
- Geração de manifesto com resolução consistente de caminhos de ícones
- Tratamento de fontes por ativo (master/light/dark/variações de favicon)
- Export estruturado para fluxos web e desktop
- Temas de interface e controles de configuração por projeto
- Interface localizada (`pt-BR`, `en-US`, `es-ES`)

## Estrutura do Monorepo

```text
apps/
  web/        Aplicação web principal
  promo/      Site promocional/landing page
  desktop/    Shell desktop em Tauri
packages/
  iconcore-engine/  Regras de planejamento de geração e manifesto/output
  iconcore-shared/  Tipos, contratos e utilitários de locale compartilhados
scripts/
  assemble-pages.mjs  Combina builds de promo + web para GitHub Pages
```

## Início Rápido

### Pré-requisitos

- Bun 1.3+
- Node.js 20+ (recomendado para o ecossistema de tooling)
- Toolchain Rust (apenas para build desktop)

### Instalação

```bash
bun install
```

### Rodar Aplicação Web

```bash
bun run dev:web
```

### Rodar Site Promo

```bash
bun run dev:promo
```

### Rodar Desktop (dev)

```bash
bun run --filter @iconcore/desktop tauri:dev
```

## Build e Deploy

### Build de todos os apps e artefato de Pages

```bash
bun run build
```

Destino no GitHub Pages:

- Site promo em `/icon-core/`
- Aplicação web em `/icon-core/app/`

### Build de instaladores desktop

```bash
bun run build:desktop
```

## Checks de Qualidade e Segurança

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun audit
```

O CI inclui auditoria de dependências (`bun audit`) como gate de merge.

## Segurança

- Local-first por design (sem processamento externo obrigatório)
- Geração estruturada de output para evitar empacotamento ad-hoc
- Auditoria de dependências obrigatória no CI

Se encontrar um problema de segurança, abra um reporte privado para o mantenedor antes da divulgação pública.

## Contribuição

Contribuições são bem-vindas.

Fluxo recomendado:

1. Faça um fork do repositório
2. Crie uma branch de feature
3. Execute os checks de qualidade localmente
4. Abra um PR com escopo claro e notas de validação

## Mantenedor

Criado e mantido por [mafhper](https://github.com/mafhper).

## Licença

Licença MIT. Veja [LICENSE](LICENSE).
