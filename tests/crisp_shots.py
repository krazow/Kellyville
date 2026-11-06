"""Capture crops of the world on a 3x iPhone at zoom 1.0 and 1.5 for crispness comparison."""
import sys, pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent; tag = sys.argv[1]; out = root / 'shots' / 'crisp'; out.mkdir(parents=True, exist_ok=True)
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    d = dict(p.devices['iPhone 13 Pro Max']); d.pop('default_browser_type', None)
    pg = b.new_context(**d).new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto((root / 'index.html').as_uri()); pg.wait_for_timeout(1000)
    pg.locator('#name-in').type('Kelly'); pg.locator('#wel-go').tap(); pg.wait_for_timeout(400)
    pg.evaluate("()=>{G.state.coins=1e5;G.addXP(3000);G.buyBuilding('feed_mill');G.buyAnimal('chickens');for(let i=0;i<6;i++)G.plant(i,i%2?'lentils':'wheat');}")
    pg.evaluate("()=>{for(let k=0;k<20;k++){const b=[...document.querySelectorAll('#modal-root button')].find(x=>x.offsetParent);if(!b)break;b.click()}G.uikit.showTab('farm')}")
    pg.evaluate("()=>G.World.teleport(8,8.6)"); pg.wait_for_timeout(600)
    for z in [1.0, 1.5]:
        pg.evaluate(f"()=>{{ G.state.flags['world.zoom']={z}; }}")
        # use the +/- buttons path to set zoom through the real code
        cur = pg.evaluate("()=>G.state.flags['world.zoom']")
        for _ in range(12): pg.locator('#w-zout').tap(force=True); pg.wait_for_timeout(40)
        if z > 1.0:
            for _ in range(12): pg.locator('#w-zin').tap(force=True); pg.wait_for_timeout(40)
        else:
            for _ in range(3): pg.locator('#w-zin').tap(force=True); pg.wait_for_timeout(40)
        pg.wait_for_timeout(900)
        zz = pg.evaluate("()=>G.state.flags['world.zoom']")
        pg.screenshot(path=str(out / f'{tag}_z{z}_full.png'))
        pg.screenshot(path=str(out / f'{tag}_z{z}_crop.png'), clip={'x': 60, 'y': 300, 'width': 200, 'height': 200})
        print(tag, 'zoom', zz)
    print('errors', errs); b.close()
