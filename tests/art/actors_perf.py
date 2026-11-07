"""Shared screenshot tool for the 3D art agents.
usage: python3 tests/art_shot.py OUTNAME ZONE [--season spring|summer|fall|winter] [--night] [--zoom 0.7..1.5] [--setup full|bare] [--device "iPhone 13 Pro Max"]
Builds index.html first, sets up a mid-game farm (all structures, animals, cattle, stand, open restaurant with guests,
tractor), teleports the player next to ZONE (barn house shed restaurant orders stand shop pasture fields pens buildings),
waits, and writes shots/art/OUTNAME.png. Prints console errors. Exit code 1 if any errors."""
import sys, pathlib, subprocess, argparse
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent.parent
ap = argparse.ArgumentParser(); ap.add_argument('out'); ap.add_argument('zone'); ap.add_argument('--season', default='spring'); ap.add_argument('--night', action='store_true')
ap.add_argument('--zoom', type=float, default=1.0); ap.add_argument('--setup', default='full'); ap.add_argument('--device', default='iPhone 13 Pro Max'); ap.add_argument('--nobuild', action='store_true')
a = ap.parse_args()
if not a.nobuild: subprocess.run([sys.executable, str(root / 'build.py')], check=True, capture_output=True)
out = root / 'shots' / 'art'; out.mkdir(parents=True, exist_ok=True)
SEASON_DAY = {'spring': 0, 'summer': 7, 'fall': 14, 'winter': 21}
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    d = dict(p.devices[a.device]); d.pop('default_browser_type', None)
    pg = b.new_context(**d).new_page()
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto((root / 'index.html').as_uri()); pg.wait_for_timeout(900)
    pg.locator('#name-in').type('Kelly'); pg.locator('#wel-go').tap(); pg.wait_for_timeout(300)
    day = SEASON_DAY[a.season]; prog = 0.88 if a.night else 0.30
    pg.evaluate(f"""() => {{ G.state.startedAt = Date.now() - ({day} + {prog}) * G.DAY_SEC * 1000; }}""")
    if a.setup == 'full':
        pg.evaluate("""() => { const s = G.state; s.coins = 1e7; G.addXP(60000); s.barnCap = 9999;
          ['feed_mill','grain_mill','bakery','creamery','cider_press','winery','hop_brewery','fry_shack'].forEach(k => G.buyBuilding(k));
          ['chickens','cows','sheep','bees'].forEach(k => { G.buyAnimal(k); G.buyAnimal(k); });
          s.animals.forEach((x, i) => { if (i % 2) { x.status = 'ready'; } });
          try { ['angus','hereford','angus','simmental','red_angus'].forEach(k => G.Ranch.buyCalf(k)); G.Ranch.buyBull(); } catch (e) {}
          try { G.Machines.buy('bigyellow'); const o = G.Machines.owned(); G.Machines.equip(o[o.length - 1]); } catch (e) {}
          ['cherries','apples','eggs','sweet_onions','potatoes','honey','bread','cheese','milk','butter','lentils','flour','mint','hummus','onion_rings','ipa','apple_pie'].forEach(k => G.addItem(k, 60));
          try { G.Stand.build(); ['cherries','apples','eggs','sweet_onions'].forEach((k, i) => G.Stand.stock(i, k, 30)); } catch (e) {}
          try { const R = G.Restaurant, r = () => s.restaurant; R.apply(); R.resolveHearing('farm'); r().permit.inspectEnd = Date.now() - 1; G.tick(); R.step && R.step(Date.now()); R.reno(); r().permit.buildEnd = Date.now() - 1; G.tick(); R.step && R.step(Date.now());
            const ds = R.dishes().filter(x => G.hasItems(x.inputs)).slice(0, 4); ds.forEach(x => { R.toggleMenu(x.id); R.cook(x.id); }); r().queue.forEach(j => j.readyAt = Date.now() - 1); G.tick(); R.step && R.step(Date.now()); R.startService(); } catch (e) { console.warn('rest', e) }
          for (let i = 0; i < 12; i++) G.plant(i, ['wheat','corn','lentils','potatoes'][i % 4]);
          s.plots.forEach((p, i) => { if (i % 3 === 0 && p.status === 'growing') p.readyAt = Date.now() - 1; if (i % 3 === 1 && p.status === 'growing') p.plantedAt = Date.now() - (p.readyAt - p.plantedAt) * .6; });
          G.tick(); }""")
    pg.evaluate("() => { for (let k = 0; k < 40; k++) { const b = [...document.querySelectorAll('#modal-root button')].find(x => x.offsetParent); if (!b) break; b.click(); } G.uikit.closeSheet(); G.uikit.showTab('farm'); }")
    pg.evaluate(f"() => {{ const z = G.World.zones().find(z => z.id === '{a.zone}'); if (z) G.World.teleport(z.x, z.y); G.World.setZoom({a.zoom}); G.World.repaint && G.World.repaint(); }}")
    pg.wait_for_timeout(1000)
    dis = "() => { for (let k = 0; k < 10; k++) { const b = [...document.querySelectorAll('#modal-root button')].find(x => x.offsetParent); if (!b) break; b.click(); } }"
    pg.evaluate(dis)
    pg.evaluate("() => { G.World.teleport(20, 27); G.World.setZoom(1.5); }")
    for i in range(4):
        pg.wait_for_timeout(2500); pg.evaluate(dis)
        pg.screenshot(path=str(out / f'actors_road2_{i}.png'))
    r = pg.evaluate("""() => { const H = G.WorldKit || G.WorldArtKit, A = G.WorldArt.actors, c = document.createElement('canvas').getContext('2d'); c.canvas.width = c.canvas.height = 600; c.setTransform(1,0,0,.75,0,0);
      const T = (n, f) => { for (let i = 0; i < 50; i++) f(i); const t0 = performance.now(); for (let i = 0; i < n; i++) f(i); return +((performance.now() - t0) / n).toFixed(4); };
      const o = { player: T(2000, i => A.player(c, { x: 100, y: 100, t: i / 60, dir: 1, moving: true, walk: i / 5, driving: false, avatar: '🧑‍🌾', name: 'Kelly' }, H)),
        tractor: T(2000, i => A.tractor(c, { x: 100, y: 100, dir: 1, def: { key: 'bigyellow', color: '#f2b631' }, t: i / 60, moving: true, withDriver: true, avatar: '🧑‍🌾' }, H)),
        combine: T(2000, i => A.tractor(c, { x: 100, y: 100, dir: -1, def: { key: 'harvestqueen', color: '#d9533b' }, t: i / 60, moving: true, withDriver: true, avatar: '🧑‍🌾' }, H)),
        npc: T(2000, i => A.npc(c, { x: 100, y: 100, cu: { emoji: '🧑', phase: 'paying', mood: 'happy' }, walk: true, t: i / 60, i: 1 }, H)),
        animal: T(2000, i => A.animal(c, { x: 100, y: 100, type: 'cows', emoji: '🐄', size: 26, t: i / 60, i: 1, dir: 1, moving: true, status: 'ready', productEmoji: '🥛' }, H)),
        cattle: T(2000, i => A.cattle(c, { x: 100, y: 100, h: { emoji: '🐄' }, size: 26, t: i / 60, i: 1, dir: 1, moving: false, night: false, hungry: true }, H)),
        duck: T(2000, i => A.duck(c, { x: 100, y: 100, a: 1, t: i / 60, i: 1 }, H)),
        vehicle: T(2000, i => A.vehicle(c, { x: 100 + i % 50, y: 100, dir: 1, kind: '🛻', t: i / 60 }, H)) };
      return o; }""")
    print('actor ms/call', r)
    import base64
    d = pg.evaluate("""() => { const H = G.WorldArtKit, A = G.WorldArt.actors, cv = document.createElement('canvas'); cv.width = 900; cv.height = 700; const c = cv.getContext('2d'); c.fillStyle = '#8d8a85'; c.fillRect(0,0,900,700);
      const v = G.World._v, k = v.zoom * v.dpr; c.scale(k, k * .75);
      const kinds = ['🛻','🚚','🚐','🚗'];
      kinds.forEach((kd, i) => { [1, -1].forEach((dr, j) => { A.vehicle(c, { x: 60 + j * 100, y: 40 + i * 50, dir: dr, kind: kd, t: 1 }, H); }); });
      A.npc(c, { x: 300, y: 50, cu: { emoji: '🧑', phase: 'paying', mood: 'happy' }, walk: false, t: 1, i: 1 }, H);
      A.npc(c, { x: 340, y: 50, cu: { emoji: '👵', phase: 'eating', id: 3 }, sit: true, t: 1, i: 1 }, H);
      A.duck(c, { x: 400, y: 50, a: 1, t: 1, i: 1 }, H);
      A.animal(c, { x: 300, y: 100, type: 'chickens', emoji: '🐔', size: 20, t: 1, i: 1, dir: 1, moving: false, status: 'hungry', productEmoji: '🥚' }, H);
      A.animal(c, { x: 350, y: 100, type: 'bees', emoji: '🐝', size: 14, t: 1, i: 1, dir: 1, bees: true, status: 'ready', productEmoji: '🍯' }, H);
      A.cattle(c, { x: 300, y: 160, h: { emoji: '🐄' }, size: 30, t: 1, i: 1, dir: 1, moving: false, night: false, hungry: false }, H);
      A.cattle(c, { x: 360, y: 160, h: { emoji: '🐂' }, size: 26, t: 1, i: 1, dir: -1, moving: false, night: true, hungry: false }, H);
      A.player(c, { x: 300, y: 220, t: 1, dir: 1, moving: true, walk: 1, driving: false, avatar: '🧑‍🌾', name: 'Kelly' }, H);
      return cv.toDataURL(); }""")
    open(out / 'actors_gallery.png', 'wb').write(base64.b64decode(d.split(',')[1]))
    b.close()
print('saved', out / f'{a.out}.png'); print('errors:', len(errs)); [print(' -', e) for e in errs[:15]]
sys.exit(1 if errs else 0)
