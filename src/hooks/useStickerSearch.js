import { useEffect, useState } from 'react'
import { stickerService } from '../stickerService'

/** Debounced query, falling back to the selected category when the query is empty. */
export function useStickerSearch(query, category) {
  const [state, setState] = useState({ stickers: [], loading: true })

  useEffect(() => {
    let stale = false
    setState((s) => ({ ...s, loading: true }))
    const t = setTimeout(async () => {
      const { stickers, error } = query.trim()
        ? await stickerService.searchStickers(query)
        : await stickerService.getStickersByCategory(category)
      if (!stale) setState({ stickers, error, loading: false })
    }, query.trim() ? 250 : 0)
    return () => {
      stale = true
      clearTimeout(t)
    }
  }, [query, category])

  return state
}
