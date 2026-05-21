# RTG Pipeline — Assumptions & Methodology Decisions

This document logs methodology decisions that affect how the RTG panel
(`district_tiers`) is built. Each section is a discrete decision with a
status, a date, and the rule that follows from it. Code that depends on a
decision should reference it by id (e.g. `DECISION: H8`).

Status values:
- **PENDING** — discussed, not yet adopted; do not implement.
- **ACCEPTED** *(YYYY-MM-DD)* — adopted on the given date; live in code.
- **SUPERSEDED BY** *(id)* — replaced by a later decision.

---

## A1 — `scsd` polygons excluded from census pull *(placeholder)*

Status: PENDING (referenced by `Data Pull/census_pull_only.py` but the
rationale has not been written up here yet).

---

## G1+D2 — Full cross-product panel; tier=0 ≠ tier=NULL

Status: **ACCEPTED 2026-05-21**

Consolidates the two previously-PENDING items **G1 (Norfolk exclusion)** and
**D2 (panel tail)** into a single rule. Both are resolved by the rule below.

### Rule

The panel (`district_tiers` in Supabase) is the full cross-product of:

- All **158 districts** in `backend/data/composite_unsd_elsd.geojson`
  (the canonical district list)
- All years **2009 – 2024** (the window where both Census ACS 5-year and
  DoE coverage are available)

For each `(district, year)` cell:

| field                  | rule |
|------------------------|------|
| `books_combined`       | sum of BFK + Bookmobile spatial-join matches; **0 if no rows match** (not NULL, not skipped) |
| `rolling_3yr_combined` | 3-year mean of `books_combined`, treating absent prior years as 0 |
| `doe_*`                | joined from EdSight; NULL if uncovered |
| `census_*`             | joined from ACS; NULL if uncovered (within the window, full coverage is expected) |
| `ratio_0_9`            | computed when `census_pop_0_9` is non-null; with `books_combined = 0` the ratio is **0** |
| `ratio_0_9_hn`         | computed when `census_pop_0_9` AND `doe_high_needs_pct` are both non-null |
| `tier_overall`         | from ratio when ratio is non-null; `0` when ratio = 0 (the "no reach" tier); **NULL when the denominator is unavailable** |
| `tier_hn`              | same logic against `ratio_0_9_hn` |

### Three-state table

| books | demographics | ratio  | tier  | meaning             |
|-------|--------------|--------|-------|---------------------|
| 0     | present      | 0      | 0     | measured no reach   |
| >0    | present      | calc   | calc  | measured reach      |
| any   | missing      | NULL   | NULL  | cannot measure      |

`tier = 0` and `tier = NULL` are **semantically distinct** and must be
rendered distinctly. `tier = 0` is a real measurement (we know the
population and saw zero books). `tier = NULL` means the denominator is
unavailable and reach cannot be computed.

### Zero-reach across slices

When `rolling_3yr_combined = 0` and `census_pop_0_9 > 0`, **all six ratios**
(Overall and HN × ages 0–4 / 0–9 / 5–9) are 0, even if a slice-specific
denominator (HN %, age subset) is unavailable. The interpretation is "zero
books reached anyone in this district, including high-needs children" — a
real measurement given that we know the district has children.
`tier_overall = 0` and `tier_hn = 0` follow.

This generalises the three-state table above: "demographics present" for
HN purposes is satisfied by `census_pop_0_9 > 0`, not strictly by
`census + DoE`. The math fix lives in `computeRatios` in
`backend/src/services/pipeline.js` (search for `zeroReach`).

### Scope cap

The cross-product extends **only** over 2009–2024. Years before 2009 lack
ACS 5-year coverage (the script handles this — see `Data Pull/census_pull_only.py`
which starts at 2009). Years after 2024 are handled separately by **H8**
(census proxy carry-forward). Do not extend the cross-product outside this
window.

### Implementation pointers

- `backend/scripts/expand-panel.js` — one-shot backfill that adds missing
  cells to an existing seeded DB. Operates only on 2009–2024.
- Live `POST /api/admin/upload-books` in `backend/src/routes/admin.js`
  already enforces this rule for new-year uploads (inserts zero-book rows
  for any district missing from the upload).
- `assignOverallTier(0, config)` and `assignHnTier(0, config)` in
  `backend/src/services/pipeline.js` already return 0 for ratio = 0; no
  change needed there.

---

## H8 — Census proxy carry-forward

Status: **ACCEPTED 2026-05-21**

### Rule

For any year *Y* where the ACS pull returns 404 or missing rows, use the most
recent vintage with full coverage as the denominator for *Y*. Flag those rows
with `census_is_proxy = true` and `census_source_year = <actual vintage used>`.

The proxied census values are written into the row's `census_pop_0_4`,
`census_pop_5_9`, and `census_pop_0_9` columns, and `ratio_0_9`,
`ratio_0_9_hn`, `tier_overall`, and `tier_hn` are recomputed using the
proxied denominator. Tier thresholds are unchanged — only the denominator
changes.

### Revisit trigger

Re-run `Data Pull/census_pull_only.py` with the 2025 vintage after the ACS
2020–2024 5-year estimates release (expected Dec 2026). If the pull succeeds,
the proxy logic should not fire for 2025 on the next pipeline run.

### Scope cap

Do not carry forward more than one year. The proxy step refuses to fill a
year *Y* whose nearest real-vintage source is older than *Y* − 1, and refuses
to chain off another proxied row. If year *Y* + 2 also lacks ACS, that
requires a fresh decision (provisional name **H8b**).

### Auditability

The substitution must be visible in the row itself:
- `census_is_proxy = true` on every proxied row.
- `census_source_year` records the vintage actually used.
- `census_pop_*` reflect the carried-forward values (not the upstream null).

### Implementation pointers

- `backend/src/services/pipeline.js` — `applyProxyCensus` function (the
  single place where proxying happens).
- `backend/src/routes/admin.js` — three call sites: `POST /upload-books`,
  `POST /census-refresh`, `PUT /config` (recompute).
- `Data Pull/census_pull_only.py` — emits the same two columns so the
  standalone pull and the live pipeline produce consistent output.
- Frontend badge: muted "Census denominator: <year>" near the year slider
  when any visible row is proxied, and in the district header when the
  selected district-year is proxied.
