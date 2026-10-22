import { useEffect, useState } from 'react';

import { Footer } from './components/icon-core/Footer';
import { Header } from './components/icon-core/Header';
import { Hero } from './components/icon-core/Hero';
import { Platforms } from './components/icon-core/Platforms';
import { StudioProvider } from './components/icon-core/studio-context';

const repo = 'mafhper/icon-core';

const publicLabel = (value: string): string => value.replace(/\bIconCore\b/g, 'Icon Core');

type Platform = 'Windows' | 'macOS' | 'Linux';

type ReleaseStatus = 'loading' | 'ready' | 'error';

interface DesktopLinks {
  windows: string | null;
  macos: string | null;
  linux: string | null;
  releaseUrl: string;
  versionLabel: string;
}

const workflows = [
  {
    title: 'Create in Edit Space',
    text: 'Start with a blank canvas, build layers, tune variants, and keep the project editable.',
    meta: 'Layered editing'
  },
  {
    title: 'Upload to Export Utilities',
    text: 'Drop an existing logo and generate the web, PWA, desktop, and marketing assets directly.',
    meta: 'Fast export'
  },
  {
    title: 'Upload, Adjust, Export',
    text: 'Import an asset into Edit Space, adjust positioning and variants, then send it to Export Utilities.',
    meta: 'Unified flow'
  }
];

const faqs = [
  {
    q: 'Is Icon Core free?',
    a: 'Yes. Icon Core is open-source, free to use, and built as a local-first tool for designers and developers.'
  },
  {
    q: 'Do files need to be uploaded to a server?',
    a: 'No. The browser workflow processes files locally, and the desktop app keeps the same local-first model.'
  },
  {
    q: 'Can I contribute?',
    a: 'Yes. The project is public on GitHub, and issues, ideas, and pull requests are welcome.'
  }
];

const isSignatureAsset = (assetName: string) => {
  const lower = assetName.toLowerCase();
  return lower.endsWith('.sig') || lower.endsWith('.sigstore') || lower.endsWith('.sha256') || lower.endsWith('.sha256sum') || lower.endsWith('.json');
};

const pickAssetByExtensions = (
  assets: Array<{ name: string; browser_download_url: string }>,
  extensions: string[]
) => {
  const usable = assets.filter((asset) => !isSignatureAsset(asset.name));
  for (const extension of extensions) {
    const match = usable.find((asset) => asset.name.toLowerCase().endsWith(extension));
    if (match) return match.browser_download_url;
  }
  return null;
};

const pickAssetByHints = (
  assets: Array<{ name: string; browser_download_url: string }>,
  hints: string[]
) => {
  const usable = assets.filter((asset) => !isSignatureAsset(asset.name));
  return usable.find((asset) => hints.some((hint) => asset.name.toLowerCase().includes(hint)))?.browser_download_url ?? null;
};

const PlatformButton = ({ platform, href, status }: { platform: Platform; href: string | null; status: ReleaseStatus }) => {
  if (status === 'loading') {
    return <button type="button" className="promo-download is-loading" disabled>{platform} · checking…</button>;
  }

  if (!href) {
    return <button type="button" className="promo-download is-disabled" disabled>{platform} unavailable</button>;
  }

  return <a className="promo-download" href={href} target="_blank" rel="noreferrer">{platform}</a>;
};

const WorkflowMini = ({ index }: { index: number }) => {
  if (index === 0) {
    return (
      <div className="workflow-mini">
        <div className="mini-canvas"><span /></div>
        <div className="mini-handles"><b /><b /><b /></div>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className="workflow-mini mini-export">
        <span />
        <span />
        <span />
        <strong />
      </div>
    );
  }

  return (
    <div className="workflow-mini mini-flow">
      <span>upload</span>
      <i />
      <span>adjust</span>
      <i />
      <span>export</span>
    </div>
  );
};

