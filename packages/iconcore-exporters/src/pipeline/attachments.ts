import type {
  ExportAttachmentGenerator,
  ExportContext,
  ExportPlan,
  IconVariant
} from '@iconcore/shared';
import { auditProject } from '@iconcore/validator';
import type { GeneratedFile, PlannedArtifact } from './types';
import { generatePreviewHtml } from './preview';

/** A produced attachment: content + mime. The output *path* comes from the plan's `attachments` entry. */
export interface AttachmentOutput {
  content: string;
  mime: string;
}

const jsonBlob = (value: unknown): { content: string; mime: string } => ({
  content: JSON.stringify(value, null, 2),
  mime: 'application/json'
});

const textBlob = (content: string, mime = 'text/plain'): { content: string; mime: string } => ({
  content,
  mime
});

/**
 * Web app manifest icons derived from the PNGs actually produced by the plan
 * (web/pwa rows). Maskable icons (opaque background) are flagged via
 * `purpose: 'maskable'`.
 */
const manifestIcons = (planned: PlannedArtifact[]): Array<{ src: string; sizes?: string; type: string }> =>
  planned
    // **Square only.** The manifest is a PWA install contract and its icons must
    // be square, so a non-square asset (a 1200×630 banner, say) is left out
    // instead of being declared with a size no platform can install. For every
    // square artifact this is byte-for-byte the previous behaviour.
    .filter(
      ({ artifact, size, height }) =>
        artifact.format === 'png' && artifact.enabled && (height ?? size) === size
    )
    .map(({ artifact, path, size }) => ({
      sizes: `${size}x${size}`,
      src: path,
      type: 'image/png',
      ...(artifact.background === 'opaque' ? { purpose: 'maskable' } : {})
    }));

/** site.webmanifest / manifest.webmanifest (generator: 'manifest'). */
export const generateWebManifest = (context: ExportContext, planned: PlannedArtifact[]): AttachmentOutput => {
  const { project } = context;
  const icons = manifestIcons(planned);
  const manifest = {
    name: project.metadata.name,
    short_name: project.metadata.shortName,
    description: project.metadata.description ?? '',
    start_url: '/',
    display: 'standalone',
    icons
  };
  return jsonBlob(manifest);
};

/** browserconfig.xml for Windows tiles (generator: 'browserconfig'). */
export const generateBrowserconfig = (): AttachmentOutput => {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square150x150logo src="mstile-150x150.png"/>
      <TileColor>#ffffff</TileColor>
    </tile>
  </msapplication>
</browserconfig>
`;
  return { content: xml, mime: 'application/xml' };
};

/**
 * `mipmap-anydpi-v26/ic_launcher.xml` — a declaracao que liga as duas camadas do adaptive icon.
 *
 * Sem esse arquivo o Android **nunca usa** o adaptive: ele cai no `ic_launcher.png`
 * legado, e a pessoa perde a máscara por shape, o parallax e a consistência com os outros
 * ícones do sistema. É um arquivo de três linhas que decide o ícone inteiro.
 *
 * ## Por que ele é attachment e não artifact
 *
 * `ExportFormat` é `svg | png | webp | jpeg | ico | icns` — não há formato de texto, e
 * acrescentar um só para isso seria um tipo novo no schema por causa de um XML. O
 * precedente já existe: `browserconfig.xml` e `site.webmanifest` são attachments, e
 * `ExportAttachmentGenerator` é a extensão certa.
 *
 * ## O `monochrome` é opcional de propósito
 *
 * A camada monocromática (ícones tematizados, Android 13+) é uma silhueta de **uma cor
 * só**, que no app é o override de paint de SVG. Emitir a referência sem ter a camada
* `@drawable/ic_launcher_monochrome` no projeto seria um XML que **não compila** — o
 * `aapt` falha em resource-not-found. Então a linha só entra se o artefato existir.
 *
 * ## `ic_launcher.xml` e `ic_launcher_round.xml` são idênticos
 *
 * O Android usa o segundo quando o launcher pede ícone redondo (`android:roundIcon`).
 * Os dois apontam para as mesmas camadas, então um gerador só serve os dois, e o
 * `Attachment.path` é quem decide o nome em disco.
 */
export const generateAndroidAdaptiveIcon = (planned: PlannedArtifact[]): AttachmentOutput => {
  const tem = (id: string) =>
    planned.some(({ artifact, path }) => artifact.enabled && (artifact.id === id || path.includes(id)));

  const linhas = ['  <background android:drawable="@mipmap/ic_launcher_background"/>'];
  linhas.push('  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>');
  if (tem('ic_launcher_monochrome')) {
    linhas.push('  <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>');
  }

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<!--
  Gerado pelo Icon Core. Copie a pasta mipmap-anydpi-v26/ para res/ do projeto Android.

  O Android 8.0+ le este arquivo; abaixo da API 26 ele ignora e usa o ic_launcher.png
  legado, que o mesmo export tambem gera.
-->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
${linhas.join('\n')}
</adaptive-icon>
`;
  return { content: xml, mime: 'application/xml' };
};

