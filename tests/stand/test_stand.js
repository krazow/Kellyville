// node tests/stand/test_stand.js
const fs = require('fs'), path = require('path'), assert = require('assert');
global.window = global; global.document = undefined;
const store = {}; global.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
let T = 1700000000000; Date.now = () => T;
const root = path.join(__dirname, '..', '..', 'src');
for (const f of ['core', 'data', 'events', 'economy', 'stand']) (0, eval)(fs.readFileSync(path.join(root, f + '.js'), 'utf8'));
const toasts = []; G.toast = (m, k) => toasts.push(m);
G.bus.emit('init');
let ok = 0; const t = (n, f) => { try { f(); ok++; console.log('ok  ', n); } catch (e) { console.log('FAIL', n, e.message); process.exitCode = 1; } };
const sales = []; G.bus.on('stand:sale', p => sales.push(p));
const run = (sec) => { for (let i = 0; i < sec * 2; i++) { T += 500; G.tick(); } };

t('locked below level 3', () => { G.state.coins = 1000; assert(!G.Stand.build('x')); assert(!G.Stand.isBuilt()); });
t('build at level 3 costs coins, sanitizes name', () => {
  G.state.level = 3; G.setPlayerName('Kelly'); assert.strictEqual(G.Stand.name(), "Kelly's Farm Stand");
  const c0 = G.state.coins; assert(G.Stand.build('<b>Kelly & Co</b>"')); assert.strictEqual(G.state.coins, c0 - G.Stand.buildCost);
  assert.strictEqual(G.Stand.name(), 'bKelly Co/b'); });
t('setName', () => { assert(G.Stand.setName('Palouse Pickings')); assert.strictEqual(G.Stand.name(), 'Palouse Pickings'); assert(!G.Stand.setName('<>')); });
t('stock / pull / tier', () => {
  G.state.barn = { wheat: 20, eggs: 10, apples: 30, milk: 5 }; G.state.barnCap = 200;
  assert.strictEqual(G.Stand.stock(0, 'eggs', 10, 2), 10); assert.strictEqual(G.qty('eggs'), 0);
  assert.strictEqual(G.Stand.unitPrice(G.Stand.shelves()[0]), Math.round(G.sellPrice('eggs') * 1.6));
  assert.strictEqual(G.Stand.pull(0, 4), 4); assert.strictEqual(G.qty('eggs'), 4);
  assert(G.Stand.setTier(0, 0)); assert(!G.Stand.stock(0, 'milk', 1)); assert(!G.Stand.stock(9, 'milk', 1));
  G.Stand.pull(0, 'all'); assert.strictEqual(G.Stand.shelves()[0], null);
  G.Stand.stock(0, 'apples', 30, 1); G.Stand.stock(1, 'wheat', 20, 0); G.Stand.stock(2, 'milk', 5, 1); G.Stand.stock(3, 'eggs', 10, 0); });
t('shelf upgrade 4->6, level gating', () => { G.state.level = 3; assert(!G.Stand.upgrade('shelves')); G.state.level = 12; G.state.coins = 99999; assert(G.Stand.upgrade('shelves')); assert.strictEqual(G.Stand.slotCount(), 6); assert(!G.Stand.upgrade('shop')); G.Stand.upgrade('sign'); G.Stand.upgrade('awning'); assert(G.Stand.upgrade('shop')); G.Stand.upgrade('shelves'); G.Stand.upgrade('shelves'); assert.strictEqual(G.Stand.slotCount(), 10); assert(!G.Stand.upgrade('shelves')); });
t('hour of ticks: coins up, stock down, caps, phases', () => {
  G.state.barn = { apples: 999 }; G.state.barnCap = 5000;
  G.Stand.pull(0, 'all'); // clear
  for (let i = 0; i < 10; i++) { const s = G.Stand.shelves()[i]; if (s) G.Stand.pull(i, 'all'); }
  G.state.barn = { apples: 400, wheat: 400, milk: 90, eggs: 90, honey: 90, bread: 90 }; G.state.barnCap = 5000;
  ['apples', 'wheat', 'milk', 'eggs', 'honey', 'bread'].forEach((k, i) => G.Stand.stock(i, k, 90, 1));
  const c0 = G.state.coins, stock0 = G.Stand.shelves().reduce((a, x) => a + (x ? x.qty : 0), 0); sales.length = 0;
  let maxC = 0, phases = new Set();
  for (let i = 0; i < 7200; i++) { T += 500; G.tick(); const cs = G.Stand.customers(); maxC = Math.max(maxC, cs.length); cs.forEach(c => { phases.add(c.phase); assert(c.t >= 0 && c.t <= 1); }); }
  const stock1 = G.Stand.shelves().reduce((a, x) => a + (x ? x.qty : 0), 0);
  console.log('   coins +', G.state.coins - c0, 'stock', stock0, '->', stock1, 'sales', sales.length, 'maxC', maxC, [...phases], 'rep', G.Stand.reputation().toFixed(2));
  assert(G.state.coins > c0); assert(stock1 < stock0); assert(sales.length > 5); assert(maxC <= 4 && maxC >= 1);
  assert(['arriving', 'browsing', 'paying', 'leaving'].every(p => phases.has(p))); assert(G.Stand.todaySales() >= 0); });
