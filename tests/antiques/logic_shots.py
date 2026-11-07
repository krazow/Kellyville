import pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent
url = (root.parent.parent / 'index.html').resolve().as_uri()
shots = root / 'shots'; shots.mkdir(exist_ok=True)
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(**p.devices['iPhone 13 Pro Max'])
    pg = ctx.new_page()
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    pg.goto(url); pg.wait_for_timeout(1200)
    pg.evaluate("""() => { G.setPlayerName('Kelly'); G.state.flags['ui.welcomed']=true; document.querySelectorAll('.modal,#modal-root').forEach(m=>m.hidden=true);
      G.state.level=8; G.state.coins=6000; G.state.barnCap=300;
      G.calendar = () => ({day:3, season:'summer', dayProgress:0.4, year:1, dayOfSeason:3}); }""")
    # walk-up action, not built
    pg.evaluate("() => G.World.goTo('antiques')"); pg.wait_for_timeout(9000)
    print('act (not built):', pg.evaluate("() => (document.querySelector('#w-act')||{}).innerText"))
    pg.evaluate("() => G.openPanel('antiques')"); pg.wait_for_timeout(600)
    pg.screenshot(path=str(shots / 'a1_build.png'))
    pg.evaluate("() => { const b=document.querySelector('[data-pa=build]'); b.click(); }"); pg.wait_for_timeout(600)
    pg.screenshot(path=str(shots / 'a1b_modal.png'))
    pg.evaluate("() => { document.querySelectorAll('[data-act=m-choice]').forEach(b=>b.click()); }"); pg.wait_for_timeout(300)
    pg.evaluate("""() => { const A=G.Antiques; for (const u of ['shelves','workshop','appraiser','porch']) A.upgrade(u);
      A.listings().slice(0,8).forEach(l=>A.buyListing(l.id));
      A.inventory().slice(0,4).forEach(x=>A.setDisplay(x.id,true));
      const r=A.inventory().find(x=>x.cond<3&&!x.disp); if(r) A.restore(r.id);
      const s=G.state.antiques; const d=A.inventory().filter(x=>x.disp);
      d.slice(0,2).forEach((it,i)=>s.offers.push({id:'o'+i,invId:it.id,type:'collector',emoji:'🧐',who:'Collector',amount:Math.round(A.value(it)*1.3),max:Math.round(A.value(it)*1.55),startAt:Date.now(),endAt:Date.now()+70000}));
      for (let i=0;i<4;i++) G.Antiques.ensure(); window.__tick=0; }""")
    pg.wait_for_timeout(700)
    for tab in ['floor','buy','work','coll','up']:
        pg.evaluate("(t) => { document.querySelector('[data-pa=tab][data-k='+t+']').click(); }", tab); pg.wait_for_timeout(500)
        pg.screenshot(path=str(shots / f'a2_{tab}.png'))
        pg.evaluate("() => { const b=document.querySelector('#sheet-body'); if(b) b.scrollTo(0,99999); }"); pg.wait_for_timeout(300)
        pg.screenshot(path=str(shots / f'a2_{tab}_bottom.png'))
    pg.evaluate("() => G.closePanel()"); pg.wait_for_timeout(300)
    pg.evaluate("() => G.World.goTo('antiques')"); pg.wait_for_timeout(9000)
    print('act (built, offers):', pg.evaluate("() => (document.querySelector('#w-act')||{}).innerText"))
    pg.screenshot(path=str(shots / 'a3_world.png'))
    print('errors', errors)
