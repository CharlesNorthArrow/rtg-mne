-- Seed the initial "last uploaded" timestamps so the admin panel has something
-- to display before the Data Director runs their first real upload. Once they
-- do, the new pipeline_runs rows take over as the displayed timestamps.
--
-- Paste into the Supabase SQL editor once to apply.

INSERT INTO pipeline_runs (run_type, triggered_by, status, details, created_at)
VALUES
  ('books_upload',   'initial seed', 'success',
   '{"note":"Historical books CSV seeded via npm run seed; no live admin upload yet"}'::jsonb,
   '2026-05-25T00:00:00Z'),
  ('doe_upload',     'initial seed', 'success',
   '{"note":"Historical DoE data seeded via npm run seed; no live admin upload yet"}'::jsonb,
   '2026-05-25T00:00:00Z'),
  ('census_refresh', 'initial seed', 'success',
   '{"note":"Initial census + H8 proxy carry-forward seeded via npm run proxy-census"}'::jsonb,
   '2026-05-25T00:00:00Z');
