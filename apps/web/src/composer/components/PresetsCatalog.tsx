import { useState } from 'react';
import { useComposer } from '../ComposerContext';
import type { IconCoreProject, Fill, ShapeDefinition } from '@iconcore/shared';

interface VisualPreset {
  id: string;
  name: string;
  description: string;
  preview: string;
  apply: (base: IconCoreProject) => IconCoreProject;
}

const solidFill = (color: string): Fill => ({ kind: 'solid', color });
const shape = (kind: ShapeDefinition['kind'], w = 512, h = 512): ShapeDefinition => ({ kind, width: w, height: h });

const presets: VisualPreset[] = [
  {
    id: 'modern-circle',
    name: 'Modern Circle',
    description: 'Clean circular icon with dual-tone gradient',
    preview: '●',
    apply: (base) => ({
      ...base,
      canvas: { ...base.canvas, size: 512, background: solidFill('#ffffff') },
      layers: [
        { id: 'bg-circle', name: 'Background', kind: 'image', visible: true, zIndex: 0, opacity: 1, source: { type: 'reference', path: '', shape: shape('circle') }, transform: { x: 0, y: 0, scale: 1, rotation: 0 }, fill: solidFill('#6366f1') },
        { id: 'inner-dot', name: 'Accent dot', kind: 'image', visible: true, zIndex: 1, opacity: 1, source: { type: 'reference', path: '', shape: shape('circle', 128, 128) }, transform: { x: 0, y: 0, scale: 1, rotation: 0 }, fill: solidFill('#a5b4fc') }
      ]
    })
  },
  {
    id: 'rounded-square',
    name: 'Rounded Square',
    description: 'Modern rounded square with layered depth',
    preview: '▢',
    apply: (base) => ({
      ...base,
      canvas: { ...base.canvas, size: 512, background: solidFill('#f8fafc') },
      layers: [
        { id: 'bg-rect', name: 'Background', kind: 'image', visible: true, zIndex: 0, opacity: 1, source: { type: 'reference', path: '', shape: shape('rounded-rectangle') }, transform: { x: 0, y: 0, scale: 1, rotation: 0 }, fill: solidFill('#0f172a') },
        { id: 'inner-sq', name: 'Inner accent', kind: 'image', visible: true, zIndex: 1, opacity: 0.9, source: { type: 'reference', path: '', shape: shape('rounded-rectangle', 256, 256) }, transform: { x: 0, y: 0, scale: 1, rotation: 0 }, fill: solidFill('#38bdf8') }
      ]
    })
  },
  {
    id: 'squircle',
    name: 'Squircle',
    description: 'Apple-style squircle with soft gradient',
    preview: '◌',
    apply: (base) => ({
      ...base,
      canvas: { ...base.canvas, size: 512, background: solidFill('#ffffff') },
      layers: [
        { id: 'bg-squircle', name: 'Background', kind: 'image', visible: true, zIndex: 0, opacity: 1, source: { type: 'reference', path: '', shape: shape('squircle') }, transform: { x: 0, y: 0, scale: 1, rotation: 0 }, fill: solidFill('#f472b6') },
        { id: 'inner', name: 'Inner shape', kind: 'image', visible: true, zIndex: 1, opacity: 1, source: { type: 'reference', path: '', shape: shape('circle', 160, 160) }, transform: { x: 0, y: 0, scale: 1, rotation: 0 }, fill: solidFill('#fce7f3') }
      ]
    })
  },
  {
    id: 'minimal-ring',
    name: 'Minimal Ring',
    description: 'Thin circular ring with center dot',
    preview: '○',
    apply: (base) => ({
      ...base,
      canvas: { ...base.canvas, size: 512, background: solidFill('#ffffff') },
      layers: [
        { id: 'ring-outer', name: 'Outer ring', kind: 'image', visible: true, zIndex: 0, opacity: 1, source: { type: 'reference', path: '', shape: shape('circle') }, transform: { x: 0, y: 0, scale: 1, rotation: 0 }, fill: solidFill('#e2e8f0') },
        { id: 'ring-inner', name: 'Ring hole', kind: 'image', visible: true, zIndex: 1, opacity: 1, source: { type: 'reference', path: '', shape: shape('circle', 300, 300) }, transform: { x: 0, y: 0, scale: 1, rotation: 0 }, fill: solidFill('#ffffff') },
        { id: 'center-dot', name: 'Center dot', kind: 'image', visible: true, zIndex: 2, opacity: 1, source: { type: 'reference', path: '', shape: shape('circle', 64, 64) }, transform: { x: 0, y: 0, scale: 1, rotation: 0 }, fill: solidFill('#64748b') }
      ]
    })
  },
  {
    id: 'gradient-burst',
    name: 'Gradient Burst',
    description: 'Multi-layered gradient composition',
    preview: '✦',
    apply: (base) => ({
      ...base,
      canvas: { ...base.canvas, size: 512, background: solidFill('#0f172a') },
      layers: [
        { id: 'burst-1', name: 'Layer 1', kind: 'image', visible: true, zIndex: 0, opacity: 0.8, source: { type: 'reference', path: '', shape: shape('circle', 400, 400) }, transform: { x: 56, y: 56, scale: 1, rotation: 0 }, fill: solidFill('#3b82f6') },
        { id: 'burst-2', name: 'Layer 2', kind: 'image', visible: true, zIndex: 1, opacity: 0.9, source: { type: 'reference', path: '', shape: shape('circle', 280, 280) }, transform: { x: 116, y: 116, scale: 1, rotation: 0 }, fill: solidFill('#8b5cf6') },
        { id: 'burst-3', name: 'Layer 3', kind: 'image', visible: true, zIndex: 2, opacity: 1, source: { type: 'reference', path: '', shape: shape('circle', 160, 160) }, transform: { x: 176, y: 176, scale: 1, rotation: 0 }, fill: solidFill('#c084fc') }
      ]
    })
  },
  {
    id: 'corner-accent',
    name: 'Corner Accent',
    description: 'Clean square with corner highlight',
    preview: '▣',
    apply: (base) => ({
      ...base,
      canvas: { ...base.canvas, size: 512, background: solidFill('#ffffff') },
      layers: [
        { id: 'base-sq', name: 'Base', kind: 'image', visible: true, zIndex: 0, opacity: 1, source: { type: 'reference', path: '', shape: shape('rounded-rectangle') }, transform: { x: 0, y: 0, scale: 1, rotation: 0 }, fill: solidFill('#1e293b') },
        { id: 'corner-dot', name: 'Corner accent', kind: 'image', visible: true, zIndex: 1, opacity: 1, source: { type: 'reference', path: '', shape: shape('circle', 80, 80) }, transform: { x: 430, y: 0, scale: 1, rotation: 0 }, fill: solidFill('#f59e0b') }
      ]
    })
  }
];

