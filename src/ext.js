// A content script keeps running after its extension is reloaded or updated,
// but every chrome.* call from that orphaned frame throws "Extension context
// invalidated". Route them all through here so the stale UI removes itself
// once instead of throwing on every interaction.
let onDead = () => {}
export const setDeadHandler = (fn) => {
  onDead = fn
}

const alive = () => Boolean(chrome.runtime?.id)

export function url(path) {
  if (!alive()) {
    onDead()
    return ''
  }
  return chrome.runtime.getURL(path)
}

export async function send(message) {
  if (!alive()) {
    onDead()
    return null
  }
  try {
    return await chrome.runtime.sendMessage(message)
  } catch {
    onDead() // reloaded mid-flight
    return null
  }
}
