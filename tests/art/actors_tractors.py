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
    pg.wait_for_timeout(1500)
    for k in ['rusty72','rowcrop160','bigyellow','harvestqueen','supercar']:
        pg.evaluate(f"""() => {{ try {{ G.Machines.buy('{k}'); }} catch (e) {{}} G.Machines.equip('{k}'); G.Machines.setDriving(true); G.World.setZoom({a.zoom}); }}""")
        pg.evaluate("() => { for (let k = 0; k < 10; k++) { const b = [...document.querySelectorAll('#modal-root button')].find(x => x.offsetParent); if (!b) break; b.click(); } }")
        pg.keyboard.down('ArrowRight'); pg.wait_for_timeout(300); pg.keyboard.up('ArrowRight')
        pg.evaluate("() => G.World.repaint && G.World.repaint()")
        pg.wait_for_timeout(250)
        pg.keyboard.down('ArrowRight')
        pg.wait_for_timeout(120)
        pg.screenshot(path=str(out / f'actors_t_{k}{"_n" if a.night else ""}.png'), clip={'x':114,'y':280,'width':200,'height':130})
        pg.keyboard.up('ArrowRight'); pg.wait_for_timeout(100)
        pg.screenshot(path=str(out / f'actors_ti_{k}{"_n" if a.night else ""}.png'), clip={'x':114,'y':280,'width':200,'height':130})
    b.close()
print('saved', out / f'{a.out}.png'); print('errors:', len(errs)); [print(' -', e) for e in errs[:15]]
sys.exit(1 if errs else 0)
