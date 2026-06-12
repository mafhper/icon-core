import { useEffect, useState } from 'react';

const repo = 'mafhper/icon-core';

const publicLabel = (value: string): string => value.replace(/\bIconCore\b/g, 'Icon Core');

type Platform = 'Windows' | 'macOS' | 'Linux';

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

const PlatformButton = ({ platform, href }: { platform: Platform; href: string | null }) => {
  if (!href) {
    return <button type="button" className="promo-download is-disabled" disabled>{platform} unavailable</button>;
  }

  return <a className="promo-download" href={href} target="_blank" rel="noreferrer">{platform}</a>;
};

const ProductPreview = () => (
  <div className="product-preview" aria-hidden="true">
    <div className="preview-titlebar">
      <span />
      <span />
      <span />
      <strong>Icon Core</strong>
    </div>
    <div className="preview-layout">
      <div className="preview-rail">
        <span className="is-active" />
        <span />
        <span />
      </div>
      <div className="preview-canvas">
        <div className="preview-grid" />
        <div className="preview-icon">
          <i />
        </div>
        <div className="preview-selection">
          <b />
          <b />
        </div>
      </div>
      <div className="preview-panel">
        <p>Edit Space</p>
        <strong>Layer Properties</strong>
        <span />
        <span />
        <span />
        <em>Variant overrides</em>
      </div>
    </div>
    <div className="preview-export">
      <span>Export Utilities</span>
      <i>favicon</i>
      <i>PWA</i>
      <i>desktop</i>
    </div>
  </div>
);

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
  const [latestCommit, setLatestCommit] = useState('Checking latest update...');
  const [commitLink, setCommitLink] = useState(`https://github.com/${repo}/commits`);
  const [desktopLinks, setDesktopLinks] = useState<DesktopLinks>({
    windows: null,
    macos: null,
    linux: null,
    releaseUrl: `https://github.com/${repo}/releases/latest`,
    versionLabel: 'Latest release'
  });

  useEffect(() => {
    const loadLatestCommit = async () => {
      try {
        const response = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`, {
          headers: { Accept: 'application/vnd.github+json' }
        });
        if (!response.ok) throw new Error('Unable to fetch commit');
        const commits = (await response.json()) as Array<{
          sha: string;
          html_url: string;
          commit: { message: string; author: { date: string } };
        }>;
        const first = commits[0];
        if (!first) throw new Error('No commits found');
        const dateLabel = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(first.commit.author.date));
        setLatestCommit(publicLabel(`${first.commit.message.split('\n')[0].trim()} (${first.sha.slice(0, 7)}) - ${dateLabel}`));
        setCommitLink(first.html_url || `https://github.com/${repo}/commits`);
      } catch {
        setLatestCommit('Visit GitHub to see the latest updates.');
      }
    };

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
      } catch {
        setDesktopLinks((previous) => ({ ...previous, windows: null, macos: null, linux: null }));
      }
    };

    void loadLatestCommit();
    void loadRelease();
  }, []);

  return (
    <div className="promo-root">
      <header className="promo-nav">
        <a href="#top" className="promo-brand">Icon Core</a>
        <nav aria-label="Primary navigation">
          <a href="#workflows">Workflows</a>
          <a href="#edit-space">Edit Space</a>
          <a href="#export-utilities">Export Utilities</a>
          <a href="#desktop">Desktop</a>
          <a href="#community">Community</a>
        </nav>
        <a className="nav-cta" href="/icon-core/app/#/workspaces">Try Online</a>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-copy">
            <h1>Create, refine, and export every icon your app needs.</h1>
            <p>
              Icon Core is a free, open-source, local-first workspace for turning source artwork into complete web,
              desktop, and marketing icon packages.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="/icon-core/app/#/workspaces">Try Online</a>
              <a className="button" href="#desktop">Download Desktop</a>
              <a className="text-link" href={`https://github.com/${repo}`} target="_blank" rel="noreferrer">Join on GitHub</a>
            </div>
          </div>
          <ProductPreview />
        </section>

        <section id="workflows" className="section-block">
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

        <section id="edit-space" className="split-section">
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

        <section id="export-utilities" className="split-section split-section-alt">
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
              Pick the targets and variants you need, review the resulting structure, and download a ZIP that is ready
              for open-source apps and documentation.
            </p>
          </div>
        </section>

        <section id="desktop" className="section-block desktop-section">
          <div className="section-heading">
            <h2>Use it online or download the desktop build.</h2>
            <p>The desktop app is also free and open-source, with native file access for local workflows.</p>
          </div>
          <p className="release-line">{desktopLinks.versionLabel}</p>
          <div className="download-grid">
            <PlatformButton platform="Windows" href={desktopLinks.windows} />
            <PlatformButton platform="macOS" href={desktopLinks.macos} />
            <PlatformButton platform="Linux" href={desktopLinks.linux} />
          </div>
          <a className="text-link" href={desktopLinks.releaseUrl} target="_blank" rel="noreferrer">View all release assets</a>
        </section>

        <section id="community" className="community-section">
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
      </main>

      <footer className="promo-footer">
        <div>
          <strong>Icon Core</strong>
          <p>Free, open-source icon workspaces for web and desktop apps.</p>
        </div>
        <nav aria-label="Footer product links">
          <a href="/icon-core/app/#/workspaces">Workspaces</a>
          <a href="/icon-core/app/#/edit-space">Edit Space</a>
          <a href="/icon-core/app/#/export-utilities">Export Utilities</a>
        </nav>
        <nav aria-label="Footer community links">
          <a href={`https://github.com/${repo}`} target="_blank" rel="noreferrer">GitHub</a>
          <a href={commitLink} target="_blank" rel="noreferrer">{latestCommit}</a>
        </nav>
      </footer>
    </div>
  );
};
