import type { ProjectManifest } from '@iconcore/shared';

/**
 * Análise de pasta: o que há aqui, e o que provavelmente é o logo.
 *
 * ## O que isto é, e o que não é
 *
 * Isto **lê** uma pasta e **propõe**. Não grava, não move, não arruma. A proposta só vira
 * `project.json` quando a pessoa aceita — e a razão é `IC-D5`: um app que reorganiza o disco
 * de quem abriu o projeto sem pedir é um app que ninguém confia o suficiente para abrir de novo.
 *
 * ## Por que isto é puro
 *
 * A entrada é uma lista de arquivos e o texto dos que interessam. Nenhum `FileSystemHandle`,
 * nenhum DOM. Isso é deliberado: a mesma função roda na tela, no teste e — quando o `M1`
 * chegar — dentro do `Tauri`, sem um segundo caminho de lógica. E é o que a torna testável
 * sem navegador, que é a razão de o `D1b` ser o marco travado em vez deste.
 */

/** Formatos que sabemos ler e que servem de artefato de projeto. */
export const ARTIFACT_EXTENSIONS = [
  'png',
  'svg',
  'webp',
  'jpg',
  'jpeg',
  'gif',
  'ico',
  'icns',
  'avif'
] as const;

/** Extensões em que vale procurar referência a imagem. */
const SCANNABLE_EXTENSIONS = [
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'html',
  'css',
  'scss',
  'md',
  'mdx',
  'vue',
  'svelte',
  'astro',
  'yaml',
  'yml'
] as const;

export const DOCUMENT_EXTENSION = '.iconcore.json';

/** Pastas que nunca são projeto. Lista curta e explícita, como manda o manifesto. */
export const DEFAULT_IGNORE = ['node_modules', '.git', 'dist', 'build', 'target'] as const;

export interface ScannedFile {
  /** Relativo à raiz, sempre com barra `/`. Um caminho com `\` nunca entra aqui. */
  path: string;
  size: number;
  /**
   * O texto, **quando é `.iconcore.json` ou quando o chamador já o tem**.
   *
   * Ler o arquivo é caro e o webview não faz isso sozinho; quem chama decide o que vale
   * a pena trazer. Sem texto, um documento ainda é **contado**, mas não classificado.
   */
  text?: string;
}

export type CandidateRole = 'logo' | 'asset';

