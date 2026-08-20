// All sticker network calls live here: content scripts inherit the page's CORS
// rules, the service worker doesn't.
const API = 'https://api.giphy.com/v1/stickers'
const KEY = 'giphyKey'
// Shared demo key with a LIMITED QUOTA — everyone running this build hits the
// same rate limit, and it is readable by anyone with the extension folder.
// Live search only; the 941 bundled stickers never touch it. Get your own free
// key at https://developers.giphy.com/dashboard/ and paste it into the options
// page (that value wins over this one).
const DEFAULT_KEY = 'pYUTlvaz4h72pgggYQhkvh8thxEQkdz0'

// Stickers only, still frames only — no animation, transparency preserved.
const still = (g) =>
  g.images.fixed_width_still || g.images['480w_still'] || g.images.original_still

const normalize = (g) => {
  const img = still(g)
  return img?.url
    ? {
        id: g.id,
        imageUrl: img.url,
        gifUrl: (g.images.fixed_width_downsampled || g.images.fixed_width)?.url || null,
        name: (g.title || '').replace(/\bsticker\b/gi, '').trim() || 'sticker',
        tags: [],
        category: '',
        width: Number(img.width) || 200,
        height: Number(img.height) || 200,
      }
    : null
}

async function giphy(path, params) {
  const { [KEY]: stored } = await chrome.storage.sync.get(KEY)
  const key = stored || DEFAULT_KEY
  if (!key) return { error: 'nokey' }

  const url = new URL(`${API}/${path}`)
  url.search = new URLSearchParams({ api_key: key, limit: '50', rating: 'pg-13', ...params })
  try {
    const res = await fetch(url)
    if (!res.ok) return { error: res.status === 401 || res.status === 403 ? 'badkey' : `http ${res.status}` }
    const { data } = await res.json()
    return { stickers: data.map(normalize).filter(Boolean) }
  } catch (e) {
    return { error: 'offline' }
  }
}

// Content scripts lost cross-origin fetch in MV3, so image bytes come back
// from here as a data URL for clipboard/paste insertion.
async function imageData(url) {
  try {
    const res = await fetch(url)
    console.log('[MemeStick sw]', res.status, res.headers.get('content-type'), url)
    const type = res.headers.get('content-type') || 'image/png'
    const bytes = new Uint8Array(await res.arrayBuffer())
    let bin = ''
    for (const b of bytes) bin += String.fromCharCode(b)
    return { dataUrl: `data:${type};base64,${btoa(bin)}` }
  } catch (e) {
    console.log('[MemeStick sw] image fetch threw', url, e)
    return { error: 'fetch failed' }
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'image') {
    imageData(msg.url).then(sendResponse)
    return true
  }
  if (msg?.type === 'stickers') {
    giphy(msg.path, msg.params).then(sendResponse)
    return true // async response
  }
  if (msg?.type === 'options') chrome.runtime.openOptionsPage()
  return false
})
