import { Select } from '@iconcore/ui';
import { SELECTABLE_FONTS, type IconFont } from '@iconcore/renderer';
import { nominalFamily, useSystemFonts } from './useSystemFonts';

/**
 * O seletor de fonte.
 *
 * ## O valor sentinela
 *
 * `text.fontFamily` e uma **string livre** no schema, e um projeto que ja existia pode ter
 * qualquer pilha ali — `Inter, Sora, system-ui, sans-serif`, por exemplo. O valor que nao
 * corresponde a nenhuma opcao aparece como uma entrada propria, marcada como nao instalada,
 * em vez de o seletor cair em `system-ui` e a pessoa so descobrir que a fonte mudou quando
 * olhou o desenho.
 *
 * O sentinela e um prefixo, e nao um indice: um indice mudaria quando a lista de fontes do
 * sistema mudasse, e o `select` passaria a apontar para outra fonte sem que ninguem tivesse
 * tocado em nada.
 *
 * ## O que entra no documento e a **pilha**, nao so a familia
 *
 * Sem o fallback, uma maquina sem a fonte embarcada resolve no Times e o icone sai
 * serifado. A pilha tambem e o que o validador le para avisar que o SVG carrega um nome e
 * nao um arquivo.
 *
 * ## Os tres grupos, e o que cada um promete
 *
 * - **Bundled with the app** — o arquivo esta aqui, entao o preview e o PNG mostram
 *   exatamente o que a pessoa escolheu.
 * - **Resolves on any machine** — familia generica: nao depende de nenhum arquivo.
 * - **This computer** — o nome diz de onde vem, e o que custa: o SVG nao a embute.
 */
const OUTRA = '__outra__:';

/** A pilha que o `UPDATE_LAYER` grava: familia + fallback. */
const stackFor = (font: IconFont): string =>
  font.origin === 'generic' ? font.id : `${font.id}, system-ui, sans-serif`;

/**
 * O `id` de uma fonte **ou** o seu `label` — o que a pilha pode conter.
 *
 * ## Por que os dois
 *
 * Para uma fonte embarcada os dois sao quase iguais: `'Cal Sans'` e `Cal Sans`. Para as
 * genericas **nao**: o `id` e a palavra do CSS (`system-ui`) e o `label` e o que a pessoa ve
 * (`System UI`). E o que vai no documento e o `id`.
 *
 * A versao anterior comparava so com o `label`, entao a familia do default —
 * `system-ui, sans-serif` — nao casava com nenhuma opcao, e o seletor abria mostrando
 * **`system-ui — not installed`** para uma fonte que ele mesmo oferece. Um controle que
 * chama de "nao instalada" a propria opcao padrao e pior do que nenhum.
 */
const casaCom = (familia: string, font: IconFont): boolean =>
  font.id === familia || font.label === familia;

export interface FontPickerProps {
  /** O valor gravado em `text.fontFamily`. */
  value: string;
  onChange: (fontFamily: string) => void;
}

export const FontPicker = ({ value, onChange }: FontPickerProps) => {
  const sistema = useSystemFonts();

  const atual = nominalFamily(value);
  const conhecida = SELECTABLE_FONTS.some((f) => casaCom(atual, f));
  const noSistema =
    sistema.state === 'ready' && sistema.fonts.some((f) => casaCom(atual, f));
  const desconhecida = !conhecida && !noSistema;

  const embarcadas = SELECTABLE_FONTS.filter((f) => f.origin === 'bundled');
  const genericas = SELECTABLE_FONTS.filter((f) => f.origin === 'generic');
  const doSistema = sistema.state === 'ready' ? sistema.fonts : [];

  const hint =
    sistema.state === 'unsupported'
      ? 'This browser does not list installed fonts. A family still applies if you have it.'
      : sistema.state === 'loading'
        ? 'Reading installed fonts…'
        : sistema.state === 'ready' && doSistema.length === 0
          ? 'No installed fonts were reported.'
          : undefined;

  return (
    <>
      <Select
        label="Font"
        hint={hint}
        value={desconhecida ? `${OUTRA}${atual}` : atual}
        onChange={(event) => {
          const alvo = event.target.value;
          // A entrada sintetica da fonte que ja estava no documento: nao muda nada.
          if (alvo.startsWith(OUTRA)) return;
          const font =
            SELECTABLE_FONTS.find((f) => casaCom(alvo, f)) ??
            doSistema.find((f) => casaCom(alvo, f));
          if (font) onChange(stackFor(font));
        }}
      >
        {desconhecida && <option value={`${OUTRA}${atual}`}>{atual} — not installed</option>}

        {embarcadas.length > 0 && (
          <optgroup label="Bundled with the app">
            {embarcadas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </optgroup>
        )}

        <optgroup label="Resolves on any machine">
          {genericas.map((f) => (
            /**
             * `value={f.id}`, e nao `f.label`.
             *
             * O valor e o que vai para o documento e o que casa com a pilha gravada. Com o
             * rotulo, nenhuma opcao teria o valor `system-ui`, o `<select>` nao casaria com o
             * `value` controlado e o navegador **selecionaria a primeira opcao** — o
             * navegador nao mostra um campo em branco, ele escolhe por conta propria, e o
             * campo pareceria estar em Cal Sans.
             */
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </optgroup>

        {doSistema.length > 0 && (
          <optgroup label="This computer">
            {doSistema.map((f) => (
              <option key={f.id} value={f.label}>
                {f.label}
              </option>
            ))}
          </optgroup>
        )}
      </Select>

      {/**
       * O botao so existe onde a API existe, e o texto diz o que ele faz. Um botao de "usar
       * fontes do sistema" que falha ao ser clicado e pior que um botao ausente.
       *
       * Sem `aria-label` no `Select` acima, de proposito: o `Select` do kit escreve
       * `aria-label` **antes** do `{...rest}`, entao um rotulo passado aqui sobrescreve o
       * `<label htmlFor>` e o nome acessivel passa a discordar do texto visivel ("Font family"
       * contra "Font"). Quem fala "clicar em Font" nao acerta o campo.
       */}
      {sistema.state === 'idle' && (
        <button type="button" className="ic-link-button" onClick={sistema.reveal}>
          Read fonts from this computer
        </button>
      )}
    </>
  );
};
