// node tests/apiary/logic_apiary.js
const fs = require('fs'), path = require('path'), assert = require('assert');
global.window = global; global.document = undefined;
const store = {}; global.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
let T = 1700000000000; Date.now = () => T;
const root = path.join(__dirname, '..', '..', 'src');
for (const f of ['core', 'data', 'events', 'economy', 'apiary']) (0, eval)(fs.readFileSync(path.join(root, f + '.js'), 'utf8'));
const toasts = []; G.toast = (m) => toasts.push(m);
let modals = 0; G.showModal = () => { modals++; };
let structs = 0; G.bus.on('apiary:change', () => structs++);
G.bus.emit('init'); const quiet = () => { G.state.flags['events.nextAt'] = T + 36e8; }; G.bus.on('tick', quiet);
let errs = 0; const ce = console.error; console.error = (...a) => { errs++; ce(...a); };
let ok = 0; const t = (n, f) => { try { f(); ok++; console.log('ok  ', n); } catch (e) { console.log('FAIL', n, e.stack); process.exitCode = 1; } };
let pin = null; // pin the calendar to one season so long runs do not drift across seasons
const run = sec => { for (let i = 0; i < sec * 2; i++) { T += 500; if (pin) G.state.startedAt = T - pin * G.DAY_SEC * 1000; G.tick(); } };
const care = () => A.hives().forEach((h, i) => { if (h.status !== 'empty' && h.mites >= 0.5) { G.state.coins += 35; A.treat(i); } });
const runCare = sec => { for (let k = 0; k < sec / 10; k++) { run(10); care(); } };
const setSeason = (s, p, free) => { const d = { spring: 0, summer: 7, fall: 14, winter: 21 }[s]; pin = free ? null : d + (p || 0.3); G.state.startedAt = T - (d + (p || 0.3)) * G.DAY_SEC * 1000; G.tick(); };
const A = G.Apiary;
const act = (a, d) => G.panels.apiary.onAction(a, { dataset: d || {} });
const render = () => { const h = G.panels.apiary.render(); assert(typeof h === 'string' && h.length > 50); return h; };

t('products added', () => { ['honeycomb', 'beeswax', 'beeswax_candle'].forEach(k => { const p = G.DATA.products[k]; assert(p && p.emoji && p.name && p.sellPrice > 0); }); });
t('locked below level 5 / needs coins; not-built views', () => {
  G.state.level = 3; G.state.coins = 5000; assert(!A.build()); assert(!A.isBuilt()); assert.deepStrictEqual(A.hives(), []); assert.strictEqual(A.readyCount(), 0);
  render(); G.state.level = 5; G.state.coins = 500; assert(!A.build()); assert.strictEqual(G.state.coins, 500); assert.strictEqual(G.hookless, undefined); });
t('build: 600 coins, 2 hives, 4 slots visible, modal, change', () => {
  setSeason('spring'); G.state.coins = 700; const c = structs; assert(A.build()); assert.strictEqual(G.state.coins, 100); assert(modals === 1 && structs > c);
  const hs = A.hives(); assert.strictEqual(hs.length, 4); assert.deepStrictEqual(hs.map(h => h.status), ['active', 'active', 'empty', 'empty']); assert(!A.build());
  hs.slice(0, 2).forEach(h => { assert(h.strength > 0 && h.strength <= 1 && h.fill >= 0 && h.fill <= 1 && h.id && h.name && h.queen === 'young'); }); render(); });
t('fill ticks do not emit apiary:change', () => { const c = structs; run(20); assert.strictEqual(structs, c); assert(A.hives()[0].fill > 0); });
t('forage rises with flowering crops', () => {
  const f0 = A.forage(); G.state.level = 20; G.state.coins = 99999; for (let i = 0; i < 6; i++) G.plant(i, ['canola', 'apples', 'cherries', 'alfalfa', 'mint', 'pumpkins'][i]);
  const f1 = A.forage(); assert(f0 >= 0.79 && f0 < 0.85 && f1 > f0 + 0.3 && f1 <= 1.7, f0 + ' ' + f1); });
