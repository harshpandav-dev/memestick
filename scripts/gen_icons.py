"""Generates the extension icons. Run: python3 scripts/gen_icons.py"""
import os
from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"
OUT = os.path.join(os.path.dirname(__file__), "..", "icons")
SIZES = (16, 32, 48, 128)
BASE = 512

card = Image.new("RGBA", (BASE, BASE), (0, 0, 0, 0))
draw = ImageDraw.Draw(card)

# Indigo → violet rounded square, painted as a vertical gradient then masked.
gradient = Image.new("RGBA", (1, BASE))  # one column, stretched sideways
for y in range(BASE):
    t = y / (BASE - 1)
    gradient.putpixel((0, y), (round(99 + 40 * t), round(102 - 30 * t), round(241 - 8 * t), 255))
gradient = gradient.resize((BASE, BASE))
mask = Image.new("L", (BASE, BASE), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, BASE - 1, BASE - 1), radius=112, fill=255)
card.paste(gradient, (0, 0), mask)

# Sticker face, drawn big then downscaled so the emoji bitmap stays crisp.
face = Image.new("RGBA", (136, 128), (0, 0, 0, 0))
ImageDraw.Draw(face).text(
    (68, 64), "😂", font=ImageFont.truetype(FONT, 109), anchor="mm", embedded_color=True
)
face = face.resize((330, 310), Image.LANCZOS)
card.alpha_composite(face, (91, 101))

os.makedirs(OUT, exist_ok=True)
for size in SIZES:
    card.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, f"icon{size}.png"))
print("icons:", ", ".join(str(s) for s in SIZES))
