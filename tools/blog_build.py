#!/usr/bin/env python3
"""Build the LINDJANAR blog.

Every post lives in blog-src/<slug>.html as front matter + article body.
This script wraps each one in the shared page shell (analytics, Meta pixel,
fonts, header, footer, cookie banner) and writes blogi/<slug>.html, then
regenerates blogi/index.html and the blog part of sitemap.xml.

The generated files are committed like any other file – GitHub Pages still
serves plain static HTML and nothing about the deploy changes.

A post goes live when its date arrives. Anything dated in the future is a
scheduled post: no page, no index card, no sitemap entry, and any link
pointing at it is quietly unwrapped to plain text so nothing 404s. Rerun the
build on the day and the post – and every link to it – appears.

    python3 tools/blog_build.py              # publish everything dated today or earlier
    python3 tools/blog_build.py 2026-09-04   # pretend it is that day (dry run of a future state)
"""
import os
import re
import sys
import html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'blog-src')
OUT = os.path.join(ROOT, 'blogi')
SITE = 'https://kinnisvara.lindjanar.ee'

MONTHS = ['jaanuar', 'veebruar', 'märts', 'aprill', 'mai', 'juuni', 'juuli',
          'august', 'september', 'oktoober', 'november', 'detsember']


def et_date(iso):
    y, m, d = iso.split('-')
    return '%d. %s %s' % (int(d), MONTHS[int(m) - 1], y)


# ---------------------------------------------------------------- front matter
def parse(path):
    raw = open(path, encoding='utf-8').read()
    if not raw.startswith('---'):
        sys.exit('%s: missing front matter' % path)
    _, fm, body = raw.split('---', 2)
    meta = {}
    for line in fm.strip().splitlines():
        if not line.strip() or line.strip().startswith('#'):
            continue
        k, v = line.split(':', 1)
        meta[k.strip()] = v.strip()
    return meta, body.strip()


# ---------------------------------------------------------------- shared parts
def tracking():
    """The consent-gated GA4 + Meta pixel block, byte-identical to the rest
    of the site. Kept in one place so a pixel change is a one-line edit."""
    return open(os.path.join(ROOT, 'tools', 'blog_tracking.html'),
                encoding='utf-8').read().rstrip()


HEADER = '''<header class="site-header">
  <div class="header-inner">
    <a href="../" class="logo">LINDJANAR</a>
    <nav class="nav">
      <a href="../#pricing">Hinnad</a>
      <a href="../tood.html">Tööd</a>
      <a href="../arikinnisvara.html">Äripinnad</a>
      <a href="../#agency">Maakleritele</a>
      <a href="./">Blogi</a>
      <a href="../kkk.html">KKK</a>
      <a href="../#contact">Kontakt</a>
    </nav>
  </div>
</header>'''

FOOTER = '''<footer class="site-footer">
  <div class="footer-inner">
    <span>&copy; <span class="year"></span> Janar Lind. Kõik õigused kaitstud.</span>
    <a href="https://lindjanar.ee">← Autofotograafia</a>
  </div>
</footer>

<div class="cookie-banner" id="cookieBanner" hidden>
  <p class="cookie-text">Kasutame küpsiseid, et oma veebilehte paremaks teha.</p>
  <div class="cookie-actions">
    <button type="button" class="cookie-btn cookie-btn--decline" id="cookieDecline">Ainult vajalikud</button>
    <button type="button" class="cookie-btn cookie-btn--accept" id="cookieAccept">Nõustun</button>
  </div>
</div>

<script src="../script.js"></script>'''

FONTS = '''<link rel="preload" href="../assets/fonts/cabinet-grotesk-regular.woff2" as="font" type="font/woff2" crossorigin />
<link rel="stylesheet" href="../styles.css" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=Raleway:wght@600&display=swap" rel="stylesheet" />'''


