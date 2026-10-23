# Icon Core

[English](README.md) | [Português (Brasil)](README.pt-BR.md) | [Español](README.es-ES.md)

Icon Core es un workspace gratuito y open source para iconos de aplicaciones. Empieza con un lienzo vacío o importa un archivo SVG/PNG/JPG/WebP, ajusta el icono y exporta assets listos para web y desktop.

Todo se ejecuta localmente en el navegador o en la app desktop. No requiere cuenta, servicio de subida ni backend.

![Icon Core Studio: capas a la izquierda, el lienzo y sus variantes en el centro y el Inspector a la derecha](docs/assets/app-editor.png)

## Cómo empezar

Tres puertas, misma salida: archivos de icono listos.

### Empezar desde cero

![Pantalla inicial: crear en Edit Space, subir directo a exportación o subir, editar y exportar](docs/assets/app-welcome.png)

Abre Edit Space en un lienzo vacío. Añade formas, textos e imágenes como capas, ajusta cada una y observa las variantes claro, oscuro y mono mientras trabajas.

### Empezar desde un archivo

Omite el lienzo. Suelta un SVG, PNG, JPG o WebP terminado y ve directo a la exportación.

### Empezar desde un archivo y afinarlo

Abre tu archivo en Edit Space primero, ajusta posición y variantes, y luego exporta.

## Exportar desde el Inspector

![La pestaña Export del Inspector: variantes, formatos, tamaños de PNG y la opción de fondo transparente](docs/assets/app-export.webp)

La exportación es una pestaña del Inspector, junto a Design. Elige las variantes, los formatos (SVG, PNG, ICO), los tamaños de PNG que necesites y si el fondo del lienzo va transparente; el panel cuenta los archivos antes de generarlos. **Export** descarga los archivos y **Download all (.zip)** los empaqueta en un solo archivo. La vista previa usa el mismo motor que la exportación, así que el archivo corresponde a lo que viste.

## Probar

- App web: https://mafhper.github.io/icon-core/app/
- Landing page: https://mafhper.github.io/icon-core/
- Releases desktop: https://github.com/mafhper/icon-core/releases
- Repositorio: https://github.com/mafhper/icon-core

[![Landing page de Icon Core](docs/assets/promo.png)](https://mafhper.github.io/icon-core/)

## Funcionalidades

- Capas para formas, textos, imágenes y SVG, con posición, tamaño, rotación, opacidad, color, degradados, blend y sombra — más matiz, saturación, brillo y contraste en capas de imagen y SVG
- Vistas previas claro, oscuro y mono como miniaturas junto al lienzo, con guía de área segura opcional
- Una sola superficie de exportación para SVG, PNG (16 a 1024 px) e ICO de varios tamaños, con las variantes elegidas
- Cada ajuste de capa sobrevive a la exportación en SVG, no solo al PNG
- El marco exportado sigue la forma del lienzo, mientras que contenedores como ICO quedan full-bleed porque cada plataforma aplica su propia máscara
- Los proyectos se guardan automáticamente en el navegador; nada se sube a un servidor

## Desarrollo

Requisitos:

- Node.js 22+ (npm)
- Toolchain de Rust para builds desktop

Instala dependencias:

```bash
npm install
```

Ejecuta la app web:

```bash
npm run dev:web
```

Ejecuta la landing page:

```bash
npm run dev:promo
```

Genera el build para GitHub Pages:

```bash
npm run build
```

Ejecuta la validación:

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

CI también ejecuta `npm run build`, la suite e2e de Playwright contra la landing page
(`npm run test:e2e`) y la captura del contrato visual (`npm run ui:shots`). Los
`scripts/check-*.mjs` son baratos y detectan lo que el lint no detecta.

Las imágenes de este README salen de `scripts/capture-screenshots.mjs`, que usa los dos
servidores de desarrollo y escribe en `docs/assets/`; ejecuta el script en vez de editar imágenes a mano.

Genera los bundles desktop:

```bash
npm run build:desktop
```

## Repositorio

```text
apps/
  promo/      Landing page pública
  web/        App del navegador
  desktop/    Shell desktop en Tauri
packages/
  iconcore-shared/     Tipos compartidos del proyecto
  iconcore-renderer/   Renderización Canvas/SVG
  iconcore-exporters/  Targets de assets y entradas del ZIP
  iconcore-engine/     Planificación y utilidades de schema
  iconcore-validator/  Validación de proyectos
  iconcore-cli/        Herramientas de línea de comando
  iconcore-ui/         Primitivos del design system
```

## Contribución

Issues, correcciones y experimentos son bienvenidos. Mantén los cambios enfocados, ejecuta los checks relevantes e incluye notas de validación en los pull requests.

## Licencia

Licencia MIT. Ver [LICENSE](LICENSE).
