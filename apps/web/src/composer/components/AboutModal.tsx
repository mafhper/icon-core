import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Info, X } from 'lucide-react';
import { withIconStroke } from '@iconcore/ui';
import { AnimatedIconCoreLogo } from '../../app/AnimatedIconCoreLogo';
import { useFocusTrap } from '../hooks/useFocusTrap';

const THIRD_PARTY = [
  {
    name: 'Rune Icons',
    license: 'Apache-2.0',
    source: 'https://github.com/Nexvyn/runeicons',
    note: 'Initial stock for the built-in icon library.'
  },
  {
    name: 'Lucide',
    license: 'ISC',
    source: 'https://lucide.dev',
    note: 'App chrome icons.'
  }
] as const;

/**
 * About / third-party licenses dialog. Lists the components redistributed by
 * Icon Core and points to the full third-party license index. The guard
 * `scripts/check-third-party-assets.mjs` (CI) keeps this list in sync with
 * `third-party/manifest.json` and `THIRD_PARTY_LICENSES.md`.
 */
export const AboutModal = ({ onClose }: { onClose: () => void }) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useFocusTrap(dialogRef, true);

  // Portalled to <body>: the topbar `<header>` carries `backdrop-filter`, which
  // becomes the containing block for `position: fixed` descendants — rendering
  // here kept the overlay trapped inside the 50px header and pushed the dialog
  // off-screen. The portal restores viewport-fixed positioning.
  return createPortal(
    <div className="ic-modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="ic-welcome-modal ic-about-modal"
        role="dialog"
        aria-modal="true"
        aria-label="About Icon Core"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="ic-modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <header className="ic-welcome-head">
          <div className="ic-welcome-brand">
            <AnimatedIconCoreLogo className="ic-welcome-logo" animated={false} />
            <span className="ic-product-mark">Icon Core</span>
          </div>
          <h1>About Icon Core</h1>
          <p>A free, offline icon design tool. Draw, refine and export icons for web, PWA, desktop apps and marketing assets.</p>
        </header>

        <section className="ic-about-section">
          <h2>
            {withIconStroke(<Info size={15} aria-hidden="true" />, 'semibold')}
            Third-party licenses
          </h2>
          <p>Icon Core redistributes the following components. Full texts and terms live in <code>THIRD_PARTY_LICENSES.md</code>.</p>
          <ul className="ic-about-list">
            {THIRD_PARTY.map((component) => (
              <li key={component.name}>
                <strong>{component.name}</strong>
                <span className="ic-about-license">{component.license}</span>
                <span className="ic-about-note">{component.note}</span>
                <a href={component.source} target="_blank" rel="noreferrer">
                  {component.source.replace('https://', '')} {withIconStroke(<ExternalLink size={12} aria-hidden="true" />)}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <footer className="ic-welcome-foot">
          <a href="https://github.com/mafhper/icon-core/blob/main/THIRD_PARTY_LICENSES.md" target="_blank" rel="noreferrer">
            {withIconStroke(<ExternalLink size={15} />, 'semibold')}
            THIRD_PARTY_LICENSES.md
          </a>
          <a href="https://github.com/mafhper/icon-core" target="_blank" rel="noreferrer">
            {withIconStroke(<ExternalLink size={15} />, 'semibold')}
            GitHub repository
          </a>
        </footer>
      </div>
    </div>,
    document.body
  );
};