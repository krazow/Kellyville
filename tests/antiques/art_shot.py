"""usage: python3 tests/antiques/art_shot.py NAME [--view walk|road] [--season spring|summer|fall|winter] [--night] [--zoom 1.0] [--level 1..3] [--ups none|all|porch,neonSign,...] [--unbuilt] [--stub]
Screenshots the antique store on an iPhone 13 Pro Max profile into shots/art/antiques_NAME.png. Uses the real G.Antiques if src/antiques.js exists (unless --stub)."""
import sys, pathlib, subprocess, argparse
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent.parent
ap = argparse.ArgumentParser(); ap.add_argument('out'); ap.add_argument('--view', default='walk'); ap.add_argument('--season', default='spring'); ap.add_argument('--night', action='store_true')
ap.add_argument('--zoom', type=float, default=1.0); ap.add_argument('--level', type=int, default=3); ap.add_argument('--ups', default='all'); ap.add_argument('--unbuilt', action='store_true'); ap.add_argument('--stub', action='store_true'); ap.add_argument('--nobuild', action='store_true')
a = ap.parse_args()
if not a.nobuild: subprocess.run([sys.executable, str(root / 'build.py')], check=True, capture_output=True)
out = root / 'shots' / 'art'; out.mkdir(parents=True, exist_ok=True)
DAY = {'spring': 0, 'summer': 7, 'fall': 14, 'winter': 21}
ups = {} if a.ups == 'none' else {k: True for k in (['porch', 'neonSign', 'workshop', 'secondFloor'] if a.ups == 'all' else a.ups.split(','))}
import json
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    d = dict(p.devices['iPhone 13 Pro Max']); d.pop('default_browser_type', None)
    pg = b.new_context(**d).new_page()
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto((root / 'index.html').as_uri()); pg.wait_for_timeout(900)
    pg.locator('#name-in').type('Kelly'); pg.locator('#wel-go').tap(); pg.wait_for_timeout(300)
    prog = 0.80 if a.night else 0.30
    TIME = f"() => {{ G.state.startedAt = Date.now() - ({DAY[a.season]} + {prog}) * G.DAY_SEC * 1000; }}"
    pg.evaluate(TIME)
    real = (root / 'src' / 'antiques.js').exists() and not a.stub and not a.unbuilt
    if a.unbuilt:
        pg.evaluate("() => { G.Antiques = G.Antiques || {}; const o = G.Antiques; o.isBuilt = () => false; }")
    elif real:
        pg.evaluate("""([lvl, ups]) => { const s = G.state; s.coins = 1e8; G.addXP(60000); try { G.Antiques.build(); } catch (e) { console.warn('build', e); }
          try { s.antiques = s.antiques || {}; s.antiques.level = lvl; s.antiques.upgrades = ups; } catch (e) {}
          try { G.Antiques.__stubOverride && 0; } catch (e) {} }""", [a.level, ups])
    else:
        pg.evaluate("""([lvl, ups]) => { const disp = [['🕰️','Mantel clock'],['🏺','Vase'],['📻','Radio'],['🪑','Chair'],['🔔','Cowbell'],['📷','Camera']].map((x, i) => ({ key: 'k' + i, emoji: x[0], name: x[1] }));
          G.Antiques = { isBuilt: () => true, level: () => lvl, upgrades: () => ups, display: () => disp.slice(0, lvl === 1 ? 2 : 6), name: () => "Kelly's Antiques", customers: () => [], offerCount: () => 0 }; }""", [a.level, ups])
    pg.evaluate("() => { for (let k = 0; k < 40; k++) { const b = [...document.querySelectorAll('#modal-root button')].find(x => x.offsetParent); if (!b) break; b.click(); } G.uikit.closeSheet(); G.uikit.showTab('farm'); }")
    ty = 32.6 if a.view == 'walk' else 27
    pg.evaluate(f"() => {{ G.World.teleport(20, {ty}); G.World.setZoom({a.zoom}); G.World.repaint && G.World.repaint(); }}")
    pg.evaluate(TIME)
    pg.evaluate("() => { try { G.state.flags['events.nextAt'] = Date.now() + 36e5; } catch (e) {} }")
    pg.wait_for_timeout(2200)
    pg.evaluate("() => { for (let k = 0; k < 40; k++) { const b = [...document.querySelectorAll('#modal-root button')].find(x => x.offsetParent); if (!b) break; b.click(); } G.uikit.closeSheet(); }")
    pg.wait_for_timeout(400)
    pg.screenshot(path=str(out / f'antiques_{a.out}.png'))
    b.close()
print('saved', out / f'antiques_{a.out}.png'); print('errors:', len(errs)); [print(' -', e) for e in errs[:15]]
sys.exit(1 if errs else 0)
