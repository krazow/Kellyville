import pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parents[2]
url = (root / 'index.html').as_uri()
out = root / 'tests' / 'restaurant' / 'shots'; out.mkdir(exist_ok=True)
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    pg.goto(url); pg.wait_for_timeout(1000)
    inp = pg.locator('input:visible').first
    inp.tap(); inp.type('Kelly'); pg.wait_for_timeout(200)
    pg.evaluate("""() => { const b=[...document.querySelectorAll('button')].find(x=>/Start farming/i.test(x.textContent)); b&&b.click(); }""")
    pg.wait_for_timeout(800)
    def shot(name, delay=700):
        pg.wait_for_timeout(delay); pg.screenshot(path=str(out / (name + '.png')))
    def modal_close():
        for _ in range(4):
            pg.evaluate("() => { const b=document.querySelector('[data-act=m-choice]'); b&&b.click(); }"); pg.wait_for_timeout(250)
    pg.evaluate("() => { G.state.level=12; G.state.coins=20000; G.state.barnCap=2000; G.openPanel('restaurant'); }")
    shot('1_permit_apply')
    pg.evaluate("() => G.panels.restaurant.onAction('apply',{dataset:{}})"); shot('2_apply_modal'); modal_close()
    pg.evaluate("() => G.panels.restaurant.onAction('hearing',{dataset:{}})"); shot('3_hearing_modal')
    pg.evaluate("() => { const bs=document.querySelectorAll('[data-act=m-choice]'); bs[1].click(); }"); pg.wait_for_timeout(300); modal_close()
    shot('4_inspection')
    pg.evaluate("() => { const r=G.state.restaurant; r.permit.inspectEnd=Date.now()-1; }"); shot('5_approved', 1200)
    pg.evaluate("() => G.panels.restaurant.onAction('reno',{dataset:{}})"); pg.wait_for_timeout(300); modal_close(); shot('6_building')
    pg.evaluate("() => { const r=G.state.restaurant; r.permit.buildEnd=Date.now()-1; }"); pg.wait_for_timeout(1200); shot('7_grand_opening')
    modal_close()
    pg.evaluate("""() => { ['hummus','bread','mint','lentils','sweet_onions','cherries','flour','butter','cheese','honey'].forEach(k=>G.addItem(k,30));
      G.Restaurant.toggleMenu('hummus_board'); G.Restaurant.toggleMenu('lentil_burger'); G.Restaurant.toggleMenu('cherry_cobbler'); G.Restaurant.toggleMenu('smash_burger');
      G.openPanel('restaurant'); G.panels.restaurant.onAction('tab',{dataset:{tab:'menu'}}); }""")
    shot('8_menu')
    pg.evaluate("""() => { G.panels.restaurant.onAction('tab',{dataset:{tab:'kitchen'}}); G.Restaurant.cook('hummus_board'); G.Restaurant.cook('lentil_burger'); }""")
    shot('9_kitchen')
    pg.evaluate("""() => { const r=G.state.restaurant; r.queue.forEach(j=>j.readyAt=Date.now()); r.pass={hummus_board:12,lentil_burger:12,cherry_cobbler:9}; G.panels.restaurant.onAction('tab',{dataset:{tab:'service'}}); }""")
    shot('10_service_idle')
    pg.evaluate("""() => { G.Restaurant.toggleStaff('server'); G.Restaurant.startService(); }""")
    pg.wait_for_timeout(16000); shot('11_service_live', 100)
    pg.evaluate("() => G.panels.restaurant.onAction('tab',{dataset:{tab:'staff'}})"); shot('12_staff')
    pg.evaluate("() => { G.state.restaurant.service.endAt=Date.now()-1; G.state.restaurant.service.guests=[]; }"); pg.wait_for_timeout(1500); shot('13_summary')
    modal_close()
    pg.evaluate("() => G.panels.restaurant.onAction('tab',{dataset:{tab:'service'}})"); shot('14_cooldown')
    # events
    pg.evaluate("() => G.Events.trigger('restaurant_inspector')"); shot('15_event')
    print('ERRORS', errors)
