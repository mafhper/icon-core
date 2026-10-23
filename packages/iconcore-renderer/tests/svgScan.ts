/**
 * Leitura de markup SVG **sem regex de backtracking**.
 *
 * Os specs comparavam o SVG gerado com `svg.match(/<feDropShadow[^>]*>/g)` e parentes. Num
 * documento grande essas regexes são polinomiais — a classe `[^>]*` reencontra o próprio
 * prefixo literal — e o CodeQL marcou as sete ocorrências (`js/polynomial-redos`, high).
 * Quebrar na `<` e cortar no `>` responde o mesmo em tempo linear e, de quebra, entrega os
 * atributos já separados (o que os specs precisavam e faziam com uma segunda regex).
 */

/** Um elemento de abertura do documento, sem aninhamento nem decodificação de entidades. */
export interface SvgTag {
  /** Nome do elemento como escrito no markup (`feDropShadow`). */
  readonly name: string;
  /** Atributos; `attrs.x` é `undefined` quando o atributo não existe. */
  readonly attrs: Readonly<Record<string, string | undefined>>;
}

const espaco = (c: string | undefined): boolean =>
  c === ' ' || c === '\t' || c === '\n' || c === '\r';

/** Atributos `nome="valor"` de um trecho de tag, por varredura de `="`. */
const attrsOf = (corpo: string): Record<string, string> => {
  const attrs: Record<string, string> = {};
  let cursor = 0;
  for (;;) {
    const igual = corpo.indexOf('="', cursor);
    if (igual < 0) return attrs;
    const inicioValor = igual + 2;
    const fimValor = corpo.indexOf('"', inicioValor);
    if (fimValor < 0) return attrs;
    let inicioNome = igual;
    while (inicioNome > 0 && !espaco(corpo[inicioNome - 1])) inicioNome -= 1;
    attrs[corpo.slice(inicioNome, igual)] = corpo.slice(inicioValor, fimValor);
    cursor = fimValor + 1;
  }
};

/**
 * Elementos de abertura do documento, em ordem. `name` filtra por tag.
 *
 * Declaração (`<?xml`), comentário (`<!--`) e tag de fechamento (`</x`) ficam de fora: não
 * são elementos.
 */
export const tagsOf = (svg: string, name?: string): SvgTag[] => {
  const tags: SvgTag[] = [];
  for (const pedaco of svg.split('<')) {
    const fecha = pedaco.indexOf('>');
    if (fecha < 0) continue;
    const corpo = pedaco.slice(0, fecha);
    const primeiro = corpo[0];
    if (primeiro === undefined || primeiro === '/' || primeiro === '?' || primeiro === '!') {
      continue;
    }
    let fimNome = 0;
    while (fimNome < corpo.length && !espaco(corpo[fimNome]) && corpo[fimNome] !== '/') {
      fimNome += 1;
    }
    const nome = corpo.slice(0, fimNome);
    if (nome === '' || (name !== undefined && nome !== name)) continue;
    tags.push({ name: nome, attrs: attrsOf(corpo) });
  }
  return tags;
};

/** Conteúdo entre `<name ...>` e `</name>`; `''` quando não há o par. */
export const contentOf = (svg: string, name: string): string => {
  const abre = svg.indexOf(`<${name}`);
  if (abre < 0) return '';
  const inicio = svg.indexOf('>', abre);
  if (inicio < 0) return '';
  const fecha = svg.indexOf(`</${name}>`, inicio + 1);
  if (fecha < 0) return '';
  return svg.slice(inicio + 1, fecha);
};

/** Todos os `id="..."` do documento, em ordem. */
export const idsOf = (svg: string): string[] =>
  tagsOf(svg).flatMap((tag) => (tag.attrs.id === undefined ? [] : [tag.attrs.id]));

/** Alvos de `url(#...)`, em ordem — inclusive os que não existem (é o que o spec procura). */
export const urlRefsOf = (svg: string): string[] => {
  const marca = 'url(#';
  const refs: string[] = [];
  for (let i = svg.indexOf(marca); i >= 0; i = svg.indexOf(marca, i + marca.length)) {
    const inicio = i + marca.length;
    const fim = svg.indexOf(')', inicio);
    if (fim < 0) break;
    const id = svg.slice(inicio, fim).trim();
    if (id !== '') refs.push(id);
  }
  return refs;
};