# Author card under every post's closing CTA. A face and a direct line are
# what a reader who has just finished a 3-minute article needs to act.
AUTHOR = '''
    <aside class="article-author">
      <img src="../assets/janar/janar-avatar.webp" alt="Janar Lind, kinnisvarafotograaf" width="240" height="240" loading="lazy" decoding="async" />
      <div class="article-author-body">
        <p class="article-author-name">Janar Lind</p>
        <p class="article-author-role">Kinnisvarafotograaf ja sertifitseeritud droonipiloot. Tartust pärit, pildistan üle Eesti.</p>
        <p class="article-author-contact">
          <a href="tel:+37253053253">+372 5305 3253</a>
          <a href="mailto:hello@lindjanar.ee">hello@lindjanar.ee</a>
        </p>
      </div>
    </aside>
'''


# ---------------------------------------------------------------- page builder
def hero_block(meta):
    """Optional lead image under the title, the way news articles open.

    Frontmatter: hero (path from site root, 1000px wide), optional hero_full
    (1800px twin for srcset), heroalt, herocap. Loads eagerly – it is the
    first thing on screen, so lazy-loading it would only delay the paint."""
    hero = meta.get('hero')
    if not hero:
        return ''
    alt = html.escape(meta.get('heroalt', meta['title']), quote=True)
    full = meta.get('hero_full')
    srcset = ''
    if full:
        srcset = ' srcset="../%s 1000w, ../%s 1800w" sizes="(max-width: 960px) 100vw, 900px"' % (hero, full)
    cap = meta.get('herocap')
    capblock = '\n      <figcaption>%s</figcaption>' % html.escape(cap, quote=False) if cap else ''
    return '''
    <figure class="article-hero">
      <img src="../%s"%s alt="%s" width="1000" height="667" fetchpriority="high" decoding="async" />%s
    </figure>
''' % (hero, srcset, alt, capblock)


def build_post(meta, body, posts, known):
    slug = meta['slug']
    url = '%s/blogi/%s' % (SITE, slug)
    og = '%s/assets/og/%s' % (SITE, meta.get('og', 'blogi.jpg'))
    title = meta['title']
    desc = meta['description']
    share = meta.get('share', desc)

    # Related posts – three others from the same cluster, then fill from the
    # rest. Internal links are the cheapest SEO there is, so every post gets
    # some.
    rel = [p for p in posts
           if p['slug'] != slug and p.get('cluster') == meta.get('cluster')]
    rel += [p for p in posts
            if p['slug'] != slug and p not in rel]
    rel = rel[:3]
    related = ''
    if rel:
        items = '\n'.join(
            '        <li><a href="%s">%s</a></li>' % (p['slug'], html.escape(p['title']))
            for p in rel)
        related = '''
    <aside class="article-related">
      <h2>Loe ka</h2>
      <ul>
%s
      </ul>
    </aside>
''' % items

    schema_img = meta.get('schema_image', 'assets/og/' + meta.get('og', 'blogi.jpg'))
    jsonld = '''<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": %s,
  "description": %s,
  "datePublished": "%s",
  "dateModified": "%s",
  "inLanguage": "et",
  "author": { "@type": "Person", "name": "Janar Lind", "url": "%s/" },
  "publisher": { "@type": "Organization", "name": "LINDJANAR Kinnisvarafotograafia", "url": "%s/" },
  "mainEntityOfPage": "%s",
  "image": "%s/%s"
}
</script>''' % (jsonstr(title), jsonstr(desc), meta['date'],
                meta.get('updated', meta['date']), SITE, SITE, url, SITE, schema_img)

    faq = meta.get('faq_json')
    faq_block = ''
    if faq:
        faq_block = '\n' + open(os.path.join(SRC, faq), encoding='utf-8').read().rstrip()

    page = '''<!DOCTYPE html>
<html lang="et">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>%(title)s | LINDJANAR blogi</title>
<meta name="description" content="%(desc)s" />
<link rel="canonical" href="%(url)s" />
<link rel="icon" href="../favicon.ico" sizes="any" />

<meta property="og:type" content="article" />
<meta property="og:title" content="%(title)s" />
<meta property="og:description" content="%(share)s" />
<meta property="og:url" content="%(url)s" />
<meta property="og:image" content="%(og)s" />
<meta property="og:image:alt" content="%(ogalt)s" />
<meta property="og:image:type" content="image/jpeg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:site_name" content="LINDJANAR" />
<meta property="og:locale" content="et_EE" />
<meta property="article:published_time" content="%(date)s" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="%(title)s" />
<meta name="twitter:description" content="%(share)s" />
<meta name="twitter:image" content="%(og)s" />

%(jsonld)s%(faq)s

%(tracking)s

%(fonts)s
</head>
<body>

%(header)s

<main>
  <article class="article">
    <a href="./" class="back-to-blog">← Blogi</a>
    <p class="article-meta">%(etdate)s · Janar Lind · %(read)s min lugemist</p>
    <h1>%(title)s</h1>
%(hero)s
%(body)s
%(author)s%(related)s  </article>
</main>

%(footer)s
</body>
</html>
''' % {
        'title': html.escape(title, quote=True),
        'desc': html.escape(desc, quote=True),
        'share': html.escape(share, quote=True),
        'ogalt': html.escape(meta.get('ogalt', title), quote=True),
        'url': url, 'og': og, 'date': meta['date'],
        'etdate': et_date(meta['date']),
        'read': readtime(body),
        'hero': hero_block(meta),
        'author': AUTHOR,
        'jsonld': jsonld, 'faq': faq_block,
        'tracking': tracking(), 'fonts': FONTS,
        'header': HEADER, 'footer': FOOTER,
        'body': indent(add_dims(resolve_links(body, {p['slug'] for p in posts}, known, slug)), 4),
        'related': related,
    }
    return page


