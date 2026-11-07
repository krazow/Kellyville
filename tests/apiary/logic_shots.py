"""python3 tests/apiary/logic_shots.py : screenshots the apiary panel (not built / built) and checks the walk-up action."""
import sys, pathlib, subprocess
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent.parent
subprocess.run([sys.executable, str(root / 'build.py')], check=True, capture_output=True)
out = root / 'tests' / 'apiary' / 'shots'; out.mkdir(parents=True, exist_ok=True)
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    d = dict(p.devices['iPhone 13 Pro Max']); d.pop('default_browser_type', None)
    pg = b.new_context(**d).new_page()
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto((root / 'index.html').as_uri()); pg.wait_for_timeout(900)
    pg.locator('#name-in').type('Kelly'); pg.locator('#wel-go').tap(); pg.wait_for_timeout(300)
    pg.evaluate("() => { G.state.startedAt = Date.now() - 7.3 * G.DAY_SEC * 1000; G.state.coins = 5000; G.addXP(3000); G.state.barnCap = 999; G.state.flags['events.nextAt'] = Date.now() + 36e6; }")
    def clear(): pg.evaluate("() => { for (let k = 0; k < 40; k++) { const b = [...document.querySelectorAll('#modal-root button')].find(x => x.offsetParent); if (!b) break; b.click(); } }")
    clear()
    pg.wait_for_timeout(5500); pg.evaluate("() => G.openPanel('apiary')"); pg.wait_for_timeout(700); pg.screenshot(path=str(out / 'panel_not_built.png'))
    pg.evaluate("() => G.closePanel()")
    pg.evaluate("() => { G.Apiary.build(); }"); pg.wait_for_timeout(300); clear()
    pg.evaluate("""() => { const A = G.Apiary; A.buyHive(); A.addSuper(0); A.addSuper(0); A.upgrade('honeyHouse'); const hs = G.state.apiary.hives;
      hs[0].fill = 1; hs[0].strength = 0.95; hs[1].fill = 0.45; hs[1].strength = 0.7; hs[1].mites = 0.55; hs[2].mites = 0.3; hs[2].fill = 0.2; hs[1].swarmAt = Date.now() + 60000;
      G.tick(); }""")
    pg.wait_for_timeout(5500)
    pg.evaluate("() => G.openPanel('apiary')"); pg.wait_for_timeout(700); pg.screenshot(path=str(out / 'panel_built.png'))
    pg.evaluate("() => document.querySelector('#sheet-body').scrollTo(0, 99999)"); pg.wait_for_timeout(300); pg.screenshot(path=str(out / 'panel_built_scrolled.png'))
    for k in ('orch', 'up'):
        pg.evaluate(f"() => document.querySelector('[data-pa=tab][data-k={k}]').click()"); pg.wait_for_timeout(700); pg.screenshot(path=str(out / f'panel_{k}.png'))
    pg.evaluate("() => { G.closePanel(); G.state.startedAt = Date.now() - 21.3 * G.DAY_SEC * 1000; G.tick(); }"); pg.wait_for_timeout(1500)
    pg.evaluate("() => { G.openPanel('apiary'); document.querySelector('[data-pa=tab][data-k=hives]').click(); }"); pg.wait_for_timeout(700); pg.screenshot(path=str(out / 'panel_winter.png'))
    pg.evaluate("() => { G.closePanel(); G.state.startedAt = Date.now() - 7.3 * G.DAY_SEC * 1000; const hs = G.state.apiary.hives; hs[0].fill = 1; hs[0].sick = false; G.tick(); }"); pg.wait_for_timeout(1600)
    pg.evaluate("() => G.World.goTo('apiary')"); pg.wait_for_timeout(9000)
    act = pg.evaluate("() => (document.querySelector('#w-act') || {}).textContent")
    print('walk-up action:', repr(act), 'ready=', pg.evaluate("() => G.Apiary.readyCount()"))
    pg.screenshot(path=str(out / 'world.png'))
    ok = act and 'Harvest honey' in act
    b.close()
print('errors:', len(errs)); [print(' -', e) for e in errs[:15]]
sys.exit(0 if ok and not errs else 1)
