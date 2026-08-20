/** Does this sticker answer `query`? Kept pure so scripts/check.mjs can run it. */
export function matches(sticker, query) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    sticker.name.includes(q) ||
    sticker.category.includes(q) ||
    sticker.tags.some((t) => t.startsWith(q))
  )
}
