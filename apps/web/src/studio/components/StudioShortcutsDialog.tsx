import { Kbd } from '@iconcore/ui';
import { StudioDialog } from './StudioDialog';

interface ShortcutGroup {
  title: string;
  rows: Array<{ keys: string[]; action: string }>;
}

/**
 * Studio keyboard shortcuts (Fase 2): the real list, in Portuguese.
 *
 * Every row names a binding the app actually installs — the Composer's
 * `useKeyboardShortcuts` plus the studio tool keys (`V`/`H`) and `?`, owned
 * by the shell. The menu shortcut labels point here, and this dialog is the
 * proof they do not lie: `Ctrl+O` (Abrir) and `Ctrl+Shift+S` (Salvar como)
 * were added with their bindings, and `Ctrl+N` is absent because nothing is
 * bound to it.
 */
const GROUPS: ShortcutGroup[] = [
  {
    title: 'Ferramentas',
    rows: [
      { keys: ['V'], action: 'Selecionar ferramenta' },
      { keys: ['H'], action: 'Ferramenta mão (pan)' }
    ]
  },
  {
    title: 'Camadas',
    rows: [
      { keys: ['Delete', 'Backspace'], action: 'Excluir camada selecionada' },
      { keys: ['Ctrl', 'D'], action: 'Duplicar camada selecionada' },
      { keys: ['↑', '↓', '←', '→'], action: 'Mover camada (Shift: ×10)' }
    ]
  },
  {
    title: 'Histórico',
    rows: [
      { keys: ['Ctrl', 'Z'], action: 'Desfazer' },
      { keys: ['Ctrl', 'Shift', 'Z'], action: 'Refazer' }
    ]
  },
  {
    title: 'Exibir',
    rows: [
      { keys: ['Ctrl', '+'], action: 'Aproximar' },
      { keys: ['Ctrl', '−'], action: 'Afastar' },
      { keys: ['Ctrl', '0'], action: 'Redefinir zoom' },
      { keys: ['G'], action: 'Alternar grade' },
      { keys: ['1', '2', '3'], action: 'Variantes padrão / claro / escuro' }
    ]
  },
  {
    title: 'Documento',
    rows: [
      { keys: ['Ctrl', 'O'], action: 'Abrir projeto' },
      { keys: ['Ctrl', 'S'], action: 'Salvar' },
      { keys: ['Ctrl', 'Shift', 'S'], action: 'Salvar como' },
      { keys: ['Ctrl', 'E'], action: 'Abrir exportação' },
      { keys: ['Ctrl', 'L'], action: 'Adicionar camada de círculo' },
      { keys: ['Esc'], action: 'Desmarcar camada / fechar diálogo' },
      { keys: ['?'], action: 'Abrir esta lista' }
    ]
  }
];

export const StudioShortcutsDialog = ({ onClose }: { onClose: () => void }) => {
  return (
    <StudioDialog title="Atalhos de teclado" onClose={onClose}>
      {GROUPS.map((group) => (
        <section key={group.title} aria-label={group.title}>
          <h3 className="text-xs font-semibold text-ic-text-muted mt-3 mb-1">{group.title}</h3>
          <div className="studio-shortcut-list">
            {group.rows.map((row) => (
              <div className="studio-shortcut-row" key={row.action}>
                <span>{row.action}</span>
                <span className="inline-flex gap-1">
                  {row.keys.map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </StudioDialog>
  );
};
