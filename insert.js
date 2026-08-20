/**
 * Getting a sticker into a chat box.
 *
 * Teams, Slack, Discord, WhatsApp Web and X don't use plain contenteditable —
 * they run model-driven editors (CKEditor, Quill, Slate, Lexical, Draft) that
 * rebuild the DOM from their own state, so anything written straight into the
 * DOM is discarded on the next render. All of them do handle a pasted image
 * file, so that is the primary path here.
 *
 * Exposes MEMESTICK_INSERT(field, range, sticker, autoSend) -> Promise<hint>.
 * An empty hint means it worked.
 */
var MEMESTICK_INSERT = (() => {
  // Most specific first — a comma-joined selector would return document order
  // instead, and "Send a file" would win over "Send".
  const SEND_BUTTONS = [
    'button[data-tid="sendMessageCommands-send"]', // Teams
    'button[data-tid="newMessageCommands-send"]',
    'button[data-testid="send"]',
    'button[aria-label^="Send" i]',
    'button[title^="Send" i]',
    'button[aria-label*="Send" i]',
    'button[type="submit"]',
  ]

  // Bytes come from the service worker: MV3 content scripts lost cross-origin
  // fetch, and live GIPHY stickers are cross-origin.
  async function fileFrom(url, id) {
    let res
    try {
      res = await chrome.runtime.sendMessage({ type: 'image', url })
    } catch {
      return null
    }
    if (!res?.dataUrl) return null
    const blob = await (await fetch(res.dataUrl)).blob()
    const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
    return new File([blob], `${id}.${ext}`, { type: blob.type })
  }

  /** The async clipboard API takes PNG and nothing else, so flatten frame one. */
  async function toPng(file) {
    if (file.type === 'image/png') return file
    const bitmap = await createImageBitmap(file)
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    canvas.getContext('2d').drawImage(bitmap, 0, 0)
    const png = await canvas.convertToBlob({ type: 'image/png' })
    return new File([png], file.name.replace(/\.\w+$/, '.png'), { type: 'image/png' })
  }

  /**
   * Synthetic paste. Editors that handle it call preventDefault; that's our
   * receipt.
   *
   * The file goes in ALONE. CKEditor's ImageUploadEditing bails out of
   * uploading pasted files the moment the clipboard also carries text/html
   * (`isHtmlIncluded()`), and a text/plain fallback just pastes the URL as
   * text — so both would defeat the upload we actually want.
   */
  function pasteInto(el, file) {
    const dt = new DataTransfer()
    dt.items.add(file)
    const event = new ClipboardEvent('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true,
      composed: true,
    })
    el.dispatchEvent(event)
    return event.defaultPrevented
  }

  function findSendButton(el) {
    const scope = el.closest('form, [role="form"]') || document
    for (const selector of SEND_BUTTONS) {
      const button = scope.querySelector(selector) || document.querySelector(selector)
      if (button) return button
    }
    return null
  }

  /**
   * Smallest ancestor holding both the editor and the Send button. Apps render
   * the pasted image as an attachment preview that often lives outside the
   * editable itself, so this is what we watch — not the editable.
   */
  function composeArea(el) {
    const button = findSendButton(el)
    let node = el
    for (let up = 0; up < 6 && node.parentElement; up++) {
      node = node.parentElement
      if (button && node.contains(button)) break
    }
    return node
  }

  // Relative count: the toolbar's own icons are in here too, we only care that
  // one more image appeared (landed) or disappeared (sent).
  const imageCount = (node) => node.querySelectorAll('img, canvas, video').length

  const isDisabled = (button) =>
    button.disabled || button.getAttribute('aria-disabled') === 'true'

  async function waitFor(condition, limit = 8000, step = 100) {
    for (let waited = 0; waited < limit; waited += step) {
      if (condition()) return true
      await new Promise((r) => setTimeout(r, step))
    }
    return condition()
  }

  /**
   * Chat apps attach a pasted image asynchronously (upload, preview render).
   * Wait for the compose area to stop changing before sending.
   * ponytail: quiescence heuristic, not an upload-complete signal — if some app
   * uploads silently for longer than `quiet`, watch its own progress element.
   */
  function waitSettled(node, quiet = 800, limit = 8000) {
    return new Promise((resolve) => {
      let idle
      const stop = () => {
        observer.disconnect()
        clearTimeout(idle)
        clearTimeout(hard)
        resolve()
      }
      const observer = new MutationObserver(() => {
        clearTimeout(idle)
        idle = setTimeout(stop, quiet)
      })
      observer.observe(node, { childList: true, subtree: true, characterData: true })
      idle = setTimeout(stop, quiet) // nothing ever changed
      const hard = setTimeout(stop, limit)
    })
  }

  /** Enter, the way every chat app listens for it. keyCode is dead but still read. */
  function pressEnter(el) {
    el.focus()
    for (const type of ['keydown', 'keypress', 'keyup']) {
      const event = new KeyboardEvent(type, {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
        cancelable: true,
        composed: true,
      })
      Object.defineProperty(event, 'keyCode', { get: () => 13 })
      Object.defineProperty(event, 'which', { get: () => 13 })
      el.dispatchEvent(event)
    }
  }

  /**
   * Send the sticker that already landed in the compose area. `before` is the
   * image count from before the paste: back down to it means the box emptied,
   * i.e. the message went out.
   */
  async function submit(el, area, before) {
    await waitSettled(area) // upload finishing, preview rendering
    const gone = () => imageCount(area) <= before

    const button = findSendButton(el)
    if (button && !isDisabled(button)) {
      button.click()
      if (await waitFor(gone, 3000)) return true
    }

    // No button (Discord), or the click didn't take.
    for (let attempt = 0; attempt < 2; attempt++) {
      pressEnter(el)
      if (await waitFor(gone, 2000)) return true
    }
    return false
  }

  function typeInto(el, text) {
    // React/Vue controlled fields ignore a plain `.value =`, hence the
    // prototype setter + bubbling input event.
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement
    const setValue = Object.getOwnPropertyDescriptor(proto.prototype, 'value').set
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? start
    setValue.call(el, el.value.slice(0, start) + text + el.value.slice(end))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.setSelectionRange(start + text.length, start + text.length)
  }

  return async function insert(el, range, sticker, autoSend = true) {
    if (!el.isConnected) return 'Lost the text field — try again'
    el.focus()

    if (!el.isContentEditable) {
      // input/textarea can't hold an image, so the URL goes in as text. Never
      // auto-send: Enter there submits forms and runs searches.
      typeInto(el, sticker.gifUrl || sticker.imageUrl)
      return ''
    }

    // Only restore a caret that still exists — CKEditor and friends replace the
    // whole subtree, and re-adding a detached range silently kills the paste.
    const sel = document.getSelection()
    sel.removeAllRanges()
    if (range?.startContainer.isConnected && el.contains(range.commonAncestorContainer)) {
      sel.addRange(range)
    } else {
      const end = document.createRange()
      end.selectNodeContents(el)
      end.collapse(false)
      sel.addRange(end)
    }

    let copied = false
    const src = sticker.gifUrl || sticker.imageUrl // animated where we have it
    const file = await fileFrom(src, sticker.id).catch(() => null)

    if (file) {
      const area = composeArea(el)
      const before = imageCount(area)
      // The app uploads and renders the preview asynchronously — checking the
      // DOM right after dispatch always looks empty.
      const landed = pasteInto(el, file) && (await waitFor(() => imageCount(area) > before))
      if (landed) {
        if (!autoSend) return ''
        return (await submit(el, area, before)) ? '' : 'Inserted — press Enter to send'
      }

      // Nothing claimed the paste — put it on the real clipboard as a backstop.
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': await toPng(file) })])
        copied = true
      } catch {}
    }

    el.focus()
    document.execCommand(
      'insertHTML',
      false,
      `<img src="${src}" alt="${sticker.name}" width="96" height="96">`
    )
    if (el.innerHTML.includes(src)) return '' // survived the editor's re-render
    return copied ? 'Copied — press Ctrl+V' : "This editor didn't accept the sticker"
  }
})()
