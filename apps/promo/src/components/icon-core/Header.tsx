import { useEffect, useState } from 'react';

import { useDetectedOS } from '../../hooks/use-os';
import { cn } from '../../lib/cn';
import { siteConfig } from '../../lib/site-config';
import { DownloadButton, WebAppButton } from './DownloadButton';
import { BrandMark } from './IconArt';

/**
 * Only anchors that exist on this page. `#interface` joins the list with the section that
 * ports the editor (a nav link to nowhere is a broken promise, not a placeholder).
 */
const NAV = [
  { href: '#plataformas', label: 'Plataformas' },
  { href: '#baixar', label: 'Baixar' },
];

export function Header() {
  const os = useDetectedOS();
  const mobile = os === 'ios' || os === 'android';
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled ? 'border-b border-glass-border bg-glass py-2 backdrop-blur-xl' : 'py-4'
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2.5" aria-label="Icon-Core, início">
          <BrandMark className="size-7" />
          <span className="text-[15px] font-semibold tracking-tight whitespace-nowrap">{siteConfig.name}</span>
          <span className="hidden rounded-md border px-1.5 py-px font-mono text-[10px] tracking-wider text-muted-foreground min-[400px]:inline">
            {siteConfig.stage}
          </span>
        </a>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Seções">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {mobile ? (
            <WebAppButton size="sm" variant="default" />
          ) : (
            <span className="hidden sm:block">
              <WebAppButton size="sm" variant="outline" className="bg-background/60 backdrop-blur" />
            </span>
          )}
          <DownloadButton size="sm" mobileFallback={false} />
        </div>
      </div>
    </header>
  );
}
