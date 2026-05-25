-- High-Needs subgroup counts. Per-district per-year breakdown of the three
-- components of the CSDE "high-needs" definition, with a 7-way breakdown of
-- Students with Disabilities.
--
-- Counts only. Pcts are derived client-side from count / doe_total_enrollment.
-- doe_high_needs_count / doe_high_needs_pct are NOT touched — they remain the
-- authoritative HN total that tier_hn math depends on.
--
-- Paste into the Supabase SQL editor once to apply.

ALTER TABLE district_tiers
  ADD COLUMN IF NOT EXISTS doe_econ_dis_count           NUMERIC,
  ADD COLUMN IF NOT EXISTS doe_free_meals_count         NUMERIC,
  ADD COLUMN IF NOT EXISTS doe_reduced_price_count      NUMERIC,
  ADD COLUMN IF NOT EXISTS doe_english_learner_count    NUMERIC,
  ADD COLUMN IF NOT EXISTS doe_swd_count                NUMERIC,
  ADD COLUMN IF NOT EXISTS doe_swd_autism_count         NUMERIC,
  ADD COLUMN IF NOT EXISTS doe_swd_emotional_count      NUMERIC,
  ADD COLUMN IF NOT EXISTS doe_swd_intellectual_count   NUMERIC,
  ADD COLUMN IF NOT EXISTS doe_swd_learning_count       NUMERIC,
  ADD COLUMN IF NOT EXISTS doe_swd_other_count          NUMERIC,
  ADD COLUMN IF NOT EXISTS doe_swd_other_health_count   NUMERIC,
  ADD COLUMN IF NOT EXISTS doe_swd_speech_count         NUMERIC;
