/**
 * Styles for the picker. Lives in a template literal rather than a .css file
 * because our UI is inside a Shadow DOM: a stylesheet declared in the manifest
 * is injected into the page, which the shadow root can't see.
 */
var MEMESTICK_CSS = `
  :host, * { box-sizing: border-box; }
  button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }

  .ms-btn {
    position: fixed;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    font-size: 13px;
    line-height: 1;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(23, 23, 23, 0.82);
    backdrop-filter: blur(4px);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    opacity: 0.7;
    transition: transform 0.12s, opacity 0.12s, background 0.12s;
  }
  .ms-btn:hover { opacity: 1; transform: scale(1.1); background: #262626; }
  .ms-btn[data-active='true'] { opacity: 1; transform: scale(1.1); box-shadow: 0 0 0 1px #818cf8; }

  .ms-picker {
    position: fixed;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(360px, calc(100vw - 16px));
    max-height: 420px;
    padding: 10px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: #171717;
    color: #f5f5f5;
    font-family: system-ui, -apple-system, Segoe UI, sans-serif;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
    overflow: hidden;
    container-type: inline-size; /* the grid's column count keys off this */
    transition: opacity 0.15s ease-out, transform 0.15s ease-out;
  }
  .ms-picker[hidden] { display: none; }
  .ms-picker[data-shown='false'] { opacity: 0; transform: translateY(4px) scale(0.96); }

  .ms-search {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 12px;
    background: rgba(38, 38, 38, 0.8);
  }
  .ms-search input {
    width: 100%;
    font-size: 13px;
    color: #f5f5f5;
    background: none;
    border: 0;
    outline: none;
  }
  .ms-search input::placeholder { color: #737373; }
  .ms-clear { color: #737373; font-size: 12px; }
  .ms-clear:hover { color: #e5e5e5; }

  /* flex-shrink:0 is load-bearing here and on .ms-search: without it the grid
     grows to fit its content and squashes everything above it. */
  .ms-cats {
    display: flex;
    flex-shrink: 0;
    gap: 4px;
    padding-bottom: 8px;
    overflow-x: auto;
    scrollbar-width: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .ms-cats::-webkit-scrollbar { display: none; }
  .ms-cat {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    font-size: 11px;
    white-space: nowrap;
    border-radius: 999px;
    background: #262626;
    color: #d4d4d4;
    transition: background 0.12s;
  }
  .ms-cat:hover { background: #404040; }
  .ms-cat[aria-selected='true'] { background: #6366f1; color: #fff; }

  .ms-scroll {
    flex: 1;
    min-height: 0; /* or this flex child refuses to scroll and grows instead */
    overflow-y: auto;
    margin-right: -6px;
    padding-right: 6px;
    scrollbar-width: thin;
    scrollbar-color: #404040 transparent;
  }
  .ms-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
    padding-bottom: 4px;
  }
  @container (min-width: 320px) {
    .ms-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  }
  .ms-card {
    aspect-ratio: 1;
    padding: 4px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
    transition: transform 0.12s, background 0.12s;
  }
  .ms-card:hover { transform: scale(1.05); background: rgba(255, 255, 255, 0.1); }
  .ms-card img { width: 100%; height: 100%; object-fit: contain; }

  .ms-message { padding: 40px 0; text-align: center; font-size: 12px; color: #737373; }
  .ms-notice {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 11px;
    color: #fcd34d;
    background: rgba(245, 158, 11, 0.1);
  }
  .ms-notice[hidden] { display: none; }
  .ms-notice button { padding: 2px 8px; border-radius: 6px; font-weight: 500; background: rgba(251, 191, 36, 0.2); }

  .ms-foot {
    flex-shrink: 0;
    padding-top: 6px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    text-align: center;
    font-size: 9px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #525252;
  }

  .ms-hint {
    position: fixed;
    padding: 4px 10px;
    border-radius: 8px;
    font-family: system-ui, sans-serif;
    font-size: 11px;
    color: #f5f5f5;
    background: #171717;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  }
  .ms-hint[hidden] { display: none; }
`
