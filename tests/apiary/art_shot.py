"""usage: python3 tests/apiary/art_shot.py OUT [--season S] [--night] [--zoom Z] [--hives N] [--status a,b,..] [--supers 0,1,..] [--upg bearFence,honeyHouse] [--unbuilt] [--real]
Stubs G.Apiary (unless --real and src/apiary.js exists), teleports to (28.75,7.3), screenshots shots/art/OUT.png"""
import sys, pathlib, subprocess, argparse, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent.parent
ap = argparse.ArgumentParser(); ap.add_argument('out'); ap.add_argument('--season', default='spring'); ap.add_argument('--night', action='store_true')
ap.add_argument('--zoom', type=float, default=1.0); ap.add_argument('--hives', type=int, default=4); ap.add_argument('--status', default=''); ap.add_argument('--supers', default='')
ap.add_argument('--upg', default='bearFence,honeyHouse'); ap.add_argument('--unbuilt', action='store_true'); ap.add_argument('--real', action='store_true'); ap.add_argument('--nobuild', action='store_true')
ap.add_argument('--x', type=float, default=28.75); ap.add_argument('--y', type=float, default=7.3)
a = ap.parse_args()
if not a.nobuild: subprocess.run([sys.executable, str(root / 'build.py')], check=True, capture_output=True)
out = root / 'shots' / 'art'; out.mkdir(parents=True, exist_ok=True)
DAY = {'spring': 0, 'summer': 7, 'fall': 14, 'winter': 21}
st = a.status.split(',') if a.status else []; sp = [int(x) for x in a.supers.split(',')] if a.supers else []
hives = [{'id': 'h%d' % i, 'name': 'Hive %d' % (i + 1), 'status': (st[i] if i < len(st) else 'active'), 'strength': .8, 'fill': .4, 'supers': (sp[i] if i < len(sp) else i % 4)} for i in range(a.hives)]
upg = {k: True for k in a.upg.split(',') if k}
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    d = dict(p.devices['iPhone 13 Pro Max']); d.pop('default_browser_type', None)
    pg = b.new_context(**d).new_page()
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto((root / 'index.html').as_uri()); pg.wait_for_timeout(900)
    pg.locator('#name-in').type('Kelly'); pg.locator('#wel-go').tap(); pg.wait_for_timeout(300)
    TJ = f"() => {{ G.state.startedAt = Date.now() - ({DAY[a.season]} + {0.80 if a.night else 0.30}) * G.DAY_SEC * 1000; }}"
    pg.evaluate(TJ)
    pg.evaluate("() => { G.state.coins = 1e7; G.addXP(60000); }")
    pg.evaluate("() => { for (let k = 0; k < 40; k++) { const b = [...document.querySelectorAll('#modal-root button')].find(x => x.offsetParent); if (!b) break; b.click(); } G.uikit.closeSheet(); G.uikit.showTab('farm'); }")
    real = a.real and (root / 'src' / 'apiary.js').exists()
    if real:
        pg.evaluate("() => { G.Apiary.build(); }")
    else:
        pg.evaluate("([hv, up, built]) => { G.Apiary = { isBuilt: () => built, hives: () => hv, maxHives: () => 8, upgrades: () => up, readyCount: () => 1, harvestAll() {} }; }", [hives, upg, not a.unbuilt])
    pg.evaluate(f"() => {{ G.World.teleport({a.x}, {a.y}); G.World.setZoom({a.zoom}); G.World.repaint && G.World.repaint(); }}")
    pg.evaluate(TJ); pg.evaluate("() => { try { G.state.flags['events.nextAt'] = Date.now() + 36e5; } catch (e) {} }")
    pg.wait_for_timeout(4500)
    pg.evaluate("() => { for (let k = 0; k < 40; k++) { const b = [...document.querySelectorAll('#modal-root button')].find(x => x.offsetParent); if (!b) break; b.click(); } G.uikit.closeSheet(); }")
    pg.wait_for_timeout(400)
    pg.screenshot(path=str(out / f'{a.out}.png')); b.close()
print('saved', out / f'{a.out}.png'); print('errors:', len(errs)); [print(' -', e) for e in errs[:10]]
sys.exit(1 if errs else 0)
