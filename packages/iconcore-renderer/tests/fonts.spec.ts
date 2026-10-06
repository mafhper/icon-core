import { describe, expect, it } from 'vitest';
import {
  BUNDLED_FONTS,
  DEFAULT_FONT_ID,
  DEFAULT_FONT_STACK,
  GENERIC_FONTS,
  SELECTABLE_FONTS,
  fontById,
  hasBundledFile,
  svgFidelityOf
} from '../src/fonts';
import {
  GENERIC_FONT_FAMILIES,
  fontStackIsFontIndependent,
  fontStackRendersEverywhere
} from '@iconcore/shared';
import { existeNaRaiz } from './bundledFontFiles';

/**
 * As fontes, e as promessas que cada uma pode cumprir.
 *
 * ## O que este arquivo existe para fixar
 *
 * Uma camada de texto carregava `fontFamily: 'Inter, Sora, system-ui, sans-serif'` como
 * string fixa, sem controle na UI, e **nenhuma das duas primeiras fontes estava no
 * projeto**. O SVG exportado carrega o *nome* da familia, e quem abre resolve na maquina
 * dele.
 *
 * Entao ha duas perguntas distintas, e este arquivo cobre as duas:
 *
 * 1. **A fonte existe aqui?** A embarcada tem arquivo, e a lista nao promete uma que nao tem.
 * 2. **O export pode entregar?** `generic` resolve em qualquer maquina; `bundled` e
 *    `system` so na maquina de quem tem a fonte. E essa distincao precisa estar **escrita**,
 *    nao implícita, porque e o que o validador transforma em aviso.
 *
 * ## O teste mais importante deste arquivo
 *
 * `o default resolve em qualquer maquina`. O default e o que ninguem escolheu: e o que toda
 * camada nova usa, e o que ninguem vai olhar duas vezes. Se ele deixar de resolver, todo
 * icone novo nasce com uma promessa que o export nao cumpre.
 */
describe('o que existe', () => {
  it('a Cal Sans esta embarcada, com arquivo e peso', () => {
    const cal = BUNDLED_FONTS.find((f) => f.label === 'Cal Sans');
    expect(cal).toBeDefined();
    expect(cal!.origin).toBe('bundled');
    expect(cal!.bundledPath).toBe('assets/fonts/CalSans-Regular.woff2');
  });

  it('toda fonte embarcada tem arquivo declarado', () => {
    for (const f of BUNDLED_FONTS) {
      expect(f.bundledPath).toBeTruthy();
    }
  });

  it('toda fonte embarcada tem um arquivo de verdade em disco', () => {
    // `hasBundledFile` e a funcao que mede: `BUNDLED_FONTS` declara a intencao. Uma fonte
    // listada sem arquivo falha em silencio — o preview cai no fallback e a pessoa acha que
    // escolheu e nao escolheu.
    // O filesystem e real de proposito: este teste roda em Node e pode ler o disco. A
    // primeira versao usou `existsSync(p)` com o caminho RELATIVO, e o vitest roda com o
    // cwd no package — entao `assets/fonts/...` nao existia ali e o teste falhou medindo o
    // caminho, nao a fonte. Ver `bundledFontFiles.ts`.
    for (const f of BUNDLED_FONTS) {
      expect(hasBundledFile(f, existeNaRaiz)).toBe(true);
    }
  });

  it('as familias genericas vem do shared, e nao de uma lista local', () => {
    // Uma lista reescrita aqui seria a segunda fonte de verdade, e a divergencia seria
    // silenciosa: o seletor ofereceria uma familia que o validador nao reconhece.
    expect(GENERIC_FONTS.map((f) => f.id)).toEqual([...GENERIC_FONT_FAMILIES]);
  });
});

describe('o que o export pode entregar', () => {
  it('o default e a fonte embarcada, e a pilha tem fallback', () => {
    expect(DEFAULT_FONT_ID).toBe("'Cal Sans'");
    expect(DEFAULT_FONT_STACK).toBe("'Cal Sans', system-ui, sans-serif");
    expect(DEFAULT_FONT_STACK.startsWith(DEFAULT_FONT_ID)).toBe(true);

    // O fallback e o que impede o pior desfecho: sem ele, uma maquina sem a fonte
    // embarcada resolveria no Times e o icone sairia serifado — e nao avisado.
    expect(fontStackRendersEverywhere(DEFAULT_FONT_STACK)).toBe(true);
  });

  it('o default NAO e independente de fonte — e o validador avisa por isso', () => {
    // Esta e a consequencia de usar uma fonte embarcada como default, e e o que o
    // `TEXT_FONT_NOT_EMBEDDED` existe para dizer. Um default invisivel e "correto" no SVG
    // seria trocar um defeito mensuravel por um invisivel.
    expect(fontStackIsFontIndependent(DEFAULT_FONT_STACK)).toBe(false);

    // E a familia generica continua disponivel para quem quer o SVG resolvendo em qualquer
    // maquina: e a resposta certa para esse caso, e nao uma opcao esquecida.
    expect(fontStackIsFontIndependent('system-ui, sans-serif')).toBe(true);
  });

  it('a fonte embarcada esta declarada com arquivo, e ele existe', () => {
    // O default aponta para uma fonte que este projeto **embarcou**. Se o arquivo sumir, o
    // default vira um nome de fonte que ninguem tem — e o preview volta ao fallback sem
    // aviso, que e o mesmo modo de falha que a fonte remota tinha.
    const cal = BUNDLED_FONTS.find((f) => f.label === 'Cal Sans');
    expect(cal).toBeDefined();
    expect(hasBundledFile(cal!, existeNaRaiz)).toBe(true);
  });

  it('toda familia generica e independente de fonte, e renderiza em qualquer maquina', () => {
    for (const f of GENERIC_FONTS) {
      expect(f.svgFidelity).toBe('as-designed-anywhere');
      expect(fontStackIsFontIndependent(f.id)).toBe(true);
      expect(fontStackRendersEverywhere(f.id)).toBe(true);
    }
  });

  it('uma fonte concreta substitui quem nao a tem — e o registro diz isso', () => {
    for (const f of SELECTABLE_FONTS.filter((x) => x.origin !== 'generic')) {
      expect(f.svgFidelity).toBe('substitutes-without-font');
    }
  });

  it('a fonte embarcada e a de sistema tem o mesmo contrato, e nao por acaso', () => {
    // Sao a mesma promessa porque e a mesma Mecanica: o SVG carrega o nome. Se um dia uma
    // delas passar a embutir o arquivo, e este teste que avisa.
    expect(svgFidelityOf("'Cal Sans'")).toBe('substitutes-without-font');
    expect(svgFidelityOf('Arial')).toBe('substitutes-without-font');
    expect(svgFidelityOf('monospace')).toBe('as-designed-anywhere');
  });

  it('uma fonte desconhecida e tratada como substituta', () => {
    // O padrao conservador: nao prometer autonomia para o que nao conhecemos.
    expect(svgFidelityOf('Raleway, sans-serif')).toBe('substitutes-without-font');
  });
});

