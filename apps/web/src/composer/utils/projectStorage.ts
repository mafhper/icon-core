/**
 * Writing the project to `localStorage`, and telling the user when it did not
 * happen.
 *
 * The autosave writes `JSON.stringify(project)`, and a layer's source is the
 * image as base64 — about 4/3 of its binary size. Measured in Chromium: the
 * budget is **5.101 KB** for such a payload, and a `QuotaExceededError` arrives
 * around layer 31 of 170 KB images.
 *
 * What happens today at that point: `setItem` throws inside a `setTimeout`, so the
 * error is unhandled, nothing reaches the user, and the editor keeps showing a
 * project that looks saved. The **previous good value is still in storage** —
 * measured, not assumed — so this is not data loss; it is a user who is told,
 * implicitly, that their work is safe when it no longer is.
 *
 * That is why the outcome is a value rather than an exception: the caller has to
 * be able to say something specific, and it has to be able to say it once rather
 * than on every keystroke.
 */

export type SaveOutcome =
  | { kind: 'saved'; payloadBytes: number }
  | {
      kind: 'quota-exceeded';
      payloadBytes: number;
      budgetBytes: number;
      overshootBytes: number;
    }
  | { kind: 'unavailable' };

/** Measured in Chromium for a project carrying base64 image layers. */
const DEFAULT_BUDGET = 5 * 1024 * 1024;

/**
 * Whether an error is the browser refusing for lack of room.
 *
 * Read by `name` rather than by `instanceof DOMException`: this module is
 * exercised in Node by the unit tests, where a thrown object is not a DOMException
 * even though it describes the same condition. Firefox and older WebKit also use
 * a different name for the same thing.
 */
const isQuotaError = (error: unknown): boolean => {
  const nome = (error as { name?: string } | null)?.name;
  return nome === 'QuotaExceededError' || nome === 'NS_ERROR_DOM_QUOTA_REACHED';
};

export interface SaveOptions {
  /**
   * The budget to measure the overflow against. Only used for the message; the
   * store rejects the write on its own.
   */
  budget?: number;
}

/**
 * Nome de arquivo derivado do nome do projeto.
 *
 * Exportado porque o nome aparece em **três** lugares — o download, o `<input>` de
 * abertura e o rótulo do item no menu — e divergir entre eles produz o Sintoma 2 do
 * `IC-N4` (uma verdade asserted num lugar e falsa em outro).
 */
export const projectFileName = (name: string): string =>
  `${name.toLowerCase().replace(/\s+/g, '-')}.iconcore.json`;

export type DownloadOutcome =
  /** The browser accepted the download. The dirty flag may be cleared. */
  | { kind: 'downloaded'; fileName: string }
  /** Nothing was handed over; **the project is still unsaved**. */
  | { kind: 'skipped'; reason: 'no-project' | 'no-document' };

/**
 * "Salvar" como o app consegue fazer hoje: **baixar o `.json`**.
 *
 * ## Por que isto mora aqui, e não no botão
 *
 * Estava **duplicado**: 13 linhas em `Topbar.tsx` e as mesmas 13 em
 * `useKeyboardShortcuts.ts`. Duas cópias significam dois lugares para um bug aparecer,
 * e o bug apareceu nos dois — o `SET_DIRTY(false)` rodava mesmo quando não havia projeto
 * para baixar, e o editor marcava "salvo" sem ter salvo nada.
 *
 * ## Por que ainda é um download, e não "salvar no lugar"
 *
 * Porque `showDirectoryPicker` não está implementado — é o `D1b` do `IC63`, e ele
 * **exige gesto do usuário** e não é automatizável. Quando o `M1` do `IC65` (ou o
 * `D1b`) entrar, o `downloadProject` vira o **fallback** e o handle de pasta assume.
 * Por isso o retorno distingue `downloaded` de `skipped`: só o primeiro autoriza
 * limpar o dirty.
 *
 * ## `revokeObjectURL` imediato, e por que ainda funciona
 *
 * Revogar no mesmo tick jáCancelled o download em Firefox antes. O `setTimeout`
 * adia o suficiente para o fetch do blob ter começado, e revoke de objeto já
 * retrieved é seguro. Este é o mesmo bug que o ADR-017 do outro lado já pagou.
 */
export const downloadProject = (
  project: { metadata: { name: string } } | null | undefined,
  doc: Document = document
): DownloadOutcome => {
  if (!project) return { kind: 'skipped', reason: 'no-project' };
  const fileName = projectFileName(project.metadata.name);
  const json = JSON.stringify(project, null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return { kind: 'downloaded', fileName };
};

export const saveProject = (
  store: Pick<Storage, 'setItem'>,
  key: string,
  project: unknown,
  options: SaveOptions = {}
): SaveOutcome => {
  const payload = JSON.stringify(project);
  // The budget is for the *message*. A real browser store rejects the write on
  // its own; when it does, the caller has no other way to say by how much the
  // project overflows, so the default stands unless a test passes a smaller one.
  const budget = options.budget ?? DEFAULT_BUDGET;

  try {
    store.setItem(key, payload);
    return { kind: 'saved', payloadBytes: payload.length };
  } catch (error) {
    if (isQuotaError(error)) {
      return {
        kind: 'quota-exceeded',
        payloadBytes: payload.length,
        budgetBytes: budget,
        // Zero when the store refused before the measured budget — which is the
        // normal case for a browser whose real quota is smaller than ours. Better
        // a small undercount than a fabricated overflow.
        overshootBytes: Math.max(0, payload.length - budget)
      };
    }

    // A blocked or partitioned store throws on every write. That is a mode, not
    // a failure worth announcing each time — private browsing, mostly.
    return { kind: 'unavailable' };
  }
};

const mb = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/**
 * The user-facing text for an outcome, or `null` when there is nothing to say.
 *
 * `null` for a normal save (a toast on every autosave would be noise) and for
 * an unavailable store (private browsing is not a problem to announce). Only a
 * quota failure gets a message, because only there is the user working under a
 * false belief.
 *
 * It deliberately does not say the work is lost: measured, the previous good
 * save is still in storage. Saying "lost" would be scarier and less accurate
 * than "your last save is still there, but newer edits are not being kept".
 */
export const describeSaveOutcome = (outcome: SaveOutcome): string | null => {
  if (outcome.kind !== 'quota-exceeded') return null;

  return (
    `This project is too large for autosave (${mb(outcome.payloadBytes)} against a ` +
    `${mb(outcome.budgetBytes)} browser budget), so newer edits are not being saved. ` +
    `Your last saved version is still here — download or export the project to keep ` +
    `your current work.`
  );
};