export interface Candidate {
  role: CandidateRole;
  path: string;
  /**
   * Por que a análise acredita nisso. **Sempre mostrado** antes de a pessoa aceitar —
   * uma sugestão sem justificativa é uma adivinhação, e adivinhação que grava em disco
   * é um bug esperando nome.
   */
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ScanInput {
  files: ScannedFile[];
  /** `project.json` já lido, quando existe. Sobrepõe a proposta. */
  manifest?: ProjectManifest | null;
}

export interface ScanResult {
  candidates: Candidate[];
  /** Referência quebrada, `.iconcore.json` ilegível, manifesto inválido. Não impede o resto. */
  warnings: string[];
  /** O que a análise **não** conseguiuperguntado, para a tela dizer em vez de fingir que achou tudo. */
  unresolved: string[];
}

/** `a/b/c.Png` -> `png`. Vazio quando não tem extensão. */
const extensionOf = (path: string): string => {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot === -1 ? '' : base.slice(dot + 1).toLowerCase();
};

const basename = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

/** `.iconcore.json` — e não `.json` qualquer. */
export const isDocumentPath = (path: string): boolean =>
  path.toLowerCase().endsWith(DOCUMENT_EXTENSION);

export const isImagePath = (path: string): boolean =>
  (ARTIFACT_EXTENSIONS as readonly string[]).includes(extensionOf(path));

const isScannable = (path: string): boolean =>
  (SCANNABLE_EXTENSIONS as readonly string[]).includes(extensionOf(path));

/**
 * Uma pasta está ignorada por `manifest.ignore` ou pelas padrão?
 *
 * Casa **qualquer segmento**, não só o primeiro: `apps/web/node_modules` também está
 * fora. O preço é que não dá para ignorar uma pasta chamada `dist` aninhada dentro de
 * `src` — e esse é um preço justo, porque o inverso (ignorar por convenção onde não
 * era) seria silencioso.
 */
const isIgnored = (path: string, extra: readonly string[]): boolean => {
  const segments = path.split('/');
  const names = new Set<string>([...DEFAULT_IGNORE, ...extra]);
  return segments.some((segment) => names.has(segment));
};

/** Resolve `../` e `./` contra a pasta do arquivo que referenciou. */
export const resolveRelative = (fromDir: string, ref: string): string => {
  const stack = fromDir === '' ? [] : fromDir.split('/');
  for (const part of ref.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
};

/**
 * Referências a imagem dentro de um arquivo de código.
 *
 * Três sintaxes, porque cada uma aparece num lugar:
 *
 * 1. string entre aspas — `"./logo.png"`, e o que `src=""` de `<img>` é;
 * 2. markdown inline — `![](./hero.png)`, **sem aspas**;
 * 3. markdown por definição — `![x][r]` com `[r]: ./hero.png` mais abaixo.
 *
 * A 2 e a 3 existem porque o README é onde a referência quebrada **aparece para o
 * leitor**. Um teste que só cobrisse aspas passaria e deixaria o caso comum sem cobertura.
 */
export const findImageReferences = (text: string): string[] => {
  const out: string[] = [];

  const quoted = /['"`]([^'"`\n]*?\.(?:png|svg|webp|jpe?g|gif|ico|icns|avif))(?:[?#][^'"`\n]*)?['"`]/gi;
  let m: RegExpExecArray | null;
  while ((m = quoted.exec(text)) !== null) {
    out.push(m[1].trim());
  }

  const markdownInline = /!\[[^\]]*\]\(\s*([^)\s]+)/g;
  while ((m = markdownInline.exec(text)) !== null) {
    out.push(m[1].trim());
  }

  const markdownDefinition = /^\s*\[[^\]]+\]:\s*(\S+)/gm;
  while ((m = markdownDefinition.exec(text)) !== null) {
    out.push(m[1].trim());
  }

  return [...new Set(out)].filter((ref) => {
    if (ref.startsWith('data:')) return false; // conteúdo, não caminho
    if (ref.includes('*')) return false; // glob não é arquivo
    // Título opcional do markdown: `![](./a.png "O logo")`.
    return !isImagePath(ref.split(/\s+/)[0]) ? false : true;
  });
};

/** Lê o suficiente de um `.iconcore.json` para saber se o canvas é quadrado. */
interface CanvasFacts {
  size?: number;
  height?: number;
}

/**
 * Canvas de um documento, sem `JSON.parse` completo.
 *
 * O parse inteiro é tentado primeiro — é o caminho honesto. O fallback por regex é para o
 * documento **corrompido**, que é justamente o caso em que a tela precisa dizer "isto aqui
 * não abre" em vez de engolir. Devolver `null` no parse **e** no regex significa "não
 * sei"; devolver pelo regex significa "sei o suficiente".
 */
const readCanvasFacts = (text: string): CanvasFacts | null => {
  try {
    const doc = JSON.parse(text) as { canvas?: { size?: number; height?: number } };
    if (!doc.canvas) return {};
    return { size: doc.canvas.size, height: doc.canvas.height };
  } catch {
    const size = /"size"\s*:\s*(\d+)/.exec(text);
    const height = /"height"\s*:\s*(\d+)/.exec(text);
    if (!size && !height) return null;
    return { size: size ? Number(size[1]) : undefined, height: height ? Number(height[1]) : undefined };
  }
};

/**
 * A análise.
 *
 * A ordem das regras é a ordem da confiança, e a confiança é o que a tela mostra. Um
 * `.iconcore.json` quadrado é `high` porque é **verificado**: o documento diz o canvas.
 * Um arquivo chamado `logo.png` é `medium` porque é **convenção**. Um PNG qualquer
 * citado num README é `low`, porque pode ser screenshot de bug.
 */
