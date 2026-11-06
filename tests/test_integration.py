import sys, json, pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent
url = (root.parent / 'index.html').resolve().as_uri()
shots = root.parent / 'shots'; shots.mkdir(exist_ok=True)
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    pg.goto(url); pg.wait_for_timeout(1200)
    pg.screenshot(path=str(shots / '01_welcome.png'))
    inp = pg.locator('input:visible').first
    inp.tap(); inp.type('Kelly'); pg.wait_for_timeout(200)
    pg.evaluate('''() => { const b=[...document.querySelectorAll('button')].find(x=>/Start farming/i.test(x.textContent)); b && b.click(); }''')
    pg.wait_for_timeout(500)
    report0 = pg.evaluate('() => ({name: G.state.playerName, farm: G.state.farmName})')
    # real touch play: tap first plot, screenshot seed sheet
    plot = pg.locator('[data-plot]:visible, .plot:visible').first
    if plot.count(): plot.tap(); pg.wait_for_timeout(500)
    pg.screenshot(path=str(shots / '01b_seedsheet.png'))
    pick = pg.locator('[data-act=seed]:visible').first
    if pick.count(): pick.tap(); pg.wait_for_timeout(500)
    report0['plantedViaTouch'] = pg.evaluate("() => G.state.plots.filter(p=>p.status==='growing').length")
    pg.screenshot(path=str(shots / '01c_planted.png'))
    report = pg.evaluate('''() => {
      const r = {};
      r.modules = { events: !!window.G.Events, economy: !!window.G.Economy, crops: Object.keys(G.DATA.crops).length,
                    products: Object.keys(G.DATA.products).length, buildings: Object.keys(G.DATA.buildings).length,
                    events: (G.Events && G.Events.definitions || []).length };
      // simulate play via engine API
      G.state.coins = 100000; G.state.barnCap = 400;
      G.state.plots.forEach((p,i)=>{ p.status='empty'; p.crop=null; });
      for (let i = 0; i < 6; i++) G.plant(i, 'wheat');
      G.state.plots.forEach(p => { if (p.status === 'growing') p.readyAt = Date.now() - 1; });
      G.tick();
      r.ready = G.state.plots.filter(p => p.status === 'ready').length;
      r.harvested = [0,1,2].map(i => G.harvest(i));
      G.addXP(5000);
      r.level = G.state.level;
      G.buyBuilding('feed_mill'); G.buyAnimal('chickens'); G.buyAnimal('cows');
      Object.keys(G.DATA.crops).forEach(k => G.addItem(k, 3));
      G.addItem('chicken_feed', 3);
      r.feed = G.feedAnimal(0);
      const fm = G.DATA.buildings.feed_mill;
      r.recipe = fm ? G.startRecipe(0, fm.recipes[0].id) : 'nofeedmill';
      r.orders = G.Economy ? G.Economy.orders().length : -1;
      r.catalog = G.Economy ? Object.keys(G.Economy.shopCatalog()) : [];
      r.eventMults = G.Events ? [G.Events.growthMult('wheat'), G.Events.yieldMult('wheat'), G.Events.priceMult('wheat'), G.Events.animalMult('cows')] : [];
      G.bus.emit('change');
      return r;
    }''')
    report.update(report0)
    pg.wait_for_timeout(600)
    # close any open modal
    for sel in ['.modal button', '[data-action=close]', '.sheet-close']:
        try:
            el = pg.query_selector(sel)
            if el and el.is_visible(): el.click(); pg.wait_for_timeout(300)
        except Exception: pass
    pg.screenshot(path=str(shots / '02_farm.png'))
    # trigger every event definition
    keys = pg.evaluate('() => (G.Events && G.Events.definitions || []).map(d => d.key)')
    for i, k in enumerate(keys):
        pg.evaluate('k => { G.Events.trigger(k); const a = G.state.activeEvents; }', k)
        pg.wait_for_timeout(60)
        if i == 0:
            pg.wait_for_timeout(500); pg.screenshot(path=str(shots / '03_event.png'))
    report['triggered'] = len(keys)
    pg.evaluate('() => { const a=(G.Events.active&&G.Events.active())||[]; a.forEach(e=>{ try{G.Events.choose(e.id,0)}catch(x){} }); G.tick(); }')
    # tabs
    for name in ['orders', 'shop', 'barn', 'almanac', 'farm']:
        clicked = pg.evaluate('''n => { const els=[...document.querySelectorAll('[data-tab],nav button,.tab')];
            const el = els.find(e => (e.dataset.tab||'').toLowerCase()===n || e.textContent.toLowerCase().includes(n)); if (el) { el.click(); return true } return false }''', name)
        pg.wait_for_timeout(400)
        # dismiss queued modals so tabs are visible
        for _ in range(30):
            done = pg.evaluate('''() => { const b=[...document.querySelectorAll('button')].find(x=>x.offsetParent && /^(OK|Got it|Continue|Nice|Close|Awesome)/i.test(x.textContent.trim())); if(b){b.click();return true} return false }''')
            if not done: break
            pg.wait_for_timeout(120)
        pg.screenshot(path=str(shots / f'tab_{name}.png'))
        report['tab_' + name] = clicked
    # reload persistence
    pg.evaluate('() => G.save()'); pg.reload(); pg.wait_for_timeout(1000)
    report['afterReloadLevel'] = pg.evaluate('() => G.state.level')
    b.close()
print(json.dumps(report, indent=1))
print('ERRORS:', len(errors)); [print(' -', e) for e in errors[:30]]
