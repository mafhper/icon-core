import { Info, Search } from 'lucide-react';
import { ButtonGroup, IconButton, ToolbarDivider, Tooltip } from '@iconcore/ui';
import { useState } from 'react';
import { useComposer } from '../ComposerContext';
import { openCommandPalette } from '../utils/commandPalette';
import { modKey } from '../utils/platform';
import { AnimatedIconCoreLogo } from '../../app/AnimatedIconCoreLogo';
import { AboutModal } from './AboutModal';
import { AppMenu } from './AppMenu';

/**
 * Faixa superior: logo, menu de aplicação, paleta de comandos, About.
 *
 * ## O título **saiu** daqui
 *
 * O nome do projeto vivia ao lado do logo, e o dono pediu para movê-lo: ele cresce, e
 * um nome comprido empurrava o menu para a direita — deslocando tudo a cada digitação.
 * Agora ele está no painel esquerdo, acima de Layers, onde tem largura inteira e não
 * disputa espaço com nada.
 *
 * O logo continua sendo o atalho para Workspaces. Só o **título** saiu.
 *
 * ## "Save" e "Export" também saíram
 *
 * Os dois foram para o menu de aplicação (`AppMenu`), e as duas cópias do download
 * — uma aqui, outra em `useKeyboardShortcuts` — foram para `downloadProject`. Um item
 * de menu com atalho no rótulo é descobrível; um ícone solto na barra não é.
 *
 * O que fica aqui é o que **não** é ação de arquivo: a paleta de comandos e o About.
 */

export const Topbar = () => {
  const { navigate, saveProject, saveProjectAs, openProjectFile, fileHandle } = useComposer();
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 flex-none border-b border-ic-border bg-ic-bg/88 backdrop-blur-[18px]">
      <div className="flex min-w-0 items-center justify-between gap-3 px-4 py-2.5">
        <div className="inline-flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            className="flex shrink-0 cursor-pointer items-center rounded-[9px] border-0 bg-transparent px-1.5 py-1 text-inherit hover:bg-ic-elevated"
            onClick={() => navigate('workspaces')}
            title="Home — start or open a project"
            aria-label="Go to workspaces"
          >
            <AnimatedIconCoreLogo className="block h-[22px] w-[22px]" animated={false} />
          </button>

          <AppMenu
            onOpenProject={() => void openProjectFile()}
            onAbout={() => setIsAboutOpen(true)}
            onSave={saveProject}
            onSaveAs={saveProjectAs}
            canSaveInPlace={fileHandle != null}
          />
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2">
          {/* Discoverability for the keyboard-first palette: the only visible
              entry point (Ctrl/Cmd+K still works). */}
          <ButtonGroup label="Commands">
            <Tooltip content={`Command palette (${modKey()}+K)`}>
              <IconButton
                icon={<Search size={15} />}
                aria-label="Open command palette"
                onClick={openCommandPalette}
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
        </div>
      </div>
      {isAboutOpen && <AboutModal onClose={() => setIsAboutOpen(false)} />}
    </header>
  );
};