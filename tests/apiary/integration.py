"""End-to-end apiary: real G.Apiary drives the 3D art; walk-up harvest; bees; persistence."""
import pathlib, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent.parent
out = root / 'shots' / 'apiary'; out.mkdir(parents=True, exist_ok=True)
errs = []
DIS = "() => { for (let k = 0; k < 40; k++) { const b = [...document.querySelectorAll('#modal-root button')].find(x => x.offsetParent); if (!b) break; b.click(); } G.uikit.closeSheet(); G.uikit.showTab('farm'); }"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    d = dict(p.devices['iPhone 13 Pro Max']); d.pop('default_browser_type', None)
    pg = b.new_context(**d).new_page()
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto((root / 'index.html').as_uri()); pg.wait_for_timeout(900)
    pg.locator('#name-in').type('Kelly'); pg.locator('#wel-go').tap(); pg.wait_for_timeout(300)
    pg.evaluate("() => { G.state.startedAt = Date.now() - (7 + 0.3) * G.DAY_SEC * 1000; G.state.coins = 20000; G.addXP(500); G.state.flags['events.nextAt'] = Date.now() + 36e5; }")
    pg.evaluate(DIS)
    r = {}
    r['level'] = pg.evaluate("() => G.state.level")
    pg.evaluate("() => G.World.goTo('apiary')"); pg.wait_for_timeout(8000)
    r['actBefore'] = pg.evaluate("() => document.getElementById('w-act').textContent.trim()")
    r['build'] = pg.evaluate("() => G.Apiary.build()"); pg.evaluate(DIS)
    r['hives'] = pg.evaluate("() => { for (let i = 0; i < 4; i++) G.Apiary.buyHive(); return G.Apiary.hives().length }")
    r['supers'] = pg.evaluate("() => { G.Apiary.addSuper(0); G.Apiary.addSuper(0); G.Apiary.addSuper(1); return G.Apiary.hives().map(h => h.supers) }")
    r['upgrades'] = pg.evaluate("() => { ['bearFence','honeyHouse'].forEach(k => G.Apiary.upgrade(k)); return Object.keys(G.Apiary.upgrades()) }")
    pg.evaluate(DIS)
    pg.evaluate("() => { const h = G.state.apiary && (G.state.apiary.hives || []); h.slice(0, 2).forEach(x => { if ('fill' in x) x.fill = 1; }); G.tick(); }"); pg.wait_for_timeout(1500)
    r['ready'] = pg.evaluate("() => G.Apiary.readyCount()")
    r['act'] = pg.evaluate("() => document.getElementById('w-act').textContent.trim()")
    pg.screenshot(path=str(out / 'int_built.png'))
    honey0 = pg.evaluate("() => G.qty('honey')")
    pg.locator('#w-act').tap(force=True); pg.wait_for_timeout(800)
    r['honeyGained'] = pg.evaluate("() => G.qty('honey')") - honey0
    r['pollination'] = pg.evaluate("() => G.Apiary.pollinationPct ? G.Apiary.pollinationPct() : null")
    r['yieldApples'] = pg.evaluate("() => G.mods.yield('apples')")
    pg.evaluate("() => G.openPanel('apiary')"); pg.wait_for_timeout(600); pg.screenshot(path=str(out / 'int_panel.png')); pg.evaluate(DIS)
    pg.evaluate("() => { G.state.startedAt = Date.now() - (21 + 0.3) * G.DAY_SEC * 1000; G.tick(); G.World.repaint(); }"); pg.wait_for_timeout(2500); pg.evaluate(DIS)
    pg.screenshot(path=str(out / 'int_winter.png'))
    pg.evaluate("() => G.save()"); pg.reload(); pg.wait_for_timeout(1500)
    r['afterReload'] = pg.evaluate("() => ({ built: G.Apiary.isBuilt(), hives: G.Apiary.hives().length, up: Object.keys(G.Apiary.upgrades()).length })")
    b.close()
print(json.dumps(r, indent=1)); print('errors', len(errs)); [print(' -', e) for e in errs[:10]]
