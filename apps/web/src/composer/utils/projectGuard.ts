import type { IconCoreProject } from '@iconcore/shared';
import { migrateToCurrent, type IconCoreProjectV2 } from '@iconcore/engine';

/**
 * Lightweight runtime shape check for an opened `.iconcore.json` file.
 *
 * The validator package audits *quality* of a well-formed project; this guard
 * only confirms the parsed JSON has the structural fields the editor relies on,
 * so we can reject garbage with a friendly message instead of crashing.
 *
 * Accepts both v2 (legacy) and v3 (canonical) — callers migrate with
 * `migrateToCurrent`.
 */
export const isIconCoreProject = (value: unknown): value is IconCoreProjectV2 | IconCoreProject => {
  if (typeof value !== 'object' || value === null) return false;
  const project = value as Record<string, unknown>;

  const metadata = project.metadata as Record<string, unknown> | undefined;
  const canvas = project.canvas as Record<string, unknown> | undefined;

  return (
    (project.schemaVersion === 2 || project.schemaVersion === 3) &&
    typeof metadata === 'object' && metadata !== null && typeof metadata.name === 'string' &&
    typeof canvas === 'object' && canvas !== null && typeof canvas.size === 'number' &&
    Array.isArray(project.layers) &&
    Array.isArray(project.targets)
  );
};

/** Parse + validate a project file's text, returning the canonical project or null. */
export const parseProjectFile = (text: string): IconCoreProject | null => {
  try {
    const parsed = JSON.parse(text);
    return isIconCoreProject(parsed) ? normalizeTextFields(migrateToCurrent(parsed)) : null;
  } catch {
    return null;
  }
};

/**
 * Normaliza os campos de texto **na carga**, que é a fronteira.
 *
 * `isIconCoreProject` confirma o formato do documento — `schemaVersion`, `metadata.name`,
 * `canvas.size`, e que `layers` e `targets` são arrays. Ele **não olha dentro da layer**,
 * e não deveria: um guarda que valida tudo é um validador, e o validador é outro pacote.
 *
 * Mas a consequência é que `text.textAlign` e `text.fontStyle` chegam do arquivo com
 * qualquer valor. E isso não é teórico:
 *
 * - um `.iconcore.json` **editado à mão** com `textAlign: "justify"`;
 * - um projeto gravado por uma versão futura do app, aberto numa versão anterior;
 * - `fontStyle: "oblique"`, que existiu no tipo durante o desenvolvimento do `IC63/2` e
 *   **não tem mais** — o arquivo fica com um valor que o tipo atual rejeita.
 *
 * O TypeScript não protege nenhum desses casos: ele protege o código, não o JSON.
 *
 * ## Onde normaliza, e por que também no renderer
 *
 * Aqui é o lugar certo: **uma vez**, na entrada, e todo consumidor downstream — canvas,
 * SVG, export, relatório — vê o valor já resolvido. Espalhar `?? 'center'` pelos
 * chamadores daria a cada um o seu default, e foi assim que `undefined` e um valor
 * desconhecido passaram a se comportar diferente em lugares diferentes.
 *
 * O `normalizeTextAlign` do renderer continua existindo **de propósito**: o renderer é
 * usado diretamente pela CLI e pelos testes, sem passar por aqui. Duas defesas porque são
 * duas entradas diferentes, e porque a do renderer é a que a spec de markup mede.
 *
 * O valor normalizado é `undefined` quando não há nada a dizer: assim um projeto recém
 * criado **não ganha campos que não pediu**, e o round-trip continua devolvendo um
 * documento idêntico ao original.
 */
export const normalizeTextFields = (project: IconCoreProject): IconCoreProject => ({
  ...project,
  layers: project.layers.map((layer) => {
    if (layer.kind !== 'text' || !layer.text) return layer;
    const { textAlign, fontStyle, ...resto } = layer.text;
    const texto = {
      ...resto,
      // `center` e `normal` sao os defaults, entao so entram de volta se a pessoa pediu.
      ...(textAlign === 'left' || textAlign === 'right' ? { textAlign } : {}),
      ...(fontStyle === 'italic' ? { fontStyle } : {})
    };
    return { ...layer, text: texto };
  })
});
