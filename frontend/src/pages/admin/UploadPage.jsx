import { useEffect, useRef, useState } from 'react'
import { adminApi, api } from '../../lib/supabase.js'
import { previewBooksCsv, previewDoeXlsx } from '../../lib/uploadHelpers.js'
import { toCsv, downloadCsv, todayStamp } from '../../lib/csvExport.js'

// Static fallback for the HN Subgroups card — that data isn't ingested
// through the live admin panel, so it doesn't appear in pipeline_runs.
const HN_SUBGROUPS_LAST_IMPORT = '2026-05-25T00:00:00Z'

export default function UploadPage() {
  const [lastRuns, setLastRuns] = useState({})

  useEffect(() => {
    let cancelled = false
    adminApi.getRuns().then(runs => {
      if (cancelled) return
      const map = {}
      for (const r of (runs || [])) {
        if (r.status !== 'success') continue
        if (!map[r.run_type]) map[r.run_type] = r.created_at  // runs are returned newest-first
      }
      setLastRuns(map)
    }).catch(() => { /* swallow — display will simply omit the pill */ })
    return () => { cancelled = true }
  }, [])

  // Bump a card's lastUploaded after a successful upload, without re-fetching.
  function markUploaded(runType) {
    setLastRuns(prev => ({ ...prev, [runType]: new Date().toISOString() }))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <header>
        <h1 className="text-2xl font-semibold">Annual data refresh</h1>
        <p className="mt-1 text-sm text-gray-600">
          Upload a new year of Read to Grow distribution data and CSDE enrollment
          data, refresh the Census denominators, and download the full longitudinal
          panel for offline analysis.
        </p>
      </header>

      <BooksUploadCard lastUploaded={lastRuns.books_upload} onUploaded={() => markUploaded('books_upload')} />
      <DoeUploadCard   lastUploaded={lastRuns.doe_upload}   onUploaded={() => markUploaded('doe_upload')}   />
      <HnSubgroupsReferenceCard lastUploaded={HN_SUBGROUPS_LAST_IMPORT} />
      <PanelExportCard />
    </div>
  )
}

function formatDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── A. Books distribution ──────────────────────────────────────────────
function BooksUploadCard({ lastUploaded, onUploaded }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function onFile(f) {
    setError(null); setResult(null); setPreview(null); setFile(f)
    if (!f) return
    const p = await previewBooksCsv(f)
    setPreview(p)
    if (p.error) setError(p.error)
  }

  async function onConfirm() {
    if (!file) return
    setBusy(true); setError(null); setResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const r = await adminApi.uploadBooks(form)
      setResult(r)
      onUploaded?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const ready = preview && !preview.error && !busy
  return (
    <Card title="Books distribution" lastUploaded={lastUploaded}>
      <p>
        Annual export from HUB containing every BFK and Bookmobile distribution
        with latitude, longitude, quantity, and program tag. The dashboard uses
        these rows to compute books-per-child reach for the new year.
      </p>

      <Details summary="What this file should look like">
        <SchemaList rows={[
          ['Year', 'integer, e.g. 2025'],
          ['Lat', 'number, decimal degrees'],
          ['Lon', 'number, decimal degrees'],
          ['ProgramType', '"Books for Kids" or "Bookmobile"'],
          ['SumOfQty', 'number, total books in this row'],
        ]} />
      </Details>

      <Details summary="How to get this file">
        <ol className="list-decimal pl-5 space-y-1">
          <li>Open HUB → Reports → "Distribution by Event".</li>
          <li>Set the date range to the full school year you’re adding.</li>
          <li>Group rows by Event / Site, with quantity and program tag.</li>
          <li>Export as CSV. The file must include lat/lon columns; if not,
              re-geocode events in HUB first.</li>
        </ol>
      </Details>

      <FileDrop accept=".csv" file={file} onChange={onFile} disabled={busy} />

      {preview && !preview.error && (
        <Preview rows={[
          ['Rows in file', preview.rowCount?.toLocaleString()],
          ['Years covered', preview.distinctYears?.join(', ') || '—'],
          ['Latest year', preview.latestYear ?? '—'],
          ['Rows in latest year', preview.latestYearRows?.toLocaleString()],
          ['Rows with Lat/Lon', `${preview.withLatLonPct}%`],
        ]} />
      )}

      <ConfirmButton onClick={onConfirm} disabled={!ready} busy={busy}>
        {busy ? 'Processing…' : 'Process books CSV'}
      </ConfirmButton>

      {error && <ErrorPanel message={error} />}
      {result && (
        <ResultPanel title={`Books processed for ${result.year}`} rows={[
          ['Districts with books', result.districtsWithBooks],
          ['Districts total (incl. zero-book)', result.districtsTotal],
          ['Points matched to a district', result.pointsMatched],
          ['Points unmatched', `${result.pointsUnmatched} (${result.unmatchedPct}%)`],
          ['Census proxy carry-forward', result.censusProxy ? JSON.stringify(result.censusProxy) : '—'],
        ]} />
      )}
    </Card>
  )
}

// ── B. DoE enrollment + High-Needs total ───────────────────────────────
function DoeUploadCard({ lastUploaded, onUploaded }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  function onFile(f) {
    setError(null); setResult(null); setFile(f)
    setPreview(f ? previewDoeXlsx(f) : null)
    if (f && previewDoeXlsx(f).error) setError(previewDoeXlsx(f).error)
  }

  async function onConfirm() {
    if (!file) return
    setBusy(true); setError(null); setResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const r = await adminApi.uploadDoe(form)
      setResult(r)
      onUploaded?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const ready = preview && !preview.error && !busy
  return (
    <Card title="CSDE enrollment & high-needs" lastUploaded={lastUploaded}>
      <p>
        Annual EdSight report giving total enrollment and the combined
        high-needs count per district. Used as the denominator for the
        High-Needs view of the tier map.
      </p>

      <Details summary="What this file should look like">
        <SchemaList rows={[
          ['File type', '.xlsx workbook with a sheet named "Results"'],
          ['Column A', 'student_group ("" for total, "High Needs" for HN)'],
          ['Column B', 'District name with trailing "(DoE code)"'],
          ['Column D', 'school_year, e.g. "2024-25"'],
          ['Column E', 'student_count (integer; blank when suppressed)'],
        ]} />
      </Details>

      <Details summary="How to get this file">
        <ol className="list-decimal pl-5 space-y-1">
          <li>Go to <a href="https://edsight.ct.gov/" target="_blank" rel="noopener noreferrer" className="underline">edsight.ct.gov</a> → Public Data → Students → Enrollment.</li>
          <li>Choose the "All Districts" report for the latest school year.</li>
          <li>Filter student_group to <em>Total</em> and <em>High Needs</em>.</li>
          <li>Export as Excel. Keep the default "Results" sheet name.</li>
        </ol>
      </Details>

      <FileDrop accept=".xlsx" file={file} onChange={onFile} disabled={busy} />

      {preview && !preview.error && (
        <Preview rows={[
          ['Filename', preview.filename],
          ['Size', `${preview.sizeKb} KB`],
          ['Server-side parse', 'Year and row counts will be reported after upload'],
        ]} />
      )}

      <ConfirmButton onClick={onConfirm} disabled={!ready} busy={busy}>
        {busy ? 'Processing…' : 'Process DoE workbook'}
      </ConfirmButton>

      {error && <ErrorPanel message={error} />}
      {result && (
        <ResultPanel title={`DoE processed for ${result.year}`} rows={[
          ['Districts upserted', result.districtsUpserted ?? result.districtsTotal ?? '—'],
          ['Suppressed (low count)', result.suppressed ?? '—'],
        ]} />
      )}
    </Card>
  )
}

// ── C. HN Subgroups — read-only reference ──────────────────────────────
function HnSubgroupsReferenceCard({ lastUploaded }) {
  return (
    <Card title="High-needs subgroups · reference only" tone="info" lastUploaded={lastUploaded}>
      <p>
        The dashboard reports the three components of CSDE’s high-needs definition
        separately (Economically Disadvantaged, English Learners, and Students
        with Disabilities), with a 7-way breakdown of disability sub-types in
        the district detail view.
      </p>
      <p>
        This data comes from <strong>a separate EdSight report</strong> (the
        "High-Needs Subgroups" file, not the main enrollment workbook handled
        above). Updating it is upstream work and currently runs through a
        one-shot import script. <strong>It is not yet part of the live admin
        panel.</strong> Reach out to the development team when a new
        subgroups report is released and they’ll re-run the import.
      </p>

      <Details summary="What that report looks like">
        <SchemaList rows={[
          ['File type', '.csv exported from EdSight'],
          ['District / District_Name / District_Code', 'district identifiers'],
          ['School Year', '"YYYY-YY", e.g. "2024-25"'],
          ['Total_Enrollment', 'integer'],
          ['High_Needs / Non_High_Needs', 'integer'],
          ['English_Learners', 'integer'],
          ['Free_Meals / Reduced_Price_Meals', 'integer'],
          ['SWD_Total', 'integer'],
          ['SWD_Autism / Emotional / Intellectual / Learning / Other / OtherHealthImp / SpeechLanguage', 'integer (sparse in older years)'],
        ]} />
      </Details>

      <p className="text-xs text-gray-500">
        Once new subgroup data is loaded, it shows up automatically in the
        dashboard’s Need Filter and the district-mode share chart.
      </p>
    </Card>
  )
}

// ── D. Panel export ────────────────────────────────────────────────────
function PanelExportCard() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  async function onDownload() {
    setBusy(true); setError(null); setDone(null)
    try {
      const rows = await api.getPanel()
      const csv = toCsv(rows)
      const filename = `rtg-panel-${todayStamp()}.csv`
      downloadCsv(filename, csv)
      setDone({ rows: rows.length, filename })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Download the full longitudinal panel">
      <p>
        Get the entire dataset as a single CSV: every district, every year,
        with books, Census population, CSDE enrollment, the high-needs
        subgroup breakdown, ratios, and tier assignments. Useful for offline
        analysis, sharing with funders, or auditing the numbers behind the
        dashboard.
      </p>

      <ConfirmButton onClick={onDownload} disabled={busy} busy={busy}>
        {busy ? 'Preparing CSV…' : 'Download panel CSV'}
      </ConfirmButton>

      {error && <ErrorPanel message={error} />}
      {done && (
        <ResultPanel title="Download started" rows={[
          ['Rows exported', done.rows?.toLocaleString()],
          ['Filename', done.filename],
        ]} />
      )}
    </Card>
  )
}

// ── Shared bits ────────────────────────────────────────────────────────
function Card({ title, tone, lastUploaded, children }) {
  const accent = tone === 'info'
    ? { borderLeftColor: '#243A78', borderLeftWidth: 3 }
    : {}
  return (
    <section
      className="rounded-md bg-white p-5 space-y-3 shadow-sm"
      style={{ border: '0.5px solid #E5E7EB', ...accent }}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">{title}</h2>
        {lastUploaded && (
          <span className="text-[11px] text-gray-500 tabular-nums">
            Last updated <span className="text-gray-700">{formatDate(lastUploaded)}</span>
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

function Details({ summary, children }) {
  return (
    <details className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-gray-700 select-none">
        {summary}
      </summary>
      <div className="mt-2 text-sm text-gray-700 space-y-2">
        {children}
      </div>
    </details>
  )
}

function SchemaList({ rows }) {
  return (
    <table className="w-full text-xs">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-t border-gray-200">
            <td className="py-1.5 pr-3 font-mono text-gray-700 align-top whitespace-nowrap">{k}</td>
            <td className="py-1.5 text-gray-600">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function FileDrop({ accept, file, onChange, disabled }) {
  const ref = useRef(null)
  const [drag, setDrag] = useState(false)
  function onDrop(e) {
    e.preventDefault(); setDrag(false)
    if (disabled) return
    const f = e.dataTransfer.files?.[0]
    if (f) onChange(f)
  }
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onClick={() => !disabled && ref.current?.click()}
      className={`rounded border-2 border-dashed px-4 py-6 text-center text-sm cursor-pointer transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      style={{
        borderColor: drag ? '#243A78' : '#D1D5DB',
        background: drag ? 'rgba(36,58,120,0.04)' : '#FAFAFA',
      }}
    >
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        disabled={disabled}
      />
      {file ? (
        <span>
          <span className="font-medium">{file.name}</span>{' '}
          <span className="text-gray-500">({Math.round(file.size / 1024)} KB)</span>
          <span className="ml-2 text-xs text-gray-500">— click to replace</span>
        </span>
      ) : (
        <span className="text-gray-600">
          Drop a <span className="font-mono">{accept}</span> file here, or click to browse.
        </span>
      )}
    </div>
  )
}

function Preview({ rows }) {
  return (
    <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Preview</div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-t border-gray-200">
              <td className="py-1 pr-3 text-gray-600">{k}</td>
              <td className="py-1 text-gray-900 tabular-nums">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ConfirmButton({ onClick, disabled, busy, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ background: '#243A78' }}
    >
      {children}
      {busy && <span className="ml-2 inline-block animate-pulse">●</span>}
    </button>
  )
}

function ResultPanel({ title, rows }) {
  return (
    <div className="rounded border border-green-200 bg-green-50 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-green-700 mb-1">{title}</div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-t border-green-200">
              <td className="py-1 pr-3 text-green-800">{k}</td>
              <td className="py-1 text-green-900 tabular-nums">{String(v ?? '—')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ErrorPanel({ message }) {
  return (
    <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <span className="font-medium">Error:</span> {message}
    </div>
  )
}
