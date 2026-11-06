"""Covers the gaps: zoom (buttons + pinch), tractor seeder, real stand customers and
restaurant diners on the map (full permit -> service flow), v1 save -> v2 migration,
and emulated real phones."""
import json, pathlib, sys, threading, http.server, functools
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
shots = root / 'shots' / 'untested'; shots.mkdir(parents=True, exist_ok=True)
SRV = '/tmp/kv'  # holds v1.html (first release) and v2.html (current build), same origin
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
handler = functools.partial(Q, directory=SRV)
httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 8765), handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = 'http://127.0.0.1:8765/'
R = {}; ERR = {}
DIS = '''() => { for (let k=0;k<40;k++){ const b=[...document.querySelectorAll('#modal-root button')].find(x=>x.offsetParent); if(!b) break; b.click(); } }'''
FARM = '() => { if (G.uikit) { G.uikit.closeSheet(); G.uikit.showTab("farm") } }'

def page(p, name, **ctxkw):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    kw = dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True); kw.update(ctxkw)
    ctx = b.new_context(**kw); pg = ctx.new_page(); ERR[name] = []
    pg.on('console', lambda m: ERR[name].append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: ERR[name].append('PAGEERROR ' + str(e)))
    return b, ctx, pg

def start(pg, url='v2.html'):
    pg.goto(BASE + url); pg.wait_for_timeout(1200)
    inp = pg.locator('#name-in')
    if inp.count() and inp.is_visible(): inp.type('Kelly'); pg.keyboard.press('Enter'); pg.wait_for_timeout(500)
    pg.evaluate(DIS); pg.evaluate(FARM); pg.wait_for_timeout(400)