export const scanProject = ({ files, manifest }: ScanInput): ScanResult => {
  const warnings: string[] = [];
  const unresolved: string[] = [];
  const extraIgnore = manifest?.ignore ?? [];

  const visible = files.filter((f) => !isIgnored(f.path, extraIgnore));
  const present = new Set(visible.map((f) => f.path));
  const candidates: Candidate[] = [];

  // 1. Documentos. A fonte de verdade sobre o que é ícone.
  const documents: Candidate[] = [];
  for (const file of visible) {
    if (!isDocumentPath(file.path)) continue;
    if (file.text === undefined) {
      unresolved.push(file.path);
      continue;
    }
    const facts = readCanvasFacts(file.text);
    if (facts === null) {
      warnings.push(`${file.path} não abre como JSON — não analisado.`);
      continue;
    }
    if (facts.height === undefined || facts.height === facts.size) {
      documents.push({
        role: 'logo',
        path: file.path,
        reason: facts.size
          ? `Canvas quadrado de ${facts.size}px — é a proporção de um ícone.`
          : 'Canvas sem altura declarada, ou seja, quadrado.',
        confidence: facts.size && facts.size <= 512 ? 'high' : 'medium'
      });
    } else {
      documents.push({
        role: 'asset',
        path: file.path,
        reason: `Canvas de ${facts.size}×${facts.height}px — não-quadrado, é asset.`,
        confidence: 'high'
      });
    }
  }
  candidates.push(...documents);

  // 2. Referências em código. Só as que apontam para arquivo que existe.
  const referenced = new Set<string>();
  for (const file of visible) {
    if (!isScannable(file.path) || file.text === undefined) continue;
    const fromDir = file.path.slice(0, file.path.lastIndexOf('/'));
    for (const ref of findImageReferences(file.text)) {
      const isAbsoluteish = ref.startsWith('/') || /^[a-z]+:/i.test(ref);
      const resolved = isAbsoluteish ? ref.replace(/^\//, '') : resolveRelative(fromDir, ref);
      if (!present.has(resolved)) {
        if (file.path.endsWith('.md') || file.path.endsWith('.mdx')) {
          warnings.push(`${file.path} cita ${ref}, que não está na pasta.`);
        }
        continue;
      }
      if (isDocumentPath(resolved)) continue;
      referenced.add(resolved);
    }
  }

  const logoDocument = candidates.find((c) => c.role === 'logo');
  for (const path of [...referenced].sort()) {
    if (logoDocument && path === logoDocument.path) continue;
    const base = basename(path).toLowerCase();
    const looksLikeLogo = /(^|[^a-z])(logo|icon|favicon|mark|brand)([^a-z]|$)/.test(base);
    candidates.push({
      role: looksLikeLogo ? 'logo' : 'asset',
      path,
      reason: looksLikeLogo
        ? 'Nome de logo, e citado por um arquivo do projeto.'
        : 'Imagem citada por um arquivo do projeto.',
      confidence: looksLikeLogo ? 'medium' : 'low'
    });
  }

  // 3. Imagens soltas que ninguém cita — as deixadas de fora são as de uso interno
  //    (favicon de dev, screenshot de teste). Propor toda imagem joga o ruído no lixo.
  const already = new Set(candidates.map((c) => c.path));
  for (const file of visible) {
    if (!isImagePath(file.path) || already.has(file.path)) continue;
    const base = basename(file.path).toLowerCase();
    if (/^(favicon|apple-touch|android-chrome|safari-pinned)/.test(base)) continue;
    unresolved.push(file.path);
  }

  // 4. O manifesto vence a proposta: quem respondeu, não é adivinhado.
  if (manifest?.logo) {
    if (!present.has(manifest.logo)) {
      warnings.push(`project.json aponta logo para ${manifest.logo}, que não está na pasta.`);
    }
    // Outro documento quadrado não vira logo: o manifesto já escolheu, e dois "o logo"
    // na mesma tela é uma pergunta sem resposta. Ele continua na lista, rebaixado para
    // asset — que é o que ele é: um documento que existe e pode virar versão nova.
    const rest = candidates
      .filter((c) => c.path !== manifest.logo)
      .map((c) =>
        c.role === 'logo'
          ? {
              ...c,
              role: 'asset' as const,
              reason: `${c.reason} O project.json escolheu outro como logo.`
            }
          : c
      );
    return {
      candidates: [
        {
          role: 'logo',
          path: manifest.logo,
          reason: 'Declarado no project.json.',
          confidence: 'high'
        },
        ...rest
      ],
      warnings,
      unresolved
    };
  }

  return { candidates, warnings, unresolved };
};