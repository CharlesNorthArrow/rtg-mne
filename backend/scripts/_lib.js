// Shared utilities for one-shot maintenance scripts under backend/scripts/.

const PAGE = 1000

// Paginate a Supabase select through PostgREST's row cap (default 1000).
// Pass the builder up to the point just before `.range(...)` is needed —
// fetchAll handles ranging.
export async function fetchAll(query) {
  const out = []
  let offset = 0
  while (true) {
    const { data, error } = await query.range(offset, offset + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  return out
}
