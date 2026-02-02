CREATE TABLE IF NOT EXISTS public.consumption (
  tenant_id uuid NOT NULL,
  period text NOT NULL,
  messages_sent integer NOT NULL DEFAULT 0,
  surveys_created integer NOT NULL DEFAULT 0,
  responses_received integer NOT NULL DEFAULT 0,
  messages_sent_webhook integer NOT NULL DEFAULT 0,
  messages_sent_manual integer NOT NULL DEFAULT 0,
  messages_sent_api integer NOT NULL DEFAULT 0,
  responses_received_webhook integer NOT NULL DEFAULT 0,
  responses_received_manual integer NOT NULL DEFAULT 0,
  responses_received_api integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, period)
);

ALTER TABLE public.consumption
  ADD COLUMN IF NOT EXISTS messages_sent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS surveys_created integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS responses_received integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS messages_sent_webhook integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS messages_sent_manual integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS messages_sent_api integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS responses_received_webhook integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS responses_received_manual integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS responses_received_api integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.consumption
  SET
  messages_sent = COALESCE(messages_sent, 0),
    surveys_created = COALESCE(surveys_created, 0),
    responses_received = COALESCE(responses_received, 0),
    messages_sent_webhook = COALESCE(messages_sent_webhook, 0),
    messages_sent_manual = COALESCE(messages_sent_manual, 0),
    messages_sent_api = COALESCE(messages_sent_api, 0),
    responses_received_webhook = COALESCE(responses_received_webhook, 0),
    responses_received_manual = COALESCE(responses_received_manual, 0),
    responses_received_api = COALESCE(responses_received_api, 0);

ALTER TABLE public.consumption ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consumption_select ON public.consumption;
CREATE POLICY consumption_select ON public.consumption
  FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS consumption_insert ON public.consumption;
CREATE POLICY consumption_insert ON public.consumption
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS consumption_update ON public.consumption;
CREATE POLICY consumption_update ON public.consumption
  FOR UPDATE TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);
