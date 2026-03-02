import { useEffect, useMemo, useState } from 'react';

type GlyphName =
  | 'layers'
  | 'spark'
  | 'contrast'
  | 'shield'
  | 'browser'
  | 'palette'
  | 'package'
  | 'megaphone'
  | 'download'
  | 'play'
  | 'export';

const capabilityCards: Array<{ title: string; text: string; icon: GlyphName }> = [
  {
    title: 'One logo, complete package',
    text: 'Generate favicon, PWA icons, social images, and manifest from one source.',
    icon: 'layers'
  },
  {
    title: 'Clear light and dark variants',
    text: 'Use default mode or provide explicit light/dark files when needed.',
    icon: 'contrast'
  },
  {
    title: 'Designer + developer workflow',
    text: 'Visual confidence for design, deterministic files for engineering.',
    icon: 'spark'
  },
  {
    title: 'Local-first processing',
    text: 'Assets are generated locally, with no mandatory upload step.',
    icon: 'shield'
  }
];

const configurationCards: Array<{ title: string; text: string; icon: GlyphName }> = [
  {
    title: 'Output modes',
    text: 'Switch between automatic, default-only, or forced themed output.',
    icon: 'browser'
  },
  {
    title: 'Format visibility',
    text: 'Toggle logo SVG, favicon SVG, and ICO based on your delivery needs.',
    icon: 'palette'
  },
  {
    title: 'Structure control',
    text: 'Choose standard folder structure or flat output for simpler integrations.',
    icon: 'package'
  },
  {
    title: 'Named exports',
    text: 'Define the ZIP name and keep generated packages organized by project.',
    icon: 'megaphone'
  }
];

const desktopPoints = [
  'Generate assets locally with native file dialogs',
  'Export directly to your filesystem without browser limitations',
  'Use the same deterministic engine from the web application',
  'Install per platform from the latest GitHub release'
];

const installSteps: Array<{ id: string; title: string; text: string; commands: string[] }> = [
  {
    id: 'clone',
    title: '1. Clone the repository',
    text: 'Get the source locally before installing dependencies.',
    commands: ['git clone https://github.com/mafhper/icon-core.git', 'cd icon-core']
  },
  {
    id: 'install',
    title: '2. Install dependencies',
    text: 'Install all workspace packages using Bun.',
    commands: ['bun install']
  },
  {
    id: 'run',
    title: '3. Run the project',
    text: 'Start web or desktop mode depending on your flow.',
    commands: ['bun run dev:web', 'bun run --filter @iconcore/desktop tauri:dev']
  }
];

const usageSteps: Array<{ title: string; text: string; icon: GlyphName }> = [
  {
    title: '1. Upload your master logo',
    text: 'Optionally add light, dark, and favicon-specific files.',
    icon: 'layers'
  },
  {
    title: '2. Configure project metadata',
    text: 'Set app name, short name, description, and default manifest theme.',
    icon: 'play'
  },
  {
    title: '3. Generate and export',
    text: 'Download a ZIP in web mode or export directly to local folder in desktop mode.',
    icon: 'export'
  }
];

const repo = 'mafhper/icon-core';

interface DesktopLinks {
  windows: string | null;
  macos: string | null;
  linux: string | null;
  releaseUrl: string;
  versionLabel: string;
}

