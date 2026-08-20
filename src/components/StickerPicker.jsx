import { useEffect, useState } from 'react'
import { stickerService } from '../stickerService'
import { useStickerSearch } from '../hooks/useStickerSearch'
import { StickerSearch } from './StickerSearch'
import { StickerCategories } from './StickerCategories'
import { StickerGrid } from './StickerGrid'

const WIDTH = 360
const HEIGHT = 420

function place(rect) {
  const left = Math.min(Math.max(8, rect.right - WIDTH), window.innerWidth - WIDTH - 8)
  return rect.top > HEIGHT + 16
    ? { left, bottom: window.innerHeight - rect.top + 8 }
    : { left, top: rect.bottom + 8 }
}

const MESSAGES = {
  nokey: 'Nothing bundled matches — add a GIPHY key to search live',
  badkey: 'That GIPHY key was rejected',
  offline: 'No local match, and GIPHY is unreachable',
  empty: 'No stickers found',
}

function Notice({ error }) {
  const needsKey = error === 'nokey' || error === 'badkey'
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-300">
      <span>{MESSAGES[error] || `GIPHY error: ${error}`}</span>
      {needsKey && (
        <button
          type="button"
          onClick={() => stickerService.openOptions()}
          className="shrink-0 rounded-md bg-amber-400/20 px-2 py-0.5 font-medium hover:bg-amber-400/30"
        >
          Set key
        </button>
      )}
    </div>
  )
}

export function StickerPicker({ rect, closing, onPick }) {
  const [categories, setCategories] = useState([])
  const [category, setCategory] = useState('trending')
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(false)
  const { stickers, loading, error } = useStickerSearch(query, category)

  useEffect(() => {
    stickerService.getCategories().then(setCategories)
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const visible = shown && !closing

  return (
    <div
      style={{ ...place(rect), width: `min(${WIDTH}px, calc(100vw - 16px))`, maxHeight: HEIGHT }}
      className={`@container fixed z-[2147483647] flex flex-col gap-2 overflow-hidden rounded-2xl
        border border-white/10 bg-neutral-900 p-2.5 text-neutral-100 shadow-2xl
        [font-family:system-ui,sans-serif] transition duration-150 ease-out
        ${visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-1 scale-95 opacity-0'}`}
    >
      <StickerSearch value={query} onChange={setQuery} />
      {!query.trim() && (
        <StickerCategories categories={categories} active={category} onSelect={setCategory} />
      )}
      {error && <Notice error={error} />}
      {/* min-h-0 is load-bearing: without it this grows to fit the grid and
          squashes the search bar and category row above it. */}
      <div
        className="-mr-1.5 min-h-0 flex-1 overflow-y-auto pr-1.5
          [scrollbar-color:theme(colors.neutral.700)_transparent] [scrollbar-width:thin]"
      >
        <StickerGrid stickers={stickers} loading={loading} onPick={onPick} />
      </div>
      <p className="shrink-0 border-t border-white/5 pt-1.5 text-center text-[9px] tracking-wide text-neutral-600 uppercase">
        Shift-click to insert without sending · Powered by GIPHY
      </p>
    </div>
  )
}
