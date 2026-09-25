"""Render app/extension icons from the front-facing Clawd sprite (pixel-perfect, no smoothing)."""
from PIL import Image, ImageDraw
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLAWD = [
    "....OOOOOOOOOOOOOOOOO....",
    "....OOOOOOOOOOOOOOOOO....",
    "....OOEEOOOOOOOOOEEOO....",
    "....OOEEOOOOOOOOOEEOO....",
    "OOOOOOOOOOOOOOOOOOOOOOOOO",
    "OOOOOOOOOOOOOOOOOOOOOOOOO",
    "OOOOOOOOOOOOOOOOOOOOOOOOO",
    "OOOOOOOOOOOOOOOOOOOOOOOOO",
    "....OOOOOOOOOOOOOOOOO....",
    "....OOOOOOOOOOOOOOOOO....",
    "....OOOOOOOOOOOOOOOOO....",
    "....OOOOOOOOOOOOOOOOO....",
    "....OO..OO.....OO..OO....",
    "....OO..OO.....OO..OO....",
    "....OO..OO.....OO..OO....",
    "....OO..OO.....OO..OO....",
]
COL = {"O": (216, 118, 79, 255), "E": (27, 19, 17, 255)}
BG_TOP, BG_BOT = (88, 55, 158), (42, 26, 76)

def icon(size):
    ss = 4  # supersample only the rounded background edge
    img = Image.new("RGBA", (size * ss, size * ss), (0, 0, 0, 0))
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1], radius=int(size * ss * 0.22), fill=255)
    grad = Image.new("RGBA", img.size)
    gd = ImageDraw.Draw(grad)
    for y in range(img.size[1]):
        k = y / img.size[1]
        gd.line([(0, y), (img.size[0], y)], fill=tuple(int(a + (b - a) * k) for a, b in zip(BG_TOP, BG_BOT)) + (255,))
    img.paste(grad, (0, 0), mask)
    img = img.resize((size, size), Image.LANCZOS)
    # sprite: largest whole-pixel unit that fits with a margin
    unit = max(1, int(size * 0.8 // 25))
    w, h = 25 * unit, 16 * unit
    ox, oy = (size - w) // 2, (size - h) // 2 + unit // 2
    d = ImageDraw.Draw(img)
    for r, row in enumerate(CLAWD):
        for c, ch in enumerate(row):
            if ch in COL:
                d.rectangle([ox + c * unit, oy + r * unit, ox + (c + 1) * unit - 1, oy + (r + 1) * unit - 1], fill=COL[ch])
    return img

for s in (16, 32, 48, 128):
    icon(s).save(os.path.join(ROOT, "extension", "public", "icons", f"icon{s}.png"))
icon(256).save(os.path.join(ROOT, "desktop", "assets", "icon.png"))
icon(32).save(os.path.join(ROOT, "desktop", "assets", "tray.png"))
icon(256).save(os.path.join(ROOT, "desktop", "assets", "icon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("icons written")
