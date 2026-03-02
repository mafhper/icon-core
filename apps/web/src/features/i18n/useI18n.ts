import { detectLocale, type Locale } from '@iconcore/shared';
import { translate, type TranslationKey } from './translations';

export const getInitialLocale = (language = navigator.language): Locale => {
  return detectLocale(language);
};

export const makeTranslator = (locale: Locale) => {
  return (key: TranslationKey) => translate(locale, key);
};
