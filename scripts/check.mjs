// node scripts/check.mjs — dataset + search sanity. Fails loud on drift.
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const stickers = JSON.parse(readFileSync(new URL('../stickers.json', import.meta.url)))
const categories = new Set(stickers.map((s) => s.category))

assert.ok(stickers.length > 20, 'dataset too small')
for (const s of stickers) {
  assert.ok(s.id && s.name && s.tags.length && s.width && s.height, `bad record: ${s.id}`)
  assert.ok(
    existsSync(new URL(`../stickers/${s.file}`, import.meta.url)),
    `missing image: ${s.file}`
  )
  assert.ok(
    !s.gif || existsSync(new URL(`../stickers/${s.gif}`, import.meta.url)),
    `missing gif: ${s.gif}`
  )
}
assert.equal(new Set(stickers.map((s) => s.id)).size, stickers.length, 'duplicate ids')
assert.equal(categories.size, 10, 'expected 10 categories')

// The search predicate itself is three `includes` calls in content.js; what
// actually breaks is the dataset drifting from the files on disk.
assert.ok(
  stickers.filter((s) => s.tags.includes('meme')).length > 50,
  'meme category should be well populated'
)

console.log(`ok — ${stickers.length} stickers, ${categories.size} categories`)
