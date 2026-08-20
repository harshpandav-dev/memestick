"""Downloads GIPHY sticker packs into public/stickers/ + src/stickers.json,
so the extension works with no network and no key at runtime.

  GIPHY_KEY=xxxx python3 scripts/fetch_packs.py [per_category]

Re-run to refresh the packs. GIPHY's terms want attribution wherever these are
shown; keep the "Powered by GIPHY" line in the picker.
"""
import io, json, os, re, sys, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

KEY = os.environ.get("GIPHY_KEY") or (len(sys.argv) > 2 and sys.argv[2])
PER = int(sys.argv[1]) if len(sys.argv) > 1 else 100
SIZE = 200
ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "public", "stickers")

# Must stay in sync with CATEGORIES in src/stickerService.js.
CATEGORIES = {
    "trending": None,
    "meme": "meme",
    "funny": "funny meme",
    "reactions": "reaction meme",
    "wtf": "wtf meme",
    "sad": "sad meme",
    "angry": "angry meme",
    "love": "love meme",
    "approval": "thumbs up meme",
    "disapproval": "nope meme",
}
STILL = ("fixed_width_still", "fixed_height_still", "original_still")  # 480w_still is jpg: no alpha
ANIM = ("fixed_width_downsampled", "fixed_width", "original")  # animated, smallest first
NOISE = re.compile(r"\b(sticker|gif|animated)\b.*$|\bby\b.*$", re.I)


def api(path, **params):
    params.update(api_key=KEY, rating="pg-13")
    url = f"https://api.giphy.com/v1/stickers/{path}?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)["data"]


def collect(query):
    out, offset = [], 0
    while len(out) < PER:
        batch = (
            api("trending", limit=50, offset=offset)
            if query is None
            else api("search", q=query, limit=50, offset=offset)
        )
        if not batch:
            break
        out += batch
        offset += 50
    return out[:PER]


def pick(gif, keys):
    return next((gif["images"][k]["url"] for k in keys if gif["images"].get(k, {}).get("url")), None)


def download(url, path):
    if os.path.exists(path):
        return True
    with urllib.request.urlopen(url, timeout=30) as r:
        data = r.read()
    with open(path, "wb") as f:
        f.write(data)
    return True


def grab(gif, category):
    src = pick(gif, STILL)
    if not src:
        return None
    path = os.path.join(OUT, f"{gif['id']}.png")
    try:
        if not os.path.exists(path):
            with urllib.request.urlopen(src, timeout=30) as r:
                img = Image.open(io.BytesIO(r.read())).convert("RGBA")
            img.thumbnail((SIZE, SIZE), Image.LANCZOS)
            img.save(path, optimize=True)
        w, h = Image.open(path).size
        anim = pick(gif, ANIM)
        if anim:
            download(anim, os.path.join(OUT, f"{gif['id']}.gif"))
    except Exception as e:
        print(f"  skip {gif['id']}: {e}")
        return None

    name = NOISE.sub("", gif.get("title") or "").strip().lower() or category
    tags = sorted({w for w in re.split(r"[^a-z0-9]+", name) if len(w) > 2} | {category})
    return {"id": gif["id"], "file": f"{gif['id']}.png",
            "gif": f"{gif['id']}.gif" if anim else None, "name": name,
            "tags": tags, "category": category, "width": w, "height": h}


if not KEY:
    sys.exit("set GIPHY_KEY")
os.makedirs(OUT, exist_ok=True)

stickers, seen = [], set()
for category, query in CATEGORIES.items():
    gifs = [g for g in collect(query) if g["id"] not in seen]
    seen.update(g["id"] for g in gifs)
    with ThreadPoolExecutor(16) as pool:
        got = [s for s in pool.map(lambda g: grab(g, category), gifs) if s]
    stickers += got
    print(f"{category:14} {len(got)}")

with open(os.path.join(ROOT, "stickers.json"), "w") as f:
    json.dump(stickers, f, indent=1)
print(f"total {len(stickers)}")
