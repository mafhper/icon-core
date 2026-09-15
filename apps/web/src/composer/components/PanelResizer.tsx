import type React from 'react';

interface PanelResizerProps {
  side: 'left' | 'right';
  label: string;
  onStart: (event: React.PointerEvent<HTMLDivElement>) => void;
}

/**
 * Invisible pointer-capture strip on the inner edge of a resizable panel.
 * Pointer semantics (min/max clamping + localStorage persistence) live in
 * `usePanelLayout#startResize`; this component owns the DOM/A11y contract.
 */
export const PanelResizer = ({ side, label, onStart }: PanelResizerProps) => {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      className={`ic-panel-resizer is-${side}`}
      onPointerDown={onStart}
    />
  );
};