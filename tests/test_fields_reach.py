from playwright.sync_api import sync_playwright
import pathlib
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    d=dict(p.devices['iPhone SE']); d.pop('default_browser_type',None)
    pg=b.new_context(**d).new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(pathlib.Path('' + str(pathlib.Path(__file__).resolve().parent.parent) + '/index.html').as_uri()); pg.wait_for_timeout(1000)
    pg.locator('#name-in').type('Kelly'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    pg.evaluate("()=>G.World.goTo('fields')"); pg.wait_for_timeout(3000)
    txt=pg.evaluate("()=>[...document.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>b.textContent.trim()).filter(t=>/Plant|Harvest/.test(t))")
    print('action buttons:',txt)
    btn=pg.locator('button:visible', has_text='Plant').first
    if btn.count(): btn.tap(force=True); pg.wait_for_timeout(500)
    print('seed sheet open:', pg.evaluate("()=>G.uikit.sheetOpen()"))
    pg.screenshot(path='' + str(pathlib.Path(__file__).resolve().parent.parent) + '/shots/untested/fields_fixed_iphoneSE.png'); print(errs); b.close()
