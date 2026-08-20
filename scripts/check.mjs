// node scripts/check.mjs — dataset + search sanity. Fails loud on drift.
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { matches } from '../src/match.js'

const stickers = JSON.parse(readFileSync(new URL('../public/stickers.json', import.meta.url)))
const categories = new Set(stickers.map((s) => s.category))

assert.ok(stickers.length > 20, 'dataset too small')
for (const s of stickers) {
  assert.ok(s.id && s.name && s.tags.length && s.width && s.height, `bad record: ${s.id}`)
  assert.ok(
    existsSync(new URL(`../public/stickers/${s.file}`, import.meta.url)),
    `missing image: ${s.file}`
  )
  assert.ok(
    !s.gif || existsSync(new URL(`../public/stickers/${s.gif}`, import.meta.url)),
    `missing gif: ${s.gif}`
  )
}
assert.equal(new Set(stickers.map((s) => s.id)).size, stickers.length, 'duplicate ids')
assert.equal(categories.size, 10, 'expected 10 categories')

const find = (q) => stickers.filter((s) => matches(s, q)).map((s) => s.id)
assert.ok(find('meme').length > 50, 'category search')
assert.ok(find('lol').length > 0, 'tag search')
assert.equal(find('zzzqqq').length, 0, 'no false hits')
assert.equal(find('  ').length, stickers.length, 'blank query = everything')

console.log(`ok — ${stickers.length} stickers, ${categories.size} categories`)
