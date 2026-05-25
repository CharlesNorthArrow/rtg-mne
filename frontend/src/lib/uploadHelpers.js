// Client-side file preview helpers for the admin upload page.

import Papa from 'papaparse'

// Parse a CSV File and return summary stats for the preview UI.
// Returns: { rowCount, distinctYears, latestYear, latestYearRows,
//            withLatLonPct, columns, sampleRow, error? }
export async function previewBooksCsv(file) {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data || []
        if (rows.length === 0) {
          resolve({ rowCount: 0, error: 'CSV is empty.' })
          return
        }
        const columns = Object.keys(rows[0])
        const required = ['Year', 'Lat', 'Lon', 'ProgramType', 'SumOfQty']
        const missing = required.filter(c => !columns.includes(c))
        if (missing.length) {
          resolve({
            rowCount: rows.length,
            columns,
            sampleRow: rows[0],
            error: `Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`,
          })
          return
        }
        const years = [...new Set(rows.map(r => r.Year).filter(Boolean))].sort((a, b) => a - b)
        const latestYear = years[years.length - 1] ?? null
        const latestYearRows = rows.filter(r => r.Year === latestYear).length
        const withLatLon = rows.filter(r => r.Lat != null && r.Lon != null).length
        resolve({
          rowCount: rows.length,
          distinctYears: years,
          latestYear,
          latestYearRows,
          withLatLonPct: rows.length > 0 ? Math.round((withLatLon / rows.length) * 100) : 0,
          columns,
          sampleRow: rows[0],
        })
      },
      error: (err) => {
        resolve({ rowCount: 0, error: err.message })
      },
    })
  })
}

// xlsx doesn't get parsed client-side (would require SheetJS frontend dep
// just for a preview). Return basic file metadata only.
export function previewDoeXlsx(file) {
  const ok = /\.xlsx$/i.test(file.name)
  return {
    filename: file.name,
    sizeKb: Math.round(file.size / 1024),
    error: ok ? null : 'File must be an .xlsx workbook exported from EdSight.',
  }
}
