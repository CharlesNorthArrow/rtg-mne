-- RTG Early Literacy Platform — Supabase schema
-- Paste this entire file into the Supabase SQL editor and run once on a fresh project.
-- After running, seed historical data with: npm run seed -- /path/to/books_by_sd_year.csv

-- ─── district_tiers ──────────────────────────────────────────────────────────
-- Primary data table. One row per school district per year.
CREATE TABLE district_tiers (
  id                      SERIAL PRIMARY KEY,
  school_district_geoid   TEXT NOT NULL,
  school_district_name    TEXT NOT NULL,
  sd_type                 TEXT,
  county                  TEXT NOT NULL,
  year                    INTEGER NOT NULL,
  books_bfk               NUMERIC,
  books_bookmobile        NUMERIC,
  books_combined          NUMERIC,
  rolling_3yr_bfk         NUMERIC,
  rolling_3yr_bookmobile  NUMERIC,
  rolling_3yr_combined    NUMERIC,
  doe_total_enrollment    NUMERIC,
  doe_high_needs_count    NUMERIC,
  doe_high_needs_pct      NUMERIC,
  doe_econ_dis_count          NUMERIC,
  doe_free_meals_count        NUMERIC,
  doe_reduced_price_count     NUMERIC,
  doe_english_learner_count   NUMERIC,
  doe_swd_count               NUMERIC,
  doe_swd_autism_count        NUMERIC,
  doe_swd_emotional_count     NUMERIC,
  doe_swd_intellectual_count  NUMERIC,
  doe_swd_learning_count      NUMERIC,
  doe_swd_other_count         NUMERIC,
  doe_swd_other_health_count  NUMERIC,
  doe_swd_speech_count        NUMERIC,
  census_pop_0_4          NUMERIC,
  census_pop_5_9          NUMERIC,
  census_pop_0_9          NUMERIC,
  census_source_year      SMALLINT,
  census_is_proxy         BOOLEAN NOT NULL DEFAULT FALSE,
  ratio_0_9               NUMERIC,
  ratio_0_4               NUMERIC,
  ratio_5_9               NUMERIC,
  ratio_0_9_hn            NUMERIC,
  ratio_0_4_hn            NUMERIC,
  ratio_5_9_hn            NUMERIC,
  tier_overall            SMALLINT CHECK (tier_overall BETWEEN 0 AND 5),
  tier_hn                 SMALLINT CHECK (tier_hn BETWEEN 0 AND 5),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (school_district_geoid, year)
);

CREATE INDEX district_tiers_year_idx  ON district_tiers (year);
CREATE INDEX district_tiers_geoid_idx ON district_tiers (school_district_geoid);

ALTER TABLE district_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read"  ON district_tiers FOR SELECT USING (true);
CREATE POLICY "admin write"  ON district_tiers FOR ALL    USING (auth.role() = 'authenticated');


-- ─── pipeline_config ─────────────────────────────────────────────────────────
-- Single-row table. Stores age coefficients and tier thresholds.
CREATE TABLE pipeline_config (
  id               INTEGER PRIMARY KEY DEFAULT 1,
  coeff_0_9        NUMERIC NOT NULL DEFAULT 0.80,
  coeff_0_4        NUMERIC NOT NULL DEFAULT 0.48,
  coeff_5_9        NUMERIC NOT NULL DEFAULT 0.32,
  tier_overall_t1  NUMERIC NOT NULL DEFAULT 0.010,
  tier_overall_t2  NUMERIC NOT NULL DEFAULT 0.030,
  tier_overall_t3  NUMERIC NOT NULL DEFAULT 0.135,
  tier_overall_t4  NUMERIC NOT NULL DEFAULT 0.500,
  tier_hn_t1       NUMERIC NOT NULL DEFAULT 0.030,
  tier_hn_t2       NUMERIC NOT NULL DEFAULT 0.080,
  tier_hn_t3       NUMERIC NOT NULL DEFAULT 0.270,
  tier_hn_t4       NUMERIC NOT NULL DEFAULT 1.000,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_by       TEXT,
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO pipeline_config DEFAULT VALUES;

ALTER TABLE pipeline_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read"  ON pipeline_config FOR SELECT USING (true);
CREATE POLICY "admin write"  ON pipeline_config FOR ALL    USING (auth.role() = 'authenticated');


-- ─── pipeline_runs ───────────────────────────────────────────────────────────
-- Audit log. Every admin action writes a record.
CREATE TABLE pipeline_runs (
  id            SERIAL PRIMARY KEY,
  run_type      TEXT NOT NULL CHECK (run_type IN (
                  'books_upload', 'doe_upload',
                  'census_refresh', 'config_change'
                )),
  triggered_by  TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('pending','success','error')),
  details       JSONB,
  error_message TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX pipeline_runs_created_at_idx ON pipeline_runs (created_at DESC);

ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin only" ON pipeline_runs FOR ALL USING (auth.role() = 'authenticated');


-- ─── RPC: years_with_data ────────────────────────────────────────────────────
-- Server-side DISTINCT for the year dropdown. Needed because PostgREST's
-- default max-rows cap (1000) truncates a plain `SELECT year` once a few
-- years × ~150 districts exceed the budget.
CREATE OR REPLACE FUNCTION public.years_with_data()
RETURNS SETOF int
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT year
  FROM district_tiers
  WHERE ratio_0_9 IS NOT NULL
  ORDER BY year DESC;
$$;
