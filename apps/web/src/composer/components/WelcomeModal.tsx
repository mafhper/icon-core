import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Layers2, MonitorDown, PenTool, CloudUpload, X } from 'lucide-react';
import { useComposer } from '../ComposerContext';
import { fileToLayerAsset, isSupportedLayerFile } from '../utils/fileLayers';
import { createProjectFromAsset } from '../utils/projectFactory';
import { AnimatedIconCoreLogo } from '../../app/AnimatedIconCoreLogo';

type UploadMode = 'edit' | 'export';

/**
 * The app's entry point, presented as a modal over the editor window (rather
 * than a full marketing-style page). Shown automatically when there is no
 * project, and on demand (dismissible) when returning Home with a project open.
 */
export const WelcomeModal = ({ dismissible }: { dismissible: boolean }) => {
  const { dispatch, navigate } = useComposer();
  const [projectName, setProjectName] = useState('My Icon');
  const [isImporting, setIsImporting] = useState(false);
  const uploadMode = useRef<UploadMode>('edit');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    if (dismissible) navigate('edit-space');
  };

  useEffect(() => {
    if (!dismissible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') navigate('edit-space');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismissible, navigate]);

  const createProject = () => {
    dispatch({ type: 'NEW_PROJECT', payload: { name: projectName.trim() || 'My Icon', size: 512, view: 'edit-space' } });
    navigate('edit-space');
  };

  const requestUpload = (mode: UploadMode) => {
    uploadMode.current = mode;
    fileInputRef.current?.click();
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file || !isSupportedLayerFile(file)) return;
    setIsImporting(true);
    try {
      const asset = await fileToLayerAsset(file);
      const project = createProjectFromAsset(asset);
      const view = uploadMode.current === 'export' ? 'export-utilities' : 'edit-space';
      dispatch({ type: 'LOAD_PROJECT', payload: { project, view } });
      navigate(view);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="ic-modal-overlay" onClick={close}>
      <div className="ic-welcome-modal" role="dialog" aria-modal="true" aria-label="Start a new icon" onClick={(event) => event.stopPropagation()}>
        {dismissible && (
          <button type="button" className="ic-modal-close" onClick={close} aria-label="Close">
            <X size={18} />
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp"
          onChange={(event) => void handleUpload(event.target.files?.[0])}
        />

        <header className="ic-welcome-head">
          <div className="ic-welcome-brand">
            <AnimatedIconCoreLogo className="ic-welcome-logo" animated={false} />
            <span className="ic-product-mark">Icon Core</span>
          </div>
          <h1>Start a new icon</h1>
          <p>Create from scratch, or bring artwork in and refine it before exporting every target.</p>
        </header>

        <div className="ic-welcome-grid">
          <article className="ic-welcome-card is-primary">
            <div className="ic-card-icon"><PenTool size={18} /></div>
            <h2>Create in Edit Space</h2>
            <p>Build a layered icon from shapes, text, images, variants and precise transforms.</p>
            <label>
              Project name
              <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
            </label>
            <button type="button" className="ic-button ic-button-primary" onClick={createProject}>
              <PenTool size={16} />
              Create
            </button>
          </article>

          <article className="ic-welcome-card">
            <div className="ic-card-icon"><CloudUpload size={18} /></div>
            <h2>Upload → Export</h2>
            <p>Skip editing and generate favicon, PWA and desktop assets straight from a file.</p>
            <button type="button" className="ic-link-button" onClick={() => requestUpload('export')} disabled={isImporting}>
              Select file <ArrowRight size={15} />
            </button>
          </article>

          <article className="ic-welcome-card">
            <div className="ic-card-icon"><Layers2 size={18} /></div>
            <h2>Upload → Edit → Export</h2>
            <p>Open the file in Edit Space, tune variants and positioning, then export.</p>
            <button type="button" className="ic-link-button" onClick={() => requestUpload('edit')} disabled={isImporting}>
              Upload into Edit Space <ArrowRight size={15} />
            </button>
          </article>
        </div>

        <footer className="ic-welcome-foot">
          <a href="https://github.com/mafhper/icon-core/releases/latest" target="_blank" rel="noreferrer">
            <MonitorDown size={15} />
            Download Desktop
          </a>
          <a href="https://github.com/mafhper/icon-core" target="_blank" rel="noreferrer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
            Join the development community
          </a>
        </footer>
      </div>
    </div>
  );
};
