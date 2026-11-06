import pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent
url = (root.parent.parent / 'index.html').resolve().as_uri()
shots = root / 'shots'; shots.mkdir(exist_ok=True)
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    pg.goto(url); pg.wait_for_timeout(1000)
    pg.evaluate("""() => { G.setPlayerName('Kelly'); G.state.flags['ui.welcomed']=true; document.querySelectorAll('.modal,#modal-root').forEach(m=>m.hidden=true);
      G.state.level=4; G.state.coins=2000; G.state.barnCap=300;
      G.state.barn={apples:60,eggs:24,milk:12,sweet_onions:40,honey:9,bread:14,wheat:50,cheese:6,cherries:20,corn:30};
      G.calendar = () => ({day:1, season:'summer', dayProgress:0.4, year:1, dayOfSeason:1}); G.openPanel('stand'); }""")
    pg.wait_for_timeout(600)
    pg.screenshot(path=str(shots / 's1_build.png'))
    pg.locator('[data-pa=build]').tap(); pg.wait_for_timeout(500)
    pg.screenshot(path=str(shots / 's2_empty.png'))
    pg.locator('[data-pa=slot]').first.tap(); pg.wait_for_timeout(500)
    pg.locator('[data-pa=pick][data-k=sweet_onions]').tap(); pg.wait_for_timeout(300)
    pg.locator('[data-pa=tier][data-t="2"]').tap(); pg.locator('[data-pa=qty][data-q=all]').tap(); pg.wait_for_timeout(500)
    pg.screenshot(path=str(shots / 's3_picker.png'))
    pg.locator('[data-pa=stock]').tap(); pg.wait_for_timeout(400)
    pg.evaluate("""() => { ['apples','eggs','milk','honey','bread'].forEach((k,i)=>G.Stand.stock(i+1,k,G.qty(k),i%3)); G.Stand.upgrade('sign'); G.Stand.ensure().rep=3.7; }""")
    pg.evaluate("() => { window.__off=0; const rd=Date.now; Date.now=()=>rd()+window.__off; G.Stand.ensure().lastSeen=Date.now(); }")
    for i in range(50):
        pg.evaluate("() => { window.__off+=1500; G.bus.emit('tick',{now:Date.now(), cal:G.calendar()}); }")
    pg.wait_for_timeout(300)
    print(pg.evaluate("() => JSON.stringify(G.Stand.customers())"))
    pg.screenshot(path=str(shots / 's4_customers.png'))
    pg.locator('.sheet, #sheet-body, .panel-body').first.evaluate("e => (e.closest('#sheet-body')||e).scrollTo(0, 900)")
    pg.wait_for_timeout(400); pg.screenshot(path=str(shots / 's5_upgrades.png'))
    print('errors', errors)
