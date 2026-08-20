import { matches } from './match'
import { send, url as extUrl } from './ext'

// The only module that knows where stickers come from. The packs ship with the
// extension, so everything works offline; GIPHY is only consulted when a local
// search comes up empty and a key is configured.
const url = (f) => extUrl(`stickers/${f}`)

// Fetched on first open rather than bundled: ~250kB of JSON has no business
// parsing in every frame of every page.
let loading
const local = () =>
  (loading ??= fetch(extUrl('stickers.json'))
    .then((r) => r.json())
    .then((data) =>
      data.map((s) => ({ ...s, imageUrl: url(s.file), gifUrl: s.gif ? url(s.gif) : null }))
    )
    .catch(() => []))

const CATEGORIES = [
  { id: 'trending', label: 'Trending', emoji: '🔥' },
  { id: 'meme', label: 'Meme', emoji: '🗿', query: 'meme' },
  { id: 'funny', label: 'Funny', emoji: '😂', query: 'funny meme' },
  { id: 'reactions', label: 'Reactions', emoji: '🤔', query: 'reaction meme' },
  { id: 'wtf', label: 'WTF', emoji: '💀', query: 'wtf meme' },
  { id: 'sad', label: 'Sad', emoji: '😭', query: 'sad meme' },
  { id: 'angry', label: 'Angry', emoji: '😡', query: 'angry meme' },
  { id: 'love', label: 'Love', emoji: '❤️', query: 'love meme' },
  { id: 'approval', label: 'Approval', emoji: '👍', query: 'thumbs up meme' },
  { id: 'disapproval', label: 'Disapproval', emoji: '👎', query: 'nope meme' },
]

const cache = new Map()

async function remote(key, path, params) {
  if (cache.has(key)) return cache.get(key)
  const res = await send({ type: 'stickers', path, params })
  const out = res?.stickers?.length
    ? { stickers: res.stickers }
    : { stickers: [], error: res?.error || 'empty' }
  if (!out.error) cache.set(key, out)
  return out
}

export const stickerService = {
  async getCategories() {
    return CATEGORIES
  },

  async getStickersByCategory(category) {
    const c = CATEGORIES.find((x) => x.id === category) || CATEGORIES[0]
    const bundled = (await local()).filter((s) => s.category === c.id)
    if (bundled.length) return { stickers: bundled }
    return remote(`cat:${c.id}`, c.query ? 'search' : 'trending', c.query ? { q: c.query } : {})
  },

  async searchStickers(query) {
    const q = query.trim().toLowerCase()
    if (!q) return this.getStickersByCategory('trending')
    const hits = (await local()).filter((s) => matches(s, q))
    if (hits.length) return { stickers: hits }
    return remote(`q:${q}`, 'search', { q }) // nothing bundled: try live GIPHY
  },

  openOptions() {
    send({ type: 'options' })
  },
}
