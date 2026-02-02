CREATE TABLE IF NOT EXISTS whatsapp_trigger_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT,
  external_trigger_id TEXT NOT NULL,
  survey_template_id UUID NOT NULL,
  whatsapp_instance_name TEXT NOT NULL,
  webhook_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_trigger_configs_tenant_external_unique
  ON whatsapp_trigger_configs (tenant_id, external_trigger_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_trigger_configs_webhook_key_unique
  ON whatsapp_trigger_configs (webhook_key);

CREATE INDEX IF NOT EXISTS idx_whatsapp_trigger_configs_tenant_active
  ON whatsapp_trigger_configs (tenant_id, is_active, created_at DESC);