with sync_playwright() as p:
    # ---------- 1. zoom: buttons + two-finger pinch ----------
    b, ctx, pg = page(p, 'zoom'); start(pg)
    z = lambda: pg.evaluate('() => G.state.flags["world.zoom"] || 1')
    z0 = z()
    for _ in range(3): pg.locator('#w-zin').tap(); pg.wait_for_timeout(150)
    z_in = z(); pg.screenshot(path=str(shots / 'zoom_in.png'))
    for _ in range(8): pg.locator('#w-zout').tap(); pg.wait_for_timeout(120)
    z_out = z(); pg.screenshot(path=str(shots / 'zoom_out.png'))
    # pinch: two touch points spreading apart (CDP touch = real multi-touch)
    box = pg.locator('canvas').first.bounding_box(); cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    cdp = ctx.new_cdp_session(pg)
    def t(tp, pts): cdp.send('Input.dispatchTouchEvent', {'type': tp, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in enumerate(pts)]})
    before_pinch = z()
    t('touchStart', [(cx - 30, cy), (cx + 30, cy)])
    for i in range(1, 16): t('touchMove', [(cx - 30 - 6 * i, cy), (cx + 30 + 6 * i, cy)]); pg.wait_for_timeout(30)
    t('touchEnd', []); pg.wait_for_timeout(300)
    after_spread = z()
    t('touchStart', [(cx - 120, cy), (cx + 120, cy)])
    for i in range(1, 16): t('touchMove', [(cx - 120 + 7 * i, cy), (cx + 120 - 7 * i, cy)]); pg.wait_for_timeout(30)
    t('touchEnd', []); pg.wait_for_timeout(300)
    after_squeeze = z()
    moved_during_pinch = pg.evaluate('() => G.World.player().moving')
    R['zoom'] = dict(start=z0, after_3_zoom_in=z_in, after_8_zoom_out=z_out, pinch_start=before_pinch,
                     after_pinch_spread=after_spread, after_pinch_squeeze=after_squeeze,
                     clamped_0_7_to_1_5=all(0.7 <= v <= 1.5 for v in [z_in, z_out, after_spread, after_squeeze]),
                     player_still_after_pinch=not moved_during_pinch)
    pg.reload(); pg.wait_for_timeout(1200); pg.evaluate(DIS)
    R['zoom']['persists_after_reload'] = z() == after_squeeze
    b.close()

    # ---------- 2. tractor seeder auto-plant ----------
    b, ctx, pg = page(p, 'seeder'); start(pg)
    R['seeder'] = pg.evaluate('''() => {
      G.state.coins = 1e6; G.addXP(20000); G.state.barnCap = 999;
      const big = G.Machines.list().find(m => m.seeder);
      G.Machines.buy(big.key); G.Machines.equip(big.key);
      G.state.flags['ui.lastCrop'] = 'wheat';
      while (G.state.plots.length < 12) G.buyPlot();
      G.state.plots.forEach((p,i) => { p.status='empty'; p.crop=null; });
      // half the plots ready to harvest, half empty
      [0,1,2,3,4,5].forEach(i => { G.plant(i,'wheat'); G.state.plots[i].readyAt = Date.now()-1; }); G.tick();
      return { tractor: big.name, seeder: big.seeder, radius: big.radius, ready: G.state.plots.filter(p=>p.status==='ready').length,
               empty: G.state.plots.filter(p=>p.status==='empty').length, coinsBefore: G.state.coins };
    }''')
    pg.evaluate(DIS); pg.evaluate(FARM)
    pg.evaluate('() => G.Machines.setDriving(true)')
    R['seeder']['driving'] = pg.evaluate('() => G.Machines.isDriving()')
    pg.evaluate('() => G.World.goTo("fields")'); pg.wait_for_timeout(9000)
    pg.screenshot(path=str(shots / 'seeder_on_fields.png'))
    # sweep along the field rows with the keyboard so every plot is passed over
    for key, ms in [('ArrowDown', 500), ('ArrowLeft', 2500), ('ArrowDown', 400), ('ArrowRight', 4500), ('ArrowDown', 400), ('ArrowLeft', 4500)]:
        pg.keyboard.down(key); pg.wait_for_timeout(ms); pg.keyboard.up(key)
    pg.wait_for_timeout(500)
    R['seeder'].update(pg.evaluate('''() => ({ harvested: G.state.stats.harvested,
      growingAfter: G.state.plots.filter(p=>p.status==='growing').length,
      emptyAfter: G.state.plots.filter(p=>p.status==='empty').length,
      readyAfter: G.state.plots.filter(p=>p.status==='ready').length,
      fuel: G.Machines.fuel(), seedCoinsSpent: null })'''))
    pg.screenshot(path=str(shots / 'seeder_after_sweep.png'))
    b.close()

    # ---------- 3. real stand customers + real restaurant diners on the map ----------
    b, ctx, pg = page(p, 'npcs'); start(pg)
    pg.evaluate('''() => { G.state.coins = 1e6; G.addXP(20000); G.state.barnCap = 999;
      G.state.startedAt = Date.now() - 20*1000;  // early morning = stand open
      ['cherries','apples','eggs','sweet_onions','potatoes','honey'].forEach(k => G.addItem(k, 40));
      G.Stand.build(); ['cherries','apples','eggs','sweet_onions'].forEach((k,i) => G.Stand.stock(i, k, 30)); }''')
    pg.evaluate(DIS); pg.evaluate(FARM)
    pg.evaluate('() => G.World.goTo("stand")'); pg.wait_for_timeout(9000)
    seen = []
    for i in range(20):
        c = pg.evaluate('() => G.Stand.customers().map(c => c.emoji + ":" + c.phase)'); seen.append(c)
        if i == 8: pg.screenshot(path=str(shots / 'stand_real_customers.png'))
        pg.wait_for_timeout(1000)
    R['stand'] = dict(max_simultaneous=max(len(s) for s in seen), phases_seen=sorted({x.split(':')[1] for s in seen for x in s}),
                      sales_today=pg.evaluate('() => G.Stand.todaySales()'))
    # restaurant: run the actual permit questline through its API, fast-forwarding only the timers
    R['restaurant'] = pg.evaluate('''() => { const R = G.Restaurant, r = () => G.state.restaurant, log = [];
      log.push('apply:' + R.apply()); log.push('hearing->farm:' + R.resolveHearing('farm'));
      r().permit.inspectEnd = Date.now() - 1; G.tick(); R.step && R.step(Date.now()); log.push('step:' + r().permit.step);
      log.push('reno:' + R.reno()); r().permit.buildEnd = Date.now() - 1; G.tick(); R.step && R.step(Date.now()); log.push('stage:' + R.stage());
      ['lentils','bread','sweet_onions','potatoes','butter','cherries','flour','eggs','ipa','apple_pie','milk','hummus','mint'].forEach(k => G.addItem(k, 30));
      const ds = R.dishes().filter(d => G.hasItems(d.inputs) && G.state.level >= d.level).slice(0, 4);
      ds.forEach(d => { R.toggleMenu(d.id); R.cook(d.id); R.cook(d.id); });
      r().queue.forEach(j => j.readyAt = Date.now() - 1); G.tick(); R.step && R.step(Date.now());
      log.push('menu:' + r().menu.join(',')); log.push('pass:' + JSON.stringify(r().pass));
      log.push('service:' + R.startService()); return log; }''')
    pg.evaluate(DIS); pg.evaluate(FARM)
    pg.evaluate('() => G.World.goTo("restaurant")'); pg.wait_for_timeout(9000)
    diners = []
    for i in range(30):
        diners.append(pg.evaluate('() => G.Restaurant.customers().map(c => c.phase + "@" + c.table)'))
        if i == 18: pg.screenshot(path=str(shots / 'restaurant_real_diners.png'))
        pg.wait_for_timeout(1000)
    R['restaurant_diners'] = dict(max_seated_or_eating=max(sum(1 for x in d if x.split('@')[0] in ('seated', 'eating')) for d in diners),
                                  phases_seen=sorted({x.split('@')[0] for d in diners for x in d}),
                                  serving=pg.evaluate('() => G.Restaurant.isServing()'))
    b.close()

    # ---------- 4. v1 save -> v2 ----------
    b, ctx, pg = page(p, 'migration')
    start(pg, 'v1.html')
    pg.evaluate('''() => { G.state.coins = 777; G.addXP(300); G.buyBuilding && G.buyBuilding('feed_mill');
      G.plant(0,'wheat'); G.plant(1,'lentils'); G.addItem('apples', 5); G.save(); }''')
    v1 = pg.evaluate('() => ({level:G.state.level, coins:G.state.coins, name:G.state.playerName, plots:G.state.plots.filter(p=>p.status!=="empty").length, apples:G.state.barn.apples, buildings:G.state.buildings.length, hasWorld:!!G.World})')
    pg.goto(BASE + 'v2.html'); pg.wait_for_timeout(1500)
    welcome_reprompted = pg.locator('#name-in').count() > 0 and pg.locator('#name-in').is_visible()
    pg.evaluate(DIS); pg.evaluate(FARM); pg.wait_for_timeout(800)
    v2 = pg.evaluate('''() => ({level:G.state.level, coins:G.state.coins, name:G.state.playerName, plots:G.state.plots.filter(p=>p.status!=="empty").length, apples:G.state.barn.apples, buildings:G.state.buildings.length,
       hasWorld:!!G.World, ranch:!!G.state.ranch || (G.Ranch.herd(), !!G.state.ranch), stand:G.Stand.isBuilt(), restaurant:G.Restaurant.stage(), machines:(G.Machines.owned()||[]).length})''')
    pg.screenshot(path=str(shots / 'migrated_v1_save.png'))
    # and the new features work on the migrated save
    v2['newFeaturesWork'] = pg.evaluate('''() => { G.state.coins += 5000; G.addXP(3000);
       return { calf: !!G.Ranch.buyCalf('angus'), stand: !!G.Stand.build(), tractor: G.Machines.buy('rusty72') !== false } }''')
    R['migration'] = dict(v1=v1, v2=v2, welcome_reprompted=welcome_reprompted)
    b.close()

    # ---------- 5. emulated real phones ----------
    R['devices'] = {}
    for dev in ['iPhone SE', 'iPhone 13 Pro Max', 'Pixel 5', 'Galaxy S9+']:
        d = dict(p.devices[dev]); d.pop('default_browser_type', None)
        b, ctx, pg = page(p, dev, **d); start(pg)
        info = pg.evaluate('''() => { const r = s => { const e=document.querySelector(s); if(!e) return null; const b=e.getBoundingClientRect(); return [Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)] };
          return { vw: innerWidth, vh: innerHeight, canvas: r('canvas'), tabbar: r('#tabbar'), hscroll: document.documentElement.scrollWidth > innerWidth } }''')
        pg.evaluate('() => G.World.goTo("fields")'); pg.wait_for_timeout(2500)
        pg.screenshot(path=str(shots / f'device_{dev.replace(" ", "_")}.png'))
        info['actionBtn'] = pg.evaluate('() => { const b=[...document.querySelectorAll("button")].find(x=>x.offsetParent && /Plant|Harvest|Shed|Barn/.test(x.textContent)); if(!b) return null; const r=b.getBoundingClientRect(); return {txt:b.textContent.trim().slice(0,20), bottom:Math.round(r.bottom), h:Math.round(r.height)} }')
        R['devices'][dev] = info
        b.close()
httpd.shutdown()
(root / 'shots' / 'untested' / 'results.json').write_text(json.dumps(R, indent=1)); print(json.dumps(R, indent=1))
for k, v in ERR.items(): print(f'ERRORS[{k}]:', len(v), v[:5])
