import { useEffect, useState } from 'react'
import { adminApi, api } from '../../lib/supabase.js'

export default function CensusRefreshPage() {
  const [status, setStatus] = useState(null)
  const [statusError, setStatusError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    loadStatus()
  }, [])

  async function loadStatus() {
    setStatusError(null)
    try {
      const [panel, runs] = await Promise.all([
        api.getPanel(),
        adminApi.getRuns(),
      ])
      const real = panel.filter(r => r.census_source_year != null && !r.census_is_proxy)
      const proxied = panel.filter(r => r.census_is_proxy)
      const latestReal = real.reduce((m, r) => Math.max(m, r.census_source_year), 0) || null
      const proxyYears = [...new Set(proxied.map(r => r.year))].sort((a, b) => a - b)
      const lastCensusRun = (runs || []).find(r => r.run_type === 'census_refresh')
      setStatus({
        latestReal,
        proxyYears,
        proxiedRowCount: proxied.length,
        lastRun: lastCensusRun,
      })
    } catch (e) {
      setStatusError(e.message)
    }
  }

  async function onRefresh() {
    setConfirmOpen(false)
    setBusy(true); setError(null); setResult(null)
    try {
      const r = await adminApi.censusRefresh()
      setResult(r)
      await loadStatus()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <header>
        <h1 className="text-2xl font-semibold">Census refresh</h1>
        <p className="mt-1 text-sm text-gray-600">
          Pull the latest U.S. Census ACS 5-year estimates for Connecticut’s
          158 school districts. The result becomes the denominator for the
          books-per-child ratios.
        </p>
      </header>

      <Card
        title="Current census status"
        lastUploaded={status?.lastRun?.created_at}
      >
        {statusError && <ErrorPanel message={statusError} />}
        {!status && !statusError && <div className="text-sm text-gray-500">Loading…</div>}
        {status && (
          <table className="w-full text-sm">
            <tbody>
              <Row k="Latest vintage with real data" v={status.latestReal ?? '—'} />
              <Row k="Years using carried-forward proxy" v={status.proxyYears.join(', ') || 'none'} />
              <Row k="Proxied rows in panel" v={status.proxiedRowCount} />
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Run a refresh">
        <p>
          Refresh attempts the most recent year missing real census data. If
          that vintage hasn’t been published yet by the Census Bureau, the
          previous vintage is carried forward as a proxy (see methodology
          decision <span className="font-mono">H8</span>) and the row is
          flagged.
        </p>

        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={busy}
          className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: '#243A78' }}
        >
          {busy ? 'Refreshing…' : 'Refresh census now'}
        </button>

        {error && <ErrorPanel message={error} />}
        {result && (
          <ResultPanel title="Refresh complete">
            <Row k="Vintage fetched" v={result.vintageYear} />
            <Row k="Districts updated" v={result.districtsUpdated} />
            <Row
              k="Proxy carry-forward summary"
              v={result.censusProxy && Object.keys(result.censusProxy).length
                ? JSON.stringify(result.censusProxy)
                : 'no proxy years needed'}
            />
          </ResultPanel>
        )}
      </Card>

      {confirmOpen && (
        <ConfirmModal
          onCancel={() => setConfirmOpen(false)}
          onConfirm={onRefresh}
        >
          This pulls fresh data from the U.S. Census API and may take 20–60
          seconds. The dashboard will reflect any new vintage immediately
          after.
        </ConfirmModal>
      )}
    </div>
  )
}

function Card({ title, lastUploaded, children }) {
  return (
    <section className="rounded-md bg-white p-5 space-y-3 shadow-sm" style={{ border: '0.5px solid #E5E7EB' }}>
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

function formatDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function Row({ k, v }) {
  return (
    <tr className="border-t border-gray-200">
      <td className="py-1.5 pr-3 text-gray-600">{k}</td>
      <td className="py-1.5 text-gray-900 tabular-nums">{String(v ?? '—')}</td>
    </tr>
  )
}

function ResultPanel({ title, children }) {
  return (
    <div className="rounded border border-green-200 bg-green-50 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-green-700 mb-1">{title}</div>
      <table className="w-full text-sm">
        <tbody>{children}</tbody>
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

function ConfirmModal({ onCancel, onConfirm, children }) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4"
      onClick={onCancel}
    >
      <div
        className="max-w-md rounded-md bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold">Confirm census refresh</h3>
        <p className="mt-2 text-sm text-gray-700">{children}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-white"
            style={{ background: '#243A78' }}
          >
            Refresh now
          </button>
        </div>
      </div>
    </div>
  )
}
