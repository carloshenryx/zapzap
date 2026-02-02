## Contexto Atual (Codebase)
- A página [TotemDisplay.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/TotemDisplay.jsx) já “parece fullscreen” via CSS (`h-screen`), mas não usa API de tela cheia.
- TotemDisplay está em `pagesWithoutMenu` no [Layout.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/Layout.jsx#L166-L178), então é o melhor ponto para adicionar UX de quiosque sem interferir no resto do app.
- O fluxo de totem já tem comportamento “kiosk-like” na [Survey.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Survey.jsx) (timeout e auto-retorno), então entrar em fullscreen no TotemDisplay tende a permanecer durante a navegação SPA.
- O app usa `sonner` para feedback (TotemDisplay já usa `toast.success/error`).

## 1) Análise Técnica Inicial (Plataformas/Políticas)
- **Android tablets (Chrome/Firefox/Edge)**: Fullscreen API padrão costuma funcionar, mas **exige gesto do usuário** (click/tap). Orientation lock geralmente só funciona em fullscreen.
- **Windows tablets (Edge/Chrome)**: comportamento similar a desktop; Fullscreen API funciona e F11 também (quando teclado existe).
- **iPadOS (Safari/Chrome/WebKit)**: fullscreen para elementos é suportado em iPads modernos, porém com restrições e frequentemente via prefixo WebKit; historicamente **não funciona em iPhone**. Há relatos de que funciona em iPadOS e não em iPhone e que prefixos WebKit são necessários em alguns casos. citeturn1search0 citeturn1search0
- **Orientação de tela**: `screen.orientation.lock()` pode exigir fullscreen e/ou contexto de app instalado (PWA), e Safari pode não suportar. citeturn2search0 citeturn2search0

## 2) Proposta de Solução Técnica (Implementação)
### 2.1 Módulo Reutilizável “Kiosk Mode”
- Criar um módulo em `src/lib/` (ex.: `src/lib/kioskMode.js`) que exponha:
  - `isFullscreenSupported()` (detecção por `requestFullscreen` e variantes)
  - `enterFullscreen(element)` e `exitFullscreen()` com fallback para:
    - `element.requestFullscreen()`
    - `element.webkitRequestFullscreen()`
    - `element.mozRequestFullScreen()`
    - `element.msRequestFullscreen()`
    - `document.exitFullscreen()` e variantes (`webkitExitFullscreen`, etc.)
  - `getFullscreenElement()` (normalizado)
  - `onFullscreenChange(cb)` (assina `fullscreenchange` + variantes)
  - `tryLockOrientation('landscape'|'portrait')` e `unlockOrientation()` (com `screen.orientation.lock` quando disponível; falhar silenciosamente com feedback)
  - “simulação” via CSS: `applyKioskCssFallback(true/false)` (toggle de classe em `html/body`)

### 2.2 Integração no TotemDisplay
- Adicionar um controle visível na UI (ex.: botão **“Ativar Modo Quiosque”** / **“Sair”**) no topo, próximo ao botão de configurações.
- Ao ativar:
  - Chamar `enterFullscreen(document.documentElement)` (tende a manter fullscreen durante as rotas internas).
  - Tentar travar orientação (opcional/configurável) após entrar em fullscreen.
  - Se fullscreen não estiver disponível/for negado, habilitar fallback CSS e mostrar toast (“Seu navegador não suporta…”, “Toque para ativar…”, etc.).
- Ao sair:
  - Chamar `exitFullscreen()`.
  - Remover CSS fallback e destravar orientação.

## 3) UX/UI (Quiosque)
- Adaptar a UI para fullscreen:
  - Em modo quiosque, ocultar/atenuar controles não essenciais (ex.: esconder o botão de “Configurações” após alguns segundos, mantendo acessível via gesto).
- Saída clara e “segura”:
  - Implementar um **botão de sair escondido**: aparece após **toque longo (ex.: 2–3s)** em uma área discreta (canto inferior/branding) e some novamente após timeout.
  - Em desktop, permitir também **ESC** (padrão do navegador) e exibir instrução breve.

## 4) Tratamento de Erros e Fallbacks
- Capturar e tratar exceções (Promise reject) de `requestFullscreen()`/`orientation.lock()`:
  - Mensagens via `sonner` (já usado em TotemDisplay).
- Estados a cobrir:
  - “Sem suporte” (API ausente)
  - “Sem gesto do usuário” (ativação automática bloqueada)
  - “Falhou ao entrar/saiu ao focar” (especialmente em WebKit/iPad)
- Fallback mínimo:
  - Classe CSS global para “modo quiosque simulado”: `height: 100vh`, `overflow: hidden`, `overscroll-behavior: none`, etc.

## 5) Testes e Validação
### 5.1 Testes Automatizados (Vitest)
- Criar testes unitários para o módulo:
  - Seleção correta entre `requestFullscreen` e variantes.
  - `getFullscreenElement()` normalizado.
  - `applyKioskCssFallback()` adiciona/remove classes.

### 5.2 Plano de Teste Manual (Tablets)
- Matriz mínima:
  - Android tablet: Chrome (principal), Firefox (secundário)
  - iPadOS: Safari
  - Windows tablet: Edge
- Cenários:
  - Entrar em quiosque → navegar TotemDisplay → Survey → voltar (fullscreen persiste no SPA)
  - Sair via toque longo (e via ESC no desktop)
  - Falha proposital (simular sem suporte) → fallback CSS + mensagem
  - Rotação de tela: com lock suportado vs. não suportado
  - Acessibilidade: controles focáveis e gesto alternativo

## 6) Entregáveis
- Módulo reutilizável: `src/lib/kioskMode.js` (ou equivalente)
- Atualização de UI: [TotemDisplay.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/TotemDisplay.jsx) com botão de ativação + saída via toque longo
- Estilos globais (se necessário): `src/globals.css` ou `src/index.css` para classe de fallback
- Documentação: novo doc `docs/KIOSK_MODE.md` (limitações por plataforma, gesto obrigatório, orientação, recomendações)

## Observação Importante (PWA)
- `index.html` referencia `/manifest.json`, mas esse arquivo não existe no repo hoje. Em iPadOS/iOS, a experiência mais “kiosk-like” geralmente depende de rodar como app instalado (Adicionar à Tela de Início). Posso incluir no escopo a criação do `manifest.json` + meta tags iOS para melhorar o modo standalone, se você confirmar.
