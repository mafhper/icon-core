import { useEffect, useState } from 'react';
import type { IconFont } from '@iconcore/renderer';

/**
 * As fontes instaladas na maquina da pessoa.
 *
 * ## Por que `queryLocalFonts` e nao varrer `C:\Windows\Fonts`
 *
 * Porque a **Local Font Access API** e a interface que o navegador expoe para isso, e ela
 * devolve as familias ja **registradas** no sistema de tipografia do agente de usuario — que
 * e exatamente o conjunto que resolve um `font-family`. Um arquivo em disco pode nao estar
 * registrado, e vice-versa: registrado e o que importa para o `<text>` do SVG.
 *
 * E porque varrer o disco exigiria permissao de filesystem, que o app web nao tem — e seria
 * um pedido de permissao que ninguem entenderia ao ver um editor de icone.
 *
 * ## A degradacao
 *
 * A API e Chromium-only e **exige gesto do usuario**: `queryLocalFonts()` tem de ser
 * chamada de um handler de clique, senao o navegador recusa. Por isso o hook nao consulta
 * sozinho — ele expoe um `reveal`, e a UI so o chama no clique.
 *
 * Onde ela nao existe, a lista e so a embarcada + as genericas, e o aviso **diz** em vez de
 * sumir: uma opcao que falha ao ser clicado e pior que uma opcao ausente.
 *
 * ## O que a lista do sistema **nao** promete
 *
 * Uma fonte do sistema resolve no editor e no PNG, e no SVG **na maquina de quem abre** — o
 * mesmo contrato das embarcadas (ver `fonts.ts`). E por isso que o grupo no seletor se
 * chama "This computer": o nome diz de onde a fonte vem, e o que ela custa em fidelidade.
 *
 * ## Por que este arquivo existe separado do componente
 *
 * Porque `react-refresh/only-export-components` (`--max-warnings 0`) exige que um arquivo
 * que exporta componente so exporte componentes, e `FontPicker.tsx` exportava o hook
 * junto. Um `eslint-disable` esconderia o sintoma; os dois valores **sao** compartilhaveis,
 * e o `ExportView` vai querer `nominalFamily`.
 */

/** O tipo que a Local Font Access API devolve (parcial: so o que o app usa). */
interface LocalFontInfo {
  family: string;
  fullName: string;
  postscriptName: string;
}

type QueryLocalFonts = () => Promise<LocalFontInfo[]>;

export type SystemFonts =
  | { readonly state: 'idle' }
  | { readonly state: 'unsupported' }
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly fonts: readonly IconFont[] };

const hasApi = (): QueryLocalFonts | null => {
  const w = window as unknown as { queryLocalFonts?: QueryLocalFonts };
  return typeof w.queryLocalFonts === 'function' ? w.queryLocalFonts : null;
};

/**
 * As familias do sistema, deduplicadas e ordenadas.
 *
 * A API devolve uma entrada **por face**, e o que repete familia (`Cal Sans Bold`) chega
 * como familia propria em alguns sistemas e como `fullName` em outros. Deduplicar e o que a
 * lista precisa — e o que o `<text>` resolve.
 */
const toFontList = (infos: readonly LocalFontInfo[]): IconFont[] => {
  const porFamilia = new Map<string, IconFont>();
  for (const info of infos) {
    const familia = info.family.trim();
    if (!familia || porFamilia.has(familia)) continue;
    porFamilia.set(familia, {
      // Com aspas: e o que o CSS e o SVG exigem de um nome com espaco.
      id: `'${familia.replace(/'/g, '')}'`,
      label: familia,
      origin: 'system',
      svgFidelity: 'substitutes-without-font'
    });
  }
  return [...porFamilia.values()].sort((a, b) => a.label.localeCompare(b.label));
};

export const useSystemFonts = (): SystemFonts & { reveal: () => void } => {
  const [state, setState] = useState<SystemFonts>(() =>
    hasApi() ? { state: 'idle' } : { state: 'unsupported' }
  );

  useEffect(() => {
    if (!hasApi()) setState({ state: 'unsupported' });
  }, []);

  const reveal = () => {
    const api = hasApi();
    if (!api) {
      setState({ state: 'unsupported' });
      return;
    }
    setState({ state: 'loading' });
    api()
      .then((infos) => setState({ state: 'ready', fonts: toFontList(infos) }))
      .catch(() => setState({ state: 'unsupported' }));
  };

  return { ...state, reveal };
};

/**
 * A familia nominal de uma pilha: a primeira, sem as aspas.
 *
 * E o que casa com a lista do seletor. Guardar e comparar a pilha inteira faria
 * `system-ui, sans-serif` nao casar com a opcao `system-ui` — e o `Select` cairia em
 * branco num documento que veio de arquivo.
 */
export const nominalFamily = (fontFamily: string): string =>
  fontFamily.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '') ?? '';
