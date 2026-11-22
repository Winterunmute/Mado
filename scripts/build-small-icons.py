"""Build optimized Windows small-size icons from the user-supplied Mado PNGs.

The full-resolution originals in assets/ are never modified. The unread PNG is
horizontally aligned to the normal PNG so only the red dot differs, then both
are cropped tightly, downsampled to 16/24/32 and packaged as ICO files.
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
SIZES = [16, 24, 32]
PADDING = 6
LIGHT = (249, 241, 229, 255)


def bbox(im, predicate):
    px = im.load()
    xs, ys = [], []
    for y in range(im.height):
        for x in range(im.width):
            if predicate(*px[x, y]):
                xs.append(x)
                ys.append(y)
    return (min(xs), min(ys), max(xs) + 1, max(ys) + 1) if xs else None


def is_light(r, g, b, a):
    return a > 120 and min(r, g, b) > 170


def is_opaque(r, g, b, a):
    return a > 20


def align_unread(normal, unread):
    normal_light = bbox(normal, is_light)
    unread_light = bbox(unread, is_light)
    if not normal_light or not unread_light:
        raise SystemExit("Could not locate the calligraphy in both icons")
    return normal_light[0] - unread_light[0]


def crop_box(normal, unread, shift_x):
    aligned = Image.new("RGBA", unread.size, (0, 0, 0, 0))
    aligned.paste(unread, (shift_x, 0))

    nb = bbox(normal, is_opaque)
    ub = bbox(aligned, is_opaque)
    if not nb or not ub:
        raise SystemExit("Could not locate icon content")

    left = min(nb[0], ub[0]) - PADDING
    top = min(nb[1], ub[1]) - PADDING
    right = max(nb[2], ub[2]) + PADDING
    bottom = max(nb[3], ub[3]) + PADDING
    side = max(right - left, bottom - top)
    cx, cy = (left + right) / 2, (top + bottom) / 2
    left = max(0, round(cx - side / 2))
    top = max(0, round(cy - side / 2))
    right = min(normal.width, left + side)
    bottom = min(normal.height, top + side)
    side = min(right - left, bottom - top)
    right, bottom = left + side, top + side
    return (left, top, right, bottom), aligned


def strengthen(im):
    r, g, b, a = im.split()
    lum = Image.eval(r, lambda v: v * 299 // 1000)
    lum = ImageChops.add(lum, Image.eval(g, lambda v: v * 587 // 1000))
    lum = ImageChops.add(lum, Image.eval(b, lambda v: v * 114 // 1000))
    light = ImageChops.multiply(lum.point(lambda v: 255 if v > 165 else 0), a)
    edge = ImageChops.subtract(light.filter(ImageFilter.MaxFilter(3)), light)
    edge = ImageChops.multiply(edge, a).point(lambda v: v * 30 // 100)
    overlay = Image.new("RGBA", im.size, LIGHT)
    return Image.composite(overlay, im, edge)


def build(name, source, shift_x, box):
    aligned = Image.new("RGBA", source.size, (0, 0, 0, 0))
    aligned.paste(source, (shift_x, 0))
    cropped = aligned.crop(box)
    frames = []
    for size in SIZES:
        resized = cropped.resize((size, size), Image.Resampling.LANCZOS)
        frames.append(strengthen(resized))
    out = ASSETS / name
    frames[-1].save(out, format="ICO", sizes=[(s, s) for s in SIZES])
    print(f"Wrote {out.relative_to(ROOT)} ({', '.join(str(s) for s in SIZES)}px)")


def main():
    normal = Image.open(ASSETS / "icon.png").convert("RGBA")
    unread = Image.open(ASSETS / "icon-unread.png").convert("RGBA")
    if normal.size != unread.size:
        raise SystemExit("Icon sources must have identical dimensions")
    shift_x = align_unread(normal, unread)
    box, _ = crop_box(normal, unread, shift_x)
    print(f"Alignment shift: +{shift_x}px; crop: {box}")
    build("icon-small.ico", normal, 0, box)
    build("icon-unread-small.ico", unread, shift_x, box)


if __name__ == "__main__":
    main()
