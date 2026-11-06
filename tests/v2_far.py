from playwright.sync_api import sync_playwright
import pathlib
root=pathlib.Path(__file__).resolve().parent.parent; errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True).new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto((root/'index.html').as_uri()); pg.wait_for_timeout(1000)
    pg.locator('input:visible').first.type('Kelly'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    pg.evaluate("""()=>{G.state.coins=1e6;G.addXP(9000);G.state.barnCap=999;
      ['angus','hereford','angus'].forEach(k=>G.Ranch.buyCalf(k));G.Ranch.buyBull();
      const R=G.Restaurant; const s=G.state; R.ensure&&R.ensure();}""")
    dis="()=>{for(let k=0;k<40;k++){const b=[...document.querySelectorAll('#modal-root button')].find(x=>x.offsetParent);if(!b)break;b.click()}G.uikit.closeSheet();G.uikit.showTab('farm')}"
    pg.evaluate(dis)
    for z in ['pasture','restaurant','shed','fields']:
        pg.evaluate(f"()=>G.World.goTo('{z}')"); pg.wait_for_timeout(14000)
        pg.screenshot(path=str(root/f'shots/v2/far_{z}.png'))
        pg.evaluate(dis)
    print(errs); b.close()
