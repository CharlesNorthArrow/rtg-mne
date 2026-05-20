import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession()
  return session ? { Authorization: `Bearer ${session.access_token}` } : {}
}

export async function apiFetch(path, options = {}) {
  const authHeaders = options.auth ? await getAuthHeader() : {}
  let res
  try {
    res = await fetch(`${API}${path}`, {
      ...options,
      headers: { ...authHeaders, ...options.headers },
      signal: AbortSignal.timeout(8000),
    })
  } catch (e) {
    if (e.name === 'TimeoutError') throw new Error(`Request to ${path} timed out — is the backend connected to Supabase?`)
    throw new Error(`Request to ${path} failed: ${e.message}`)
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json()
}

// Public data helpers
export const api = {
  getYears: () => apiFetch('/api/data/years'),
  getDistricts: (year, county) => apiFetch(`/api/data/districts?year=${year}${county ? `&county=${county}` : ''}`),
  getDistrict: (geoid) => apiFetch(`/api/data/district/${geoid}`),
  getSummary: (year) => apiFetch(`/api/data/summary/${year}`),
}

// Admin helpers (require auth)
export const adminApi = {
  uploadBooks: (formData) => apiFetch('/api/admin/upload-books', { method: 'POST', body: formData, auth: true }),
  uploadDoe: (formData) => apiFetch('/api/admin/upload-doe', { method: 'POST', body: formData, auth: true }),
  censusRefresh: () => apiFetch('/api/admin/census-refresh', { method: 'POST', auth: true }),
  getConfig: () => apiFetch('/api/admin/config', { auth: true }),
  updateConfig: (config) => apiFetch('/api/admin/config', { method: 'PUT', body: JSON.stringify(config), headers: { 'Content-Type': 'application/json' }, auth: true }),
  getRuns: () => apiFetch('/api/admin/runs', { auth: true }),
}
