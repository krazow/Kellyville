// node tests/ranch/test_ranch.js
global.window = global; global.document = undefined;
const store = {}; global.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
global.setInterval = () => 0;
const path = require('path'), root = path.resolve(__dirname, '../../src');
let T = 1.7e12; Date.now = () => T;
['core', 'data', 'events', 'economy', 'ranch'].forEach(m => require(path.join(root, m + '.js')));
const G = window.G; const toasts = [];
G.toast = (m, k) => toasts.push(k + ': ' + m);
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const adv = (ms, fn) => { const stepMs = 1000; for (let i = 0; i < ms; i += stepMs) { T += stepMs; if (fn) fn(); G.bus.emit('tick', { now: T, cal: G.calendar() }); } };
G.bus.emit('init');
const Rn = G.Ranch;
['ground_beef', 'ribeye', 'brisket', 'leather'].forEach(k => ok(G.DATA.products[k] && G.DATA.products[k].emoji, 'product ' + k));
// lock
G.state.level = 3; G.state.coins = 99999; G.state.barnCap = 500;
ok(Rn.buyCalf('angus') === false, 'locked below level 4');
G.state.level = 4;
ok(G.panels.ranch.render().includes('Herd 0/4'), 'panel renders empty');
const calf = Rn.buyCalf('angus'); ok(calf && calf.stage === 'calf', 'buy calf');
ok(Rn.herd().length === 1 && Rn.herd()[0].hungry === false, 'herd() has fed calf');
G.state.barn.cow_feed = 40; G.state.barn.alfalfa = 40;
// growth pauses while hungry
calf.fedUntil = 0; const p0 = calf.prog; adv(60000);
ok(calf.prog === p0 && calf.health < 100, 'growth paused & health drops when hungry');
// fed lifecycle
const feedKeepUp = () => { Rn.animals().forEach(a => { if (a.fedUntil - T < 60000) Rn.feed(a.id); }); };
calf.sex = 'm'; let t0 = T;
adv(7 * 60000, feedKeepUp); ok(calf.stage === 'yearling', 'calf -> yearling in ~6 min fed (' + calf.stage + ')');
adv(11 * 60000, feedKeepUp); ok(calf.stage === 'steer', 'yearling -> steer in ~10 min fed (' + calf.stage + ')');
ok(calf.weight >= 1000, 'steer weight ' + Math.round(calf.weight));
ok(Rn.herd()[0].emoji === '🐂', 'steer emoji');
// feed accounting
const cf = G.qty('cow_feed'); G.state.barn.cow_feed = 0; const al = G.qty('alfalfa');
calf.fedUntil = 0; ok(Rn.feed(calf.id) && G.qty('alfalfa') === al - 2, 'alfalfa x2 used when no cow feed');
G.state.barn.cow_feed = 5; calf.fedUntil = 0; Rn.feed(calf.id); ok(G.qty('cow_feed') === 4, 'cow_feed x1');
// winter double
const realCal = G.calendar; G.calendar = () => ({ day: 99, season: 'winter', dayProgress: .5 });
calf.fedUntil = 0; Rn.feed(calf.id); ok(G.qty('cow_feed') === 2, 'winter double feed');
Rn.buyUpgrade('fence'); Rn.buyUpgrade('tank'); G.state.level = 10; Rn.buyUpgrade('tank'); Rn.buyUpgrade('shed');
ok(Rn.pastureCap() === 16, 'cap 16 after upgrades'); calf.fedUntil = 0; Rn.feed(calf.id); ok(G.qty('cow_feed') === 1, 'shed cancels winter double');
G.calendar = realCal;
// market
const price = Rn.price(calf); ok(price > 150 && price < 400, 'auction price ' + price);
const m0 = Rn.marketMult(); let moved = false;
for (let d = 1; d < 40; d++) { G.calendar = () => ({ day: 1000 + d, season: 'summer', dayProgress: .5 }); adv(1000); if (Rn.marketMult() !== m0) moved = true; ok(Rn.marketMult() >= .7 && Rn.marketMult() <= 1.4, 'mult clamped'); }
ok(moved, 'market drifts'); console.log('  ', Rn.marketText()); G.calendar = realCal;
// sell
G.state.coins = 1000; G.state.level = 4; G.state.xp = 0; const xp0 = 0; let sold = null; G.bus.on('ranch:sold', e => { sold = e; });
G.state.level = 4; G.state.xp = 0; Rn.step(T); const pr = Rn.price(calf); Rn.sell(calf.id);
ok(G.state.coins === 1000 + pr && sold && sold.via === 'auction' && Rn.herd().length === 0 && (G.state.xp > xp0 || G.state.level > 10), 'auction sale pays + xp');
// butcher
const s2 = Rn.add('hereford', 'steer', 'm'); s2.weight = 1150; G.state.barn = {}; const c1 = G.state.coins;
ok(Rn.butcher(s2.id) && G.qty('ground_beef') === 6 && G.qty('ribeye') === 2 && G.qty('brisket') === 2 && G.qty('leather') === 1, 'butcher yields');
ok(G.state.coins === c1 - Rn.consts.BUTCHER_FEE, 'butcher fee charged');
const val = 6 * G.DATA.products.ground_beef.sellPrice + 2 * G.DATA.products.ribeye.sellPrice + 2 * G.DATA.products.brisket.sellPrice + G.DATA.products.leather.sellPrice - 40;
ok(val > Rn.price(s2) * 1.4, 'butcher beats auction (' + val + ' vs ' + Rn.price(s2) + ')');
// breeding
G.state.level = 8; G.state.coins = 50000; G.state.barn = { cow_feed: 200 };
const cow = Rn.add('angus', 'cow', 'f'); cow.fedUntil = 0;
let born = null; G.bus.on('ranch:born', e => { born = e; });
adv(15 * 60000, feedKeepUp); ok(!born, 'no calf without a bull');
Rn.buyBull(); ok(Rn.animals().some(a => a.stage === 'bull'), 'buy bull');
adv(13 * 60000, feedKeepUp); ok(born && born.animal.stage === 'calf' && born.animal.name, 'calf born ' + (born && born.animal.name));
ok(toasts.some(t => /new calf/.test(t)), 'born toast');
const cowsold = Rn.sell(cow.id); ok(cowsold > 0, 'sell cow ' + cowsold);
// cap
while (Rn.animals().length < Rn.pastureCap()) Rn.add('angus', 'calf');
ok(Rn.buyCalf('angus') === false, 'cap blocks purchase');
// panel render with everything
const html = G.panels.ranch.render(); ok(html.includes('data-pa="feed"') && html.includes('Upgrades'), 'full panel');
G.panels.ranch.onAction('feedall', { dataset: {} });
// every registered event
Rn.animals().forEach(a => { a.stage === 'calf' && (a.stage = 'steer'); });
G.state.coins = 5000; G.state.level = 10;
['cattle_out', 'pinkeye', 'hay_prices', 'county_fair'].forEach(k => {
  ok(G.Events.def(k), 'registered ' + k);
  const c0 = G.state.coins; const rec = G.Events.trigger(k); ok(rec, 'trigger ' + k);
  if (rec.pending) { const last = G.Events.def(k).choices.length - 1; for (let i = 0; i <= last; i++) { const rr = G.Events.trigger(k); ok(G.Events.choose(rr.id, i), k + ' choice ' + i); } }
});
ok(G.Events.priceMult('alfalfa') > 1.3, 'hay price mod');
Rn.animals().length = 0; G.Events.active().forEach(r => { r.endAt = 0; });
const ev = G.Events.def('cattle_out'); ok(!ev.requires(), 'cattle_out needs herd'); ok(!G.Events.def('county_fair').requires(), 'fair needs steer');
// defensive: corrupt state
G.state.ranch = { animals: [null, { id: 'x', stage: 'zzz' }] }; ok(Rn.herd().length === 1, 'ensure repairs bad saves');
G.state.ranch = undefined; G.bus.emit('state:reset'); ok(Rn.herd().length === 0 && G.state.ranch, 'reset ensures');
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
