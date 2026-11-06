import pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path('/home/claude/kellyville')
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto((root / 'index.html').as_uri()); pg.wait_for_timeout(1000)
    pg.evaluate("""() => { const b=[...document.querySelectorAll('button')].find(x=>/Start farming/i.test(x.textContent)); const i=document.querySelector('input'); if(i){i.value='Kelly';i.dispatchEvent(new Event('input'))} b&&b.click(); }""")
    pg.wait_for_timeout(500)
    pg.evaluate("() => { G.state.level=20; G.state.coins=5000; G.state.level=12; }")
    pg.evaluate("() => { G.Machines.buy('rusty72'); G.Machines.buy('pacer90'); G.Machines.equip('pacer90'); G.Machines.setDriving(true); G.state.machines.condition.pacer90=60; }")
    pg.wait_for_timeout(600)
    pg.evaluate("() => { document.querySelectorAll('.modal, [class*=modal]').forEach(e=>e.remove()); document.querySelectorAll('canvas.confetti,.confetti').forEach(e=>e.remove()); G.openPanel('machines'); }")
    pg.wait_for_timeout(900)
    pg.screenshot(path=str(root / 'tests/machines/panel.png'))
    print(pg.evaluate("() => document.querySelector('.panel-body') && document.querySelector('.panel-body').scrollWidth"))
    # tap buy via real click
    pg.evaluate("() => document.querySelector('.hscroll').scrollLeft=330")
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(root / 'tests/machines/panel2.png'))
print('errors', errs)