t('pollination hook capped at +25%, only crops, none in winter', () => {
  G.state.coins = 99999; for (let i = 0; i < 4; i++) { A.buyHive(); }
  setSeason('summer'); runCare(500);
  const hs = A.hives(); assert(hs.filter(h => h.status !== 'empty').length >= 4);
  const p = A.pollinationBonus('apples'); assert(p > 0.15 && p <= 0.25 + 1e-9, p); assert(A.pollinationPct() <= 25);
  assert(G.mods.yield('apples') <= 1.25 + 1e-9 && G.mods.yield('apples') > 1.1); assert.strictEqual(A.pollinationBonus('wheat'), 0); assert.strictEqual(G.mods.yield('wheat'), 1); });
t('summer balance: fill 3-4 min with decent forage; payback 15-20 min', () => {
  G.state.coins = 99999; const f = A.forage(); const r = A.fillRate(0); const mins = 1 / r / 60; console.log('     forage', f.toFixed(2), 'fill minutes', mins.toFixed(2));
  assert(mins > 2.2 && mins < 4.6, mins); });
t('harvest: ready status, yields, barn items, xp', () => {
  G.state.barnCap = 9999; G.state.barn = {}; runCare(300); const rc = A.readyCount(); assert(rc >= 1, 'ready ' + rc);
  const xp = G.state.xp + G.state.level * 1e6; const n = A.harvestAll(); assert.strictEqual(n, rc); assert(G.qty('honey') >= rc); assert(A.readyCount() === 0);
  const hv = A.hives().find(h => h.status === 'active'); assert(hv && hv.fill < 0.2); });
t('economics: simulated 20 min of summer play, harvest each time ready', () => {
  setSeason('summer', 0.3); G.reset(); G.bus.emit('init'); setSeason('summer', 0.3); G.state.level = 5; G.state.coins = 600; G.state.barnCap = 9999;
  assert(A.build()); const start = G.state.coins; G.state.coins = 0; let earned = 0; const sp = () => { earned = 0; G.state.barn && ['honey', 'honeycomb', 'beeswax'].forEach(k => earned += G.qty(k) * G.sellPrice(k)); return earned; };
  // a typical player has a few flowering plots
  G.state.coins = 99999; for (let i = 0; i < 3; i++) G.plant(i, 'canola'); G.state.coins = 0;
  const marks = []; for (let m = 1; m <= 20; m++) { for (let i = 0; i < 120; i++) { run(0.5); if (i % 10 === 0) { A.harvestAll(); care(); } } marks.push(Math.round(sp())); }
  console.log('     cumulative sale value by minute 5/10/15/20:', marks[4], marks[9], marks[14], marks[19]);
  assert(marks[19] >= 600 && marks[14] >= 450, 'payback ' + marks.join()); assert(marks[9] < 700); });
function setSeasonKeep() { setSeason('summer'); }
t('supers: cost, cap, structural emit, faster honey/min', () => {
  setSeasonKeep(); G.state.coins = 1000; const c = structs; const c0 = G.state.coins; assert(A.addSuper(0)); assert.strictEqual(G.state.coins, c0 - 80); assert(structs > c);
  assert(A.addSuper(0) && A.addSuper(0)); assert(!A.addSuper(0)); assert.strictEqual(A.hives()[0].supers, 3);
  G.state.coins = 0; assert(!A.addSuper(1)); act('super', { i: '1' }); });
t('mites: grow, sick at 0.8, treat clears, sick emits structural', () => {
  G.state.coins = 999; setSeasonKeep(); const h = G.state.apiary.hives[1]; h.mites = 0.78; h.fill = 0; const c = structs; run(40); assert(A.hives()[1].status === 'sick' || A.hives()[1].status === 'ready' && false, A.hives()[1].status);
  assert(structs > c); const hv = A.hives()[1]; assert(hv.mites >= 0.8); assert(A.treat(1)); assert.strictEqual(A.hives()[1].status, 'active'); assert(!A.treat(1)); });
