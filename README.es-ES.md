# IconCore

[English](README.md) | [Português (Brasil)](README.pt-BR.md) | [Español](README.es-ES.md)

IconCore es un motor open source y local-first para la generación determinística de paquetes de iconos para proyectos web y desktop.

## Enlaces

- Repositorio: https://github.com/mafhper/icon-core
- Sitio promocional: https://mafhper.github.io/icon-core/
- Aplicación web: https://mafhper.github.io/icon-core/app/
- Releases desktop: https://github.com/mafhper/icon-core/releases

## Resumen

IconCore ayuda a los equipos a generar assets consistentes de aplicación a partir de un único logo. Soporta output por defecto de tema único y output temático explícito light/dark, con nombres de archivo y estructura de carpetas determinísticos.

El proyecto es completamente local-first: la generación se ejecuta en el cliente (web) o en la máquina local (desktop), sin backend obligatorio.

## Aplicación Web vs Aplicación Desktop

| Modo | Mejor para | Notas |
| --- | --- | --- |
| Aplicación web | Uso rápido en el navegador | Sin instalación, exporta paquetes ZIP |
| Aplicación desktop | Flujos con filesystem local | Diálogos nativos y exportación directa a carpeta |

## Funcionalidades Principales

- Pipeline de generación determinístico (modos de output `default` y `themed`)
- Generación de manifiesto con resolución consistente de rutas de iconos
- Manejo de fuentes por asset (master/light/dark/variantes de favicon)
- Exportación estructurada para flujos web y desktop
- Temas de interfaz y controles de configuración por proyecto
- Interfaz localizada (`pt-BR`, `en-US`, `es-ES`)

## Estructura del Monorepo

```text
apps/
  web/        Aplicación web principal
  promo/      Sitio promocional/landing page
  desktop/    Shell desktop en Tauri
packages/
  iconcore-engine/  Reglas de planificación de generación y manifiesto/output
  iconcore-shared/  Tipos, contratos y utilidades de locale compartidas
scripts/
  assemble-pages.mjs  Combina builds de promo + web para GitHub Pages
```

## Inicio Rápido

### Requisitos

- Bun 1.3+
- Node.js 20+ (recomendado para el ecosistema de tooling)
- Toolchain de Rust (solo para build desktop)

### Instalación

```bash
bun install
```

### Ejecutar Aplicación Web

```bash
bun run dev:web
```

### Ejecutar Sitio Promo

```bash
bun run dev:promo
```

### Ejecutar Desktop (dev)

```bash
bun run --filter @iconcore/desktop tauri:dev
```

## Build y Deploy

### Build de todas las apps y artefacto de Pages

```bash
bun run build
```

Destino en GitHub Pages:

- Sitio promo en `/icon-core/`
- Aplicación web en `/icon-core/app/`

### Build de instaladores desktop

```bash
bun run build:desktop
```

## Checks de Calidad y Seguridad

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun audit
```

El CI incluye auditoría de dependencias (`bun audit`) como gate de merge.

## Seguridad

- Local-first por diseño (sin procesamiento externo obligatorio)
- Generación de output estructurada para evitar empaquetado ad-hoc
- Auditoría de dependencias obligatoria en CI

Si encuentras un problema de seguridad, abre un reporte privado al mantenedor antes de la divulgación pública.

## Contribución

Las contribuciones son bienvenidas.

Flujo recomendado:

1. Haz un fork del repositorio
2. Crea una rama de feature
3. Ejecuta los checks de calidad localmente
4. Abre un PR con alcance claro y notas de validación

## Mantenedor

Creado y mantenido por [mafhper](https://github.com/mafhper).

## Licencia

Licencia MIT. Ver [LICENSE](LICENSE).
