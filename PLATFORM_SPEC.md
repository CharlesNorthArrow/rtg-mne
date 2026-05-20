# RTG Early Literacy — Platform Specification

## Overview

A two-audience web application for Read to Grow (RTG) to visualise school district book distribution reach and manage annual data refreshes.

**Public audience:** RTG team, funders, board — read-only dashboard and methodology
**Admin audience:** Data Director — password-gated panel to update the dataset annually

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 18 + Vite | |
| Styling | Tailwind CSS | |
| Map | MapLibre GL JS | Bundled GeoJSON, no API key |
| Charts | Recharts | |
| Backend | Node.js + Express | Deployed as Vercel serverless functions |
| Database | Supabase (Postgres) | Auth + Row Level Security |
| Auth | Supabase Auth | Email/password for Data Director only |
| Frontend hosting | Vercel | |
| File processing | Papaparse (CSV) + xlsx (Excel) | Client-side validation, server-side processing |
| Spatial join | @turf/boolean-point-in-polygon | New year rows only, ~1500 rows max |

---

## Database Schema

### district_tiers
Primary data table. One row per school district per year. Seeded from `books_by_sd_year.csv`.

```sql
CREATE TABLE district_tiers (
  id                      SERIAL PRIMARY KEY,
  school_district_geoid   TEXT NOT NULL,
  school_district_name    TEXT NOT NULL,
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
  census_pop_0_4          NUMERIC,
  census_pop_5_9          NUMERIC,
  census_pop_0_9          NUMERIC,
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

-- Public read, admin write
ALTER TABLE district_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON district_tiers FOR SELECT USING (true);
CREATE POLICY "admin write" ON district_tiers FOR ALL USING (auth.role() = 'authenticated');
```

### pipeline_config
Single-row table. Stores age coefficients and tier thresholds. Updated in-place by admin.

```sql
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
CREATE POLICY "public read" ON pipeline_config FOR SELECT USING (true);
CREATE POLICY "admin write" ON pipeline_config FOR ALL USING (auth.role() = 'authenticated');
```

### pipeline_runs
Audit log. Every admin action writes a record.

```sql
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

ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin only" ON pipeline_runs FOR ALL USING (auth.role() = 'authenticated');
```

---

## Application Routes

### Frontend
```
/                   Dashboard (public)
/methodology        Methodology overview (public)
/admin              → redirects to /admin/login if not authenticated
/admin/login        Login page
/admin/upload       Upload hub (books + DoE)
/admin/census       Census API refresh
/admin/config       Coefficients & thresholds
/admin/audit        Pipeline run history
```

### Backend API
```
GET  /api/data/years                          List of available years
GET  /api/data/districts?year=&county=        All districts for a year (map + table)
GET  /api/data/district/:geoid                Full longitudinal data for one district
GET  /api/data/summary/:year                  Aggregate stats for a year

POST /api/admin/upload-books                  Process books CSV upload
POST /api/admin/upload-doe                    Process DoE Excel upload
POST /api/admin/census-refresh                Trigger Census API fetch
GET  /api/admin/config                        Get pipeline config
PUT  /api/admin/config                        Update pipeline config (triggers recalc)
GET  /api/admin/runs                          Audit log
```

All `/api/admin/*` routes require a valid Supabase JWT in the Authorization header.

---

## Component Tree

