CREATE TABLE IF NOT EXISTS google_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  place_id TEXT NOT NULL,
  maps_url TEXT,
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_google_places_tenant_place_id_unique
  ON google_places (tenant_id, place_id);

CREATE INDEX IF NOT EXISTS idx_google_places_tenant_active
  ON google_places (tenant_id, is_active);

CREATE TABLE IF NOT EXISTS google_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  place_id TEXT NOT NULL,
  external_review_id TEXT NOT NULL,
  author_name TEXT,
  rating INTEGER NOT NULL,
  comment TEXT,
  review_published_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'scraping',
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_critical BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'new',
  status_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  linked_customer_email TEXT,
  linked_customer_phone TEXT,
  linked_customer_name TEXT,
  raw_payload JSONB
);

ALTER TABLE google_reviews
  ADD CONSTRAINT google_reviews_rating_check CHECK (rating >= 1 AND rating <= 5);

ALTER TABLE google_reviews
  ADD CONSTRAINT google_reviews_status_check CHECK (status IN ('new', 'in_progress', 'resolved', 'ignored'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_google_reviews_unique
  ON google_reviews (tenant_id, place_id, external_review_id);

CREATE INDEX IF NOT EXISTS idx_google_reviews_tenant_published_at
  ON google_reviews (tenant_id, review_published_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_reviews_tenant_critical_status
  ON google_reviews (tenant_id, is_critical, status, review_published_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_reviews_tenant_place
  ON google_reviews (tenant_id, place_id);

CREATE INDEX IF NOT EXISTS idx_google_reviews_tenant_customer_email
  ON google_reviews (tenant_id, linked_customer_email);

CREATE INDEX IF NOT EXISTS idx_google_reviews_tenant_customer_phone
  ON google_reviews (tenant_id, linked_customer_phone);

CREATE TABLE IF NOT EXISTS google_review_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  review_id UUID NOT NULL REFERENCES google_reviews(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_google_review_versions_unique
  ON google_review_versions (review_id, content_hash);

CREATE INDEX IF NOT EXISTS idx_google_review_versions_review
  ON google_review_versions (tenant_id, review_id, created_at DESC);

CREATE TABLE IF NOT EXISTS google_review_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  review_id UUID NOT NULL REFERENCES google_reviews(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  payload JSONB,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_google_review_actions_review
  ON google_review_actions (tenant_id, review_id, created_at DESC);

