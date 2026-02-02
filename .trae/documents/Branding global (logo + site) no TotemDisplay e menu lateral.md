## O Que Esse Código Faz Hoje
- O [SystemBrandingManager.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/master/SystemBrandingManager.jsx) tenta buscar/criar/atualizar `SystemConfig` via `base44.entities.SystemConfig` e faz upload via `base44.integrations.Core.UploadFile`.
- O [TotemDisplay.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/TotemDisplay.jsx) já lê o branding direto do Supabase em `system_config` e renderiza no “rodapé discreto” ([TotemDisplay.jsx:L437-L455](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/TotemDisplay.jsx#L437-L455)).
- O menu lateral com efeito de “abrir e aparecer texto” fica no [Layout.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/Layout.jsx#L166-L210), mas o `TotemDisplay` não usa Layout porque está em `pagesWithoutMenu` ([Layout.jsx:L134-L137](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/Layout.jsx#L134-L137)).

## Onde Está O Problema (Migração)
- O `base44` já foi desativado no projeto: [base44Client.js](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/api/base44Client.js) é um stub “DEPRECATED” e todos os métodos `entities.*` rejeitam/prometem erro.
- Então, do jeito que está, o **SystemBrandingManager não consegue salvar** a logo/site no banco atual (Supabase). Ou seja: você “coloca” no form, mas isso não persiste de forma compatível com o que o TotemDisplay lê.

## Plano de Implementação (sem executar ainda)
1. **Migrar SystemBrandingManager para Supabase**
   - Trocar `base44` por `supabase`.
   - Buscar o registro atual em `system_config` (incluindo `id`), e fazer `update` se existir ou `insert` se não existir.
   - Manter `react-query` com `queryKey: ['system-config']` e `invalidateQueries`.

2. **Migrar upload da logo para Supabase Storage**
   - Usar o mesmo bucket já usado no TotemDisplay (`public-assets`) e salvar em uma pasta tipo `system-branding/`.
   - Gerar URL pública via `getPublicUrl` e gravar em `system_logo_url`.

3. **Exibir branding no menu lateral (Layout)**
   - Criar uma query `system-config` no `Layout` (ou um hook `useSystemConfig`) e usar:
     - No estado fechado: renderizar a logo como ícone (fallback para o “A” atual).
     - No estado aberto: renderizar o texto (ex: `system_website` ou “AvaliaZap”) junto da logo.

4. **Robustez no TotemDisplay**
   - Trocar `.single()` por `.maybeSingle()` ao ler `system_config` para não quebrar quando ainda não existir registro.

5. **Validação rápida**
   - Conferir: salvar pelo manager atualiza imediatamente o rodapé do TotemDisplay e o topo do menu lateral.
   - Checar fallback quando não há logo/site.

## Resultado Esperado
- Você configura **logo do sistema** e **website** em um único lugar, persistindo no Supabase.
- O TotemDisplay mostra no rodapé e o menu lateral mostra logo/texto quando expande.
- Código fica 100% alinhado com a migração Base44 → Supabase.
