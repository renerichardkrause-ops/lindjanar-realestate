#!/usr/bin/env python3
"""Add the flambient line to the photographer section of index.html.

Written ahead of time and scheduled, so the run that publishes it has
nothing to decide. Idempotent: exits cleanly if it is already there.

    python3 tools/publish_flambient.py
"""
import os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

ET = ('Kallimate korterite puhul pildistan flambient-meetodil: välk ja olemasolev valgus '
      'eraldi kaadritena, mis pärast kokku pannakse. Aknast paistab päris vaade, mitte valge '
      'laik, seinavärvid on õiged ja ruum ei ole kollane. Kiiret tööd tegevad fotograafid seda '
      'enamasti ei tee, sest kohapeal ja töötluses kulub rohkem aega.')
EN = ('For higher-end apartments I shoot flambient: flash and ambient light captured as separate '
      'frames and blended afterwards. The window shows the actual view rather than a white patch, '
      'wall colours are true, and the room is not yellow. Photographers working at speed usually '
      'skip it, because it costs more time both on site and in editing.')

ANCHOR = ('data-et="Rahulolu on kõige tähtsam."')

s = open('index.html', encoding='utf-8').read()

if 'flambient' in s:
    print('flambient line already present – nothing to do')
    sys.exit(0)

i = s.find(ANCHOR)
if i == -1:
    sys.exit('publish_flambient: anchor paragraph not found in index.html')

# Walk back to the start of the <p> that carries the anchor, and insert ours before it.
start = s.rfind('<p', 0, i)
if start == -1:
    sys.exit('publish_flambient: could not find the opening <p>')
indent = ''
line_start = s.rfind('\n', 0, start) + 1
indent = s[line_start:start]

para = '<p data-et="%s" data-en="%s">%s</p>\n%s' % (ET, EN, ET, indent)
s = s[:start] + para + s[start:]

if '—' in para:
    sys.exit('publish_flambient: em dash in the new copy')

open('index.html', 'w', encoding='utf-8').write(s)
print('flambient line added to the photographer section')
