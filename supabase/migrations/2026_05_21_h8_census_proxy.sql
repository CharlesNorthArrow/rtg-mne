-- H8 — Census proxy carry-forward. See docs/ASSUMPTIONS.md.
-- Adds two columns so we can carry forward the most recent ACS vintage
-- as the denominator for years whose ACS vintage hasn't released yet,
-- and flag those rows auditably.
--
-- Paste this into the Supabase SQL editor once to apply.

ALTER TABLE district_tiers
  ADD COLUMN IF NOT EXISTS census_source_year SMALLINT,
  ADD COLUMN IF NOT EXISTS census_is_proxy    BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: every row that already has census data was pulled in real-time
-- from its own year's vintage, so census_source_year = year.
UPDATE district_tiers
SET census_source_year = year
WHERE census_pop_0_9 IS NOT NULL
  AND census_source_year IS NULL;
