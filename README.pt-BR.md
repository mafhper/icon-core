# Icon Core

[English](README.md) | [Português (Brasil)](README.pt-BR.md) | [Español](README.es-ES.md)

Icon Core é um workspace gratuito e open source para ícones de aplicativos. Comece com uma tela vazia ou importe um arquivo SVG/PNG/JPG/WebP, ajuste o ícone e exporte assets prontos para web e desktop.

Tudo roda localmente no navegador ou no app desktop. Não exige conta, serviço de upload ou backend.

![Icon Core Studio: camadas à esquerda, o canvas e as variantes no centro e o Inspector à direita](docs/assets/app-editor.png)

## Como começar

Três portas, mesma saída: arquivos de ícone prontos.

### Começar do zero

![Tela inicial: criar no Edit Space, enviar direto para exportação ou enviar, editar e exportar](docs/assets/app-welcome.png)

Abra o Edit Space em uma tela vazia. Adicione formas, textos e imagens como camadas, ajuste cada uma e acompanhe as variantes claro, escuro e mono enquanto trabalha.

### Começar a partir de um arquivo

Pule o canvas. Solte um SVG, PNG, JPG ou WebP pronto e vá direto para a exportação.

### Começar a partir de um arquivo e refinar

Abra seu arquivo no Edit Space primeiro, ajuste posicionamento e variantes, e então exporte.

## Exportar pelo Inspector

![A aba Export do Inspector: variantes, formatos, tamanhos de PNG e a opção de fundo transparente](docs/assets/app-export.webp)

A exportação é uma aba do Inspector, ao lado de Design. Escolha as variantes, os formatos (SVG, PNG, ICO), os tamanhos de PNG de que precisa e se o fundo do canvas vai transparente; o painel conta os arquivos antes de gerá-los. **Export** baixa os arquivos e **Download all (.zip)** junta tudo em um pacote. O preview usa o mesmo motor da exportação, então o arquivo corresponde ao que você viu.

## Teste

- App web: https://mafhper.github.io/icon-core/app/
- Landing page: https://mafhper.github.io/icon-core/
- Releases desktop: https://github.com/mafhper/icon-core/releases
- Repositório: https://github.com/mafhper/icon-core

[![Landing page do Icon Core](docs/assets/promo.png)](https://mafhper.github.io/icon-core/)

## Funcionalidades

- Camadas para formas, textos, imagens e SVG, com posição, tamanho, rotação, opacidade, cor, gradientes, blend e sombra — mais matiz, saturação, brilho e contraste em camadas de imagem e SVG
- Pré-visualizações claro, escuro e mono como miniaturas ao lado do canvas, com guia de área segura opcional
- Uma única superfície de exportação para SVG, PNG (16 a 1024 px) e ICO multi-tamanho, com as variantes escolhidas
- Cada ajuste de camada sobrevive à exportação em SVG, não só ao PNG
- A moldura exportada segue o formato do canvas, enquanto contêineres como o ICO ficam full-bleed porque cada plataforma aplica a própria máscara
- Projetos são salvos automaticamente no navegador; nada é enviado para fora

## Desenvolvimento

Pré-requisitos:

- Node.js 22+ (npm)
- Toolchain Rust para builds desktop

Instale as dependências:

```bash
npm install
```

Rode o app web:

```bash
npm run dev:web
```

Rode a landing page:

```bash
npm run dev:promo
```

Gere o build do GitHub Pages:

```bash
npm run build
```

Rode a validação:

```bash
npm audit --audit-level=high
npm run lint
node scripts/check-third-party-assets.mjs
node scripts/check-ui-boundary.mjs
node scripts/check-ui-budget.mjs
node scripts/check-ui-contrast.mjs
npm run typecheck
npm run test
```

O CI também roda `npm run build`, a suíte e2e do Playwright contra a landing page
(`npm run test:e2e`) e a captura do contrato visual (`npm run ui:shots`). Os
`scripts/check-*.mjs` são baratos e pegam o que o lint não pega.

As imagens deste README saem de `scripts/capture-screenshots.mjs`, que usa os dois
servidores de dev e grava em `docs/assets/`; rode o script em vez de editar imagem à mão.

Gere os bundles desktop:

```bash
npm run build:desktop
```

## Repositório

```text
apps/
  promo/      Landing page pública
  web/        App no navegador
  desktop/    Shell desktop em Tauri
packages/
  iconcore-shared/     Tipos compartilhados do projeto
  iconcore-renderer/   Renderização Canvas/SVG
  iconcore-exporters/  Targets de assets e entradas do ZIP
  iconcore-engine/     Planejamento e utilitários de schema
  iconcore-validator/  Validação de projetos
  iconcore-cli/        Ferramentas de linha de comando
  iconcore-ui/         Primitivos do design system
```

## Contribuição

Issues, correções e experimentos são bem-vindos. Mantenha as mudanças focadas, rode os checks relevantes e inclua notas de validação nos pull requests.

## Licença

Licença MIT. Veja [LICENSE](LICENSE).
