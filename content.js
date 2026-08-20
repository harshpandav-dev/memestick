/**
 * MemeStick — a sticker picker attached to whatever text field you're using.
 *
 * Runs in every frame. All UI lives in a Shadow DOM so the host page's CSS and
 * ours can't touch each other.
 */
;(() => {
  if (window.__memestick) return // one picker per frame
  window.__memestick = true

  const PICKER_WIDTH = 360
  const PICKER_HEIGHT = 420

  const FIELD =
    'input[type="text"], input[type="search"], input:not([type]), textarea,' +
    '[contenteditable=""], [contenteditable="true"]'

  const CATEGORIES = [
    { id: 'trending', label: 'Trending', emoji: '🔥' },
    { id: 'meme', label: 'Meme', emoji: '🗿' },
    { id: 'funny', label: 'Funny', emoji: '😂' },
    { id: 'reactions', label: 'Reactions', emoji: '🤔' },
    { id: 'wtf', label: 'WTF', emoji: '💀' },
    { id: 'sad', label: 'Sad', emoji: '😭' },
    { id: 'angry', label: 'Angry', emoji: '😡' },
    { id: 'love', label: 'Love', emoji: '❤️' },
    { id: 'approval', label: 'Approval', emoji: '👍' },
    { id: 'disapproval', label: 'Disapproval', emoji: '👎' },
  ]

  const NOTICES = {
    nokey: 'Nothing bundled matches — add a GIPHY key to search live',
    badkey: 'That GIPHY key was rejected',
    offline: 'No local match, and GIPHY is unreachable',
    empty: 'No stickers found',
  }

  // ---------------------------------------------------------------- extension
  // A content script keeps running after its extension reloads, but every
  // chrome.* call from that orphaned frame throws "Extension context
  // invalidated". Route them through here so the stale UI removes itself once.

  const alive = () => Boolean(chrome.runtime?.id)

  function die() {
    host.remove()
    document.removeEventListener('focusin', grab, true)
    document.removeEventListener('mouseover', grab, true)
    document.removeEventListener('mouseout', drop, true)
  }

  function url(path) {
    if (!alive()) return die(), ''
    return chrome.runtime.getURL(path)
  }

  async function send(message) {
    if (!alive()) return die(), null
    try {
      return await chrome.runtime.sendMessage(message)
    } catch {
      die() // reloaded mid-flight
      return null
    }
  }

  // --------------------------------------------------------------------- data
  // The packs ship with the extension, so everything works offline. GIPHY is
  // only consulted when a search comes up empty here.

  let packs = null

  async function load() {
    if (!packs) {
      const res = await fetch(url('stickers.json')).catch(() => null)
      const data = res ? await res.json() : []
      packs = data.map((s) => ({
        ...s,
        imageUrl: url('stickers/' + s.file),
        gifUrl: s.gif ? url('stickers/' + s.gif) : null,
      }))
    }
    return packs
  }

  const matches = (sticker, q) =>
    sticker.name.includes(q) ||
    sticker.category.includes(q) ||
    sticker.tags.some((tag) => tag.startsWith(q))

  async function lookup(text, category) {
    const list = await load()
    const q = text.trim().toLowerCase()
    if (!q) return { stickers: list.filter((s) => s.category === category) }

    const hits = list.filter((s) => matches(s, q))
    if (hits.length) return { stickers: hits }

    const res = await send({ type: 'stickers', path: 'search', params: { q } })
    return res?.stickers?.length
      ? { stickers: res.stickers }
      : { stickers: [], error: res?.error || 'empty' }
  }

  // ----------------------------------------------------------------------- ui

  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647'
  const shadow = host.attachShadow({ mode: 'open' })
  shadow.innerHTML = `
    <style>${MEMESTICK_CSS}</style>
    <button class="ms-btn" type="button" aria-label="Open stickers">🙂</button>
    <div class="ms-picker" hidden data-shown="false">
      <div class="ms-search">
        <span>😍</span>
        <input type="text" placeholder="Search stickers" autocomplete="off">
        <button class="ms-clear" type="button" aria-label="Clear search" hidden>✕</button>
      </div>
      <div class="ms-cats" role="tablist"></div>
      <div class="ms-notice" hidden><span></span><button type="button">Set key</button></div>
      <div class="ms-scroll"><div class="ms-grid"></div></div>
      <p class="ms-foot">Shift-click to insert without sending · Powered by GIPHY</p>
    </div>
    <div class="ms-hint" hidden></div>`
  document.documentElement.append(host)

  const pick = (sel) => shadow.querySelector(sel)
  const button = pick('.ms-btn')
  const picker = pick('.ms-picker')
  const search = pick('.ms-search input')
  const clear = pick('.ms-clear')
  const cats = pick('.ms-cats')
  const notice = pick('.ms-notice')
  const scroll = pick('.ms-scroll')
  const grid = pick('.ms-grid')
  const hint = pick('.ms-hint')

  for (const c of CATEGORIES) {
    const tab = document.createElement('button')
    tab.className = 'ms-cat'
    tab.type = 'button'
    tab.dataset.id = c.id
    tab.setAttribute('role', 'tab')
    tab.setAttribute('aria-selected', String(c.id === 'trending'))
    tab.innerHTML = `<span>${c.emoji}</span>${c.label}`
    cats.append(tab)
  }

  // -------------------------------------------------------------------- state

  let target = null // the field we're decorating: { el, rect }
  let savedRange = null // caret inside it, for contenteditable
  let open = false
  let category = 'trending'
  let debounce
  let hintTimer
  let closeTimer

  const measure = (el) => {
    const { top, left, right, bottom, width, height } = el.getBoundingClientRect()
    return { top, left, right, bottom, width, height }
  }

  function setTarget(el) {
    if (target?.el === el) return
    target = el ? { el, rect: measure(el) } : null
    savedRange = null
    place()
  }

  function place() {
    if (!target) {
      button.style.display = 'none'
      return
    }
    const { rect } = target
    button.style.display = ''
    button.style.top = `${rect.top + rect.height / 2 - 11}px`
    button.style.left = `${rect.right - 28}px`

    picker.style.left = `${Math.min(Math.max(8, rect.right - PICKER_WIDTH), innerWidth - PICKER_WIDTH - 8)}px`
    if (rect.top > PICKER_HEIGHT + 16) {
      picker.style.top = 'auto'
      picker.style.bottom = `${innerHeight - rect.top + 8}px`
    } else {
      picker.style.bottom = 'auto'
      picker.style.top = `${rect.bottom + 8}px`
    }
  }

  function showHint(text) {
    if (!target) return
    hint.textContent = text
    hint.hidden = false
    hint.style.top = `${target.rect.top - 30}px`
    hint.style.left = `${Math.max(8, target.rect.right - 240)}px`
    clearTimeout(hintTimer)
    hintTimer = setTimeout(() => (hint.hidden = true), 4000)
  }

  // ------------------------------------------------------------------ picking

  async function render() {
    const wanted = search.value
    grid.replaceChildren()
    notice.hidden = true
    scroll.replaceChildren(message('Loading…'))

    const { stickers, error } = await lookup(wanted, category)
    if (wanted !== search.value) return // a newer keystroke already won

    if (error) {
      notice.firstElementChild.textContent = NOTICES[error] || `GIPHY error: ${error}`
      notice.lastElementChild.hidden = !(error === 'nokey' || error === 'badkey')
      notice.hidden = false
    }

    if (!stickers.length) {
      scroll.replaceChildren(message('No stickers found'))
      return
    }

    grid.replaceChildren(...stickers.map(card))
    scroll.replaceChildren(grid)
    scroll.scrollTop = 0
  }

  function message(text) {
    const p = document.createElement('p')
    p.className = 'ms-message'
    p.textContent = text
    return p
  }

  function card(sticker) {
    const el = document.createElement('button')
    el.className = 'ms-card'
    el.type = 'button'
    el.title = sticker.name

    const img = document.createElement('img')
    img.src = sticker.imageUrl
    img.alt = sticker.name
    img.width = sticker.width
    img.height = sticker.height
    img.loading = 'lazy'
    img.decoding = 'async'
    el.append(img)

    // Still in the grid, animated on hover.
    if (sticker.gifUrl) {
      el.addEventListener('mouseenter', () => (img.src = sticker.gifUrl))
      el.addEventListener('mouseleave', () => (img.src = sticker.imageUrl))
    }
    el.addEventListener('mousedown', (e) => e.preventDefault()) // keep field focus
    el.addEventListener('click', async (e) => {
      const field = target?.el // grab before close(), which can drop the target
      const range = savedRange
      close()
      if (!field) return
      const problem = await MEMESTICK_INSERT(field, range, sticker, !e.shiftKey)
      if (problem) showHint(problem)
    })
    return el
  }

  function show() {
    open = true
    clearTimeout(closeTimer) // reopening inside the 150ms fade would re-hide us
    button.dataset.active = 'true'
    picker.hidden = false
    requestAnimationFrame(() => (picker.dataset.shown = 'true'))
    search.focus()
    render()
  }

  function close() {
    if (!open) return
    open = false
    button.dataset.active = 'false'
    picker.dataset.shown = 'false'
    closeTimer = setTimeout(() => (picker.hidden = true), 150)
  }

  // -------------------------------------------------------------- ui wiring

  button.addEventListener('mousedown', (e) => e.preventDefault())
  button.addEventListener('click', () => (open ? close() : show()))

  search.addEventListener('input', () => {
    clear.hidden = !search.value
    clearTimeout(debounce)
    debounce = setTimeout(render, search.value.trim() ? 250 : 0)
  })
  clear.addEventListener('click', () => {
    search.value = ''
    clear.hidden = true
    render()
  })

  cats.addEventListener('click', (e) => {
    const tab = e.target.closest('.ms-cat')
    if (!tab) return
    category = tab.dataset.id
    for (const other of cats.children) {
      other.setAttribute('aria-selected', String(other === tab))
    }
    render()
  })

  notice.lastElementChild.addEventListener('click', () => send({ type: 'options' }))

  window.addEventListener(
    'mousedown',
    (e) => {
      if (open && !e.composedPath().includes(host)) close()
    },
    true
  )
  window.addEventListener('keydown', (e) => open && e.key === 'Escape' && close(), true)

  // ---------------------------------------------------------- field tracking
  // Event delegation instead of a MutationObserver: dynamically created fields
  // and SPA navigation come free, and a field nobody has touched needs no
  // button.

  const editable = (el) =>
    el instanceof HTMLElement && el.matches(FIELD) && !el.disabled && !el.readOnly

  function grab(e) {
    if (open) return // frozen while the picker is up, so it can't lose the field
    const path = e.composedPath()
    if (path.includes(host)) return // our own search box is a text field too
    const el = path.find(editable)
    if (!el || el.getBoundingClientRect().width < 60) return
    setTarget(el)
  }

  function drop(e) {
    if (open || !target) return
    const gone =
      e.relatedTarget !== host &&
      !target.el.contains(e.relatedTarget) &&
      document.activeElement !== target.el
    if (gone) setTarget(null)
  }

  function sync() {
    if (!target) return
    if (!target.el.isConnected) return setTarget(null)
    target.rect = measure(target.el)
    place()
  }

  document.addEventListener('focusin', grab, true)
  document.addEventListener('mouseover', grab, true)
  document.addEventListener('mouseout', drop, true)
  window.addEventListener('scroll', sync, true)
  window.addEventListener('resize', sync)
  document.addEventListener('selectionchange', () => {
    if (!target?.el.isContentEditable) return
    const sel = document.getSelection()
    if (!sel?.rangeCount) return
    const range = sel.getRangeAt(0)
    if (target.el.contains(range.commonAncestorContainer)) savedRange = range.cloneRange()
  })

  place()
})()
