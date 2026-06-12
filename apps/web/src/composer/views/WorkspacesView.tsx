import { useRef, useState } from 'react';
import { ArrowRight, Download, Github, Layers3, MonitorDown, PenTool, UploadCloud } from 'lucide-react';
import { useComposer } from '../ComposerContext';
import { fileToLayerAsset, isSupportedLayerFile } from '../utils/fileLayers';
import { createProjectFromAsset } from '../utils/projectFactory';

type UploadMode = 'edit' | 'export';

export const WorkspacesView = () => {
  const { dispatch, navigate } = useComposer();
  const [projectName, setProjectName] = useState('My Icon');
  const [isImporting, setIsImporting] = useState(false);
  const uploadMode = useRef<UploadMode>('edit');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <main className="ic-app-home">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp"
        onChange={(event) => void handleUpload(event.target.files?.[0])}
      />

      <section className="ic-workspace-hero">
        <div className="ic-workspace-copy">
          <p className="ic-product-mark">Icon Core</p>
          <h1>Choose your workspace and finish the icon pack in one flow.</h1>
          <p>
            Start from a blank Edit Space, export directly from an existing file, or upload an asset and refine it before
            generating every selected target.
          </p>
          <div className="ic-workspace-actions">
            <button type="button" className="ic-button ic-button-primary" onClick={createProject}>
              <PenTool size={17} />
              Create in Edit Space
            </button>
            <button type="button" className="ic-button" onClick={() => requestUpload('export')} disabled={isImporting}>
              <UploadCloud size={17} />
              Upload to Export Utilities
            </button>
          </div>
        </div>

        <div className="ic-workspace-device" aria-hidden="true">
          <div className="ic-device-top">
            <span />
            <span />
            <span />
          </div>
          <div className="ic-device-body">
            <div className="ic-device-rail">
              <span className="is-active" />
              <span />
              <span />
            </div>
            <div className="ic-device-canvas">
              <div className="ic-device-icon">
                <span />
              </div>
            </div>
            <div className="ic-device-panel">
              <span />
              <span />
              <span />
              <strong />
            </div>
          </div>
        </div>
      </section>

      <section className="ic-workspace-grid" aria-label="Icon Core workspaces">
        <article className="ic-workspace-card">
          <div className="ic-card-icon"><PenTool size={18} /></div>
          <h2>Create in Edit Space</h2>
          <p>Build a layered icon from shapes, text, images, variant overrides, and precise transforms.</p>
          <label>
            Project name
            <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
          </label>
          <button type="button" className="ic-link-button" onClick={createProject}>
            Open Edit Space <ArrowRight size={15} />
          </button>
        </article>

        <article className="ic-workspace-card">
          <div className="ic-card-icon"><Download size={18} /></div>
          <h2>Upload to Export Utilities</h2>
          <p>Skip editing and generate favicons, PWA, desktop, and marketing assets from the selected source file.</p>
          <button type="button" className="ic-link-button" onClick={() => requestUpload('export')} disabled={isImporting}>
            Select file <ArrowRight size={15} />
          </button>
        </article>

        <article className="ic-workspace-card ic-workspace-card-featured">
          <div className="ic-card-icon"><Layers3 size={18} /></div>
          <h2>Upload, Adjust, Export</h2>
          <p>Open the file in Edit Space, tune variants and positioning, then move to Export Utilities.</p>
          <button type="button" className="ic-link-button" onClick={() => requestUpload('edit')} disabled={isImporting}>
            Upload into Edit Space <ArrowRight size={15} />
          </button>
        </article>
      </section>

      <footer className="ic-app-home-footer">
        <a href="https://github.com/mafhper/icon-core/releases/latest" target="_blank" rel="noreferrer">
          <MonitorDown size={15} />
          Download Desktop
        </a>
        <a href="https://github.com/mafhper/icon-core" target="_blank" rel="noreferrer">
          <Github size={15} />
          Join the development community
        </a>
      </footer>
    </main>
  );
};
