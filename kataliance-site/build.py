#!/usr/bin/env python3
"""Inline the brand assets into concepts.src.html -> concepts.html (self-contained)."""
import base64, pathlib, sys

root = pathlib.Path(__file__).parent
A = root / 'assets'
MAP = {
    '__LOGO__':      ('logo.png',           'image/png'),
    '__LOGOLIGHT__': ('logo-light.png',     'image/png'),
    '__MONO__':      ('monogram.png',       'image/png'),
    '__MONOLIGHT__': ('monogram-light.png', 'image/png'),
    '__AHONA__':     ('ahona.jpg',          'image/jpeg'),
    '__MUDIT__':     ('mudit.jpg',          'image/jpeg'),
}

src = (root / 'concepts.src.html').read_text(encoding='utf-8')
for token, (name, mime) in MAP.items():
    data = base64.b64encode((A / name).read_bytes()).decode()
    src = src.replace(token, f'data:{mime};base64,{data}')

left = [t for t in MAP if t in src]
if left:
    sys.exit(f'unsubstituted tokens: {left}')

out = root / 'concepts.html'
out.write_text(src, encoding='utf-8')
print(f'{out.name}: {len(src)/1024:.0f} KB')
