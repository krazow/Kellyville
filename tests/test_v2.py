"""End-to-end v2 smoke test: world + tractors + ranch + stand + restaurant, mobile viewport."""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
url = (root / 'index.html').as_uri()
shots = root / 'shots' / 'v2'; shots.mkdir(parents=True, exist_ok=True)
errors = []

FARM = '() => { try { G.uikit.closeSheet(); G.uikit.showTab("farm") } catch(e) {} }'
DISMISS = '''() => { let n=0; for (let k=0;k<40;k++){ const b=[...document.querySelectorAll('#modal-root button')].find(x=>x.offsetParent);
  if(!b) break; b.click(); n++; } return n }'''

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    pg.goto(url); pg.wait_for_timeout(1200)
    pg.locator('input:visible').first.type('Kelly'); pg.keyboard.press('Enter'); pg.wait_for_timeout(600)
    pg.evaluate(DISMISS); pg.evaluate(FARM); pg.wait_for_timeout(500)
    pg.screenshot(path=str(shots / '01_world_start.png'))
    r = {}
    r['modules'] = pg.evaluate('() => ({world:!!G.World, machines:!!G.Machines, ranch:!!G.Ranch, stand:!!G.Stand, restaurant:!!G.Restaurant, canvas: !!document.querySelector("canvas")})')

    # joystick drag on the canvas: player should move
    before = pg.evaluate('() => G.World && G.World.player ? JSON.stringify(G.World.player()) : null')
    cv = pg.locator('canvas').first
    box = cv.bounding_box() if cv.count() else None
    if box:
        sx, sy = box['x'] + box['width'] * 0.25, box['y'] + box['height'] * 0.7
        cdp = ctx.new_cdp_session(pg)
        def touch(t, pts): cdp.send('Input.dispatchTouchEvent', {'type': t, 'touchPoints': pts})
        touch('touchStart', [{'x': sx, 'y': sy}])
        for i in range(1, 25):
            touch('touchMove', [{'x': sx + 2.5 * i, 'y': sy - 1.5 * i}]); pg.wait_for_timeout(40)
        pg.wait_for_timeout(500); touch('touchEnd', [])
    after = pg.evaluate('() => G.World && G.World.player ? JSON.stringify(G.World.player()) : null')
    r['playerMoved'] = before != after
    r['zones'] = pg.evaluate('() => { try { const z=G.World.zones(); return Array.isArray(z)? z.map(x=>x.id||x) : Object.keys(z) } catch(e){ return String(e) } }')

    # set up a mid-game farm
    r['setup'] = pg.evaluate('''() => {
      const o = {};
      G.state.coins = 200000; G.addXP(4000); G.state.barnCap = 999;
      ['alfalfa','wheat','potatoes','sweet_onions','lentils','cherries','apples','eggs','milk','butter','bread','cheese','flour','mint','hummus','onion_rings'].forEach(k => G.addItem(k, 30));
      o.level = G.state.level;
      o.tractor = G.Machines.buy('rusty72') !== false; G.Machines.equip('rusty72');
      o.equipped = (G.Machines.equipped()||{}).key;
      o.yieldWith = G.mods.yield('wheat');
      o.calf = !!G.Ranch.buyCalf('angus'); G.Ranch.buyCalf('hereford'); G.Ranch.buyBull();
      o.herd = G.Ranch.herd().length;
      o.stand = G.Stand.build(); G.Stand.stock(0,'cherries',10); G.Stand.stock(1,'eggs',10); G.Stand.stock(2,'apples',10);
      o.restStage = G.Restaurant.stage();
      return o;
    }''')
    pg.evaluate(DISMISS); pg.wait_for_timeout(400)
    for i in range(6): pg.evaluate(f'() => G.plant({i}, "wheat")')
    pg.evaluate('() => { G.state.plots.forEach((p,i)=>{ if(i<3 && p.status==="growing") p.readyAt=Date.now()-1 }); G.tick(); }')
    pg.evaluate(DISMISS); pg.evaluate(FARM); pg.wait_for_timeout(2500)
    pg.screenshot(path=str(shots / '02_world_midgame.png'))

    # drive the tractor over the field
    r['drive'] = pg.evaluate('() => { G.Machines.setDriving(true); return G.Machines.isDriving() }')
    for z in ['fields', 'pasture', 'stand', 'restaurant', 'shed']:
        pg.evaluate(FARM)
        pg.evaluate(f'() => {{ try {{ G.World.goTo("{z}") }} catch(e) {{ console.error("goTo {z}", e) }} }}')
        pg.evaluate(DISMISS); pg.evaluate(FARM)
        pg.wait_for_timeout(3500)
        pg.screenshot(path=str(shots / f'03_goto_{z}.png'))
    r['harvestedWhileDriving'] = pg.evaluate('() => G.state.stats.harvested')
    pg.evaluate('() => G.Machines.setDriving(false)')

    # panels open cleanly
    for key in ['machines', 'ranch', 'stand', 'restaurant']:
        pg.evaluate(DISMISS)
        pg.evaluate(f'() => G.openPanel("{key}")'); pg.wait_for_timeout(600)
        pg.screenshot(path=str(shots / f'04_panel_{key}.png'))
        pg.evaluate('() => G.closePanel()'); pg.wait_for_timeout(300)

    # restaurant: fast-forward permit questline via API if possible
    r['restaurantFlow'] = pg.evaluate('''() => { const R=G.Restaurant, out=[]; try { out.push(R.apply && R.apply()); out.push(R.stage()); } catch(e) { out.push('err '+e) } return out }''')
    pg.evaluate(DISMISS)

    # other tabs still work
    for t in ['orders', 'shop', 'barn', 'almanac', 'farm']:
        pg.evaluate(f'() => G.uikit.showTab("{t}")'); pg.wait_for_timeout(400); pg.evaluate(DISMISS)
        pg.screenshot(path=str(shots / f'05_tab_{t}.png'))

    # persistence
    pg.evaluate('() => G.save()'); pg.reload(); pg.wait_for_timeout(1500); pg.evaluate(DISMISS)
    r['afterReload'] = pg.evaluate('() => ({level:G.state.level, herd:G.Ranch.herd().length, stand:G.Stand.isBuilt(), tractor:(G.Machines.equipped()||{}).key})')
    pg.screenshot(path=str(shots / '06_after_reload.png'))
    b.close()
print(json.dumps(r, indent=1))
print('ERRORS:', len(errors))
for e in errors[:40]: print(' -', e)
