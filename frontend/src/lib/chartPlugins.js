// Chart.js plugin factories. Use these when multiple charts need the same
// behaviour with their own plugin ID (Chart.js dispatches per-chart options
// by ID, so plugin IDs must be unique per chart kind).

// Dashed vertical line marking a specific year on the x axis. Reads the
// year from chart.options.plugins[id]?.year — pass `{ year }` in the chart
// `plugins` options block, registered under the same `id`.
export function makeVerticalYearLinePlugin(id) {
  return {
    id,
    afterDraw(chart) {
      const opts = chart.options.plugins?.[id]
      if (!opts || opts.year == null) return
      const xs = chart.scales.x
      const idx = chart.data.labels.indexOf(String(opts.year))
      if (idx < 0) return
      const x = xs.getPixelForTick(idx)
      const { top, bottom } = chart.chartArea
      const ctx = chart.ctx
      ctx.save()
      ctx.strokeStyle = '#6B7280'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(x, top)
      ctx.lineTo(x, bottom)
      ctx.stroke()
      ctx.restore()
    },
  }
}