/** iconcore-report.json: the executed plan, per artifact. */
export const generatePlanReport = (
  context: ExportContext,
  plan: ExportPlan,
  planned: PlannedArtifact[],
  files: GeneratedFile[],
  warnings: string[],
  variant: IconVariant
): AttachmentOutput => {
  const audit = auditProject(context.project);
  const contrastIssues = audit.issues.filter((issue) => issue.code === 'LOW_CONTRAST');
  const safeAreaIssues = audit.issues.filter((issue) => issue.code === 'OUTSIDE_SAFE_AREA');

  const report = {
    generatedAt: new Date().toISOString(),
    project: {
      name: context.project.metadata.name,
      shortName: context.project.metadata.shortName
    },
    plan: {
      presetId: plan.presetId ?? null,
      variants: context.variants
    },
    variant,
    artifacts: planned.map((item) => ({
      id: item.artifact.id,
      path: item.path,
      format: item.format,
      mime: item.mime,
      size: item.size,
      // Additive: present only when the artifact is non-square.
      ...(item.height !== undefined ? { height: item.height } : {}),
      variant: item.variant
    })),
    files: files.map((file) => ({ path: file.path, size: file.size })),
    checks: {
      allSizesPresent: files.length > 0,
      safeAreaRespected: safeAreaIssues.length === 0,
      contrastPassed: contrastIssues.length === 0
    },
    warnings,
    score: audit.score
  };
  return jsonBlob(report);
};

/** WARNINGS.txt — only emitted when warnings exist (parity with web export). */
export const generateWarningsFile = (warnings: string[]): AttachmentOutput =>
  textBlob(`${warnings.join('\n')}\n`, 'text/plain');

/**
 * Dispatch an attachment generator. Returns `null` when there is nothing to
 * generate (e.g. incompatible plan), never throws for missing generators.
 */
export const generateAttachment = (
  generator: ExportAttachmentGenerator,
  resolve: {
    context: ExportContext;
    plan: ExportPlan;
    planned: PlannedArtifact[];
    files: GeneratedFile[];
    variant: IconVariant;
    warnings: string[];
  }
): AttachmentOutput | null => {
  switch (generator) {
    case 'manifest':
      return generateWebManifest(resolve.context, resolve.planned);
    case 'browserconfig':
      return generateBrowserconfig();
    case 'android-adaptive':
      return generateAndroidAdaptiveIcon(resolve.planned);
    case 'report':
      return generatePlanReport(
        resolve.context,
        resolve.plan,
        resolve.planned,
        resolve.files,
        resolve.warnings,
        resolve.variant
      );
    case 'preview': {
      const imagePaths = resolve.files
        .filter((file) => /\.(png|webp|jpe?g)$/i.test(file.path))
        .map((file) => file.path);
      return textBlob(generatePreviewHtml(resolve.context.project, imagePaths), 'text/html');
    }
    case 'readme':
      return generateReadme(resolve.context, resolve.planned, resolve.files);
  }
};

/** README.md derived from the executed plan (parity with web `generateReadme`). */
export const generateReadme = (
  context: ExportContext,
  planned: PlannedArtifact[],
  _files: GeneratedFile[]
): AttachmentOutput => {
  const { project } = context;
  const artifactLines = planned
    .map((item) => `- \`${item.path}\` (${item.format}${item.variant !== 'default' ? `, variant ${item.variant}` : ''})`)
    .join('\n');

  const content = `# ${project.metadata.name} — Icon Pack

Generated with Icon Core Export Utilities.
${planned.length > 0 ? `\n## Contents\n\n${artifactLines}\n` : ''}
## Usage

Reference the icons in your platform configuration (favicon \`<link>\` tags, \`manifest.json\`,
\`tauri.conf.json\`, or your desktop build resources).

## License

Generated assets are yours to use. Icon Core itself is free and open-source.
`;
  return textBlob(content, 'text/markdown');
};