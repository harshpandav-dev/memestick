import { send } from './ext'
import { log, describe } from './log'

/**
 * Teams, Slack, Discord, WhatsApp Web and X don't use plain contenteditable —
 * they run model-driven editors (Fluent, Quill, Slate, Lexical, Draft) that
 * rebuild the DOM from their own state, so anything written straight into the
 * DOM is discarded. All of them do handle a real paste of an image file, so
 * that is the primary path here.
 */

// Bytes come from the service worker: MV3 content scripts lost cross-origin fetch.
async function fileFrom(url, id) {
  log('1. asking worker for', url)
  const res = await send({ type: 'image', url })
  if (!res?.dataUrl) {
    log('1. FAILED, worker said:', res)
    return null
  }
  const blob = await (await fetch(res.dataUrl)).blob()
  log('1. got', blob.type, blob.size, 'bytes')
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
 * Chat apps attach a pasted image asynchronously (upload, preview render).
 * Wait for the compose area to stop changing before hitting Enter.
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

/** The app's own Send button beats a synthetic Enter: it's a real user gesture. */
function findSendButton(el) {
  const scope = el.closest('form, [role="form"]') || document
  for (const selector of SEND_BUTTONS) {
    const button = scope.querySelector(selector) || document.querySelector(selector)
    if (button) return button
  }
  return null
}

const disabled = (button) =>
  button.disabled || button.getAttribute('aria-disabled') === 'true'

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

async function waitFor(condition, limit = 8000, step = 100) {
  for (let waited = 0; waited < limit; waited += step) {
    if (condition()) return true
    await new Promise((r) => setTimeout(r, step))
  }
  return condition()
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
  log('4. send button:', button ? button.outerHTML.slice(0, 120) : 'NOT FOUND')
  if (button && !disabled(button)) {
    button.click()
    const sent = await waitFor(gone, 3000)
    log('4. clicked, sent:', sent)
    if (sent) return true
  }

  // No button (Discord), or the click didn't take.
  for (let attempt = 0; attempt < 2; attempt++) {
    pressEnter(el)
    const sent = await waitFor(gone, 2000)
    log(`5. Enter #${attempt + 1}, sent:`, sent)
    if (sent) return true
  }
  return false
}

/**
 * Synthetic paste. Editors that handle it call preventDefault; that's our receipt.
 *
 * The file goes in ALONE. CKEditor's ImageUploadEditing bails out of uploading
 * pasted files the moment the clipboard also carries text/html
 * (`isHtmlIncluded()`), and a text/plain fallback just pastes the URL as text —
 * so both would defeat the upload we actually want.
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

function typeInto(el, text) {
  // React/Vue controlled fields ignore a plain `.value =`, hence the prototype
  // setter + bubbling input event.
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement
  const setValue = Object.getOwnPropertyDescriptor(proto.prototype, 'value').set
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? start
  setValue.call(el, el.value.slice(0, start) + text + el.value.slice(end))
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.setSelectionRange(start + text.length, start + text.length)
}

/**
 * Drops a sticker into the tracked field, and sends it when the editor took it.
 * Auto-send is skipped for plain input/textarea: Enter there submits forms and
 * runs searches, and the field only ever gets a URL anyway.
 * @returns {Promise<string>} user-facing hint, or '' when it just worked.
 */
export async function insertSticker({ el, rangeRef }, sticker, send = true) {
  if (!el.isConnected) {
    log('target vanished from the page', describe(el))
    return 'Lost the text field — try again'
  }
  log('0. target', describe(el), 'contentEditable:', el.isContentEditable)
  el.focus()

  if (el.isContentEditable) {
    // Only restore a caret that still exists — CKEditor and friends replace the
    // whole subtree, and re-adding a detached range silently kills the paste.
    const range = rangeRef.current
    const usable = range?.startContainer.isConnected && el.contains(range.commonAncestorContainer)
    log('0. saved caret usable:', Boolean(usable))
    const sel = document.getSelection()
    sel.removeAllRanges()
    if (usable) {
      sel.addRange(range)
    } else {
      // No caret to restore: put one at the end of the editor. The clipboard
      // pipeline needs a selection inside the editable or it drops the paste.
      const end = document.createRange()
      end.selectNodeContents(el)
      end.collapse(false)
      sel.addRange(end)
    }

    let copied = false
    const src = sticker.gifUrl || sticker.imageUrl // animated where we have it
    const file = await fileFrom(src, sticker.id).catch((e) => log('1. threw', e))
    if (file) {
      const area = composeArea(el)
      const before = imageCount(area)
      const pasted = pasteInto(el, file)
      log('2. paste accepted:', pasted, '| watching', describe(area), 'images:', before)
      // The app uploads and renders the preview asynchronously — checking the
      // DOM right after dispatch always looks empty.
      const landed = pasted && (await waitFor(() => imageCount(area) > before, 8000))
      log('3. landed in compose:', landed, '| images now:', imageCount(area))
      if (landed) {
        if (!send) return ''
        return (await submit(el, area, before)) ? '' : 'Inserted — press Enter to send'
      }
      // Nothing claimed the paste — put it on the real clipboard as a backstop.
      try {
        const png = await toPng(file)
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
        copied = true
      } catch {}
    }

    log('3. clipboard fallback, copied:', copied)
    el.focus()
    document.execCommand(
      'insertHTML',
      false,
      `<img src="${src}" alt="${sticker.name}" width="96" height="96">`
    )
    log('3. after execCommand, box:', el.innerHTML.slice(0, 200))
    if (el.innerHTML.includes(src)) return '' // survived the editor's re-render
    return copied ? 'Copied — press Ctrl+V' : "This editor didn't accept the sticker"
  }

  // input/textarea can't hold an image, so the URL goes in as text.
  typeInto(el, sticker.gifUrl || sticker.imageUrl)
  return ''
}