def jsonstr(s):
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'


def readtime(body):
    words = len(re.sub(r'<[^>]+>', ' ', body).split())
    return max(2, round(words / 190))


IMG = re.compile(r'<img ([^>]*?)src="\.\./([^"]+)"([^>]*?)/?>')


def add_dims(body):
    """Stamp real width/height on every local <img> so the browser reserves
    the right box before the file arrives – no layout shift while reading."""
    from PIL import Image

    def rep(m):
        pre, path, post = m.group(1), m.group(2), m.group(3)
        whole = m.group(0)
        if 'width=' in whole:
            return whole
        full = os.path.join(ROOT, path)
        if not os.path.exists(full):
            sys.exit('missing image: %s' % path)
        w, h = Image.open(full).size
        return '<img %ssrc="../%s" width="%d" height="%d"%s/>' % (pre, path, w, h, post)

    return IMG.sub(rep, body)


ALINK = re.compile(r'<a href="([a-z0-9-]+)\.html"[^>]*>(.*?)</a>', re.S)


XREF = re.compile(r'\s*<span class="xref">(.*?)</span>', re.S)
EMPTY_P = re.compile(r'<p[^>]*>\s*</p>\n?')


def resolve_links(body, live, known, slug):
    """Posts are written as if every post already exists. Here we reconcile
    that with what is actually published.

    A sentence whose only job is to point at another post is wrapped in
    <span class="xref"> in the source. If its target is not live yet the whole
    sentence goes – "Sellest kirjutasime eraldi." reads like a mistake once the
    link is gone. A link sitting inside ordinary prose just loses its anchor,
    because the sentence still says something without it. Both come back on
    their own the day the target publishes."""
    def xref(m):
        inner = m.group(1)
        for t in re.findall(r'href="([a-z0-9-]+)\.html"', inner):
            if t + '.html' not in known:
                sys.exit('%s: xref to unknown post %s.html' % (slug, t))
            if t + '.html' not in live:
                return ''
        return ' ' + inner

    def plain(m):
        target, text = m.group(1), m.group(2)
        if target + '.html' not in known:
            sys.exit('%s: links to unknown post %s.html' % (slug, target))
        return m.group(0) if target + '.html' in live else text

    body = XREF.sub(xref, body)
    body = ALINK.sub(plain, body)
    return EMPTY_P.sub('', body)


def indent(text, n):
    pad = ' ' * n
    return '\n'.join(pad + l if l.strip() else l for l in text.splitlines())


