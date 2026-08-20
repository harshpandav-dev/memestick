import { useEffect, useRef, useState } from 'react'

const SELECTOR =
  'input[type="text"], input[type="search"], input:not([type]), textarea, [contenteditable=""], [contenteditable="true"]'

const editable = (el) =>
  el instanceof HTMLElement && el.matches(SELECTOR) && !el.disabled && !el.readOnly

const measure = (el) => {
  const { top, left, right, bottom, width, height } = el.getBoundingClientRect()
  return { top, left, right, bottom, width, height }
}

/**
 * The active text field, tracked by event delegation on the document — which
 * covers dynamically added fields and SPA navigation for free (no
 * MutationObserver: a field nobody has focused or hovered needs no button).
 * While `locked` (picker open) the target is frozen, so opening the picker
 * cannot lose it.
 */
export function useInputDetector(locked, host) {
  const [target, setTarget] = useState(null) // { el, rect }
  const rangeRef = useRef(null) // last caret inside a contenteditable target

  useEffect(() => {
    if (locked) return

    const grab = (e) => {
      const path = e.composedPath()
      // Our own picker is full of text fields; never target one of them. The
      // search box autofocuses during React's commit, which fires focusin
      // before `locked` has torn these listeners down.
      if (host && path.includes(host)) return
      const el = path.find(editable)
      if (!el || el.getBoundingClientRect().width < 60) return
      setTarget((prev) => (prev?.el === el ? prev : { el, rect: measure(el) }))
    }
    const drop = (e) =>
      setTarget((prev) =>
        prev &&
        e.relatedTarget !== host && // moving onto our own button doesn't count
        !prev.el.contains(e.relatedTarget) &&
        document.activeElement !== prev.el
          ? null
          : prev
      )

    document.addEventListener('focusin', grab, true)
    document.addEventListener('mouseover', grab, true)
    document.addEventListener('mouseout', drop, true)
    return () => {
      document.removeEventListener('focusin', grab, true)
      document.removeEventListener('mouseover', grab, true)
      document.removeEventListener('mouseout', drop, true)
    }
  }, [locked, host])

  // Keep the button glued to the field, and remember the caret so insertion
  // lands where the user was typing.
  useEffect(() => {
    if (!target) return
    rangeRef.current = null
    const sync = () =>
      setTarget((p) => (!p ? p : p.el.isConnected ? { ...p, rect: measure(p.el) } : null))
    const saveRange = () => {
      const sel = document.getSelection()
      if (!sel?.rangeCount) return
      const range = sel.getRangeAt(0)
      if (target.el.contains(range.commonAncestorContainer)) rangeRef.current = range.cloneRange()
    }
    document.addEventListener('selectionchange', saveRange)
    window.addEventListener('scroll', sync, true)
    window.addEventListener('resize', sync)
    return () => {
      document.removeEventListener('selectionchange', saveRange)
      window.removeEventListener('scroll', sync, true)
      window.removeEventListener('resize', sync)
    }
  }, [target?.el])

  return target && { ...target, rangeRef }
}
