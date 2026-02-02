ALTER TABLE IF EXISTS survey_responses
ADD COLUMN IF NOT EXISTS followup_status TEXT,
ADD COLUMN IF NOT EXISTS followup_note TEXT,
ADD COLUMN IF NOT EXISTS followup_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS followup_updated_by UUID;

ALTER TABLE IF EXISTS survey_responses
ADD COLUMN IF NOT EXISTS google_redirect_triggered BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS google_redirect_triggered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS google_redirect_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_survey_responses_tenant_created_at ON survey_responses (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_responses_tenant_rating ON survey_responses (tenant_id, overall_rating);