# ---------------------------------------------------------------- blog index
def build_index(posts):
    cards = []
    for p in posts:
        cards.append('''        <a class="post-card" href="%s">
          <img class="post-card-thumb" src="../%s" alt="%s" width="1000" height="667" loading="lazy" />
          <div class="post-card-body">
            <time datetime="%s">%s</time>
            <h2>%s</h2>
            <p>%s</p>
          </div>
        </a>''' % (p['slug'], p['thumb'], html.escape(p.get('thumbalt', p['title']), quote=True),
                   p['date'], et_date(p['date']),
                   html.escape(p['title']), html.escape(p['card'])))

    page = '''<!DOCTYPE html>
<html lang="et">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Blogi – kinnisvarafotograafiast ausalt | LINDJANAR</title>
<meta name="description" content="Artiklid kinnisvarafotograafiast ja kuulutuse tegemisest: mis müüb, mis mitte, ja mida vältida. Nõuanded nii oma kodu müüjale kui maaklerile." />
<link rel="canonical" href="%(site)s/blogi/" />
<link rel="icon" href="../favicon.ico" sizes="any" />

<meta property="og:type" content="website" />
<meta property="og:title" content="Blogi – kinnisvarafotograafiast ausalt | LINDJANAR" />
<meta property="og:description" content="Artiklid kinnisvarafotograafiast ja kuulutuse tegemisest: mis müüb, mis mitte, ja mida vältida." />
<meta property="og:url" content="%(site)s/blogi/" />
<meta property="og:image" content="%(site)s/assets/og/blogi.jpg" />
<meta property="og:image:type" content="image/jpeg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Blogi – kinnisvarafotograafiast ausalt – LINDJANAR" />
<meta property="og:site_name" content="LINDJANAR" />
<meta property="og:locale" content="et_EE" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="%(site)s/assets/og/blogi.jpg" />
<meta name="twitter:description" content="Artiklid kinnisvarafotograafiast ja kuulutuse tegemisest: mis müüb, mis mitte, ja mida vältida." />
<meta name="twitter:title" content="Blogi – kinnisvarafotograafiast ausalt | LINDJANAR" />

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Blog",
  "name": "LINDJANAR kinnisvarafotograafia blogi",
  "url": "%(site)s/blogi/",
  "inLanguage": "et",
  "publisher": { "@type": "Organization", "name": "LINDJANAR Kinnisvarafotograafia", "url": "%(site)s/" }
}
</script>

%(tracking)s

%(fonts)s
</head>
<body>

%(header)s

<main>
  <section class="blog-header">
    <div class="container">
      <h1>Blogi</h1>
      <p>Kinnisvarafotograafiast ausalt: mis müüb, mis mitte, ja mida numbrid selle kohta ütlevad.</p>
      <p class="blog-count">%(count)d lugu</p>
    </div>
  </section>

  <section>
    <div class="container">
      <div class="post-list post-grid">

%(cards)s

      </div>
    </div>
  </section>
</main>

%(footer)s
</body>
</html>
''' % {'site': SITE, 'tracking': tracking(), 'fonts': FONTS,
       'header': HEADER, 'footer': FOOTER, 'cards': '\n\n'.join(cards),
       'count': len(posts)}
    return page


# ---------------------------------------------------------------- homepage
HOME_START = '<!-- BLOG:START – generated by tools/blog_build.py, do not edit by hand -->'
HOME_END = '<!-- BLOG:END -->'

HOME_CARD = '''          <a class="post-card" href="/blogi/{slug}">
            <img class="post-card-thumb" src="{thumb}" alt="{alt}" width="1000" height="667" loading="lazy" />
            <div class="post-card-body">
              <time datetime="{date}">{etdate}</time>
              <h2>{title}</h2>
              <p>{card}</p>
            </div>
          </a>'''

