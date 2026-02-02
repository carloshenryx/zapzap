## **Objetivo**
- Replicar **exatamente** o layout/estrutura visual e a sequência de interação dos prints, agora incluindo os **novos passos** que você enviou (cargo/equipe/público/objetivo/origem + tela de ativação por e-mail).
- Adaptar **100% dos textos** (títulos, labels, placeholders, botões, mensagens) para o contexto do **AvaliaZap**, sem alterar o fluxo/estados visuais.

## **Como o app funciona hoje (para manter compatibilidade)**
- Front: **React + Vite + React Router**. A rota atual é `/${PageKey}`; a tela é [FreeTrialSignup.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/FreeTrialSignup.jsx).
- Auth: `useAuth().signUp()` chama `supabase.auth.signUp()`.
- Onboarding de tenant: `POST /api/tenants?action=onboard` (backend em [handlers/tenants.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/tenants.ts)).

## **Novo Wizard (passos, 1:1 com os prints)**
Vou transformar o `FreeTrialSignup` em um wizard multi-step com setas laterais, barra de progresso e “Sair” no topo.

### **Passo 1 — Tela escura + card branco (Criar conta)**
- Layout 2 colunas: dor/benefícios (esquerda) + formulário (direita).
- Campos: **Nome**, **E-mail**, **Senha**.
- CTA: “Criar minha conta” (texto AvaliaZap), link “Ir para tela de login”.
- Validações: obrigatórios, e-mail válido, senha mínima.

### **Passo 2 — Boas-vindas**
- Texto “Olá {Nome}…” + card com nome/e-mail.
- Setas para avançar/voltar + “Sair”.

### **Passo 3 — Nome + E-mail (cards)**
- Campos em cards como no print, pré-preenchidos.

### **Passo 4 — Senha + Repetir senha**
- Mesma estrutura do print.
- Validações: mínimo 6 e confirmação.

### **Passo 5 — Empresa + Telefone**
- Mesma estrutura do print.
- Telefone com máscara/validação (reaproveitando a lógica do projeto, hoje já existe em [PhoneInput.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/sendsurvey/PhoneInput.jsx)).

### **Passo 6 — Cargo + Tamanho da equipe** (print novo)
- “Qual o seu cargo?”: dropdown (Select do UI já existe em [select.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/ui/select.jsx)).
- “Qual o tamanho da sua equipe …?”: chips (botões pill) com as mesmas opções do print.
- Textos adaptados para AvaliaZap (ex.: equipe de atendimento/comercial — mantendo a mesma hierarquia visual).

### **Passo 7 — Para quem você atende/vende + Objetivo** (print novo)
- Chips: Empresas / Pessoas Físicas / Instituições / Órgãos Públicos.
- Chips de objetivo (4 opções): vou adaptar mantendo 4 pills, por exemplo:
  - “Coletar avaliações”, “Acompanhar NPS”, “Melhorar atendimento”, “Outros”.

### **Passo 8 — Onde conheceu o AvaliaZap?** (print novo)
- Chips: Anúncio / Site / Redes sociais / Indicação / Outros.

### **Passo 9 — Tela de ativação por e-mail** (print novo)
- Tela final com ícone de e-mail, texto “Enviamos um e-mail para …” e botão “Vamos lá”.
- Comportamento:
  - Se o Supabase retornar sessão imediatamente (confirmação desligada), o botão pode redirecionar para o Dashboard.
  - Se o Supabase exigir confirmação (sessão nula), o botão leva para Login e mostramos a instrução de verificar o e-mail.

## **Quando criar a conta e quando criar o tenant (para suportar confirmação por e-mail)**
Para conseguir replicar o print final de “Ative sua conta” sem quebrar o fluxo, a implementação vai:
- Coletar os dados ao longo do wizard.
- **Criar o usuário (signUp) + criar o tenant (onboard)** somente ao finalizar o passo 8.
- Em seguida, mostrar o passo 9 (ativação), com o e-mail do usuário.

Isso mantém o UX idêntico ao print (a pessoa só “finaliza” no final), e evita o problema comum do Supabase quando confirmação está ligada (sessão não vem no início).

## **Persistência dos novos dados do wizard (cargo/equipe/público/objetivo/origem)**
Hoje o banco versionado no repo **não tem colunas** para esses campos. Para manter isso rastreável e evolutivo, vou propor:
- Criar migration com uma tabela nova `public.tenant_onboarding` (1:1 com tenant), com colunas:
  - `tenant_id` (PK/FK)
  - `owner_user_id`
  - `job_title` (cargo)
  - `team_size`
  - `sells_to`
  - `signup_goal`
  - `acquisition_source`
  - timestamps
- Estender `POST /api/tenants?action=onboard` para aceitar esses campos opcionais e inserir nessa tabela.

Se você preferir “zero mudança de banco”, alternativa é guardar isso como `jsonb` em uma coluna existente (se houver) — mas como o schema base não está versionado no repo, a opção mais segura aqui é **criar a tabela** via migration.

## **Arquivos que serão alterados/criados**
- Alterar: [FreeTrialSignup.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/FreeTrialSignup.jsx) (vira wizard completo)
- Alterar: [handlers/tenants.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/tenants.ts) (aceitar e persistir novos campos)
- Criar: migration SQL em `supabase/migrations/` para `tenant_onboarding`
- Possível: criar componentes auxiliares do wizard para manter o arquivo limpo (sem mudar UI).

## **Verificação**
- Validar passo a passo: bloqueio de avanço quando inválido, loading, erros e sucesso.
- Testar fluxo completo: finalizar wizard → signUp → onboard → tela de ativação → login/dashboard.
- Checar responsividade e fidelidade visual aos prints.

Se este plano estiver OK, eu começo a implementação exatamente com esse wizard (incluindo os novos passos).