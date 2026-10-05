import { describe, expect, it } from 'vitest';
import {
  ALL_KEYLINE_PARTS,
  KEYLINE_PART_LABELS,
  KEYLINE_STANDARDS,
  availableParts,
  type KeylinePart,
  type KeylineStandard
} from './keylineConfig';

/**
 * Testes da configuração da keyline.
 *
 * O teste que importa é o da **safe area indisponível**: um switch que liga uma guia
 * sem dado no documento é um switch que ajusta a arte a uma margem que a plataforma não
 * tem. E a falha é silenciosa — a guia aparece, a pessoa confia nela, e o recorte real é
 * outro.
 */
describe('availableParts', () => {
  it('sem safe area no documento, a parte some do painel', () => {
    const parts = availableParts(false);
    expect(parts).not.toContain('safe-area');
    expect(parts).toEqual(['frame', 'grid', 'circle', 'squircle']);
  });

  it('com safe area, a parte aparece', () => {
    expect(availableParts(true)).toContain('safe-area');
  });

  it('a ordem e estavel: as partes nao reordenam entre renders', () => {
    // Um painel cujas opcoes reordenam a cada render torna o clique errar sozinho.
    expect(availableParts(true)).toEqual(ALL_KEYLINE_PARTS);
    expect(availableParts(true)).toEqual(availableParts(true));
  });

  it('toda parte tem rotulo — nenhum switch sem nome', () => {
    for (const part of ALL_KEYLINE_PARTS) {
      expect(KEYLINE_PART_LABELS[part].length).toBeGreaterThan(0);
    }
  });
});

describe('KEYLINE_STANDARDS', () => {
  it('toda plataforma tem rotulo e sugere partes', () => {
    for (const [key, info] of Object.entries(KEYLINE_STANDARDS)) {
      expect(info.label.length).toBeGreaterThan(0);
      expect(info.suggestedParts.length).toBeGreaterThan(0);
      expect(Array.isArray(info.suggestedParts)).toBe(true);
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it('as partes sugeridas existem de verdade', () => {
    // Uma plataforma que sugere `safe-padding` — que nao existe — ligaria nada, e o
    // painel mostraria um estado sem nenhuma parte acesa.
    for (const info of Object.values(KEYLINE_STANDARDS)) {
      for (const part of info.suggestedParts) {
        expect(ALL_KEYLINE_PARTS).toContain(part);
      }
    }
  });

  it('nenhum rotulo de plataforma e duplicado', () => {
    const labels = Object.values(KEYLINE_STANDARDS).map((i) => i.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('iOS recomenda a superellipse e a safe area — as duas que so importam no iOS', () => {
    const ios = KEYLINE_STANDARDS.ios.suggestedParts;
    expect(ios).toContain('squircle');
    expect(ios).toContain('safe-area');
  });

  it('o generico nao sekou a nenhuma plataforma', () => {
    // Um padrao "generic" que recomenda a mesma coisa do Android nao distingue nada, e
    // a pessoa perde a unica pista de que o padrao nao e o de ningem.
    const generic = KEYLINE_STANDARDS.generic.suggestedParts;
    const android = KEYLINE_STANDARDS.android.suggestedParts;
    expect(new Set(generic).size).toBe(generic.length);
    expect([...generic].sort().join()).not.toBe([...android].sort().join());
  });

  it('circle so recomenda o circulo — é a unica parte que faz sentido', () => {
    expect(KEYLINE_STANDARDS.circle.suggestedParts).toEqual(['circle']);
  });

  it('trocar de plataforma sugere partes que existem no painel do documento', () => {
    // Um documento **sem** safe area + trocar para iOS: a parte recomendada nao esta
    // disponivel, e o painel ficaria com um estado coerente mas sem a guia que a
    // plataforma exige. O consumidor tem de filtrar — este teste so garante que o
    // filtro e possivel.
    const semSafe = new Set<KeylinePart>(availableParts(false));
    for (const part of KEYLINE_STANDARDS.ios.suggestedParts) {
      const disponivel = semSafe.has(part);
      expect(disponivel || part === 'safe-area').toBe(true);
    }
  });
});

describe('tipos', () => {
  it('o tipo tem que ser um valor conhecido — um desconhecido quebraria o switch', () => {
    const validos: KeylineStandard[] = ['generic', 'ios', 'android', 'circle', 'square'];
    for (const v of validos) {
      expect(KEYLINE_STANDARDS[v]).toBeDefined();
    }
    expect(KEYLINE_STANDARDS['nope' as KeylineStandard]).toBeUndefined();
  });
});