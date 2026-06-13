import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { IconLayer } from '@iconcore/shared';
import { useComposer } from '../ComposerContext';
import { useToast } from '../toast/ToastContext';
import { detectBorderColor, removeBackground, dataUrlToBase64 } from '../utils/chromaKey';

export const BackgroundRemovalModal = ({ layer, onClose }: { layer: IconLayer; onClose: () => void }) => {
  const { dispatch } = useComposer();
  const toast = useToast();

  const src = layer.source.type === 'inline' && layer.source.data && layer.source.mimeType
    ? `data:${layer.source.mimeType};base64,${layer.source.data}`
    : '';

  const [color, setColor] = useState('#000000');
  const [tolerance, setTolerance] = useState(12);
  const [preview, setPreview] = useState(src);
  const resultRef = useRef(src);

  useEffect(() => {
    let cancelled = false;
    if (src) detectBorderColor(src).then((c) => { if (!cancelled) setColor(c); }).catch(() => {});
    return () => { cancelled = true; };
  }, [src]);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const out = await removeBackground(src, color, tolerance);
        if (!cancelled) {
          resultRef.current = out;
          setPreview(out);
        }
      } catch {
        // keep previous preview
      }
    }, 120);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [src, color, tolerance]);

  const apply = () => {
    dispatch({
      type: 'UPDATE_LAYER',
      payload: { id: layer.id, changes: { source: { ...layer.source, type: 'inline', mimeType: 'image/png', data: dataUrlToBase64(resultRef.current) } } }
    });
    toast.success('Background removed');
    onClose();
  };

  return (
    <div className="ic-modal-overlay" onClick={onClose}>
      <div className="ic-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Remove background">
        <div className="ic-modal-head">
          <h2>Remove background</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="ic-bg-remove-preview">
          <img src={preview} alt="Background removal preview" />
        </div>

        <div className="ic-field-grid">
          <label className="ic-field">
            <span>Background color</span>
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
          </label>
          <label className="ic-field">
            <span>Tolerance ({tolerance}%)</span>
            <input type="range" min="0" max="60" value={tolerance} onChange={(event) => setTolerance(Number(event.target.value))} />
          </label>
        </div>

        <p className="ic-modal-hint">Pick the background color (auto-detected from the edges) and adjust tolerance until it reads clean.</p>

        <div className="ic-modal-actions">
          <button type="button" className="ic-button" onClick={onClose}>Cancel</button>
          <button type="button" className="core-btn core-btn-primary" onClick={apply}>Apply</button>
        </div>
      </div>
    </div>
  );
};