```
App
├── PublicLayout
│   ├── NavBar
│   │   └── links: Dashboard | Methodology | Admin (→ login)
│   │
│   ├── DashboardPage  /
│   │   ├── FilterBar
│   │   │   ├── YearSelector          dropdown, default = latest year
│   │   │   ├── CountyMultiSelect     8 CT counties
│   │   │   ├── DistrictSearch        type-ahead search
│   │   │   └── TierToggle            Overall ↔ High-Needs
│   │   │
│   │   ├── SummaryCards              (4 cards, update with filters)
│   │   │   ├── TotalBooksCard        rolling_3yr_combined sum
│   │   │   ├── TierBreakdownCard     count per tier
│   │   │   ├── MoversCard            districts that changed tier YoY
│   │   │   └── CoverageCard          % of 114 districts with data
│   │   │
│   │   ├── MapView                   MapLibre choropleth
│   │   │   ├── CT school district polygons coloured by active tier
│   │   │   ├── Tier legend (6-colour stoplight)
│   │   │   ├── DistrictHoverTooltip  name, tier, ratio on hover
│   │   │   └── DistrictClickHandler  → opens DistrictDetailPanel
│   │   │
│   │   ├── DistrictDetailPanel       slides in from right on map click
│   │   │   ├── DistrictHeader        name, county, current tier badge
│   │   │   ├── TierMovementBadge     ↑↓ vs prior year with tier labels
│   │   │   ├── RatioTrendChart       ratio_0_9 + ratio_0_9_hn over time
│   │   │   ├── BooksTrendChart       rolling_3yr_combined over time
│   │   │   ├── StatsGrid             latest year: books, pop, enrollment, HN%
│   │   │   ├── DataGapNotice         shown if any NaN years in view
│   │   │   └── CloseButton
│   │   │
│   │   └── LeagueTable               sortable, synced with map filters
│   │       ├── columns: District, County, Tier, Ratio, YoY change, Books
│   │       └── TierBadge component per row
│   │
│   └── MethodologyPage  /methodology
│       ├── TierScaleVisual           horizontal bar, 6 colours + cutoffs
│       ├── TierTable                 both Overall and HN systems side by side
│       ├── CoefficientsExplainer     what the 0.80/0.48/0.32 mean + table
│       ├── HighNeedsDefinition       DoE definition, plain language
│       ├── DataSourcesTable          source, coverage, update frequency
│       ├── DataGapSummary            the 7 gaps from the methodology doc
│       └── FullDocDownload           link to RTG_Pipeline_Methodology.md
│
└── AdminLayout  /admin/*  (auth-gated)
    ├── AdminNav
    │   └── links: Upload | Census | Config | Audit Log | Sign out
    │
    ├── LoginPage  /admin/login
    │   └── Supabase Auth email/password form
    │
    ├── UploadPage  /admin/upload
    │   ├── BooksUploadCard
    │   │   ├── ExportSettingsReminder  (collapsible, what to export from HUB)
    │   │   ├── FileDropzone            accepts .csv only
    │   │   ├── ClientSideValidator     checks columns, year range, CT state
    │   │   ├── UploadPreview           "Found N rows for year Y, K districts"
    │   │   └── ConfirmProcessButton    disabled until validation passes
    │   │
    │   └── DoeUploadCard
    │       ├── ExportSettingsReminder  (exact EdSight settings)
    │       ├── FileDropzone            accepts .xlsx only
    │       ├── ClientSideValidator     checks sheet name, columns, district count
    │       ├── UploadPreview           "Found N districts, year Y"
    │       └── ConfirmProcessButton
    │
    ├── CensusRefreshPage  /admin/census
    │   ├── LastRunCard                 date, vintage year fetched, districts returned
    │   ├── RefreshButton               triggers POST /api/admin/census-refresh
    │   ├── VintageYearDisplay          auto-resolved, shown before confirmation
    │   └── ResultsSummary              shown after run: districts added, warnings
    │
    ├── ConfigPage  /admin/config
    │   ├── ConfigWarningBanner         "Only adjust if programme age mix has changed"
    │   ├── CoefficientsForm
    │   │   ├── fields: coeff_0_9, coeff_0_4, coeff_5_9
    │   │   ├── LiveSumValidation       coeff_0_4 + coeff_5_9 must equal coeff_0_9
    │   │   └── SaveButton              disabled if validation fails
    │   ├── TierThresholdsForm
    │   │   ├── OverallThresholds       t1–t4 inputs with tier labels
    │   │   └── HNThresholds            t1–t4 inputs with tier labels
    │   ├── RecalcWarningModal          "This will recalculate all historical tiers"
    │   └── ResetToDefaultsButton
    │
    └── AuditLogPage  /admin/audit
        └── RunHistoryTable
            └── columns: Date, Type, Status, Details, Triggered by
```

---

## Tier Colour Palette

| Tier | Label | Hex | Tailwind |
|------|-------|-----|---------|
| 0 | No Reach | `#9CA3AF` | gray-400 |
| 1 | Very Low | `#EF4444` | red-500 |
| 2 | Low | `#F97316` | orange-500 |
| 3 | Moderate | `#EAB308` | yellow-500 |
| 4 | High | `#22C55E` | green-500 |
| 5 | Very High | `#3B82F6` | blue-500 |
| null | No data | `#E5E7EB` | gray-200 |

---

## Admin Upload Processing — Step by Step

### Books distribution upload

