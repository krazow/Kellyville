import pathlib, time
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parents[2]
url = (root / 'index.html').as_uri()
shots = root / 'shots' / 'world'; shots.mkdir(parents=True, exist_ok=True)
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.on('console', lambda m: errors.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    pg.goto(url); pg.wait_for_timeout(800)
    pg.evaluate("() => { G.setPlayerName('Kelly'); G.state.flags['ui.welcomed']=true; document.getElementById('modal-root').hidden=true; document.getElementById('modal-root').innerHTML=''; }")
    setup = """() => {
      const s=G.state; s.level=25; s.coins=1e6; s.barnCap=500; s.maxPlots=36;
      for(let i=0;i<10;i++) G.buyPlot();
      ['chickens','cows','sheep','bees'].forEach(t=>{G.buyAnimal(t);G.buyAnimal(t);});
      ['feed_mill','grain_mill','bakery'].forEach(t=>G.buyBuilding(t));
      s.animals[0].status='ready'; s.animals[2].status='ready';
      const crops=['wheat','corn','lentils','potatoes'];
      s.plots.forEach((p,i)=>{ if(i%3!==2) G.plant(i, crops[i%4]); });
      s.plots.forEach((p,i)=>{ if(i%7===0 && p.status==='growing') p.readyAt=Date.now()-1; if(i===5) p.status='withered'; });
      const r={};
      try{ G.buyExpansion('center_pivot'); G.buyExpansion('windbreak_trees'); }catch(e){}
      try{ G.Ranch.buyCalf('angus'); G.Ranch.buyCalf('angus'); G.Ranch.buyBull(); r.herd=G.Ranch.herd().length; }catch(e){ r.ranchErr=String(e); }
      try{ G.Stand.build(); r.stand=G.Stand.isBuilt(); }catch(e){ r.standErr=String(e); }
      try{ r.rest=G.Restaurant.stage(); }catch(e){ r.restErr=String(e); }
      try{ const m=G.Machines.list()[0]; G.Machines.buy(m.key); G.Machines.equip(m.key); r.mach=G.Machines.equipped()&&G.Machines.equipped().key; }catch(e){ r.machErr=String(e); }
      G.tick(); return r; }"""
    print(pg.evaluate(setup))
    pg.wait_for_timeout(500)
    def shot(name, x, y):
        pg.evaluate(f"() => {{ G.World.teleport({x},{y}); }}"); pg.wait_for_timeout(900)
        pg.screenshot(path=str(shots / name))
    pg.evaluate("() => { try{G.Stand.stock(0,'wheat',3);}catch(e){} G.Restaurant.stage(); G.state.restaurant.stage='permit'; }")
    shot('09_permit.png', 34, 8.5)
    pg.evaluate("() => { G.state.restaurant.stage='building'; }"); shot('09b_building.png', 34, 8.5)
    pg.evaluate("() => { G.state.restaurant.stage='open'; const cs=[{id:'r1',emoji:'👩',phase:'arriving',t:.5,table:0},{id:'r2',emoji:'👨',phase:'seated',t:1,table:1},{id:'r3',emoji:'🧑',phase:'eating',t:1,table:2},{id:'r4',emoji:'👵',phase:'leaving',t:.3,table:3}]; G.Restaurant.customers=()=>cs; const sc=[{id:'s1',emoji:'🧑',phase:'browsing',t:.5,mood:'happy'},{id:'s2',emoji:'🚗',phase:'arriving',t:.4},{id:'s3',emoji:'👩',phase:'paying',t:.5,mood:'happy'}]; G.Stand.customers=()=>sc; }")
    shot('10_pens.png', 21, 13.5)
    shot('11_buildings.png', 20, 21)
    shot('12_pasture.png', 29.4, 17)
    shot('13_stand.png', 6.5, 25.5)
    shot('14_restaurant.png', 34, 8.5)
    shot('15_shed.png', 11.5, 7.5)
    shot('16_field.png', 8, 14)
    # zoom out overview
    pg.evaluate("() => G.World.setZoom(0.7)"); shot('17_overview.png', 20, 14)
    pg.evaluate("() => G.World.setZoom(0.9)")
    # night
    pg.evaluate("() => { G.state.startedAt = Date.now() - (0.75*90000) ; }"); shot('20_night_house.png', 17.5, 8.5)
    shot('21_night_rest.png', 34, 8.5)
    # winter
    pg.evaluate("() => { G.state.startedAt = Date.now() - (22*90000 + 0.35*90000); }"); pg.wait_for_timeout(800)
    shot('30_winter.png', 17.5, 8.5); shot('31_winter_field.png', 8, 14)
    pg.evaluate("() => { G.state.startedAt = Date.now() - (14*90000 + 0.35*90000); }"); shot('32_fall.png', 17.5, 12)
    pg.evaluate("() => { G.state.startedAt = Date.now() - (7*90000 + 0.35*90000); }"); shot('33_summer.png', 8, 14)
    # tractor drive
    pg.evaluate("() => { G.state.startedAt = Date.now() - 0.35*90000; G.Machines.setDriving(true); }")
    print('driving', pg.evaluate("() => G.Machines.isDriving()"), 'btn', pg.evaluate("() => document.getElementById('w-drive').textContent"))
    shot('40_drive.png', 8, 12)
    print('ERRORS', errors)
    b.close()
