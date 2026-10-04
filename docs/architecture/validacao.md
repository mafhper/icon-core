# Validação: paridade prova divergência, assertion absoluta prova correção

> Origem: `ADR-021` (decisão de arquitetura, mantida no workspace privado). Este é o
> documento **operacional** e é o que o CI pode ler.

## A regra

Duas perguntas, e confundi-las é o defeito:

| Pergunta | Instrumento | O que prova |
|---|---|---|
| Os dois pipelines discordam? | `scripts/check-svg-parity.mjs` | **divergência** |
| O valor está certo? | assertion absoluta | **correção** |

**Toda feature de renderer precisa de pelo menos uma assertion absoluta** contra o
contrato pretendido. Paridade é complementar, nunca substituto.

### Por que isso não é teórico

O gate de paridade do `IC63/2` media `text-anchor` e `font-style` nos dois pipelines, e
passava. Se o campo novo **não chegasse** ao renderer, os dois pipelines continuariam de
acordo — porque os dois leriam a mesma ausência. A fixture estava cega.

No outro sentido: um mutante plausível no reducer, que reconstruía o objeto `text`
campo a campo, **passou** numa suíte que parecia saudável. Só morreu quando existe teste
construído para a emenda.

## Taxonomia

Quatro perguntas. Cada uma precisa do seu instrumento — a 3 não responde a 1.

| # | Pergunta | Onde vive |
|---|---|---|
| 1 | A função calcula o valor certo? | spec do módulo |
| 2 | O campo chega ao renderer? | spec de integração |
| 3 | Canvas e SVG fazem a mesma coisa? | `check-svg-parity.mjs` |
| 4 | A ação do usuário muda o resultado? | spec de componente |

**4 é a que faltava.** O precedente mais próximo, `SvgPaintEditor.spec.tsx`, **para no
estado** — não vai ao renderer. Um spec de integração que começa no projeto cobre
2, mas pula o reducer e a UI. O item que fecha a cadeia é o que começa num clique.

## Contrato de feature

O relatório de uma feature é o contrato, não a contagem de testes:

```
modelo → persistência → reducer → UI → Canvas → SVG → paridade → assertion absoluta
```

Contagem de testes não é cobertura. `204 testes no renderer` não diz se uma dimensão nova
está protegida — e o `IC63/2` provou: o pacote tinha 168 testes quando uma mutação passou.

Ao reportar, preencher a cadeia e marcar o que está vazio. Lacuna declarada é dívida
legível; lacuna não declarada vira surpresa.

## Testes que dependem do compilador precisam passar pelo compilador

Regra que veio do mesmo incidente, e que a taxonomia acima **não** cobre sozinha.

Um teste que só é válido porque o compilador rejeitaria a versão errada não é verificado
por um runner de teste. O `vitest` descarta tipos sem checar — e foi exatamente por isso
que um payload semanticamente inválido passou sem reclamar.

Portanto: **prova de tipo se verifica com `tsc`, não com o runner.** Se a proteção é o
tipo, o gate é um `tsc` que deve reprovar.

O mesmo vale para o inverso: fixture que só passa por acidente está tão ausente quanto
fixture que não existe.

## Limites conhecidos

Coisas que esta regra **não** faz, e que continuam abertas:

- **O número agregado de paridade não é portão binário.** 94% em 16 fixtures esconde
  regressão — uma fixture pode cair 20 pontos e a média mal mexer. Falta limiar **por
  fixture** com baseline versionado; hoje o baseline é local e não está no repositório.
- **`charset-scan` não é `cspell`.** Ele pega CJK, cirílico, árabe e Hangul. Não pega
  prosa em outro idioma (`itángulo`, `Ameasured`) nem palavra duplicada
  (`estabeleceram estabeleceram`), que já foram defeitos reais.
- **Não há branch protection no `main`.** Um `--amend` com erro de stage já teve efeito
  uma vez.
- **`adb`/in-browser e2e do Composer não existem.** A cobertura de e2e é do promo; fluxos
  do Composer não são cobertos.

## Referências

- `ADR-021` — a decisão e o incidente que a originou