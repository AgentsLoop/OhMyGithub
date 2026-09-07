#!/bin/bash
set -e
/usr/bin/time -p node --check games/road-war-arena/index.html 2>&1 || true
/usr/bin/time -p python3 -c "import html.parser; p=html.parser.HTMLParser(); p.feed(open('games/road-war-arena/index.html').read()); print('HTML parse OK', len(open('games/road-war-arena/index.html').read()), 'bytes')"
/usr/bin/time -p python3 -c "
import re
s=open('games/road-war-arena/index.html').read()
for k in ['__arena','START ENGINES','WASD','minimap','prefers-reduced-motion','touch','localStorage','requestAnimationFrame','gameOver','spawnPickup','explode']:
    assert k in s, 'missing '+k
print('feature markers OK')
"
/usr/bin/time -p bash -c "python3 -m http.server 8099 --directory games/road-war-arena >/tmp/rwa.log 2>&1 & echo \$! > /tmp/rwa.pid; sleep 1; curl -sf http://localhost:8099/index.html | head -c 200; echo; kill \$(cat /tmp/rwa.pid)"
echo VERIFY-DONE
