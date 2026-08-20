const DEBUG = true // flip to false to silence the console breadcrumbs

export const log = (...args) => DEBUG && console.log('[MemeStick]', ...args)

export const describe = (el) =>
  el
    ? `<${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} ce=${el.isContentEditable} tid=${el.getAttribute?.('data-tid')}>`
    : String(el)
