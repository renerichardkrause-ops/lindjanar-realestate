#!/usr/bin/env python3
"""
Build LINDJANAR share cards (Open Graph images, 1200x630).

  python3 tools/og-card.py            # rebuild every card in CARDS

Layout: ivory panel on the left (wordmark, gold eyebrow, rule, serif title,
subtext, domain), photo on the right. The photo is either one image or a
2x3 mosaic when several are given.

Fonts are the two the site already loads from Google Fonts. Fetch them once:
  ofl/cormorantgaramond/CormorantGaramond[wght].ttf
  ofl/dmsans/DMSans[opsz,wght].ttf
from https://github.com/google/fonts and point LJ_FONTS at the directory.
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

FONTS = os.environ.get('LJ_FONTS', os.path.expanduser('~/.local/share/lj-fonts'))
CG_FILE, DM_FILE = 'CormorantGaramond[wght].ttf', 'DMSans[opsz,wght].ttf'

W, H, PW = 1200, 630, 548          # canvas, and ivory panel width
PAD, MAXW = 76, 424                # left inset, usable text width
IVORY = (247, 244, 239); GOLD = (184, 133, 74)
INK = (28, 26, 23); DIM = (110, 103, 95); RULE = (212, 207, 198)

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
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    return im.crop(((im.width - bw) // 2, (im.height - bh) // 2,
                    (im.width - bw) // 2 + bw, (im.height - bh) // 2 + bh))

def mosaic(paths, box, gut=6):
    """2 columns x 3 rows. Falls back to a single cover for one image."""
    bw, bh = box
    if len(paths) == 1:
        return cover(paths[0], box)
    cols, rows = 2, 3
    cw = (bw - gut * (cols - 1)) // cols
    ch = (bh - gut * (rows - 1)) // rows
    out = Image.new('RGB', box, IVORY)
    for i, p in enumerate(paths[:cols * rows]):
        x = (i % cols) * (cw + gut)
        y = (i // cols) * (ch + gut)
        # last row/col absorbs the rounding remainder so there is no ivory edge
        w = bw - x if i % cols == cols - 1 else cw
        h = bh - y if i // cols == rows - 1 else ch
        out.paste(cover(p, (w, h)), (x, y))
    return out

TITLE_TOP, TITLE_ROOM, SUB_TOP = 222, 208, 452

def _fit(lines, start=96, floor=44):
    """Largest display size at which the title fits the panel, width and height."""
    probe = ImageDraw.Draw(Image.new('RGB', (1, 1)))
    size = start
    while size > floor:
        ft = CG(size)
        fits_w = max(probe.textlength(l, font=ft) for l in lines) <= MAXW
        fits_h = len(lines) * round(size * 1.02) <= TITLE_ROOM
        if fits_w and fits_h:
            return size
        size -= 2
    return floor

def _wrap(text, font, width, maxlines=2):
    probe = ImageDraw.Draw(Image.new('RGB', (1, 1)))
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if probe.textlength(t, font=font) <= width:
            cur = t
        else:
            lines.append(cur); cur = w
            if len(lines) == maxlines:
                return lines
    if cur:
        lines.append(cur)
    return lines[:maxlines]

def card(lines, photos, sub, eyebrow='PORTFOOLIO'):
    im = Image.new('RGB', (W, H), IVORY)
    im.paste(mosaic(photos, (W - PW, H)), (PW, 0))
    dr = ImageDraw.Draw(im)
    dr.line([(PW, 0), (PW, H)], fill=RULE, width=1)

    track(dr, (PAD, 66), 'LINDJANAR', DM(17, 'Bold'), INK, sp=4.4)
    track(dr, (PAD, 120), eyebrow, DM(12, 'Medium'), GOLD, sp=3.2)
    dr.line([(PAD, 196), (PAD + 56, 196)], fill=GOLD, width=2)

    size = _fit(lines)
    step = round(size * 1.02)
    subf = DM(22)                                   # subtext, readable at feed size
    subl = _wrap(sub, subf, MAXW)
    if ' '.join(subl) != ' '.join(sub.split()):
        print(f'  ! subtext truncated, shorten it: {sub!r}', file=sys.stderr)
    # Title block sits just under the rule; subtext is anchored so it can
    # never collide with the domain line, whatever the title height.
    y = TITLE_TOP + max(0, (TITLE_ROOM - len(lines) * step) // 2)
    for l in lines:
        dr.text((PAD - 4, y), l, font=CG(size), fill=INK); y += step
    y = SUB_TOP
    for l in subl:
        dr.text((PAD, y), l, font=subf, fill=DIM); y += 30

    track(dr, (PAD, 536), 'KINNISVARA.LINDJANAR.EE', DM(13, 'Medium'), INK, sp=2.6)
    return im

N = 'assets/naidised/'
CARDS = {
 'tood': (['Tehtud', 'tööd'], 'PORTFOOLIO',
   [N+'nora-01.webp', N+'nora-27.webp', N+'korter-1t-04.webp',
    N+'eramaja-kesk-06.webp', N+'eramaja-kesk-15.webp', N+'korter-3t-01.webp'],
   'Valik töid kodudest, mille eripära ja emotsiooni jäädvustasime.'),
 'avaleht': (['Sinu kinnisvara', 'müüb meiega', 'kiiremini'], 'KINNISVARAFOTOGRAAFIA',
   [N+'korter-1t-06.webp'],
   'Professionaalsed kinnisvarafotod 48 tunniga, avalike hindadega.'),
 'kkk': (['Korduma kippuvad', 'küsimused'], 'KKK', [N+'nora-13.webp'],
   'Hinnad, tähtajad, ettevalmistus ja broneerimine.'),
 'blogi': (['Blogi'], 'ARTIKLID', ['assets/blogi/paar-2-parast.webp'],
   'Miks head fotod müüvad kiiremini ja kuidas kuulutus tööle panna.'),
}
REGIONS = {
 'tallinnas':   ('TALLINN',     N+'nora-100.webp',        'Täispakett: koristus, staging, fotograafia, droon ja video ühes tellimuses.'),
 'tartumaa':    ('TARTUMAA',    N+'eramaja-kesk-01.webp', None),
 'jogevamaa':   ('JÕGEVAMAA',   N+'korter-3t-01.webp',    None),
 'parnumaa':    ('PÄRNUMAA',    N+'nora-08.webp',         None),
 'polvamaa':    ('PÕLVAMAA',    N+'eramaja-kesk-15.webp', None),
 'valgamaa':    ('VALGAMAA',    N+'korter-1t-04.webp',    None),
 'viljandimaa': ('VILJANDIMAA', N+'nora-27.webp',         None),
 'vorumaa':     ('VÕRUMAA',     N+'eramaja-kesk-06.webp', None),
 'jarvamaa':    ('JÄRVAMAA',    N+'korter-2t-03.webp',    None),
}
DEFAULT_REGION_SUB = 'Korterid alates 85€, eramajad alates 109€, pildid käes 48 tunniga.'
for slug, (eyebrow, photo, sub) in REGIONS.items():
    CARDS[slug] = (['Kinnisvara', 'pildistamine'], eyebrow, [photo], sub or DEFAULT_REGION_SUB)

if __name__ == '__main__':
    os.makedirs('assets/og', exist_ok=True)
    only = sys.argv[1:]
    for name, (lines, eyebrow, photos, sub) in CARDS.items():
        if only and name not in only:
            continue
        out = f'assets/og/{name}.jpg'
        card(lines, photos, sub, eyebrow).save(
            out, 'JPEG', quality=90, optimize=True, progressive=True)
        print(f'{out:34s} {os.path.getsize(out)//1024:>4} KB')