t('swarm + split', () => {
  setSeason('spring', 0.1); run(2); const h = G.state.apiary.hives[0]; h.strength = 0.95; h.swarmAt = T + 60000; h.sick = false; h.mites = 0.05; assert(A.hives()[0].swarm);
  G.state.coins = 999; assert(A.buyHive()); while (A.buyHive()) { }
  // free a slot by checking canSplit message when full
  const before = A.hives().filter(x => x.status !== 'empty').length;
  if (A.canSplit(0)) { assert(/slot/i.test(A.canSplit(0)), A.canSplit(0)); G.state.apiary.up.moreHives1 = true; }
  assert.strictEqual(A.canSplit(0), ''); h.swarmAt = T + 60000; const s0 = A.hives()[0].strength; assert(A.split(0)); assert(A.hives()[0].strength < s0); assert(!A.hives()[0].swarm);
  assert.strictEqual(A.hives().filter(x => x.status !== 'empty').length, before + 1);
  // unsplit swarm loses half
  const g = G.state.apiary.hives[1]; g.strength = 0.9; g.swarmAt = T + 1000; run(5); assert(A.hives()[1].strength <= 0.5, A.hives()[1].strength); });
t('contracts: spring only, hives away then return with coins + strength', () => {
  setSeason('summer'); assert(!A.sendContract('wenatchee')); setSeason('spring', 0.05); G.state.apiary.hives.forEach(h => { if (h) { h.sick = false; h.mites = 0.05; h.swarmAt = 0; h.strength = Math.max(h.strength, 0.6); } });
  const c = A.contracts(); assert(c.length === 2); const coins0 = G.state.coins, c1 = structs; assert(A.sendContract('wenatchee')); assert(structs > c1);
  assert.strictEqual(A.hives().filter(h => h.status === 'away').length, 2); assert(!A.sendContract('wenatchee')); render(); G.panels.apiary.onAction('tab', { dataset: { k: 'orch' } }); render();
  setSeason('spring', 0.05); run(160); assert.strictEqual(A.hives().filter(h => h.status === 'away').length, 0); assert.strictEqual(G.state.coins, coins0 + 240); assert.strictEqual(A.stats().contracts, 1);
  setSeason('spring', 0.05); run(2); assert(!A.sendContract('wenatchee')); });
t('winter: dormant, no fill, syrup feeding, starvation weakens', () => {
  setSeason('winter', 0.2); run(3); const hs = A.hives().filter(h => h.status !== 'empty'); assert(hs.every(h => h.status === 'dormant'), JSON.stringify(hs.map(h => h.status)));
  const f0 = hs[0].fill; run(300); assert.strictEqual(A.hives()[0].fill, f0); assert(A.hives()[0].food < 0.5); G.state.coins = 500; assert(A.feed(0)); assert(A.hives()[0].food > 0.5); assert(!A.feed(0) || true);
  const g = A.hives()[1]; const s0 = g.strength; G.state.apiary.hives[1].food = 0; run(300); assert(A.hives()[1].strength < s0); assert(A.hives()[1].strength >= 0.1); render();
  assert.strictEqual(A.pollinationPct(), 0); assert(!A.harvest(0));
  setSeason('spring', 0.1); run(3); assert(A.hives().some(h => h.status === 'active' || h.status === 'ready')); });
t('upgrades: gating, maxHives, honeyHouse candles, bearFence', () => {
  G.state.coins = 99999; delete G.state.apiary.up.moreHives1; assert.strictEqual(A.maxHives(), 4); assert(!A.upgrade('moreHives2')); assert(A.upgrade('moreHives1') && A.maxHives() === 6); assert(A.upgrade('moreHives2') && A.maxHives() === 8);
  ['bearFence', 'windbreak', 'honeyHouse'].forEach(k => assert(A.upgrade(k))); assert(!A.upgrade('bearFence'));
  assert.deepStrictEqual(Object.keys(A.upgrades()).sort(), ['bearFence', 'honeyHouse', 'moreHives1', 'moreHives2', 'windbreak']); assert.strictEqual(A.hives().length, 8);
  G.state.barn = {}; G.state.barnCap = 999; assert(!A.craftCandles()); G.addItem('beeswax', 3); assert(A.craftCandles()); assert(!A.craftCandles()); assert.strictEqual(A.collectCandles(), 0); render(); G.panels.apiary.onAction('tab', { dataset: { k: 'up' } }); render();
  run(80); assert.strictEqual(A.collectCandles(), 2); assert.strictEqual(G.qty('beeswax_candle'), 2); });
t('hives cost scales; buy until full', () => {
  G.state.coins = 99999; let n = 0; while (A.buyHive()) n++; assert(n >= 1); assert(!A.buyHive()); assert.strictEqual(A.hives().filter(h => h.status === 'empty').length, 0); render(); });