export const PresetsCatalog = ({ onClose }: { onClose: () => void }) => {
  const { state, dispatch } = useComposer();
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null);

  const handleApply = (preset: VisualPreset) => {
    if (!state.project) {
      dispatch({ type: 'NEW_PROJECT', payload: { name: 'My Icon', size: 512 } });
    }
    const base = state.project ?? {
      schemaVersion: 2,
      metadata: { name: 'My Icon', shortName: 'My Icon' },
      canvas: { size: 512, background: { kind: 'solid', color: '#ffffff' } },
      layers: [],
      variants: { default: {} },
      targets: [{ target: 'web-favicon', enabled: true }],
      exportProfile: { outputBaseName: 'my-icon', quality: 0.95, generateReport: false }
    } satisfies IconCoreProject;
    dispatch({ type: 'LOAD_PROJECT', payload: preset.apply(base) });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-4xl bg-core-surface border border-core-border rounded-2xl shadow-2xl overflow-hidden p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6">
          <h2 className="font-display text-lg uppercase tracking-[0.18em]">Presets</h2>
          <p className="text-sm text-core-muted mt-1">Start with a pre-designed composition</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleApply(preset)}
              onMouseEnter={() => setHoveredPreset(preset.id)}
              onMouseLeave={() => setHoveredPreset(null)}
              className={`relative group p-6 rounded-xl border text-left transition-all ${
                hoveredPreset === preset.id
                  ? 'border-core-accent bg-core-accent/10 shadow-lg scale-[1.02]'
                  : 'border-core-border hover:border-core-accent/50 bg-core-elevated'
              }`}
            >
              <div className="text-4xl mb-3">{preset.preview}</div>
              <h3 className="text-sm font-semibold">{preset.name}</h3>
              <p className="text-xs text-core-muted mt-1">{preset.description}</p>
            </button>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-core-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="core-btn inline-flex items-center gap-2 rounded-xl border border-core-border px-4 py-2 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
