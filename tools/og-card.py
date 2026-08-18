#!/usr/bin/env python3
"""
Build a LINDJANAR share card (Open Graph image, 1200x630).

Usage:
  python3 tools/og-card.py "Tehtud" "tööd" assets/naidised/nora-04.webp assets/og/tood.jpg \
      "Kinnisvarafotograafia näited –" "korterid, eramajad ja droonifotod."

Fonts are the same ones the site loads from Google Fonts. Grab the two
variable TTFs once and point FONTS at them:
  ofl/cormorantgaramond/CormorantGaramond[wght].ttf
  ofl/dmsans/DMSans[opsz,wght].ttf
from https://github.com/google/fonts
"""
import sys, os
from PIL import Image, ImageDraw, ImageFont

FONTS = os.environ.get('LJ_FONTS', os.path.expanduser('~/.local/share/lj-fonts'))
CG_FILE = 'CormorantGaramond[wght].ttf'
DM_FILE = 'DMSans[opsz,wght].ttf'

W, H = 1200, 630
IVORY = (247, 244, 239); GOLD = (184, 133, 74)
INK = (28, 26, 23); DIM = (122, 114, 105); RULE = (212, 207, 198)

def _f(name, size, variation):
    ft = ImageFont.truetype(os.path.join(FONTS, name), size)
    ft.set_variation_by_name(variation)
    return ft
CG = lambda s, v='Light':   _f(CG_FILE, s, v)
DM = lambda s, v='Regular': _f(DM_FILE, s, v)

def track(dr, xy, text, font, fill, sp=0):
    """Draw text with letter-spacing, matching the site's .logo tracking."""
    x, y = xy
    for c in text:
        dr.text((x, y), c, font=font, fill=fill)
        x += dr.textlength(c, font=font) + sp

def cover(path, box):
    im = Image.open(path).convert('RGB')
    bw, bh = box
    s = max(bw / im.width, bh / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    return im.crop(((im.width - bw) // 2, (im.height - bh) // 2,
                    (im.width - bw) // 2 + bw, (im.height - bh) // 2 + bh))

def card(line1, line2, photo, sub1, sub2, eyebrow='PORTFOOLIO'):
    im = Image.new('RGB', (W, H), IVORY)
    dr = ImageDraw.Draw(im)
    PW = 548                                   # ivory panel width
    im.paste(cover(photo, (W - PW, H)), (PW, 0))
    dr.line([(PW, 0), (PW, H)], fill=RULE, width=1)
    x = 76
    track(dr, (x, 66), 'LINDJANAR', DM(17, 'Bold'), INK, sp=4.4)
    track(dr, (x, 120), eyebrow, DM(12, 'Medium'), GOLD, sp=3.2)
    dr.line([(x, 196), (x + 56, 196)], fill=GOLD, width=2)
    dr.text((x - 4, 222), line1, font=CG(96), fill=INK)
    dr.text((x - 4, 318), line2, font=CG(96), fill=INK)
    dr.text((x, 446), sub1, font=DM(19), fill=DIM)
    dr.text((x, 474), sub2, font=DM(19), fill=DIM)
    track(dr, (x, 536), 'KINNISVARA.LINDJANAR.EE', DM(13, 'Medium'), INK, sp=2.6)
    return im

if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) < 4:
        sys.exit(__doc__)
    line1, line2, photo, out = a[0], a[1], a[2], a[3]
    sub1 = a[4] if len(a) > 4 else ''
    sub2 = a[5] if len(a) > 5 else ''
    card(line1, line2, photo, sub1, sub2).save(
        out, 'JPEG', quality=90, optimize=True, progressive=True)
    print(out, os.path.getsize(out) // 1024, 'KB')