HOME_SECTION = '''{start}
  <section class="blog-home">
    <div class="container">
      <div class="section-header">
        <span class="section-tag" data-et="Blogist" data-en="From the blog">Blogist</span>
        <h2 data-et="Kinnisvarafotograafiast ausalt" data-en="Real estate photography, honestly">Kinnisvarafotograafiast ausalt</h2>
        <p data-et="Mis müüb, mis mitte, ja mida numbrid selle kohta ütlevad." data-en="What sells, what doesn&#39;t, and what the numbers say.">Mis müüb, mis mitte, ja mida numbrid selle kohta ütlevad.</p>
      </div>
      <div class="post-grid">
{cards}
      </div>
      <div class="blog-home-foot">
        <a href="/blogi/" class="btn-outline" data-et="Kõik {n} lugu" data-en="All {n} {word}">Kõik {n} lugu</a>
      </div>
    </div>
  </section>
  {end}'''


def build_home(posts):
    """The three newest posts, in the same card /blogi uses. Regenerated on
    every build, so the homepage cannot fall behind the daily publishing."""
    cards = [HOME_CARD.format(
        slug=p['slug'], thumb=p['thumb'],
        alt=html.escape(p.get('thumbalt', p['title']), quote=True),
        date=p['date'], etdate=et_date(p['date']),
        title=html.escape(p['title']), card=html.escape(p['card']))
        for p in posts[:3]]
    n = len(posts)
    return HOME_SECTION.format(start=HOME_START, end=HOME_END,
                               cards='\n'.join(cards), n=n,
                               word='article' if n == 1 else 'articles')


def inject_home(posts):
    """Splice the section between the markers in index.html. The rest of the
    page is hand-written and stays that way."""
    path = os.path.join(ROOT, 'index.html')
    s = open(path, encoding='utf-8').read()
    if HOME_START not in s or HOME_END not in s:
        sys.exit('index.html: BLOG:START / BLOG:END markers missing')
    out = s[:s.index(HOME_START)] + build_home(posts) + s[s.index(HOME_END) + len(HOME_END):]
    if out == s:
        return False
    check(out, 'index.html')
    open(path, 'w', encoding='utf-8').write(out)
    return True


# ---------------------------------------------------------------- sitemap
def build_sitemap(posts):
    path = os.path.join(ROOT, 'sitemap.xml')
    xml = open(path, encoding='utf-8').read()
    # Drop every existing /blogi/ entry, then re-add from the manifest.
    xml = re.sub(r'  <url>\s*<loc>[^<]*/blogi/[^<]*</loc>.*?</url>\n', '', xml,
                 flags=re.S)
    entries = ['''  <url>
    <loc>%s/blogi/</loc>
    <lastmod>%s</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
''' % (SITE, posts[0]['date'])]
    for p in posts:
        entries.append('''  <url>
    <loc>%s/blogi/%s</loc>
    <lastmod>%s</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
''' % (SITE, p['slug'], p.get('updated', p['date'])))
    xml = xml.replace('</urlset>', ''.join(entries) + '</urlset>')
    open(path, 'w', encoding='utf-8').write(xml)


# ---------------------------------------------------------------- llms.txt
LLMS_START = '<!-- LEHED:START – genereerib tools/blog_build.py, käsitsi ära muuda -->'
LLMS_END = '<!-- LEHED:END -->'

# Static pages, in the order a reader would want them. Blog posts are appended
# from the manifest, so a new post cannot go missing from this file.
LLMS_PAGES = [
    ('Avaleht ja hinnakiri', '/', 'teenused, hinnad, protsess, kontakt'),
    ('Tehtud tööd', '/tood.html', 'portfoolio: korterid, eramajad, uusarendused'),
    ('Ärikinnisvara pildistamine ja filmimine', '/arikinnisvara.html',
     'büroo-, lao- ja tootmispind; ülevaatevideo ja fotod; hind objekti järgi'),
    ('KKK', '/kkk.html', 'korduma kippuvad küsimused'),
    ('Blogi', '/blogi/', 'artiklid kinnisvarafotograafiast'),
]
LLMS_AREAS = [
    ('Tartumaa', '/kinnisvara-pildistamine-tartumaa.html'),
    ('Tallinn – premium eramajad ja arhitektuur', '/kinnisvara-pildistamine-tallinnas.html'),
    ('Pärnumaa', '/kinnisvara-pildistamine-parnumaa.html'),
    ('Jõgevamaa', '/kinnisvara-pildistamine-jogevamaa.html'),
    ('Viljandimaa', '/kinnisvara-pildistamine-viljandimaa.html'),
    ('Valgamaa', '/kinnisvara-pildistamine-valgamaa.html'),
    ('Põlvamaa', '/kinnisvara-pildistamine-polvamaa.html'),
    ('Võrumaa', '/kinnisvara-pildistamine-vorumaa.html'),
    ('Järvamaa', '/kinnisvara-pildistamine-jarvamaa.html'),
]