```
1. Client: validate CSV columns and year range
2. Client: show preview → user confirms
3. POST /api/admin/upload-books (multipart/form-data)
4. Server: parse CSV with Papaparse
5. Server: filter to new year only (max_year in file not already in DB)
6. Server: filter to BFK + Bookmobile, CT state, has Lat/Lon
7. Server: spatial join against bundled ct_school_districts.geojson using @turf
8. Server: aggregate SumOfQty by geoid + program_category
9. Server: fetch prior 2 years from district_tiers for rolling avg
10. Server: compute rolling_3yr_combined (explicit zeros for missing years)
11. Server: fetch current pipeline_config for coefficients + thresholds
12. Server: fetch existing DoE + Census rows for new year from district_tiers
13. Server: compute ratios and tiers
14. Server: upsert into district_tiers ON CONFLICT (geoid, year) DO UPDATE
15. Server: write pipeline_runs record (status=success, details=JSON summary)
16. Server: return summary to client
```

### DoE upload

```
1. Client: validate Excel sheet name ('Results'), columns, year range
2. Client: show preview → user confirms
3. POST /api/admin/upload-doe (multipart/form-data)
4. Server: parse Excel with xlsx library
5. Server: extract total enrollment + high needs blocks (NaN handling with min_count logic)
6. Server: filter to our 114 district names
7. Server: extract new year only
8. Server: upsert doe_total_enrollment, doe_high_needs_count, doe_high_needs_pct
           into district_tiers ON CONFLICT DO UPDATE
9. Server: recompute ratios and tiers for affected rows
10. Server: write pipeline_runs record
11. Server: return summary
```

### Census refresh

```
1. Server: query district_tiers for max(year) where census_pop_0_9 IS NULL
2. Server: resolve vintage year = min(target_year, LATEST_ACS_VINTAGE)
           LATEST_ACS_VINTAGE stored as environment variable, updated annually
3. Server: GET https://api.census.gov/data/{year}/acs/acs5
           ?get=NAME,B01001_001E,B01001_003E,B01001_004E,B01001_027E,B01001_028E
           &for=school district (unified):*
           &in=state:09
           &key={CENSUS_API_KEY}  ← server env var, never exposed
4. Server: parse response, compute pop_0_4, pop_5_9, pop_0_9
5. Server: upsert census columns into district_tiers
6. Server: recompute ratios and tiers for affected rows
7. Server: write pipeline_runs record
8. Server: return summary
```

---

## Environment Variables

### Frontend (.env)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=
```

### Backend (.env)
```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=      # service role key, bypasses RLS for admin ops
CENSUS_API_KEY=            # never exposed to frontend
LATEST_ACS_VINTAGE=2024    # update each December
```

---

## Static Assets (bundled)

```
frontend/public/
├── ct_school_districts.geojson   (90KB, simplified TIGER polygons)
└── RTG_Pipeline_Methodology.pdf  (methodology doc download)

backend/data/
└── ct_school_districts.geojson   (same file, used for spatial join)
```

---

## One-Time Seed Script

Seeds `district_tiers` from the completed `books_by_sd_year.csv`. Run once before launch.

```javascript
// backend/scripts/seed.js
import { createClient } from '@supabase/supabase-js'
import Papa from 'papaparse'
import fs from 'fs'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const csv = fs.readFileSync('books_by_sd_year.csv', 'utf8')
const { data } = Papa.parse(csv, { header: true, dynamicTyping: true })

// Upsert in batches of 500
for (let i = 0; i < data.length; i += 500) {
  const batch = data.slice(i, i + 500)
  const { error } = await supabase
    .from('district_tiers')
    .upsert(batch, { onConflict: 'school_district_geoid,year' })
  if (error) throw error
  console.log(`Seeded rows ${i}–${i + batch.length}`)
}
console.log(`Done: ${data.length} rows seeded`)
```

---

## Build Order

1. **Supabase setup** — create project, run schema SQL, seed data
2. **Backend scaffold** — Express app, auth middleware, `/api/data/*` routes
3. **Dashboard page** — map + filters + league table (read-only, uses seeded data)
4. **District detail panel** — longitudinal charts
5. **Methodology page** — static content
6. **Admin auth** — login page, route protection
7. **Upload flows** — books then DoE
8. **Census refresh** — API proxy
9. **Config page** — coefficients + thresholds + recalc
10. **Audit log** — pipeline_runs table view
