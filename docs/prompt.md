# Project Prompt Log - v7.2

## 2024-05-24 - Advanced Variation Engine
- **Novo Fluxo de Ativos**: Sistema agora permite envio granular de Ícones (Universal, Light, Dark) e Favicons (Light, Dark).
- **Favicon granular**: Adicionados slots específicos para `faviconLight` e `faviconDark`.
- **Dicas de Resolução**: Adicionadas tags informativas com resoluções sugeridas (Sug.) para cada slot de upload.
- **Configuração de Variantes**: Implementado switch `Auto-generate Variants`.
    - Se DESATIVADO: Gera apenas variações baseadas em arquivos explicitamente enviados (ou usa o Master sem transformações).
    - Se ATIVADO: Aplica heurísticas para compor versões claro/escuro caso falte o override específico.
- **Nomenclatura**: Ativos agora seguem padrões de mercado (`icon-192-light.png`, `apple-touch-icon.png`, `favicon.ico`, `favicon-dark.ico`).
- **UI/UX Mobile**: Refinamento dos slots de override para melhor visualização em telas pequenas e fixação de problemas de scroll remanescentes.
- **Background Composer**: Slot de `Social BG` integrado para composição de OG/Twitter cards com background customizado.