const Glyph = ({ name }: { name: GlyphName }) => {
  switch (name) {
    case 'layers':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.8 20 8l-8 4.2L4 8 12 3.8Z" />
          <path d="m4 12 8 4.2L20 12" />
          <path d="m4 16 8 4.2L20 16" />
        </svg>
      );
    case 'spark':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8Z" />
          <path d="m18 15 .8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8Z" />
        </svg>
      );
    case 'contrast':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4a8 8 0 0 1 0 16Z" />
        </svg>
      );
    case 'shield':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.5 19 6v6.2c0 3.8-2.3 6.8-7 8.3-4.7-1.5-7-4.5-7-8.3V6l7-2.5Z" />
          <path d="m9.2 12.4 2 2 3.6-4" />
        </svg>
      );
    case 'browser':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
          <path d="M3.5 8.2h17" />
          <circle cx="6.3" cy="6.4" r=".7" />
          <circle cx="8.8" cy="6.4" r=".7" />
          <circle cx="11.3" cy="6.4" r=".7" />
        </svg>
      );
    case 'palette':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4a8 8 0 1 0 0 16h2.5a2.5 2.5 0 0 0 0-5H13" />
          <circle cx="8.2" cy="9" r="1" />
          <circle cx="6.8" cy="12.2" r="1" />
          <circle cx="9.2" cy="14.8" r="1" />
          <circle cx="12.4" cy="9.2" r="1" />
        </svg>
      );
    case 'package':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 3.8 8 4.3-8 4.3-8-4.3 8-4.3Z" />
          <path d="M4 8.1V16l8 4.2 8-4.2V8.1" />
          <path d="M12 12.4v7.8" />
        </svg>
      );
    case 'megaphone':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3.5 12.5h4l8-4v8l-8-4h-4Z" />
          <path d="M7.5 12.5v4.8a1.7 1.7 0 0 0 1.7 1.7h1" />
          <path d="M17 9.2c1.6.5 2.5 1.7 2.5 3.3s-.9 2.8-2.5 3.3" />
        </svg>
      );
    case 'download':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4.5v10.3" />
          <path d="m8.4 11.8 3.6 3.6 3.6-3.6" />
          <path d="M4.5 19.5h15" />
        </svg>
      );
    case 'play':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="m10.2 9 5 3-5 3Z" />
        </svg>
      );
    case 'export':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4.5v10.3" />
          <path d="m8.4 11.8 3.6 3.6 3.6-3.6" />
          <rect x="4.5" y="16.5" width="15" height="3" rx="1.2" />
        </svg>
      );
    default:
      return null;
  }
};

