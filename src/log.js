// Off by default. Turn on from the page console — no rebuild needed:
//   localStorage.memestick = 'debug'    (then reload the tab)
const DEBUG = (() => {
  try {
    return localStorage.memestick === 'debug'
  } catch {
    return false // sandboxed iframes throw on localStorage access
  }
})()

export const log = (...args) => DEBUG && console.log('[MemeStick]', ...args)

export const describe = (el) =>
  el
    ? `<${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} ce=${el.isContentEditable} tid=${el.getAttribute?.('data-tid')}>`
    : String(el)