t('sold-out leaves customers sad, rep dips, no throw', () => {
  for (let i = 0; i < 10; i++) { const s = G.Stand.shelves()[i]; if (s) G.Stand.pull(i, 'all'); }
  G.Stand.ensure().rep = 4; run(600); assert(G.Stand.reputation() < 4); assert(G.Stand.reputation() >= 1); });
t('offline sales capped at 30, toast', () => {
  G.state.barn = { apples: 900 }; G.state.barnCap = 5000; for (let i = 0; i < 10; i++) G.Stand.pull(i, 'all');
  G.Stand.stock(0, 'apples', 99, 0); G.Stand.stock(1, 'apples', 99, 0); G.Stand.stock(2, 'apples', 99, 0);
  G.Stand.ensure().up.sign = true; toasts.length = 0; sales.length = 0; const c0 = G.state.coins;
  const r = G.Stand.offlineSim(T - 20 * 3600 * 1000, T); console.log('  ', JSON.stringify(r));
  assert(r.sales > 0 && r.sales <= 30 && sales.length <= 30 + 5); assert(G.state.coins > c0); assert(toasts.some(m => /sold \d+ items while you were away: \+\d+ 🪙/.test(m))); });
t('offline via init after long absence', () => {
  G.Stand.ensure().lastSeen = T - 6 * 3600 * 1000; toasts.length = 0; G.bus.emit('init'); assert(toasts.some(m => /while you were away/.test(m))); });
t('night: closed w/o honor box, honor box sells at night', () => {
  const st = G.state.startedAt; T = st + (Math.floor((T - st) / 90000) + 1) * 90000 + 0.9 * 90000;
  G.bus.emit('state:reset'); const s = G.Stand.ensure(); s.built = true; s.up.honor = false; s.lastSeen = T; G.state.barn = { apples: 400 }; for (let i = 0; i < 10; i++) G.Stand.pull(i, 'all'); G.Stand.stock(0, 'apples', 99, 0);
  G.Events.active().forEach(r => { r.endAt = 0; });
  assert.strictEqual(G.Stand.status(), 'Closed'); let c0 = G.state.coins; sales.length = 0; run(4); assert.strictEqual(sales.length, 0);
  s.up.honor = true; assert.strictEqual(G.Stand.status(), 'Honor box'); s.rep = 5; s.up.shop = true; s.up.sign = true;
  for (let i = 0; i < 60; i++) { T += 500; G.state.startedAt += 500; G.tick(); } // hold the clock at night
  assert(sales.length > 0, 'honor box income'); assert.deepStrictEqual(G.Stand.customers(), []); });
t('traffic modifiers', () => {
  G.Events.active().forEach(r => { r.endAt = 0; }); const s = G.Stand.ensure(); s.buzzUntil = 0; s.slumpUntil = 0; s.saleUntil = 0; const base = G.Stand.trafficRate();
  G.Events.trigger('road_construction'); const rc = G.Stand.trafficRate(); G.Events.active().forEach(r => { r.endAt = 0; }); G.Events.trigger('rodeo'); const rd = G.Stand.trafficRate();
  console.log('   base', base.toFixed(4), 'roadwork', rc.toFixed(4), 'rodeo', rd.toFixed(4)); assert(rc < base * 0.6); assert(rd > base * 1.8); });
t('every registered stand event runs', () => {
  G.Events.active().forEach(r => { r.endAt = 0; });
  for (const k of ['food_blogger', 'road_construction', 'market_competition']) {
    assert(G.Events.def(k), k + ' registered'); const rec = G.Events.trigger(k); assert(rec, k);
    if (k === 'market_competition') { G.state.coins = 999; for (let i = 0; i < 3; i++) { const r = G.Events.trigger(k); assert(G.Events.choose(r.id, i), 'choice ' + i); } }
  }
  const s = G.Stand.ensure(); s.rep = 2; G.Events.trigger('food_blogger'); assert(s.rep >= 2.5); });
t('events require built stand', () => { assert(G.Events.def('food_blogger').requires()); G.state.stand.built = false; assert(!G.Events.def('food_blogger').requires()); G.state.stand.built = true; });
t('save keeps only stock/upgrades/rep/name/daily', () => { const j = JSON.parse(JSON.stringify(G.state.stand)); assert(!('customers' in j)); assert(j.up && j.shelves && j.rep && j.name && j.daily); });
t('state:reset', () => { G.reset(); assert(!G.Stand.isBuilt()); assert.deepStrictEqual(G.Stand.customers(), []); });
t('defensive: corrupt state', () => { G.state.stand = { built: true, shelves: 'x', up: 5, rep: 'nan', slotLvl: 99 }; G.tick(); run(5); assert(G.Stand.slotCount() === 10); });
console.log(ok + ' passed');
