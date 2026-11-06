#!/usr/bin/env python3
"""Concatenate src/ into one self-contained dist/index.html."""
import pathlib, re
root = pathlib.Path(__file__).parent
src = root / 'src'
read = lambda n: (src / n).read_text(encoding='utf-8')
js_order = ['core.js', 'data.js', 'events.js', 'economy.js', 'machines.js', 'ranch.js', 'stand.js', 'restaurant.js', 'ui.js', 'world.js']
js_order = [n for n in js_order if (src / n).exists()]
scripts = '\n'.join(f'<script>/* ---- {n} ---- */\n{read(n)}\n</script>' for n in js_order)
html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#e9b949">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Kellyville">
<meta name="description" content="Kellyville: a cozy farming game set in Eastern Washington.">
<title>Kellyville</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌾</text></svg>">
<style>
{read('styles.css')}
</style>
</head>
<body>
{read('body.html')}
{scripts}
</body>
</html>
'''
html = html.replace('Palouse Harvest', 'Kellyville')

(root / 'index.html').write_text(html, encoding='utf-8')
print('built', len(html), 'bytes')
