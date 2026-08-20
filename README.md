# MemeStick

**A Chrome extension that puts a meme sticker picker in every text box —
built for Microsoft Teams.**

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4)
![No build step](https://img.shields.io/badge/build-none-22C55E)
![Dependencies](https://img.shields.io/badge/dependencies-0-22C55E)
![Offline](https://img.shields.io/badge/941%20stickers-offline-22C55E)
![License](https://img.shields.io/badge/license-MIT-black)

Teams gives you emoji and GIFs. MemeStick gives you a proper meme sticker
drawer, in the same compose box, one click away — and it works in Slack,
Discord, WhatsApp Web, Gmail, X and Reddit too.

- 🖼️ **941 stickers bundled** — no network, no account, no key needed
- 🔎 Search + 10 categories, animated preview on hover
- ⚡ **One click sends it** — no copy, no paste, no upload dialog
- 🧩 Manifest V3, Shadow DOM, **no build step and no dependencies** — plain JS

---

## Install

No store listing yet, and nothing to compile:

```bash
git clone https://github.com/harshxterabits/memestick.git
```

Then in Chrome / Edge / Brave:

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Pick the **`memestick` folder** you just cloned

That's it — no npm, no build, no configuration. Edit a file, hit the reload
icon on the extension card, reload your tab.

---

## How to use

### In Microsoft Teams

1. Open a chat at [teams.live.com](https://teams.live.com) or
   `teams.microsoft.com`
2. Click into the **"Type a message"** box
3. A small 🙂 button appears at the right edge of the box
4. Click it — the picker opens
5. Pick a category or type in the search bar
6. **Click a sticker → it uploads and sends immediately**
7. **Shift-click a sticker → it drops into the box without sending**, so you can
   add text first

> Teams renders its compose box inside an iframe, and its editor (CKEditor 5)
> throws away anything written straight into the DOM. MemeStick works around
> both — see [How it works](#how-it-works).

### Everywhere else

Same flow. The button shows up on any focused or hovered text field:

| App | Sticker lands as | Auto-send |
|---|---|---|
| Microsoft Teams | uploaded image | ✅ Send button |
| Slack, WhatsApp Web | uploaded image | ✅ Send button |
| Discord | uploaded image | ✅ Enter |
| Gmail, Outlook web | inline `<img>` | ➖ you press Send |
| Plain `<input>` / `<textarea>` | sticker URL as text | ➖ never (Enter would submit the form) |

If an editor refuses the sticker, MemeStick copies it to your clipboard and
tells you to press <kbd>Ctrl</kbd>+<kbd>V</kbd> instead of failing silently.

---

## Sticker packs

941 stickers across 10 categories ship inside the extension — a still PNG for
the grid plus the animated GIF beside it (~54 MB in `public/stickers/`).
Nothing is fetched at runtime, so the picker is instant and works offline.

`🔥 Trending` `🗿 Meme` `😂 Funny` `🤔 Reactions` `💀 WTF` `😭 Sad` `😡 Angry`
`❤️ Love` `👍 Approval` `👎 Disapproval`

### Refreshing or resizing the packs

Needs Python 3 with Pillow:

```bash
GIPHY_KEY=your_key python3 scripts/fetch_packs.py 100   # 100 per category; resumable
```

It downloads the still + animated rendition for each sticker, converts stills
to transparent PNG, and rewrites `public/stickers.json`.

### Your own GIPHY key (optional)

A **shared demo key with a limited quota** is hardcoded in
`public/background.js`. Everyone running this build shares its rate limit, and
anyone with the extension folder can read it.

It is only used for **live search** — when your query matches none of the 941
bundled stickers. The bundled packs never touch it.

To use your own: grab a free key at
[developers.giphy.com](https://developers.giphy.com/dashboard/) (create an app →
choose **API**, not SDK), then open `chrome://extensions` → MemeStick →
**Extension options** and paste it. Your key overrides the built-in one.

---

## How it works

The interesting parts, because none of this is obvious:

**Finding text fields.** Event delegation (`focusin` / `mouseover`) on the
document instead of a `MutationObserver`. Dynamically created fields and SPA
navigation come free — a field nobody has focused or hovered needs no button.

**Not breaking the host page.** The button and picker render into a Shadow DOM
root, with `styles.js` injected inside it. Page CSS can't reach in; our CSS
can't leak out.

**Getting the sticker into the editor.** Teams, Slack, Discord, WhatsApp Web and
X all run model-driven editors (CKEditor, Quill, Slate, Lexical, Draft) that
rebuild the DOM from their own state — a DOM-inserted `<img>` is discarded on
the next render. They *do* all handle a pasted image file, so MemeStick
dispatches a synthetic `paste` carrying the sticker as a `File`.

The file goes in **alone**. CKEditor's `ImageUploadEditing` skips uploading
pasted files the moment the clipboard also carries `text/html`
(`isHtmlIncluded()`), and a `text/plain` fallback just pastes the URL as text.
Adding those "helpful" extras is what silently defeats the upload.

**Sending.** MemeStick waits for the image to actually appear in the compose
area, then clicks the app's own Send button (a real user gesture beats a
synthetic <kbd>Enter</kbd>), falling back to a synthetic <kbd>Enter</kbd> where
there's no button. Success is verified by the image leaving the compose area.

**Surviving MV3.** Every `chrome.*` call goes through a guard in `content.js`.
When the extension reloads under an open tab, the orphaned content script
removes its own UI instead of throwing `Extension context invalidated` on every
hover.

---

## Project structure

```
manifest.json      MV3 manifest
styles.js          the picker's CSS (a template literal — a manifest-declared
                   stylesheet lands in the page, which our Shadow DOM can't see)
insert.js          paste → upload → send pipeline
content.js         field tracking + the picker UI
background.js      service worker: all network calls + the GIPHY key
options.html/.js   paste your own GIPHY key
icons/             toolbar and store icons
stickers.json      the pack index, fetched on first open
stickers/          941 PNG + 941 GIF
scripts/
  fetch_packs.py   download/refresh the packs
  gen_icons.py     regenerate the extension icons
  check.mjs        dataset sanity check
```

The three content scripts load in that order and share one isolated world, so
`styles.js` and `insert.js` just define globals that `content.js` uses.

```bash
node scripts/check.mjs    # every record has its files, ids are unique
```

---

## Known limits

- `<input>` and `<textarea>` cannot hold an image, so they get the sticker URL
  as text.
- Sites with a strict `img-src` CSP may block live-search thumbnails. Bundled
  stickers are unaffected.
- Auto-send is best-effort: an app that checks `event.isTrusted` will ignore the
  synthetic <kbd>Enter</kbd> fallback. You'll get an
  "Inserted — press Enter to send" hint rather than a silent no-op.

## Troubleshooting

**`Extension context invalidated`** — you reloaded the extension while a tab was
open. Reload the tab.

**Nothing happens when I click a sticker** — check the page console and the
service worker console (`chrome://extensions` → MemeStick → **service
worker**) for errors. The insertion path is `insert.js`: paste the file →
wait for it to appear in the compose area → click the app's Send button.

## Contributing

Issues and PRs welcome. Adding support for another chat app usually means one
entry in `SEND_BUTTONS` in `insert.js` — please include the button's
`outerHTML` in the PR.

## License

[MIT](LICENSE).

Stickers are served by **GIPHY** and remain subject to
[GIPHY's terms](https://support.giphy.com/hc/en-us/articles/360020027752-GIPHY-User-Terms-of-Service);
the "Powered by GIPHY" attribution in the picker is required, please keep it.
This project is not affiliated with GIPHY or Microsoft.
