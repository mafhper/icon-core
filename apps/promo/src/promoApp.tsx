import { useEffect } from 'react';

import { EditorShowcase } from './components/icon-core/EditorShowcase';
import { Footer } from './components/icon-core/Footer';
import { Header } from './components/icon-core/Header';
import { Hero } from './components/icon-core/Hero';
import { Platforms } from './components/icon-core/Platforms';
import { StudioProvider } from './components/icon-core/studio-context';

export const PromoApp = () => {
  useEffect(() => {
    /*
     * A fragment in the URL is resolved before React mounts, so the browser finds no
     * target and gives up. Retrying once after mount is what makes `/#baixar` (and the
     * legacy `/#desktop`) land where it says; `scroll-margin-top` still clears the
     * fixed header.
     */
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  return (
    <StudioProvider>
      <div className="promo-root">
        <Header />

        <main>
          <Hero />
          <Platforms />
          {/* `#baixar` and its `#desktop` alias live in the showcase's GetItStrip, next to the editor they download. */}
          <EditorShowcase />
        </main>

        <Footer />
      </div>
    </StudioProvider>
  );
};
