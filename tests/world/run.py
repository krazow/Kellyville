import sys, json, pathlib, time
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parents[2]
url = (root / 'index.html').as_uri()
shots = root / 'shots' / 'world'; shots.mkdir(parents=True, exist_ok=True)
errors = []
def cdp_drag(cdp, x0, y0, x1, y1, steps=12, hold=0.5):
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y0, 'id': 1}]})
    for i in range(1, steps + 1):
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x0 + (x1 - x0) * i / steps, 'y': y0 + (y1 - y0) * i / steps, 'id': 1}]})
        time.sleep(0.02)
    time.sleep(hold)
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.on('console', lambda m: errors.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    pg.goto(url); pg.wait_for_timeout(1000)
    pg.screenshot(path=str(shots / '00_welcome.png'))
    inp = pg.locator('input:visible').first
    inp.tap(); inp.type('Kelly'); pg.wait_for_timeout(200)
    pg.evaluate("() => { const b=[...document.querySelectorAll('button')].find(x=>/Start farming/i.test(x.textContent)); b && b.click(); }")
    pg.wait_for_timeout(900)
    pg.screenshot(path=str(shots / '01_world.png'))
    print('enabled', pg.evaluate('() => G.World && G.World.enabled()'), 'player', pg.evaluate('() => G.World.player()'))
    # joystick drag (real touch events through CDP): drag left-down
    cdp = ctx.new_cdp_session(pg)
    before = pg.evaluate('() => G.World.player()')
    cdp_drag(cdp, 90, 700, 40, 740, hold=0.8)
    after = pg.evaluate('() => G.World.player()')
    print('joystick moved', before, '->', after)
    pg.screenshot(path=str(shots / '02_after_joystick.png'))
    # walk to the field: tap-to-walk
    pg.evaluate("() => G.World.teleport(8, 9.9)")
    pg.wait_for_timeout(400)
    pg.screenshot(path=str(shots / '03_field.png'))
    print('action btn', pg.evaluate("() => { const b=document.getElementById('w-act'); return b.hidden ? null : b.textContent }"))
    pg.locator('#w-act').tap(force=True); pg.wait_for_timeout(500)
    pg.screenshot(path=str(shots / '04_seedsheet.png'))
    pg.evaluate("() => { const e=document.querySelector('[data-act=seed]'); e && e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); }")
    pg.locator('[data-act=seed]:visible').first.tap(); pg.wait_for_timeout(600)
    print('plots', pg.evaluate("() => G.state.plots.map(p=>p.status)"))
    # force ready & harvest by walking
    pg.evaluate("() => { G.state.plots.forEach((p,i)=>{ if(p.status==='growing') p.readyAt=Date.now()-1; }); G.tick(); }")
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(shots / '05_ready.png'))
    print('action btn', pg.evaluate("() => { const b=document.getElementById('w-act'); return b.hidden ? null : b.textContent }"))
    pg.locator('#w-act').tap(force=True); pg.wait_for_timeout(400)
    pg.screenshot(path=str(shots / '06_harvested.png'))
    print('barn', pg.evaluate("() => JSON.stringify(G.state.barn)"))
    print('ERRORS', errors)
    b.close()
