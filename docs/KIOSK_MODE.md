# Modo Quiosque (TotemDisplay)

## Objetivo
Permitir que a página TotemDisplay opere em modo quiosque em tablets, reduzindo distrações e maximizando a área útil, mesmo onde a tecla F11 não existe.

## Como usar (UI)
- Entrar em modo quiosque: tocar no ícone no canto superior esquerdo na página TotemDisplay.
- Sair do modo quiosque: tocar e segurar (toque longo) em qualquer área da tela por ~1,6s para revelar o botão “Sair do modo quiosque”, e então tocar nele.

## Implementação (Visão geral)
- Página: [TotemDisplay.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/TotemDisplay.jsx)
- Módulo reutilizável: [kioskMode.js](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/lib/kioskMode.js)
- Fallback CSS global: [index.css](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/index.css)

O fluxo tenta, nesta ordem:
1. Entrar em fullscreen via Fullscreen API (W3C) ou variantes de vendor prefix.
2. Se falhar ou não houver suporte, ativar uma “simulação” com CSS (`kiosk-fallback`) para bloquear scroll/overscroll.
3. Tentar travar orientação em landscape quando suportado (falha silenciosamente).

## Limitações por plataforma (importante)
### Android (Chrome/Firefox/Edge)
- Fullscreen API geralmente funciona, desde que acionada por gesto do usuário.
- A barra do sistema pode continuar visível dependendo do modo do dispositivo.
- Travar orientação costuma funcionar em fullscreen, mas pode variar por fabricante/política do navegador.

### iPadOS (Safari / navegadores baseados em WebKit)
- O suporte ao fullscreen para elementos existe em iPadOS modernos, mas pode variar por versão e pode exigir prefixos WebKit. Em iPhone, historicamente não há suporte ao fullscreen de elementos arbitrários.
- Alguns comportamentos podem encerrar fullscreen (por exemplo: mudanças de foco/inputs, dependendo do WebKit).
- Travar orientação via Screen Orientation API pode não estar disponível no Safari.

### Windows tablets
- Fullscreen API funciona como em desktop (além do atalho F11 quando teclado existe).

## Regras de segurança do navegador
- A entrada em fullscreen quase sempre exige um gesto do usuário (tap/click). Tentar ativar automaticamente no load tende a falhar.
- A saída do fullscreen pode ocorrer por ações do usuário (gestos do sistema, ESC em desktop) e o app precisa lidar com isso.

## Plano de testes (manual)
- Entrar em quiosque no TotemDisplay e validar que a UI se ajusta sem scroll.
- Abrir a Survey a partir do TotemDisplay e validar que o fullscreen continua (SPA) e que o estado não quebra.
- Validar a saída via toque longo e via ESC (desktop).
- Simular “sem suporte” (por navegador/dispositivo) e validar fallback CSS + mensagens.
- Testar rotação em portrait/landscape e comportamento do lock quando suportado.
