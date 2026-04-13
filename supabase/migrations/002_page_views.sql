CREATE TABLE IF NOT EXISTS page_views (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  path text NOT NULL,
  city text,
  region text,
  country text,
  ip text,
  user_agent text,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_region ON page_views (region);

ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_full ON page_views FOR ALL USING (true) WITH CHECK (true);