def build_llms(posts):
    """Regenerate the page list inside llms.txt. The prose above the markers is
    hand-written; only the index of pages is generated, so a new blog post or a
    new service page cannot quietly go missing from the file that tells AI
    assistants what this business does."""
    out = ['## Lehed (Pages)', '']
    for name, path, note in LLMS_PAGES:
        out.append('- [%s](%s%s): %s' % (name, SITE, path, note))
    out.append('')
    out.append('## Piirkonnad (Service areas)')
    out.append('')
    for name, path in LLMS_AREAS:
        out.append('- [%s](%s%s)' % (name, SITE, path))
    out.append('')
    out.append('## Artiklid (Articles)')
    out.append('')
    for p in posts:
        out.append('- [%s](%s/blogi/%s): %s' % (p['title'], SITE, p['slug'], p['card']))
    return '\n'.join(out)


def inject_llms(posts):
    path = os.path.join(ROOT, 'llms.txt')
    s = open(path, encoding='utf-8').read()
    if LLMS_START not in s or LLMS_END not in s:
        sys.exit('llms.txt: LEHED:START / LEHED:END markers missing')
    out = (s[:s.index(LLMS_START)] + LLMS_START + '\n\n' + build_llms(posts)
           + '\n\n' + s[s.index(LLMS_END):])
    if out == s:
        return False
    open(path, 'w', encoding='utf-8').write(out)
    return True


# ---------------------------------------------------------------- main
def check(page, slug):
    """House rules, enforced at build time: en dashes only, and no Cyrillic
    or Greek look-alikes hiding inside Estonian words."""
    import unicodedata
    if '\u2014' in page:
        sys.exit('%s: em dash found – use – instead' % slug)
    for i, ch in enumerate(page):
        if ord(ch) < 128:
            continue
        name = unicodedata.name(ch, '')
        if name.startswith(('CYRILLIC', 'GREEK')):
            sys.exit('%s: %r (%s) in %r' % (slug, ch, name, page[i - 40:i + 20]))


def main():
    today = sys.argv[1] if len(sys.argv) > 1 else _today()
    files = sorted(f for f in os.listdir(SRC) if f.endswith('.html')
                   and not f.startswith('_'))
    everything = []
    for f in files:
        meta, body = parse(os.path.join(SRC, f))
        meta['_body'] = body
        meta['card'] = meta.get('card', meta['description'])
        everything.append(meta)
    known = {p['slug'] for p in everything}

    # A post is live once its date arrives. Everything else is scheduled and
    # is left out of the build entirely.
    posts = [p for p in everything if p['date'] <= today]
    later = [p for p in everything if p['date'] > today]
    posts.sort(key=lambda p: (p['date'], p['slug']), reverse=True)
    later.sort(key=lambda p: p['date'])

    stale = set(os.listdir(OUT)) - {'index.html'} - {p['slug'] for p in posts}
    for f in sorted(stale):
        os.remove(os.path.join(OUT, f))
        print('unpublished %s (scheduled for later)' % f)

    for p in posts:
        page = build_post(p, p['_body'], posts, known)
        check(page, p['slug'])
        open(os.path.join(OUT, p['slug']), 'w', encoding='utf-8').write(page)

    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(
        build_index(posts))
    build_sitemap(posts)
    inject_home(posts)
    inject_llms(posts)
    print('built %d posts + index + sitemap  (as of %s)' % (len(posts), today))
    if later:
        print('scheduled: %d more, next is %s on %s'
              % (len(later), later[0]['slug'], later[0]['date']))


def _today():
    import datetime
    return datetime.date.today().isoformat()


if __name__ == '__main__':
    main()
