## Objetivo
- Fazer o link de recuperação do Supabase abrir uma tela de redefinição de senha dentro do app, com o mesmo padrão visual do [FreeTrialSignup.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/FreeTrialSignup.jsx).
- Suportar tanto o fluxo **PKCE** (`?code=...`) quanto o fluxo legado por **hash** (`#access_token=...&refresh_token=...`) e também mostrar erros vindos no hash (ex.: `#error=access_denied&error_code=otp_expired...`).

## Diagnóstico do problema atual
- Já existe a página [ResetPassword.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/ResetPassword.jsx) e a rota `/reset-password` já está registrada em [pages.config.js](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages.config.js).
- A página atual valida apenas o `?code=...` via `supabase.auth.exchangeCodeForSession(code)` e não trata o fragmento `window.location.hash` (onde seu link está vindo com `error=...`).
- Como seu link está abrindo `/#error=...` (rota `/`), a página renderizada é [PreLogin.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/PreLogin.jsx), que hoje não redireciona esse callback para `/reset-password`.

## Mudanças planejadas (frontend)
### 1) Tornar o callback do Supabase “à prova” de hash e query
- Criar uma pequena função utilitária (ex.: `parseSupabaseAuthCallbackUrl`) para interpretar:
  - `?code=...` (PKCE)
  - `#access_token`, `#refresh_token`, `#type=recovery`
  - `#error`, `#error_code`, `#error_description`
- Adotar essa função em dois lugares:
  - [PreLogin.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/PreLogin.jsx): detectar callback no `/` e redirecionar imediatamente para `/reset-password` preservando `search` e `hash`.
  - [ResetPassword.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/ResetPassword.jsx): consumir `code` ou tokens, validar sessão e exibir mensagens de erro.

### 2) Ajustar a lógica de sessão na tela ResetPassword
- No carregamento da tela:
  - Se vier `error`/`error_code` no hash: mostrar mensagem amigável (ex.: link expirado) + CTA para [ForgotPassword.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/ForgotPassword.jsx).
  - Se vier `?code=...`: executar `exchangeCodeForSession(code)`.
  - Se vier `#access_token/#refresh_token`: executar `supabase.auth.setSession({ access_token, refresh_token })`.
  - Em seguida, `supabase.auth.getSession()` e exigir `session.user` antes de permitir redefinir.
- Limpar URL após processar (remover `code`/hash) com `history.replaceState` para não deixar tokens/erros no endereço.

### 3) Refatorar o layout da ResetPassword para o padrão do FreeTrialSignup
- Trocar o visual atual (gradiente azul) por um layout consistente com o FreeTrialSignup:
  - fundo branco + elementos flutuantes (mesma estética)
  - acento roxo `#5B2CF3`
  - card central com ícone em “pill”/quadrado arredondado
  - botões com `bg-[#5B2CF3] hover:bg-[#4A23D7]` e tipografia semelhante
- Manter os componentes shadcn já usados (`Button`, `Input`, `Label`, `Alert`) para consistência.

## Ajuste recomendado no Supabase (config)
- Garantir que as Redirect URLs permitidas incluam `https://app.avaliazap.com.br/reset-password` (e/ou a URL equivalente do ambiente), pois o app já tenta enviar `redirectTo = ${window.location.origin}/reset-password` em [AuthContext.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/lib/AuthContext.jsx#L283-L294).

## Testes/validação
- Adicionar teste unitário (Vitest) para a função de parsing de URL (casos: `?code`, `#access_token`, `#error=access_denied&error_code=otp_expired`).
- Validação manual local:
  - Abrir `http://localhost:5173/#error=access_denied&error_code=otp_expired&error_description=...` e verificar redirecionamento para `/reset-password` e exibição do CTA “Solicitar novo link”.
  - Abrir `http://localhost:5173/reset-password?code=fake` e confirmar mensagem de erro tratada.

## Entregáveis
- Fluxo funcionando quando o usuário cai no `/` com hash do Supabase.
- Página `/reset-password` com design alinhado ao FreeTrialSignup e tratamento completo de `code/hash/error`.