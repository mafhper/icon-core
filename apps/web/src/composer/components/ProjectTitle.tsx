import { useEffect, useRef, useState } from 'react';
import { useComposer } from '../ComposerContext';

/**
 * Título do projeto, no painel esquerdo acima de Layers.
 *
 * ## Por que saiu da faixa superior
 *
 * O dono pediu: ali, o nome ficava entre o logo e o menu, e **crescia** — cada
 * caractere digitado empurrava o menu para a direita, deslocando a interface inteira.
 * Aqui o título tem a largura do painel e não compete com nada.
 *
 * ## Renomear no lugar
 *
 * Um clique entra em edição com o texto selecionado, e Enter ou blur confirma, Escape
 * cancela. Já existia `SET_PROJECT_NAME` no reducer; o que faltava era a entrada.
 *
 * ## O ponto âmbar é o "não salvo" — e ele tem de ser honesto
 *
 * `isDirty` é a verdade do editor, e o download só a limpa **quando acontece**
 * (`downloadProject`). A correção do bug estava em não limpar o dirty quando o
 * download não saiu — e o indicador aqui é a prova visível de que isso ficou certo.
 *
 * O rótulo do dirty vai no `title` do botão, e o nome acessível do botão é o nome com
 * o sufixo "não salvo": um `<span>` puro é ignorado por tecnologia assistiva.
 */
export const ProjectTitle = () => {
  const { state, dispatch } = useComposer();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const name = state.project?.metadata.name ?? 'Icon Core';

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  if (!state.project) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="truncate text-[0.8125rem] font-semibold tracking-tight text-ic-text-muted">
          {name}
        </span>
      </div>
    );
  }

  const commit = () => {
    const trimmed = draft.trim();
    setEditing(false);
    if (!trimmed || trimmed === name) return;
    dispatch({ type: 'SET_PROJECT_NAME', payload: trimmed });
  };

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5">
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          aria-label="Project name"
          className="min-w-0 flex-1 rounded-[6px] border border-ic-border bg-ic-surface px-1.5 py-1 text-[0.8125rem] font-semibold text-ic-text outline-none focus-visible:ring-2 focus-visible:ring-ic-accent-text"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
          title="Rename project"
          aria-label={
            state.isDirty
              ? `${name}, unsaved changes. Activate to rename.`
              : `${name}. Activate to rename.`
          }
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-[6px] border-0 bg-transparent px-1.5 py-1 text-left hover:bg-ic-elevated"
        >
          <span className="truncate text-[0.8125rem] font-semibold tracking-tight text-ic-text">
            {name}
          </span>
          {state.isDirty && (
            <span aria-hidden="true" title="Unsaved changes" className="h-[7px] w-[7px] shrink-0 rounded-full bg-ic-gold" />
          )}
        </button>
      )}
    </div>
  );
};