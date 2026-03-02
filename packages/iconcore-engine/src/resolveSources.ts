import type { SourceMatrix, ResolvedSources } from './types';

export const resolveSources = <T>(sources: SourceMatrix<T>): ResolvedSources<T> => {
  const mode = sources.light && sources.dark ? 'themed' : 'default';

  if (mode === 'themed') {
    const lightLogo = sources.light as T;
    const darkLogo = sources.dark as T;

    return {
      mode,
      logos: {
        default: sources.master,
        light: lightLogo,
        dark: darkLogo
      },
      favicons: {
        default: sources.favicon ?? sources.master,
        light: sources.faviconLight ?? sources.favicon ?? lightLogo,
        dark: sources.faviconDark ?? sources.favicon ?? darkLogo
      },
      social: {
        logo: sources.master,
        background: sources.socialBackground
      }
    };
  }

  return {
    mode,
    logos: {
      default: sources.master
    },
    favicons: {
      default: sources.favicon ?? sources.faviconLight ?? sources.faviconDark ?? sources.master
    },
    social: {
      logo: sources.master,
      background: sources.socialBackground
    }
  };
};
