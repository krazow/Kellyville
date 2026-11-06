// node tests/restaurant/test_restaurant.js
global.window = global; global.document = undefined;
const store = {}; global.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
let T = 1700000000000; const realNow = Date.now; Date.now = () => T;
const path = require('path'), src = f => path.join(__dirname, '../../src', f);
const fs = require('fs');
['core.js', 'data.js', 'events.js', 'economy.js', 'restaurant.js'].forEach(f => { if (fs.existsSync(src(f))) require(src(f)); });
const G = global.G; const R = G.Restaurant;
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const modals = []; G.showModal = o => modals.push(o);
const pressLast = i => { const m = modals[modals.length - 1]; const b = m.buttons[i]; b && b.onClick && b.onClick(); };
const toasts = []; G.toast = (m) => toasts.push(m);
G.bus.emit('init');
G.state.startedAt = T;

ok(R && R.stage() === 'none', 'stage none');
ok(Object.keys(G.DATA.dishes).length === 12, '12 dishes');
ok(Object.keys(G.DATA.dishes).every(k => G.DATA.products[k]), 'dishes in products');
ok(Object.keys(G.DATA.dishes).every(k => Object.keys(G.DATA.dishes[k].inputs).every(i => G.DATA.crops[i] || G.DATA.products[i] || ['ground_beef', 'ribeye', 'brisket'].includes(i))), 'dish inputs valid');
G.state.coins = 5000; G.state.level = 3;
ok(!R.apply(), 'cannot apply below level 6');
G.state.level = 12;
const panel = G.panels.restaurant;
ok(/Apply for permit/.test(panel.render()), 'panel shows apply');
panel.onAction('apply', { dataset: {} });
ok(R.stage() === 'permit' && G.state.coins === 5000 - 150, 'permit applied, fee paid');
// hearing: argue loses first (delay), then retry
const origRand = Math.random;
Math.random = () => 0.9; panel.onAction('hearing', { dataset: {} }); pressLast(2);
ok(G.state.restaurant.permit.delayUntil > T, 'argue fail delays');
ok(!R.hearing(), 'hearing blocked while adjourned');
T += 46000;
panel.onAction('hearing', { dataset: {} }); ok(modals[modals.length - 1].buttons.length === 3, 'hearing modal has 3 choices');
pressLast(1);
ok(G.state.restaurant.farmOnly && G.state.restaurant.permit.step === 'inspection', 'farm-only sets rule, inspection starts');
ok(/Inspection done in/.test(panel.render()), 'inspection progress shown');
T += 100000; R.step(); ok(G.state.restaurant.permit.step === 'inspection', 'inspection still running at 100s');
T += 81000; R.step(); ok(G.state.restaurant.permit.step === 'approved', 'inspection finished at 3min');
Math.random = origRand;
G.state.coins = 100; panel.onAction('reno', {}); ok(R.stage() === 'permit', 'reno needs coins');
G.state.coins = 99999; G.state.barnCap = 2000;
panel.onAction('reno', {}); ok(R.stage() === 'building', 'building');
T += 239000; R.step(); ok(R.stage() === 'building', 'still building');
T += 2000; R.step(); ok(R.stage() === 'open', 'open after 4 min');
ok(modals[modals.length - 1].confetti, 'grand opening confetti');
// alt path: gravel saga on a fresh state
{
  const saved = JSON.parse(JSON.stringify(G.state.restaurant)); G.state.restaurant = null; R.ensure(); G.state.level = 12;
  R.apply(); R.hearing(); pressLast(0);
  ok(G.state.restaurant.up.parking === 1 && G.state.restaurant.permit.step === 'inspection', 'gravel path gives parking');
  G.state.restaurant = saved;
}
// kitchen
const r = G.state.restaurant;
['hummus_board', 'lentil_burger', 'cherry_cobbler', 'smash_burger'].forEach(id => R.toggleMenu(id));
ok(r.menu.length === 4, 'menu 4');
ok(!R.toggleMenu('mint_lemonade'), 'menu cap 4');
ok(R.startService() === false, 'cannot open with empty pass');
['hummus', 'bread', 'mint', 'lentils', 'sweet_onions', 'cherries', 'flour', 'butter', 'cheese'].forEach(k => G.addItem(k, 40));
ok(R.cook('hummus_board') && R.cook('lentil_burger') && R.cook('cherry_cobbler'), 'cook 3');
ok(!R.cook('mint_lemonade'), 'stoves full');
ok(!R.cook('smash_burger'), 'smash needs beef (ranch missing)');
panel.onAction('tab',{dataset:{tab:'kitchen'}}); ok(/needs the ranch/.test(panel.render()) && /Free stove|rs-stove on/.test(panel.render()), 'panel ok mid-cook');
T += 60000; R.step();
ok(r.pass.hummus_board === 3 && r.pass.lentil_burger === 3, 'dishes land on the pass');
for (let i = 0; i < 6; i++) { T += 50000; R.step(); for (const id of ['hummus_board', 'lentil_burger', 'cherry_cobbler']) R.cook(id); }
T += 90000; R.step();
ok(r.pass.hummus_board >= 9, 'pass stocked: ' + JSON.stringify(r.pass));
// tabs render
['service', 'kitchen', 'menu', 'staff'].forEach(t => { panel.onAction('tab', { dataset: { tab: t } }); ok(panel.render().length > 200, 'render tab ' + t); });
panel.onAction('tab', { dataset: { tab: 'service' } });
// upgrades & staff
G.state.coins = 99999;
R.buyUpgrade('tables'); ok(R.tables() === 5, 'table bought'); R.buyUpgrade('grill'); R.buyUpgrade('lights'); R.buyUpgrade('menuboard');
ok(r.up.grill === 1 && r.up.lights === 1, 'upgrades');
R.toggleStaff('server'); R.toggleStaff('host');
console.log(R.dishPrice('cherry_cobbler'), G.mods.price('cherry_cobbler')); ok(R.dishPrice('cherry_cobbler') === Math.round(200 * 1.10 * G.mods.price('cherry_cobbler')), 'farm-sourced +10% price');
// service
const coins0 = G.state.coins, rating0 = r.rating; const events = []; G.bus.on('restaurant:served', e => events.push(e));
modals.length = 0;
ok(R.startService() && R.isServing(), 'service started');
ok(!R.startService(), 'only one at a time');
let seen = new Set(), tbl = false;
for (let i = 0; i < 700 && R.isServing(); i++) { T += 500; G.bus.emit('tick', { now: T }); R.customers().forEach(c => { seen.add(c.phase); if (c.table != null) tbl = true; assertC(c); }); if (i === 100) G.panels.restaurant.render(); }
function assertC(c) { if (!(c.t >= 0 && c.t <= 1)) ok(false, 'bad t'); }
ok(!R.isServing(), 'service completed');
ok(['arriving', 'seated', 'eating', 'leaving'].every(p => seen.has(p)) && tbl, 'customers phases seen ' + [...seen]);
const sum = R.summary();
ok(sum && sum.covers > 3 && sum.revenue > 0, 'summary: ' + JSON.stringify(sum));
ok(events.length === sum.covers, 'served events == covers');
ok(Math.abs((G.state.coins - coins0) - sum.net) < 2, 'coins delta equals net ' + (G.state.coins - coins0) + ' vs ' + sum.net);
ok(sum.wages === 160, 'wages server+host 160');
ok(modals.length && /Dinner service complete/.test(modals[modals.length - 1].title) && /Covers/.test(modals[modals.length - 1].html), 'summary modal');
ok(sum.quote && sum.who, 'review quote');
ok(R.cooldownLeft() > 100000, 'cooldown set');
ok(!R.startService(), 'cooldown blocks');
console.log('rating', rating0.toFixed(2), '->', r.rating.toFixed(2), 'covers', sum.covers, 'rev', sum.revenue, 'tips', sum.tips, 'unhappy', sum.unhappy);
T += 130000; R.step();
// unhappy path: menu dish never stocked
r.pass = {}; r.menu = ['mint_lemonade']; r.pass.hummus_board = 0; r.pass = { mint_lemonade: 1 };
const rBefore = r.rating; R.startService();
for (let i = 0; i < 700 && R.isServing(); i++) { T += 500; G.bus.emit('tick', { now: T }); }
ok(R.summary().unhappy > 0 && r.rating < rBefore + 0.2, 'out-of-stock guests leave unhappy: ' + R.summary().unhappy);
// events
const keys = ['restaurant_inspector', 'restaurant_feature', 'restaurant_noise'];
keys.forEach(k => ok(G.Events.def(k), 'registered ' + k));
G.state.coins = 99999;
G.Events.trigger('restaurant_inspector'); let a = G.Events.active().find(e => e.key === 'restaurant_inspector'); ok(a && a.pending, 'inspector pending');
ok(G.Events.choose(a.id, 0), 'inspector deep clean');
G.Events.trigger('restaurant_inspector'); a = G.Events.active().find(e => e.key === 'restaurant_inspector');
Math.random = () => 0.1; const rb = r.rating; ok(G.Events.choose(a.id, 1) && r.rating < rb, 'inspector wing it can hit rating'); Math.random = origRand;
G.Events.trigger('restaurant_noise'); a = G.Events.active().find(e => e.key === 'restaurant_noise'); ok(G.Events.choose(a.id, 0), 'noise pie');
G.Events.trigger('restaurant_noise'); a = G.Events.active().find(e => e.key === 'restaurant_noise'); ok(G.Events.choose(a.id, 1) && r.noiseUntil > T, 'noise ignore');
const rb2 = r.rating; G.Events.trigger('restaurant_feature'); ok(r.rating > rb2 || r.rating === 5, 'feature boosts rating');
ok(G.Events.active().some(e => e.key === 'restaurant_feature'), 'feature active for guest boost');
// reset
G.reset(); ok(G.state.restaurant && G.state.restaurant.stage === 'none', 'state:reset ensures');
G.state.restaurant = { stage: 'bogus', pass: { nope: 3 }, menu: ['x'] }; R.ensure(); ok(G.state.restaurant.stage === 'none' && !G.state.restaurant.menu.length, 'ensure repairs bad saves');
Date.now = realNow;
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