const HeroLogo = () => (
  <svg className="hero-logo-svg" viewBox="0 0 168 168" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="g0" x1="149.289" y1="30.3809" x2="52.757" y2="86.1136" gradientUnits="userSpaceOnUse">
        <stop stopColor="#d9d9d9" />
        <stop offset="1" stopColor="#777777" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="g1" x1="71.9139" y1="0.000585915" x2="71.9139" y2="111.466" gradientUnits="userSpaceOnUse">
        <stop stopColor="#d9d9d9" />
        <stop offset="1" stopColor="#777777" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="g2" x1="19.1568" y1="136.514" x2="115.689" y2="80.7817" gradientUnits="userSpaceOnUse">
        <stop stopColor="#d9d9d9" />
        <stop offset="1" stopColor="#777777" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="g3" x1="160.879" y1="116.036" x2="65.1761" y2="58.8911" gradientUnits="userSpaceOnUse">
        <stop stopColor="#d9d9d9" />
        <stop offset="1" stopColor="#777777" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="g4" x1="97.1139" y1="167.465" x2="97.1139" y2="56" gradientUnits="userSpaceOnUse">
        <stop stopColor="#d9d9d9" />
        <stop offset="1" stopColor="#777777" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="g5" x1="5.15698" y1="52.7812" x2="101.689" y2="108.514" gradientUnits="userSpaceOnUse">
        <stop stopColor="#d9d9d9" />
        <stop offset="1" stopColor="#777777" stopOpacity="0" />
      </linearGradient>

      <linearGradient id="stripeGradient" x1="62" y1="36" x2="110" y2="128" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff">
          <animate attributeName="stop-color" dur="7s" repeatCount="indefinite" values="#ffffff;#4dd2ff;#ff7ae6;#ffd84d;#ffffff" />
        </stop>
        <stop offset="50%" stopColor="#ffffff">
          <animate attributeName="stop-color" dur="7s" repeatCount="indefinite" values="#ffffff;#8ef2ff;#ffb0f2;#fff6a3;#ffffff" />
        </stop>
        <stop offset="100%" stopColor="#f5f5f5">
          <animate attributeName="stop-color" dur="7s" repeatCount="indefinite" values="#f5f5f5;#9ec8ff;#ff95d3;#ffe17a;#f5f5f5" />
        </stop>
      </linearGradient>
    </defs>

    <path d="M143.215 30.2294C143.648 30.5306 143.916 30.9995 143.986 31.5223L149.406 71.9308C149.526 72.8197 148.505 73.4314 147.781 72.9017C141.548 68.3394 121.398 54.4554 102.154 50.6388C81.7675 46.5955 30.9815 57.3154 34.952 54.6242C38.9226 51.933 80.4908 20.6101 104.229 19.5306C125.145 18.5794 139.983 27.9803 143.215 30.2294Z" fill="url(#g0)" />
    <path d="M71.602 5.84382C72.0516 5.67727 72.5327 5.70313 72.9745 5.88952L107.994 20.6656C108.816 21.0125 108.829 22.1944 108.012 22.5544C100.975 25.6561 78.8348 36.1725 65.8905 50.9495C52.1957 66.5831 36.0863 115.925 35.7409 111.141C35.3955 106.357 29.0532 54.696 39.9876 33.5981C49.7584 14.7455 67.8598 7.22996 71.602 5.84382Z" fill="url(#g1)" />
    <path d="M25.2302 136.666C24.7973 136.365 24.5297 135.896 24.4595 135.373L19.0394 94.9644C18.9202 94.0756 19.9409 93.4639 20.6646 93.9936C26.8981 98.5558 47.0478 112.44 66.2916 116.256C86.6782 120.3 137.464 109.58 133.494 112.271C129.523 114.962 87.9549 146.285 64.2163 147.365C43.3004 148.316 28.463 138.915 25.2302 136.666Z" fill="url(#g2)" />
    <path d="M155.246 115.597C155.148 116.096 154.85 116.515 154.426 116.796L124.576 136.599C123.852 137.08 122.882 136.477 122.99 135.614C123.922 128.154 126.313 103.556 120.223 84.7444C113.821 64.9713 79.7153 25.8439 84 28.0001C88.2847 30.1563 135.891 51.1956 148.4 71.4C159.615 89.5153 156.094 111.288 155.246 115.597Z" fill="url(#g3)" />
    <path d="M97.4258 161.622C96.9762 161.789 96.4951 161.763 96.0533 161.577L61.0343 146.8C60.212 146.454 60.1988 145.272 61.0155 144.912C68.0526 141.81 90.193 131.294 103.137 116.517C116.832 100.883 132.941 51.541 133.287 56.3252C133.632 61.1094 139.975 112.77 129.04 133.868C119.269 152.721 101.168 160.236 97.4258 161.622Z" fill="url(#g4)" />
    <path d="M10.7961 53.2166C10.887 52.7178 11.1773 52.2958 11.5952 52.0086L41.1512 31.6932C41.8686 31.2001 42.8492 31.7877 42.754 32.6531C41.931 40.1325 39.9034 64.7559 46.2683 83.4718C52.96 103.149 87.6367 141.771 83.3208 139.678C79.0049 137.585 31.0943 117.247 18.2902 97.2287C6.80967 79.2796 10.0114 57.523 10.7961 53.2166Z" fill="url(#g5)" />
    <path d="M61.6 66.3999C61.6 49.8314 75.0315 36.3999 91.6 36.3999H106.424C108.081 36.3999 109.424 37.743 109.424 39.3999V98.3691C109.424 114.938 95.9925 128.369 79.424 128.369H64.6C62.9432 128.369 61.6 127.026 61.6 125.369V66.3999Z" fill="url(#stripeGradient)" />
  </svg>
);

const isSignatureAsset = (assetName: string) => {
  const lower = assetName.toLowerCase();
  return (
    lower.endsWith('.sig') ||
    lower.endsWith('.sigstore') ||
    lower.endsWith('.sha256') ||
    lower.endsWith('.sha256sum') ||
    lower.endsWith('.json')
  );
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
  const best = usable.find((asset) => {
    const lower = asset.name.toLowerCase();
    return hints.some((hint) => lower.includes(hint));
  });
  return best?.browser_download_url ?? null;
};

