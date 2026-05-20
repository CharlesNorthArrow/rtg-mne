# RTG Early Literacy Platform

## Project Structure

```
rtg-platform/
├── frontend/          React + Vite + Tailwind + MapLibre
├── backend/           Node.js + Express API
├── PLATFORM_SPEC.md   Full platform specification
└── .env.example       Environment variable templates
```

## Setup

### 1. Supabase

1. Create a new Supabase project at https://supabase.com
2. Run the schema SQL from `PLATFORM_SPEC.md` in the Supabase SQL editor
3. Copy your project URL, anon key, and service role key

### 2. Environment variables

```bash
# Frontend
cp .env.example frontend/.env.local
# Edit with your Supabase URL and anon key

# Backend
cp .env.example backend/.env
# Edit with all keys including CENSUS_API_KEY and SUPABASE_SERVICE_KEY
```

### 3. Install dependencies

```bash
cd frontend && npm install
cd ../backend && npm install
```

### 4. Copy static assets

```bash
# GeoJSON for map rendering (frontend) and spatial join (backend)
cp /path/to/ct_school_districts.geojson frontend/public/
cp /path/to/ct_school_districts.geojson backend/data/

# Methodology doc for download
cp /path/to/RTG_Pipeline_Methodology.pdf frontend/public/
```

### 5. Seed historical data

```bash
cd backend
node scripts/seed.js /path/to/books_by_sd_year.csv
```

### 6. Run locally

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Frontend: http://localhost:5173
Backend:  http://localhost:3001

## Annual Update Checklist (Data Director)

1. Export book distribution CSV from RTG HUB
2. Export DoE High Needs from EdSight (Year=latest, Level=District, All districts, District-level school, High Needs student group)
3. Log in to /admin
4. Upload books CSV → Upload DoE Excel → Run Census refresh
5. Check audit log for any warnings
6. Update `LATEST_ACS_VINTAGE` in backend `.env` if Census released a new vintage (each December)

## Deployment

### Frontend → Vercel
```bash
cd frontend && npm run build
# Deploy via Vercel CLI or GitHub integration
```

### Backend → Vercel Serverless
Add `vercel.json` to backend root:
```json
{
  "version": 2,
  "builds": [{ "src": "src/index.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "src/index.js" }]
}
```

Set environment variables in Vercel dashboard (Settings → Environment Variables).
