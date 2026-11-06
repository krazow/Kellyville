import pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parents[2]
out = root / 'shots'; out.mkdir(exist_ok=True)
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto((root / 'index.html').as_uri()); pg.wait_for_timeout(1000)
    inp = pg.locator('input:visible').first; inp.tap(); inp.type('Kelly')
    pg.evaluate('''() => { const b=[...document.querySelectorAll('button')].find(x=>/Start farming/i.test(x.textContent)); b && b.click(); }''')
    pg.wait_for_timeout(600)
    pg.evaluate('''() => { const s=G.state; s.level=9; s.coins=4000; s.barn.cow_feed=20; s.barn.alfalfa=10;
      const R=G.Ranch; const a=R.add('angus','steer','m'); a.weight=1180; a.fedUntil=Date.now()+150000;
      const b2=R.add('hereford','yearling','f'); b2.prog=300000; b2.fedUntil=Date.now()+90000; b2.health=72;
      const c=R.add('red_angus','calf','m'); c.prog=120000; c.health=45;
      const d=R.add('simmental','cow','f'); d.fedUntil=Date.now()+20000; d.breedProg=300000; R.add('angus','bull');
      G.openPanel('ranch'); }''')
    pg.wait_for_timeout(900)
    pg.screenshot(path=str(out / 'ranch_top.png'))
    pg.evaluate("() => { const s=document.querySelector('.sheet-body, #sheet-body, .sh-body'); (s||document.scrollingElement).scrollTop = 1200; }")
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / 'ranch_bottom.png'))
    print('ERRORS', errs)
