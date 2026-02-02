## Objetivo
- Adicionar no Admin → Painel Administrativo uma seção para baixar o QRCode (PNG/JPG) que aponta para a mesma URL do QRCode exibido no TotemDisplay.

## Onde será adicionado
- Incluir a seção dentro da aba **Configurações** do Admin (rota /Admin), no componente [TenantSettingsManager.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/admin/TenantSettingsManager.jsx), dentro do card **Configurações do Totem**.

## Como garantir que é “o mesmo QRCode do TotemDisplay”
- Reutilizar exatamente a mesma regra de montagem da URL usada em [TotemDisplay.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/TotemDisplay.jsx#L219-L225):
  - `.../Survey?tenant_id=<tenant>&template_id=<template>&from_qrcode=true`
- Buscar o template ativo do tenant em `survey_templates` com `is_active=true` e usar `design.primary_color` e `design.logo_url` com os mesmos parâmetros do TotemDisplay:
  - `level="H"`, `includeMargin`, `fgColor`, `imageSettings` (50x50, excavate).

## Implementação (front-end)
- Atualizar [TenantSettingsManager.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/admin/TenantSettingsManager.jsx):
  - Adicionar um `useQuery` para carregar o template ativo (id + design).
  - Montar `surveyUrl` com `window.location.origin` e os params do Totem.
  - Renderizar um preview do QRCode no card (igual ao do Totem).
  - Criar botões:
    - “Baixar PNG”
    - “Baixar JPG”
  - Gerar arquivo de download via `QRCodeCanvas` (do `qrcode.react`) para exportação.
  - Para evitar problemas de exportação quando há logo (CORS/taint), tentar previamente converter `design.logo_url` em `data:` URL via `fetch + FileReader` e usar essa fonte no canvas.
  - Nomear o arquivo de forma amigável (ex.: `qrcode-<tenant>-<template>.png/jpg`).
  - Se não houver template ativo, exibir aviso e desabilitar download.

## Verificação
- Validar no navegador:
  - Com template ativo: preview aparece e downloads geram PNG/JPG abrindo corretamente.
  - Com template sem logo e com logo: ambos exportam.
  - Sem template ativo: UI mostra aviso e bloqueia download.
- Conferir que o link embutido no QR baixado abre a mesma Survey do Totem (tenant_id/template_id/from_qrcode).
