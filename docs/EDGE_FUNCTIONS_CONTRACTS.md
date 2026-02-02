# Supabase Edge Functions — Contratos esperados (UI ↔ Functions)

O frontend chama algumas Supabase Edge Functions via `supabase.functions.invoke(...)`. O código dessas functions **não está versionado neste repositório**, então este documento registra o “contrato” que a UI espera para funcionar.

Referências:

- Trial: [FreeTrialSignup.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/FreeTrialSignup.jsx#L35-L66)
- Checkout: [Checkout.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Checkout.jsx#L145-L300)

## Convenções gerais (esperadas pela UI)

- Em caso de erro, a UI trata `error` retornado pelo `invoke` como exceção (`throw error`).
- Quando `data.success` não vem `true`, a UI tenta mostrar `data.error`.

## `start-free-trial`

### Chamada

```js
supabase.functions.invoke('start-free-trial', {
  body: {
    company_name,
    contact_email,
    contact_phone,
    full_name
  }
})
```

Referência: [FreeTrialSignup.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/FreeTrialSignup.jsx#L36-L62)

### Resposta esperada

- `success: boolean`
- `user_linked?: boolean`
- `tenant_id?: string` (uuid)
- `contact_email?: string`
- `error?: string`

### Comportamento esperado

- Se `success=true` e `user_linked=true`: UI redireciona direto para Dashboard.
- Se `success=true` e `user_linked=false`: UI redireciona para `/login` com `redirect=<Dashboard?...tenant_id=...&user_email=...&step=link>`.

## `link-tenant-to-user`

### Chamada

```js
supabase.functions.invoke('link-tenant-to-user', {
  body: { tenant_id, user_email }
})
```

Referência: [Checkout.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Checkout.jsx#L54-L86)

### Resposta esperada

- `success: boolean`
- `error?: string`

### Observação crítica

Depois de `success=true`, o usuário deve passar a ter `tenant_id` (idealmente em `auth.users.app_metadata.tenant_id` e/ou `user_profiles.tenant_id`), senão o app continua sem contexto.

## `create-asaas-payment`

### Chamada

```js
supabase.functions.invoke('create-asaas-payment', {
  body: {
    plan_type,
    customer_email,
    customer_name,
    customer_phone,
    customer_cpf,
    billingType: 'PIX' | 'CREDIT_CARD',
    tenant_id?,     // quando upgrade
    is_upgrade?     // quando upgrade
  }
})
```

Referência: [Checkout.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Checkout.jsx#L145-L177)

### Resposta esperada (PIX)

Campos usados na UI:

- `payment_id` (string)
- `value` (número/decimal)
- `due_date` (string data)
- `pix_qr_code` (string)
- `pix_copy_paste` (string)

Referência (uso na UI): [Checkout.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Checkout.jsx#L486-L549)

### Resposta esperada (cartão)

- `invoice_url` (string) para redirecionamento

Referência: [Checkout.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Checkout.jsx#L175-L177)

## `check-asaas-payment-status`

### Chamada

```js
supabase.functions.invoke('check-asaas-payment-status', {
  body: { payment_id }
})
```

Referências:

- Polling automático: [Checkout.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Checkout.jsx#L186-L204)
- Botão “Já paguei”: [Checkout.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Checkout.jsx#L206-L229)

### Resposta esperada

- `isPaid: boolean`

## `upgrade-tenant-plan`

### Chamada

```js
supabase.functions.invoke('upgrade-tenant-plan', {
  body: { tenant_id, new_plan_type }
})
```

Referência: [Checkout.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Checkout.jsx#L231-L254)

### Resposta esperada

- `success: boolean`
- `error?: string`

## `create-tenant-only`

### Chamada

```js
supabase.functions.invoke('create-tenant-only', {
  body: {
    company_name,
    contact_phone,
    plan_type,
    segment,
    employees,
    owner_user_id
  }
})
```

Referência: [Checkout.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Checkout.jsx#L260-L300)

### Resposta esperada

- `success: boolean`
- `tenant_id?: string`
- `error?: string`