export const PromoApp = () => {
  const [latestCommit, setLatestCommit] = useState('Checking latest update...');
  const [commitLink, setCommitLink] = useState(`https://github.com/${repo}/commits`);
  const [openInstallCard, setOpenInstallCard] = useState<string | null>(null);
  const [copiedStep, setCopiedStep] = useState<string | null>(null);
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

        const shortSha = first.sha.slice(0, 7);
        const title = first.commit.message.split('\n')[0].trim();
        const date = new Date(first.commit.author.date);
        const dateLabel = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date);

        setLatestCommit(`${title} (${shortSha}) - ${dateLabel}`);
        setCommitLink(first.html_url || `https://github.com/${repo}/commits`);
      } catch {
        setLatestCommit('Visit GitHub to see the latest updates.');
      }
    };

    void loadLatestCommit();
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
        const windows =
          pickAssetByExtensions(assets, ['.msi', '.exe']) ??
          pickAssetByHints(assets, ['windows', 'win64', 'win32']);

        const macos =
          pickAssetByExtensions(assets, ['.dmg', '.pkg', '.app.tar.gz']) ??
          pickAssetByHints(assets, ['macos', 'darwin', 'mac']);

        const linux =
          pickAssetByExtensions(assets, ['.appimage', '.deb', '.rpm', '.tar.xz', '.tar.gz']) ??
          pickAssetByHints(assets, ['linux']);

        setDesktopLinks({
          windows,
          macos,
          linux,
          releaseUrl: release.html_url || `https://github.com/${repo}/releases/latest`,
          versionLabel: release.name?.trim() || release.tag_name || 'Latest release'
        });
      } catch {
        setDesktopLinks((previous) => ({
          ...previous,
          windows: null,
          macos: null,
          linux: null
        }));
      }
    };

    void loadRelease();
  }, []);

  const isInstallOpen = useMemo(() => (id: string) => openInstallCard === id, [openInstallCard]);

  const handleCopyCommands = async (id: string, commands: string[]) => {
    try {
      await navigator.clipboard.writeText(commands.join('\n'));
      setCopiedStep(id);
      window.setTimeout(() => setCopiedStep((current) => (current === id ? null : current)), 1500);
    } catch {
      setCopiedStep(null);
    }
  };

  const renderDesktopDownloadButton = (label: string, href: string | null) => {
    if (!href) {
      return (
        <button type="button" className="btn btn-disabled" disabled>
          {label} unavailable
        </button>
      );
    }

    return (
      <a href={href} target="_blank" rel="noreferrer" className="btn btn-primary">
        {label}
      </a>
    );
  };

  return (
    <div className="promo-root">
      <main className="promo-shell">
        <section className="frame hero">
          <div className="hero-copy">
            <p className="eyebrow mono">Open source / free / local-first</p>
            <h1>Create clean icon packs with less manual work.</h1>
            <p>
              IconCore helps designers and developers build consistent assets from a single logo for web and desktop projects.
            </p>
            <div className="hero-actions">
              <a href="/icon-core/app/" className="btn btn-primary hero-cta" data-tip="Use instantly in your browser. No install required.">
                Try Web App
              </a>
              <a href="#desktop" className="btn hero-cta" data-tip="Download the latest desktop release for your OS.">
                Try Desktop App
              </a>
            </div>
          </div>

          <div className="hero-preview">
            <div className="logo-stage">
              <HeroLogo />
            </div>
          </div>
        </section>

        <section className="frame section">
          <div className="section-head">
            <div>
              <p className="eyebrow mono">Core capabilities</p>
              <h2>Simple flow, professional outputs</h2>
            </div>
          </div>

          <div className="grid grid-2">
            {capabilityCards.map((card) => (
              <article key={card.title} className="feature-card">
                <div className="icon-box">
                  <Glyph name={card.icon} />
                </div>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="frame section">
          <div className="section-head">
            <div>
              <p className="eyebrow mono">Workflow</p>
              <h2>How to Use</h2>
            </div>
          </div>

          <div className="grid grid-3">
            {usageSteps.map((step) => (
              <article key={step.title} className="feature-card">
                <div className="icon-box">
                  <Glyph name={step.icon} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="frame section">
          <div className="section-head">
            <div>
              <p className="eyebrow mono">Configuration</p>
              <h2>Customize IconCore for your workflow</h2>
            </div>
          </div>

          <div className="grid grid-2">
            {configurationCards.map((card) => (
              <article key={card.title} className="feature-card">
                <div className="icon-box">
                  <Glyph name={card.icon} />
                </div>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="frame section">
          <div className="section-head">
            <div>
              <p className="eyebrow mono">Community</p>
              <h2>Open source and free</h2>
            </div>
            <p>
              Created by <a href="https://github.com/mafhper">mafhper</a>. Contributions and ideas are always welcome.
            </p>
          </div>

          <div className="hero-actions">
            <a href="https://github.com/mafhper/icon-core" target="_blank" rel="noreferrer" className="btn btn-primary">
              View repository
            </a>
            <a href="https://github.com/mafhper?tab=repositories" target="_blank" rel="noreferrer" className="btn">
              More projects
            </a>
          </div>
        </section>

        <section id="install" className="frame section">
          <div className="section-head">
            <div>
              <p className="eyebrow mono">Setup</p>
              <h2>Source Build</h2>
            </div>
            <p>Web mode does not require installation. Use these commands if you want to build desktop from source.</p>
          </div>

          <div className="grid grid-3">
            {installSteps.map((step) => (
              <article key={step.id} className="step-card">
                <div className="step-header">
                  <div className="icon-box icon-box-small">
                    <Glyph name="download" />
                  </div>
                  <button
                    type="button"
                    className="command-toggle mono"
                    onClick={() => setOpenInstallCard(openInstallCard === step.id ? null : step.id)}
                  >
                    {isInstallOpen(step.id) ? 'Hide commands' : 'View commands'}
                  </button>

                  <div className={`command-overlay ${isInstallOpen(step.id) ? 'is-open' : ''}`}>
                    <div className="command-overlay-head">
                      <span className="mono">Command</span>
                      <div className="command-actions">
                        <button
                          type="button"
                          className="mono command-copy"
                          onClick={() => void handleCopyCommands(step.id, step.commands)}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <rect x="9" y="9" width="10" height="10" rx="2" />
                            <path d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" />
                          </svg>
                          {copiedStep === step.id ? 'Copied' : 'Copy'}
                        </button>
                        <button type="button" className="mono" onClick={() => setOpenInstallCard(null)}>
                          Close
                        </button>
                      </div>
                    </div>
                    <pre>
                      <code>{step.commands.join('\n')}</code>
                    </pre>
                  </div>
                </div>

                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="desktop" className="frame section">
          <div className="section-head">
            <div>
              <p className="eyebrow mono">Desktop app</p>
              <h2>IconCore Desktop</h2>
            </div>
            <p>Download the latest compiled release for your operating system.</p>
          </div>

          <ul className="bullet-list">
            {desktopPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>

          <p className="desktop-version mono">{desktopLinks.versionLabel}</p>

          <div className="grid grid-3 desktop-download-grid">
            {renderDesktopDownloadButton('Windows', desktopLinks.windows)}
            {renderDesktopDownloadButton('macOS', desktopLinks.macos)}
            {renderDesktopDownloadButton('Linux', desktopLinks.linux)}
          </div>

          <p className="desktop-release-link">
            <a href={desktopLinks.releaseUrl} target="_blank" rel="noreferrer">
              View all release assets
            </a>
          </p>
        </section>
      </main>

      <footer className="promo-footer frame">
        <div className="commit-line" aria-live="polite">
          <span className="commit-dot" aria-hidden="true" />
          <span className="mono">Latest commit</span>
          <span className="commit-value">{latestCommit}</span>
          <a href={commitLink} target="_blank" rel="noreferrer">
            View
          </a>
        </div>
        <p>
          IconCore by <a href="https://github.com/mafhper">mafhper</a> • Open source on{' '}
          <a href="https://github.com/mafhper/icon-core">GitHub</a>
        </p>
      </footer>
    </div>
  );
};