export const PromoApp = () => {
  const [releaseStatus, setReleaseStatus] = useState<ReleaseStatus>('loading');
  const [desktopLinks, setDesktopLinks] = useState<DesktopLinks>({
    windows: null,
    macos: null,
    linux: null,
    releaseUrl: `https://github.com/${repo}/releases/latest`,
    versionLabel: 'Latest release'
  });

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

  useEffect(() => {
    const loadRelease = async () => {
      try {
        const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
          headers: { Accept: 'application/vnd.github+json' }
        });
        if (!response.ok) throw new Error('Unable to fetch release');
        const release = (await response.json()) as {
          html_url: string;
          tag_name: string;
          name?: string;
          assets: Array<{ name: string; browser_download_url: string }>;
        };
        const assets = release.assets ?? [];
        setDesktopLinks({
          windows: pickAssetByExtensions(assets, ['.msi', '.exe']) ?? pickAssetByHints(assets, ['windows', 'win64', 'win32']),
          macos: pickAssetByExtensions(assets, ['.dmg', '.pkg', '.app.tar.gz']) ?? pickAssetByHints(assets, ['macos', 'darwin', 'mac']),
          linux: pickAssetByExtensions(assets, ['.appimage', '.deb', '.rpm', '.tar.xz', '.tar.gz']) ?? pickAssetByHints(assets, ['linux']),
          releaseUrl: release.html_url || `https://github.com/${repo}/releases/latest`,
          versionLabel: publicLabel(release.name?.trim() || release.tag_name || 'Latest release')
        });
        setReleaseStatus('ready');
      } catch {
        setDesktopLinks((previous) => ({ ...previous, windows: null, macos: null, linux: null }));
        setReleaseStatus('error');
      }
    };

    void loadRelease();
  }, []);

  return (
    <StudioProvider>
      <div className="promo-root">
        <Header />

        <main>
          <Hero />
          <Platforms />

          {/*
            Sections still wearing the v1 copy. They keep their original anchors (#workflows,
            #edit-space, #export-utilities, #desktop, #community) so links already in the wild
            keep resolving; `#baixar` aliases the desktop section, which is where the
            downloads live until the PT-BR download section replaces it.
          */}
          <div className="promo-legacy">
            <section id="workflows" className="section-block scroll-mt-24">
              <div className="section-heading">
                <h2>Choose the workspace that matches your icon flow.</h2>
                <p>Every path stays free and local-first. Start clean, export fast, or adjust before packaging.</p>
              </div>
              <div className="workflow-grid">
                {workflows.map((item, index) => (
                  <article key={item.title} className={index === 2 ? 'workflow-card is-featured' : 'workflow-card'}>
                    <WorkflowMini index={index} />
                    <span>{item.meta}</span>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section id="edit-space" className="split-section scroll-mt-24">
              <div>
                <h2>Edit Space is for precise icon adjustment.</h2>
                <p>
                  Arrange layers, tune position and scale, keep variant-specific overrides, and inspect selected layer
                  properties before exporting.
                </p>
              </div>
              <div className="feature-panel">
                <span>Draggable layers</span>
                <span>Right-click properties</span>
                <span>Variant tabs</span>
                <span>Shape, text, image, SVG</span>
              </div>
            </section>

            <section id="export-utilities" className="split-section split-section-alt scroll-mt-24">
              <div className="feature-panel export-panel">
                <span>favicon</span>
                <span>PWA manifest</span>
                <span>Tauri</span>
                <span>Electron</span>
                <span>marketing images</span>
              </div>
              <div>
                <h2>Export Utilities packages assets without hiding the details.</h2>
                <p>
                  Pick the targets and variants you need, review the resulting structure, and download a ZIP that is
                  ready for open-source apps and documentation.
                </p>
              </div>
            </section>

            <section id="baixar" className="section-block desktop-section scroll-mt-24">
              <span id="desktop" className="block scroll-mt-24" aria-hidden />
              <div className="section-heading">
                <h2>Use it online or download the desktop build.</h2>
                <p>The desktop app is also free and open-source, with native file access for local workflows.</p>
              </div>
              <p className="release-line">{releaseStatus === 'loading' ? 'Checking the latest release…' : desktopLinks.versionLabel}</p>
              <div className="download-grid">
                <PlatformButton platform="Windows" href={desktopLinks.windows} status={releaseStatus} />
                <PlatformButton platform="macOS" href={desktopLinks.macos} status={releaseStatus} />
                <PlatformButton platform="Linux" href={desktopLinks.linux} status={releaseStatus} />
              </div>
              {releaseStatus === 'error' && (
                <p className="release-error" role="status">Could not reach GitHub right now. You can still browse the downloads directly.</p>
              )}
              <a className="text-link" href={desktopLinks.releaseUrl} target="_blank" rel="noreferrer">View all release assets</a>
            </section>

            <section id="community" className="community-section scroll-mt-24">
              <div>
                <h2>Built in the open.</h2>
                <p>
                  Icon Core exists as a community-friendly utility. Use it, inspect it, file issues, suggest workflows, or
                  help improve the editor and exporters.
                </p>
              </div>
              <div className="community-actions">
                <a className="button button-primary" href={`https://github.com/${repo}`} target="_blank" rel="noreferrer">Join on GitHub</a>
                <a className="button" href={`https://github.com/${repo}/issues`} target="_blank" rel="noreferrer">Open issues</a>
              </div>
            </section>

            <section className="faq-section">
              {faqs.map((item) => (
                <article key={item.q}>
                  <h3>{item.q}</h3>
                  <p>{item.a}</p>
                </article>
              ))}
            </section>
          </div>
        </main>

        <Footer />
      </div>
    </StudioProvider>
  );
};
