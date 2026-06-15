import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Github, Layers3, MonitorDown, PenTool, UploadCloud, X } from 'lucide-react';
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
            <div className="ic-card-icon"><UploadCloud size={18} /></div>
            <h2>Upload → Export</h2>
            <p>Skip editing and generate favicon, PWA and desktop assets straight from a file.</p>
            <button type="button" className="ic-link-button" onClick={() => requestUpload('export')} disabled={isImporting}>
              Select file <ArrowRight size={15} />
            </button>
          </article>

          <article className="ic-welcome-card">
            <div className="ic-card-icon"><Layers3 size={18} /></div>
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
            <Github size={15} />
            Join the development community
          </a>
        </footer>
      </div>
    </div>
  );
};
