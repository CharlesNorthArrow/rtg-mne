import { useEffect, useRef } from 'react'

const STEP_MS = 800

// Compact, inline-friendly playback control: ▶ + slider only.
// The YearSelector in FilterBar shows the current year, so no separate badge here.
export default function TimelineBar({ years, year, onYearChange, isPlaying, onPlayPauseToggle }) {
  const sortedAsc = [...years].sort((a, b) => a - b)
  const minY = sortedAsc[0]
  const maxY = sortedAsc[sortedAsc.length - 1]

  const yearRef = useRef(year)
  yearRef.current = year

  useEffect(() => {
    if (!isPlaying || !sortedAsc.length) return
    const id = setInterval(() => {
      const idx = sortedAsc.indexOf(yearRef.current)
      if (idx === -1 || idx >= sortedAsc.length - 1) {
        onPlayPauseToggle(false)
        return
      }
      onYearChange(sortedAsc[idx + 1])
    }, STEP_MS)
    return () => clearInterval(id)
  }, [isPlaying, sortedAsc, onYearChange, onPlayPauseToggle])

  function handlePlay() {
    if (year === maxY) onYearChange(minY)  // rewind before replay
    onPlayPauseToggle(!isPlaying)
  }

  if (!sortedAsc.length) return null

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handlePlay}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-gray-700 text-[10px] hover:bg-gray-300"
        title={isPlaying ? 'Pause' : 'Play year-by-year'}
      >
        {isPlaying ? '❚❚' : '▶'}
      </button>
      <input
        type="range"
        min={minY}
        max={maxY}
        step={1}
        value={year ?? minY}
        onChange={e => onYearChange(Number(e.target.value))}
        className="w-40 accent-gray-700"
        title={`${minY}–${maxY}`}
      />
    </div>
  )
}