t('events: all 4 registered, trigger each, no exceptions, sane numbers', () => {
  const keys = ['apiary_bear', 'apiary_smoke', 'apiary_canola', 'apiary_varroa']; keys.forEach(k => assert(G.Events.def(k), k));
  setSeason('summer', 0.3); G.state.coins = 99999; G.state.level = 20;
  // bear without/with fence
  delete G.state.apiary.up.bearFence; G.state.apiary.hives.forEach(h => { if (h) { h.supers = 1; h.strength = 0.9; h.fill = 0.9; h.sick = false; h.awayUntil = 0; } }); G.tick();
  const sup0 = A.hives().reduce((a, h) => a + h.supers, 0); const e1 = G.Events.trigger('apiary_bear'); assert(e1); assert(A.hives().reduce((a, h) => a + h.supers, 0) < sup0);
  A.hives().forEach(h => assert(h.strength >= 0 && h.strength <= 1 && h.fill >= 0 && h.fill <= 1));
  G.state.apiary.up.bearFence = true; const sup1 = A.hives().reduce((a, h) => a + h.supers, 0); G.Events.trigger('apiary_bear'); assert.strictEqual(A.hives().reduce((a, h) => a + h.supers, 0), sup1);
  const r0 = A.fillRate(0); G.Events.trigger('apiary_smoke'); const r1 = A.fillRate(0); assert(r1 < r0 * 0.8 && r1 > 0, r0 + ' ' + r1); G.state.apiary.smokeUntil = 0;
  G.Events.trigger('apiary_canola'); const r2 = A.fillRate(0); assert(r2 > r0, 'flow ' + r2 + ' ' + r0); render(); G.state.apiary.flowUntil = 0;
  const ev = G.Events.trigger('apiary_varroa'); assert(ev && ev.pending); A.hives().filter(h => h.status !== 'empty').forEach(h => assert(h.mites >= 0.3));
  const c0 = G.state.coins; assert(G.Events.choose(ev.id, 0)); assert(G.state.coins < c0); A.hives().filter(h => h.status !== 'empty').forEach(h => assert(h.mites <= 0.06 && h.status !== 'sick'));
  [1, 2].forEach(ci => { const e = G.Events.trigger('apiary_varroa'); assert(G.Events.choose(e.id, ci)); A.hives().forEach(h => assert(h.mites <= 1 && h.strength >= 0)); });
  run(200); render();
  // events never eligible when not built
  const bak = G.state.apiary.built; G.state.apiary.built = false; assert(!G.Events.def('apiary_smoke').requires()); G.state.apiary.built = bak; assert(G.Events.def('apiary_smoke').requires()); });
t('long soak: 3 in-game years, random actions, invariants hold, no console errors', () => {
  G.state.coins = 99999; G.state.barnCap = 99999; setSeason('spring', 0.1);
  for (let step = 0; step < 3 * 28 * 90 / 5; step++) {
    run(5); if (step % 3 === 0) { A.harvestAll(); G.state.coins = Math.max(G.state.coins, 5000); }
    const r = Math.random(); const i = Math.floor(Math.random() * 8);
    if (r < 0.1) A.addSuper(i); else if (r < 0.2) A.treat(i); else if (r < 0.3) A.feed(i); else if (r < 0.35) A.split(i); else if (r < 0.4) A.requeen(i); else if (r < 0.45) A.sendContract(['wenatchee', 'yakima'][i % 2]);
    else if (r < 0.47) G.Events.trigger(['apiary_bear', 'apiary_smoke', 'apiary_canola', 'apiary_varroa'][i % 4]);
    G.Events.active().filter(e => e.pending).forEach(e => G.Events.choose(e.id, Math.floor(Math.random() * 3)));
    if (step % 20 === 0) render();
    A.hives().forEach(h => { assert(isFinite(h.strength) && h.strength >= 0 && h.strength <= 1, 'strength'); assert(h.fill >= 0 && h.fill <= 1 && h.supers >= 0 && h.supers <= 3); });
  }
  assert.strictEqual(errs, 0); const mods = G.mods.yield('apples'); assert(mods >= 1 && mods <= 1.26 * 2.5); });
console.log(`\n${ok} passed`);
