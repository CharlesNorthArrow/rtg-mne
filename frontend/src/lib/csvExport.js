// Tiny CSV serializer + browser download trigger. No dependencies.

function escape(v) {
  if (v == null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

// Serialize an array of plain-object rows to CSV. If `columns` is omitted,
// uses the keys of the first row.
export function toCsv(rows, columns) {
  if (!rows || rows.length === 0) return ''
  const cols = columns ?? Object.keys(rows[0])
  const header = cols.join(',')
  const body = rows.map(r => cols.map(c => escape(r[c])).join(',')).join('\n')
  return `${header}\n${body}\n`
}

// Trigger a browser download for a CSV string. Cleans up the object URL.
export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// "YYYY-MM-DD" in local time
export function todayStamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
