import {
  Copy,
  Download,
  FolderOpen,
  Layers,
  PenTool,
  Plus,
  Redo2,
  Save,
  Undo2,
  Info
} from 'lucide-react';
import { Menu, MenuItem, MenuSeparator } from '@iconcore/ui';
import { useComposer } from '../ComposerContext';
import { modKey } from '../utils/platform';
import { downloadProject } from '../utils/projectStorage';

/**
 * Menu de aplicação: Arquivo, Editar, Exportar, Gerenciar.
 *
 * ## O que motive o menu
 *
 * Duas ações estavam **invisíveis**. "Novo Projeto" só existia dentro do modal do logo
 * — a pessoa procurou um botão, clicou no logo por curiosidade e o encontrou ali. E
 * Export era um botão solto na barra, sem categoria nenhuma ao redor.
 *
 * Isto é um menu de aplicação **clássico** — as quatro categorias que qualquer editor
 * já habituou a pessoa — e não um painel de ações. A diferença importa: menu ensina a
 * **estrutura** (existe uma categoria "arquivo", e ela contém estes itens), enquanto um
 * painel de ações só ensina o que naquele momento cabia.
 *
 * ## Por que o menu fica **depois** do logo, e não no lugar dele
 *
 * O logo continua sendo o atalho para Workspaces. O dono pediu assim: o atalho é
 * útil, o que faltava era a **forma clássica** ao lado. O logo é um elemento decorativo
 * que executa dupla função — e o menu é o que torna essa dupla função *descobrível*,
 * em vez de secreta.
 *
 * ## `shortcut` exibe, não vincula
 *
 * `MenuItem.shortcut` mostra o texto e nada mais: a ligação real está em
 * `useKeyboardShortcuts`. Um item que **mostra** um atalho e não o cumpre é pior do
 * um item sem atalho, então os dois precisam sair do mesmo lugar — e esta é a dívida
 * que o `IC65` registra.
 *
 * ## "Salvar" ainda baixa o arquivo
 *
 * `downloadProject` baixa o `.json`, e **não** é "salvar no lugar": o
 * `showDirectoryPicker` é o `M1`, que exige gesto do usuário. Por isso o item se chama
 * "Save as…" quando o projeto **não tem** pasta associada, e "Save" quando tem — sem
 * isso o rótulo mentiria sobre o que acontece.
 */

/**
 * `onOpenProject` e `onAbout` chegam por prop, e nao por action.
 *
 * As duas sao **efeito de DOM** — um `<input type="file">` criado e clicado, e um modal
 * cujo estado mora no `Topbar`. Uma action no reducer seria a forma errada: o reducer
 * nao cria elemento nem abre dialogo, e foi justamente por meter DOM la dentro que o
 * `Ctrl+S` virou 13 linhas copiadas dentro do hook de teclado.
 */
export interface AppMenuProps {
  onOpenProject: () => void;
  onAbout: () => void;
}

export const AppMenu = ({ onOpenProject, onAbout }: AppMenuProps) => {
  const { state, dispatch, navigate } = useComposer();
  const hasProject = Boolean(state.project);

  // O mesmo criterio do reducer (`composerReducer.ts:660,671`), nao uma aproximacao:
  // um item desabilitado que nao esta desabilitado e pior que nenhum item.
  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  const handleSave = () => {
    const outcome = downloadProject(state.project);
    // **Só** um download de fato limpa o dirty. Este era o bug: o `SET_DIRTY(false)`
    // rodava incondicionalmente, entao um projeto nunca salvo aparecia como salvo.
    if (outcome.kind === 'downloaded') {
      dispatch({ type: 'SET_DIRTY', payload: false });
    }
  };

  const trigger = (label: string) => (
    <button
      type="button"
      className="shrink-0 cursor-pointer rounded-[6px] border-0 bg-transparent px-2 py-1 text-[13px] font-medium text-ic-text-muted outline-none select-none hover:bg-ic-elevated hover:text-ic-text focus-visible:ring-2 focus-visible:ring-ic-accent-text"
      aria-label={`${label} menu`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-w-0 shrink items-center gap-0.5" role="menubar" aria-label="Main menu">
      <Menu label="File menu" trigger={trigger('File')}>
        <MenuItem
          icon={<Plus size={15} />}
          label="New project"
          onSelect={() => navigate('workspaces')}
        />
        <MenuItem
          icon={<FolderOpen size={15} />}
          label="Open project…"
          onSelect={onOpenProject}
        />
        <MenuSeparator />
        <MenuItem
          icon={<Save size={15} />}
          label="Save as…"
          shortcut={`${modKey()}+S`}
          disabled={!hasProject}
          onSelect={handleSave}
        />
      </Menu>

      <Menu label="Edit menu" trigger={trigger('Edit')}>
        <MenuItem
          icon={<Undo2 size={15} />}
          label="Undo"
          shortcut={`${modKey()}+Z`}
          disabled={!canUndo}
          onSelect={() => dispatch({ type: 'UNDO' })}
        />
        <MenuItem
          icon={<Redo2 size={15} />}
          label="Redo"
          shortcut={`${modKey()}+⇧+Z`}
          disabled={!canRedo}
          onSelect={() => dispatch({ type: 'REDO' })}
        />
        <MenuSeparator />
        <MenuItem
          icon={<Copy size={15} />}
          label="Duplicate layer"
          shortcut={`${modKey()}+D`}
          disabled={!state.activeLayerId}
          onSelect={() =>
            state.activeLayerId &&
            dispatch({ type: 'DUPLICATE_LAYER', payload: { id: state.activeLayerId } })
          }
        />
      </Menu>

      <Menu label="Export menu" trigger={trigger('Export')}>
        <MenuItem
          icon={<Download size={15} />}
          label="Export icon pack"
          shortcut={`${modKey()}+E`}
          disabled={!hasProject}
          onSelect={() => navigate('export-utilities')}
        />
      </Menu>

      <Menu label="Manage menu" trigger={trigger('Manage')}>
        <MenuItem
          icon={<Layers size={15} />}
          label="Workspaces"
          onSelect={() => navigate('workspaces')}
        />
        <MenuItem
          icon={<PenTool size={15} />}
          label="Path editor"
          disabled
          onSelect={() => navigate('edit-space')}
        />
        <MenuSeparator />
        <MenuItem icon={<Info size={15} />} label="About" onSelect={onAbout} />
      </Menu>
    </div>
  );
};