import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import css from './style.css?inline'
import { setDeadHandler } from './ext'
import { log } from './log'
import { useInputDetector } from './hooks/useInputDetector'
import { insertSticker } from './insert'
import { StickerButton } from './components/StickerButton'
import { StickerPicker } from './components/StickerPicker'

function App() {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [hint, setHint] = useState('')
  const rectRef = useRef(null)
  const target = useInputDetector(open, host)
  const rootRef = useRef(null)

  const close = () => {
    setClosing(true)
    setTimeout(() => {
      setOpen(false)
      setClosing(false)
    }, 150)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!e.composedPath().includes(rootRef.current)) close()
    }
    const onKey = (e) => e.key === 'Escape' && close()
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  if (target) rectRef.current = target.rect
  const rect = rectRef.current
  if (!target && !hint) return null

  return (
    <div ref={rootRef}>
      {target && (
        <StickerButton rect={target.rect} active={open} onClick={() => setOpen(true)} />
      )}
      {hint && rect && (
        <div
          style={{ top: rect.top - 30, left: Math.max(8, rect.right - 240) }}
          className="fixed z-[2147483647] rounded-lg bg-neutral-900 px-2.5 py-1 text-[11px]
            text-neutral-100 shadow-lg [font-family:system-ui,sans-serif]"
        >
          {hint}
        </div>
      )}
      {target && open && (
        <StickerPicker
          rect={target.rect}
          closing={closing}
          onPick={async (sticker, send) => {
            close()
            log('PICK', sticker.id, sticker.gifUrl || sticker.imageUrl, 'send:', send)
            const message = await insertSticker(target, sticker, send)
            log('RESULT:', message || 'ok')
            if (!message) return
            setHint(message)
            setTimeout(() => setHint(''), 4000)
          }}
        />
      )}
    </div>
  )
}

// Shadow DOM so the host page's CSS and ours can't touch each other.
const host = document.createElement('div')
host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647'
const shadow = host.attachShadow({ mode: 'open' })
const style = document.createElement('style')
style.textContent = css
const mount = document.createElement('div')
shadow.append(style, mount)
document.documentElement.append(host)

log('loaded', chrome.runtime.getManifest?.().version, 'in', location.href)

const root = createRoot(mount)
root.render(<App />)

// Extension reloaded out from under this frame: take the stale UI down. The
// page keeps working; the button comes back on reload.
setDeadHandler(() => queueMicrotask(() => {
  root.unmount()
  host.remove()
}))
