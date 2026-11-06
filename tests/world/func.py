import pathlib, time
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parents[2]
url = (root / 'index.html').as_uri()
shots = root / 'shots' / 'world'
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.on('console', lambda m: errors.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    pg.goto(url); pg.wait_for_timeout(800)
    pg.evaluate("() => { G.setPlayerName('Kelly'); G.state.flags['ui.welcomed']=true; document.getElementById('modal-root').hidden=true; document.getElementById('modal-root').innerHTML=''; G.state.level=25; G.state.coins=1e6; G.state.barnCap=500; G.buyBuilding('grain_mill'); G.buyAnimal('chickens'); G.state.animals[0].status='ready'; G.tick(); }")
    pg.wait_for_timeout(300)
    # tap-to-walk to the grain mill (building 0) via real tap on canvas: compute its screen pos
    def screen(tx, ty):
        return pg.evaluate(f"() => {{ const w=G.World._v; const r=w.box.getBoundingClientRect(); return [r.left+({tx}*40-w.camX)*w.zoom, r.top+({ty}*40-w.camY)*w.zoom]; }}")
    pg.evaluate("() => G.World.teleport(17.5, 8.5)"); pg.wait_for_timeout(500)
    # tap building 0 (x=16,y=20)
    x, y = screen(16, 20)
    print('building screen', x, y)
    # camera may not show it: use goTo + hint instead via direct tap function through zone ids
    pg.evaluate("() => G.World.goTo('buildings')"); pg.wait_for_timeout(9000)
    print('after goTo buildings', pg.evaluate("() => G.World.player()"))
    print('btn', pg.evaluate("() => document.getElementById('w-act').textContent"))
    pg.locator('#w-act').tap(force=True); pg.wait_for_timeout(500)
    print('sheet open', pg.evaluate("() => G.uikit.sheetOpen()"))
    pg.evaluate("() => G.uikit.closeSheet()"); pg.wait_for_timeout(400)
    # real tap on screen at a visible point (ground north-west of player)
    pg.evaluate("() => { G.uikit.showTab('farm'); G.World.teleport(20.5, 18.5); }"); pg.wait_for_timeout(800)
    px, py = screen(*pg.evaluate("() => { const p=G.World.player(); return [p.x-2, p.y]; }"))
    pg.touchscreen.tap(px, py); pg.wait_for_timeout(2500)
    print('after tap walk', pg.evaluate("() => G.World.player()"))
    # pen: go to pens and collect
    pg.evaluate("() => { G.uikit.showTab('farm'); G.World.teleport(17.5, 8.5); G.World.goTo('pens'); }"); pg.wait_for_timeout(5000)
    print('pens btn', pg.evaluate("() => { const b=document.getElementById('w-act'); return b.hidden?null:b.textContent }"), pg.evaluate("() => G.World.player()"))
    # tractor test
    print(pg.evaluate("""() => { const s=G.state; for(let i=0;i<8;i++) G.buyPlot(); const m=G.Machines.list()[0]; G.Machines.buy(m.key); G.Machines.equip(m.key);
      s.flags['ui.lastCrop']='wheat'; G.plant(0,'wheat'); G.plant(1,'wheat'); s.plots[0].readyAt=Date.now()-1; s.plots[1].readyAt=Date.now()-1; G.tick();
      G.uikit.showTab('farm'); G.World.teleport(3, 10); G.Machines.setDriving(true); return [G.Machines.isDriving(), s.plots.slice(0,4).map(p=>p.status)]; }"""))
    pg.keyboard.down('d'); pg.wait_for_timeout(1500); pg.keyboard.up('d')
    print('after drive', pg.evaluate("() => [G.World.player().x, G.state.plots.slice(0,6).map(p=>p.status), JSON.stringify(G.state.barn)]"))
    pg.screenshot(path=str(shots / '50_drive_after.png'))
    pg.evaluate("() => G.Machines.setDriving(false)")
    # list view toggle
    pg.locator('#w-list').tap(); pg.wait_for_timeout(500)
    print('list visible', pg.evaluate("() => [!document.getElementById('view-farm').hidden, document.getElementById('world').hidden, document.querySelectorAll('#plots .plot').length]"))
    pg.screenshot(path=str(shots / '51_list.png'))
    pg.locator('#w-back').tap(); pg.wait_for_timeout(500)
    print('world back', pg.evaluate("() => [document.getElementById('view-farm').hidden, !document.getElementById('world').hidden]"))
    pg.locator('#w-go').tap(); pg.wait_for_timeout(300); pg.screenshot(path=str(shots / '52_goto.png'))
    pg.evaluate("() => G.uikit.showTab('orders')"); pg.wait_for_timeout(300)
    print('hidden when other tab', pg.evaluate("() => document.getElementById('world').hidden"))
    print('ERRORS', errors)
    b.close()
