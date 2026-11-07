"""End-to-end: real G.Antiques drives the 3D art (build -> buy -> display -> upgrades), plus world action."""
import pathlib, sys, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent.parent
out = root / 'shots' / 'antiques'; out.mkdir(parents=True, exist_ok=True)
errs = []
DIS = "() => { for (let k = 0; k < 40; k++) { const b = [...document.querySelectorAll('#modal-root button')].find(x => x.offsetParent); if (!b) break; b.click(); } G.uikit.closeSheet(); G.uikit.showTab('farm'); }"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    d = dict(p.devices['iPhone 13 Pro Max']); d.pop('default_browser_type', None)
    pg = b.new_context(**d).new_page()
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto((root / 'index.html').as_uri()); pg.wait_for_timeout(900)
    pg.locator('#name-in').type('Kelly'); pg.locator('#wel-go').tap(); pg.wait_for_timeout(300)
    pg.evaluate("() => { G.state.startedAt = Date.now() - 0.3 * G.DAY_SEC * 1000; G.state.coins = 20000; G.addXP(800); G.state.flags['events.nextAt'] = Date.now() + 36e5; }")
    pg.evaluate(DIS)
    r = {}
    r['before'] = pg.evaluate("() => { G.World.goTo('antiques'); return null }"); pg.wait_for_timeout(9000)
    r['actBefore'] = pg.evaluate("() => document.getElementById('w-act').textContent.trim()")
    r['level'] = pg.evaluate("() => G.state.level")
    r['build'] = pg.evaluate("() => G.Antiques.build()")
    r['coinsAfterBuild'] = pg.evaluate("() => G.state.coins")
    pg.evaluate(DIS)
    r['bought'] = pg.evaluate("() => { let n = 0; for (let k = 0; k < 6; k++) { const L = G.Antiques.listings(); const l = (Array.isArray(L) ? L : Object.values(L).flat()).find(x => x && !x.sold); if (!l || !G.Antiques.buyListing(l.id)) break; n++; } return n; }")
    r['displayed'] = pg.evaluate("() => { const inv = G.Antiques.inventory(); inv.forEach(x => G.Antiques.setDisplay(x.id, true)); return G.Antiques.display().map(d => d.emoji).join(''); }")
    pg.evaluate("() => G.World.teleport(20, 32.6)"); pg.wait_for_timeout(2500); pg.evaluate(DIS); pg.wait_for_timeout(500)
    pg.screenshot(path=str(out / 'int_level1.png'))
    r['upgrades'] = pg.evaluate("() => { G.state.coins += 20000; ['porch','neonSign','workshop','shelves','appraiser','secondFloor'].forEach(k => G.Antiques.upgrade(k)); return [G.Antiques.level(), Object.keys(G.Antiques.upgrades())]; }")
    r['displayed2'] = pg.evaluate("() => { G.Antiques.inventory().forEach(x => G.Antiques.setDisplay(x.id, true)); return G.Antiques.display().map(d => d.emoji).join(''); }")
    pg.evaluate(DIS); pg.wait_for_timeout(2500); pg.evaluate(DIS)
    pg.screenshot(path=str(out / 'int_upgraded.png'))
    pg.wait_for_timeout(25000)
    r['shoppers'] = pg.evaluate("() => G.Antiques.customers().map(c => c.emoji + ':' + c.phase)")
    r['offers'] = pg.evaluate("() => G.Antiques.offerCount()"); r['act'] = pg.evaluate("() => document.getElementById('w-act').textContent.trim()")
    r['stats'] = pg.evaluate("() => G.Antiques.stats()")
    pg.screenshot(path=str(out / 'int_shoppers.png'))
    pg.evaluate("() => G.openPanel('antiques')"); pg.wait_for_timeout(600); pg.screenshot(path=str(out / 'int_panel.png'))
    pg.evaluate("() => { G.uikit.closeSheet(); G.save(); }"); pg.reload(); pg.wait_for_timeout(1500)
    r['afterReload'] = pg.evaluate("() => ({ built: G.Antiques.isBuilt(), up: Object.keys(G.Antiques.upgrades()).length, display: G.Antiques.display().length })")
    b.close()
print(json.dumps(r, indent=1)); print('errors', len(errs)); [print(' -', e) for e in errs[:10]]
