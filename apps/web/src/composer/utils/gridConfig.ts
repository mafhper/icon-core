/**
 * A divisão do grid da bancada.
 *
 * ## O que o dono pediu
 *
 * "o grid poderia permitir ajustar a quantidade de linhas horizontais e verticais já as
 * separando no espaço disponível". Ou seja: **divisões**, e não pixels de espaçamento.
 *
 * ## Por que divisões, e não um `gap` em px
 *
 * Porque o grid é uma referência de composição. A pessoa não quer "linhas a cada 24px";
 * quer "divida em 8". Com divisões, a linha cai sempre numa fração útil da arte — 1/2,
 * 1/4, 1/8 — e o resultado **sobrevive a outro tamanho de canvas**, porque a mesma
 * conta de divisão dá 1/8 em 512 e em 1024. Um `gap` fixo quebra a referência quando o
 * canvas muda.
 *
 * ## E por que colunas e linhas são separadas
 *
 * Porque uma arte é retangular quase sempre: 8×8 num canvas 512 dá células de 64×64, e
 * uma composição de banner (1200×630) com 8×8 dá 150×79 — que não é nenhum dos dois
 * que a pessoa tem em mente. Axis separados resolvem isso, e é o que a palavra
 * "horizontais e verticais" do dono pede.
 */

/** Faixa aceitada. 2 é o mínimo útil (uma divisão não é um grid); 32 é o máximo em que a linha ainda se distingue. */
export const MIN_DIVISIONS = 2;
export const MAX_DIVISIONS = 32;

/** O que o grid usava: `background-size: 12.5%` = 8 divisões. */
export const DEFAULT_DIVISIONS = 8;

/**
 * Clampa e arredonda para inteiro.
 *
 * Arredondar é obrigatório: `background-size` com fração não divide o canvas em linhas
 * que caibam — a última fica mais larga que as outras, e o olho vê a falha sem saber
 * nomear.
 *
 * `null` e `''` caem no **padrão**, e não no mínimo. `Number(null)` é `0` e
 * `Number('')` é `0` em JavaScript, então um clamp ingenuo transforma "não informado" em
 * "2 divisões" — e `2` é uma escolha, não um valor neutro. A distinção é: um número
 * fora da faixa é um número que a pessoa escolheu e a gente limita; ausência é ausência.
 */
export const clampDivisions = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return DEFAULT_DIVISIONS;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_DIVISIONS;
  return Math.max(MIN_DIVISIONS, Math.min(MAX_DIVISIONS, n));
};

/**
 * `background-size` em porcentagem, por eixo.
 *
 * Retorna `"8.5% 12.5%"` — o par que o CSS aceita — e **não** duas strings, porque o
 * consumidor vai colocar direto num `style` e um array exigiria `join` no meio do JSX.
 */
export const gridBackgroundSize = (columns: unknown, rows: unknown): string => {
  const c = clampDivisions(columns);
  const r = clampDivisions(rows);
  return `${percent(100 / c)} ${percent(100 / r)}`;
};

/**
 * A porcentagem de uma divisão.
 *
 * **Seis** casas, e não três — medido, não escolhido por gosto. Com três, 24 divisões
 * davam `4.167%` e fechavam em 100,008%; 28 davam 99,988%. O desvio é de centésimos de
 * por cento e **invisível** numa linha de 1px, mas o teste que amarra a soma está aí
 * para não depender de o olho julgar.
 *
 * Seis casas fecham toda a faixa (verificado para 2..32) e continuam sendo um número que
 * o CSS aceita sem sobra. A alternativa — emitir `calc(100% / n)` — foi descartada
 * porque `background-size` não divide por `calc` de comprimento com segurança entre
 * engines, e o grid inteiro desapareceria num deles.
 */
const percent = (value: number): string => {
  const rounded = Number(value.toFixed(6));
  return `${rounded}%`;
};