import { useRef } from 'react';
import { ChevronDown, Circle, ImagePlus, Plus, Slash, Square, Type } from 'lucide-react';
import { IconButton, Menu, MenuItem, Tooltip } from '@iconcore/ui';
import { useComposer } from '../../composer/ComposerContext';
import { useLayerImport } from '../../composer/hooks/useLayerImport';

interface StudioInsertMenuProps {
  /** `primary` renders the evident topbar button; `icon` the panel-header `+`. */
  variant?: 'primary' | 'icon';
}

/**
 * Studio Insert menu (Fase 2): the primary, evident creation entry point.
 *
 * One menu drives both triggers (topbar button, Layers header `+`), so the
 * two can never disagree about what can be created. Every item dispatches a
 * real `ADD_LAYER` — shape kinds the engine draws, `asset` through the shared
 * image-import pipeline, `background` through the handle the reducer pins
 * last. Group creation is absent on purpose: layers carry no parent link in
 * the engine, so a Group item would promise what no dispatch can build
 * (BACKLOG, pós-ground-0).
 */
export const StudioInsertMenu = ({ variant = 'primary' }: StudioInsertMenuProps) => {
  const { state, dispatch } = useComposer();
  const importFiles = useLayerImport();
  const fileRef = useRef<HTMLInputElement>(null);

  const disabled = !state.project;

  const addShape = (shape: 'rounded-rectangle' | 'circle' | 'line') => {
    if (shape === 'circle') {
      dispatch({ type: 'ADD_LAYER', payload: { kind: 'shape', shape: { kind: 'circle', width: 220, height: 220 } } });
    } else if (shape === 'line') {
      dispatch({ type: 'ADD_LAYER', payload: { kind: 'shape', shape: { kind: 'line', width: 280, height: 40 } } });
    } else {
      dispatch({
        type: 'ADD_LAYER',
        payload: { kind: 'shape', shape: { kind: 'rounded-rectangle', width: 220, height: 220, cornerRadius: 48 } }
      });
    }
  };

  const onPickImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await importFiles(event.target.files);
    event.target.value = '';
  };

  const items = (
    <>
      <MenuItem icon={<Square size={15} />} label="Rounded rectangle" onSelect={() => addShape('rounded-rectangle')} />
      <MenuItem icon={<Circle size={15} />} label="Ellipse" onSelect={() => addShape('circle')} />
      <MenuItem icon={<Slash size={15} />} label="Line" onSelect={() => addShape('line')} />
      <MenuItem icon={<Type size={15} />} label="Text" onSelect={() => dispatch({ type: 'ADD_LAYER', payload: { kind: 'text' } })} />
      <MenuItem icon={<ImagePlus size={15} />} label="Image…" onSelect={() => fileRef.current?.click()} />
      <MenuItem
        icon={<Square size={15} fill="currentColor" strokeWidth={1} />}
        label="Background"
        onSelect={() => dispatch({ type: 'ADD_LAYER', payload: { kind: 'background' } })}
      />
    </>
  );

  return (
    <>
      <Menu
        label="Insert layer"
        trigger={
          variant === 'primary' ? (
            <button type="button" className="studio-insert-button" disabled={disabled} aria-label="Insert layer">
              <Plus size={15} aria-hidden="true" />
              <span>Insert</span>
              <ChevronDown size={12} aria-hidden="true" />
            </button>
          ) : (
            <span className="inline-flex">
              <Tooltip content="Insert layer">
                <IconButton icon={<Plus size={16} />} aria-label="Insert layer" disabled={disabled} />
              </Tooltip>
            </span>
          )
        }
      >
        {items}
      </Menu>
      {/* Rendered only with a project open: without one the welcome owns the
          single file input, and extra global `input[type="file"]` nodes break
          the upload specs' strict locator (and confuse the person). */}
      {state.project && (
        <input
          ref={fileRef}
          type="file"
          accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp"
          className="hidden"
          multiple
          aria-hidden="true"
          tabIndex={-1}
          onChange={onPickImage}
        />
      )}
    </>
  );
};
