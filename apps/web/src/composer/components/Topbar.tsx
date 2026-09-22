import { Download, FolderOpen, Info, Save } from 'lucide-react';
import { useState } from 'react';
import { Button, ButtonGroup, IconButton, ToolbarDivider, Tooltip } from '@iconcore/ui';
import { useComposer } from '../ComposerContext';
import { useToast } from '../toast/ToastContext';
import { parseProjectFile } from '../utils/projectGuard';
import { AnimatedIconCoreLogo } from '../../app/AnimatedIconCoreLogo';
import { AboutModal } from './AboutModal';

export const Topbar = () => {
  const { state, dispatch, navigate } = useComposer();
  const toast = useToast();
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const projectName = state.project?.metadata.name ?? 'Icon Core';

  const handleSave = () => {
    if (!state.project) return;
    const json = JSON.stringify(state.project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.project.metadata.name.toLowerCase().replace(/\s+/g, '-')}.iconcore.json`;
    a.click();
    URL.revokeObjectURL(url);
    dispatch({ type: 'SET_DIRTY', payload: false });
    toast.success('Project saved');
  };

  const handleOpen = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.iconcore.json,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const project = parseProjectFile(await file.text());
      if (!project) {
        toast.error(`"${file.name}" is not a valid Icon Core project file.`);
        return;
      }
      dispatch({ type: 'LOAD_PROJECT', payload: project });
      toast.success(`Opened ${project.metadata.name}`);
    };
    input.click();
  };

  return (
    <header className="sticky top-0 z-20 flex-none border-b border-ic-border bg-ic-bg/88 backdrop-blur-[18px]">
      <div className="flex min-w-0 items-center justify-between gap-3 px-4 py-2.5">
        <div className="inline-flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-[9px] border-0 bg-transparent px-1.5 py-1 text-left text-inherit hover:bg-ic-elevated"
            onClick={() => navigate('workspaces')}
            title="Home — start or open a project"
            aria-label={state.isDirty ? `${projectName}, unsaved changes` : projectName}
          >
            <AnimatedIconCoreLogo className="block h-[22px] w-[22px] shrink-0" animated={false} />
            <span className="truncate text-[0.9rem] font-semibold tracking-tight text-ic-text">
              {projectName}
            </span>
            {/* Decorative: the dirty state rides in the button's accessible name
                (a label on a bare span is ignored by assistive tech). */}
            {state.isDirty && (
              <span aria-hidden="true" title="Unsaved changes" className="h-[7px] w-[7px] shrink-0 rounded-full bg-ic-gold" />
            )}
          </button>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2">
          <ButtonGroup label="Project file">
            <Tooltip content="Open project…">
              <IconButton icon={<FolderOpen size={15} />} aria-label="Open project" onClick={handleOpen} />
            </Tooltip>
            <Tooltip content="Save project">
              <IconButton
                icon={<Save size={15} />}
                aria-label="Save project"
                onClick={handleSave}
                disabled={!state.project}
                title="Save project"
              />
            </Tooltip>
          </ButtonGroup>

          <ToolbarDivider />

          <Tooltip content="About — version and third-party licenses">
            <IconButton
              icon={<Info size={15} />}
              aria-label="About Icon Core"
              onClick={() => setIsAboutOpen(true)}
            />
          </Tooltip>

          <ToolbarDivider />

          <Tooltip content="Export icon pack">
            <Button
              variant="secondary"
              iconLeft={<Download size={15} />}
              onClick={() => navigate('export-utilities')}
              disabled={!state.project}
              aria-label="Export icon pack"
            >
              Export
            </Button>
          </Tooltip>
        </div>
      </div>
      {isAboutOpen && <AboutModal onClose={() => setIsAboutOpen(false)} />}
    </header>
  );
};
