import { describe, expect, it } from 'vitest';
import { getInitialLocale, makeTranslator } from './useI18n';

describe('i18n locale resolution', () => {
  it('falls back to en-US when locale is unknown', () => {
    expect(getInitialLocale('fr-FR')).toBe('en-US');
  });

  it('supports en-US locale mapping', () => {
    expect(getInitialLocale('en-GB')).toBe('en-US');
  });

  it('exposes mandatory translation keys', () => {
    const t = makeTranslator('es-ES');
    expect(t('appTitle')).toBe('Icon Core');
    expect(t('generate')).toBe('Generar paquete');
  });
});