describe('as duas perguntas que costumam ser confundidas', () => {
  it('"renderiza" e "sai como desenhei" nao sao a mesma coisa', () => {
    // Esta e a distincao que a primeira versao deste arquivo apagou, e que a implementacao
    // herdou: `Inter, system-ui, sans-serif` RENDERIZA em qualquer maquina (o system-ui e o
    // fallback garantido) e NAO sai como a pessoa desenhou. Um aviso que confundisse as duas
    // diria "sai um Times", que e falso — sai o system-ui, em outra cara.
    const pilha = 'Inter, system-ui, sans-serif';
    expect(fontStackRendersEverywhere(pilha)).toBe(true);
    expect(fontStackIsFontIndependent(pilha)).toBe(false);
  });

  it('sem nenhuma generica na pilha, nem renderiza em qualquer maquina', () => {
    const pilha = "'Cal Sans', Arial";
    expect(fontStackRendersEverywhere(pilha)).toBe(false);
    expect(fontStackIsFontIndependent(pilha)).toBe(false);
  });

  it('a ordem das familias nao muda o resultado', () => {
    // A lista e um fallback: a ordem nao altera se ha uma generica, e so altera qual cara
    // aparece quando ha varias. Nenhuma das duas perguntas depende da ordem.
    for (const pilha of ['system-ui, serif', 'serif, system-ui']) {
      expect(fontStackRendersEverywhere(pilha)).toBe(true);
      expect(fontStackIsFontIndependent(pilha)).toBe(true);
    }
  });
});

describe('fontStackIsFontIndependent / fontStackRendersEverywhere', () => {
  it('a independencia decide pela primeira familia', () => {
    expect(fontStackIsFontIndependent('system-ui, sans-serif')).toBe(true);
    expect(fontStackIsFontIndependent("'Cal Sans', system-ui, sans-serif")).toBe(false);
  });

  it('renderizar em qualquer lugar basta ter uma generica em qualquer posicao', () => {
    expect(fontStackRendersEverywhere('Inter, system-ui, sans-serif')).toBe(true);
    expect(fontStackRendersEverywhere('Inter, monospace')).toBe(true);
    expect(fontStackRendersEverywhere('Inter, Arial')).toBe(false);
  });

  it('aceita as duas grafias de citacao, e caixa', () => {
    // A string e livre no schema, e as duas aparecem em `.iconcore.json` escrito a mao.
    expect(fontStackIsFontIndependent("'monospace'")).toBe(true);
    expect(fontStackIsFontIndependent('"monospace"')).toBe(true);
    expect(fontStackIsFontIndependent('  MONOSPACE  ')).toBe(true);
    expect(fontStackRendersEverywhere('"Arial", monospace')).toBe(true);
  });

  it('uma pilha vazia nao e nem independente nem renderiza', () => {
    for (const vazia of ['', '   ', ',,']) {
      expect(fontStackIsFontIndependent(vazia)).toBe(false);
      expect(fontStackRendersEverywhere(vazia)).toBe(false);
    }
  });
});

describe('a lista do seletor', () => {
  it('embarcadas antes das genericas', () => {
    // A ordem e um argumento: a fonte que veio com o app e a unica que o preview e o PNG
    // mostram identicos ao que a pessoa escolheu.
    expect(SELECTABLE_FONTS[0].origin).toBe('bundled');
    expect(SELECTABLE_FONTS[SELECTABLE_FONTS.length - 1].origin).toBe('generic');
  });

  it('toda familia generica tem um rotulo legivel', () => {
    // O valor no documento e a palavra do CSS; o que a pessoa ve e outra coisa. Um rotulo
    // igual ao valor transformaria o seletor em uma lista de identificadores.
    for (const f of GENERIC_FONTS) {
      expect(f.label).not.toBe(f.id);
    }
  });

  it('os ids sao unicos', () => {
    expect(new Set(SELECTABLE_FONTS.map((f) => f.id)).size).toBe(SELECTABLE_FONTS.length);
  });

  it('fontById acha a embarcada pelo id com aspas, e sem', () => {
    expect(fontById("'Cal Sans'")?.origin).toBe('bundled');
    expect(fontById('monospace')?.origin).toBe('generic');
    expect(fontById('inexistente')).toBeUndefined();
  });
});
