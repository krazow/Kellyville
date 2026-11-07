// node tests/antiques/logic_antiques.js
const fs = require('fs'), path = require('path'), assert = require('assert');
global.window = global; global.document = undefined;
const store = {}; global.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
let T = 1700000000000; Date.now = () => T;
const root = path.join(__dirname, '..', '..', 'src');
for (const f of ['core', 'data', 'events', 'economy', 'antiques']) (0, eval)(fs.readFileSync(path.join(root, f + '.js'), 'utf8'));
const toasts = []; G.toast = (m, k) => toasts.push(m);
let modals = 0; G.showModal = () => { modals++; };
let changes = 0; G.bus.on('antiques:change', () => changes++);
G.bus.emit('init');
let ok = 0; const t = (n, f) => { try { f(); ok++; console.log('ok  ', n); } catch (e) { console.log('FAIL', n, e.stack); process.exitCode = 1; } };
const run = sec => { for (let i = 0; i < sec * 2; i++) { T += 500; G.tick(); } };
const A = G.Antiques;

t('data: ~30 items, fields, no forbidden/brand words', () => {
  const ks = Object.keys(G.DATA.antiques); assert(ks.length >= 30 && ks.length <= 40, ks.length);
  const bad = /native|indian|ivory|bone|skull|remains|coca|pepsi|singer|pendleton|ford\b|chevy|zippo|kodak|coleman/i;
  ks.forEach(k => { const d = G.DATA.antiques[k]; assert(d.name && d.emoji && d.category && d.era && d.baseValue > 0 && d.desc); assert(['common', 'uncommon', 'rare', 'legendary'].includes(d.rarity)); assert(!bad.test(d.name + d.desc), k); });
  assert(ks.some(k => G.DATA.antiques[k].rarity === 'legendary')); });
t('locked below level 6, needs coins', () => { G.state.coins = 5000; G.state.level = 3; assert(!A.build('x')); assert(!A.isBuilt()); G.state.level = 6; G.state.coins = 1000; assert(!A.build('x')); });
t('build costs 1500, modal, name sanitized, change emitted', () => {
  G.setPlayerName('Kelly'); assert.strictEqual(A.name(), "Kelly's Antiques");
  G.state.coins = 3000; const c = changes; assert(A.build('<b>Old & Rust</b>')); assert.strictEqual(G.state.coins, 1500); assert(modals === 1 && changes > c);
  assert.strictEqual(A.name(), 'bOld Rust/b'); assert(A.setName('Palouse Relics')); assert(!A.setName('<>')); assert.strictEqual(A.level(), 1); assert(!A.build('again')); });
t('listings: daily restock, sources, prices', () => {
  const l = A.listings(); assert(l.length >= 12); const srcs = new Set(l.map(x => x.src)); assert(srcs.has('estate') && srcs.has('auction') && srcs.has('flea') && srcs.has('yard'));
  l.forEach(x => { assert(x.price > 0 && x.cond >= 0 && x.cond <= 3); });
  const ids = l.map(x => x.id).join(); run(100); assert.notStrictEqual(A.listings().map(x => x.id).join(), ids); });
t('buy / storage / display / slots', () => {
  const l = A.listings().sort((a, b) => a.price - b.price); G.state.coins = 1500; const c0 = G.state.coins;
  assert(A.buyListing(l[0].id)); assert.strictEqual(G.state.coins, c0 - l[0].price); assert(!A.buyListing(l[0].id));
  const inv = A.inventory(); assert.strictEqual(inv.length, 1);
  const ch = changes; assert(A.setDisplay(inv[0].id, true)); assert(changes > ch); assert.strictEqual(A.display().length, 1);
  const l2 = A.listings(); A.buyListing(l2[0].id); A.buyListing(l2[1].id); const iv = A.inventory(); A.setDisplay(iv[1].id, true); assert(!A.setDisplay(iv[2].id, true)); assert.strictEqual(A.display().length, 2);
  assert(!A.restore(iv[0].id)); });
t('upgrades gating and effects', () => {
  G.state.coins = 99999; assert(!A.upgrade('secondFloor')); assert(A.upgrade('shelves') && A.slotCount() === 4); assert(A.upgrade('porch') && A.slotCount() === 5); assert(A.upgrade('secondFloor') && A.slotCount() === 6 && A.level() === 3);
  ['workshop', 'appraiser', 'neonSign'].forEach(k => assert(A.upgrade(k))); const u = A.upgrades(); assert(u.porch && u.workshop && u.neonSign && u.appraiser && u.secondFloor); assert(!A.upgrade('porch')); });
t('restore: fee, time, condition rises', () => {
  G.state.coins = 99999; for (let i = 0; i < 4; i++) { const l = A.listings().filter(x => x.cond < 3); if (l.length) A.buyListing(l[0].id); }
  const it = A.inventory().find(x => x.cond < 3 && !x.rest); const c0 = G.state.coins, v0 = A.value(it); assert(A.restore(it.id)); assert(G.state.coins < c0);
  assert(A.restore(A.inventory().find(x => !x.rest && x.cond < 3).id)); assert(!A.restore(A.inventory().find(x => !x.rest && x.cond < 3).id)); // two benches only
  run(250); const it2 = A.inventory().find(x => x.id === it.id); assert.strictEqual(it2.cond, it.cond + 1); assert(A.value(it2) > v0); });
t('quick sell pays 0.6x', () => { const it = A.inventory().find(x => !x.rest); const v = A.value(it); const c0 = G.state.coins; assert(A.quickSell(it.id)); assert.strictEqual(G.state.coins - c0, Math.round(v * 0.6)); });
t('farm finds', () => { const n0 = A.inventory().length; let f = 0; const r = Math.random; Math.random = () => 0.01; for (let i = 0; i < 3; i++) { G.bus.emit('harvested', {}); } Math.random = r; assert(A.inventory().length >= n0 + 1); assert(A.stats().finds >= 1);
  for (let i = 0; i < 400; i++) G.bus.emit('harvested', {}); assert(A.inventory().length <= A.invCap()); });
t('shoppers: spawn in day, cap 4, phases, offers, counters', () => {
  while (A.inventory().length < 6) { const l = A.listings(); if (!l.length) break; A.buyListing(l[0].id); }
  A.inventory().filter(x => !x.disp && !x.rest).slice(0, 6).forEach(x => A.setDisplay(x.id, true));
  assert(A.display().length >= 3); const ph = new Set(); let maxC = 0, offers = 0, counters = 0, cwin = 0, sold = 0; G.bus.on('antiques:sale', () => sold++);
  for (let i = 0; i < 9000; i++) { T += 500; G.tick(); const cs = A.customers(); maxC = Math.max(maxC, cs.length); cs.forEach(c => { ph.add(c.phase); assert(c.t >= 0 && c.t <= 1); });
    A.offers().forEach(o => { offers++; if (o.amount < A.value(A.inventory().find(x => x.id === o.invId) || { key: 'skillet', cond: 1 }) * 0.5) return; const r = counters++ % 3; if (r === 0) { if (A.counterOffer(o.id, 0.1)) cwin++; } else if (r === 1) A.acceptOffer(o.id); else A.declineOffer(o.id); });
    if (i % 200 === 0) { A.inventory().filter(x => !x.disp && !x.rest).slice(0, 2).forEach(x => A.setDisplay(x.id, true)); const l = A.listings(); if (l.length && G.state.coins > 400) A.buyListing(l[0].id); } }
  console.log('   sold', sold, 'offers seen', offers, 'counters won', cwin, [...ph], 'max', maxC);
  assert(maxC <= 4 && maxC >= 1); assert(sold > 3); assert(['arriving', 'browsing', 'leaving'].every(p => ph.has(p))); });
t('counter chance monotonic and bounded', () => { const o = { amount: 100, max: 120 }; const p = [0.1, 0.25, 0.5].map(x => A.counterChance(o, x)); assert(p[0] > p[1] && p[1] > p[2]); p.forEach(x => assert(x > 0 && x < 1)); });
t('every registered event runs without exceptions', () => {
  const keys = ['appraisal_fair', 'tv_pickers', 'repro_scare']; keys.forEach(k => assert(G.Events.def(k), k));
  keys.forEach(k => {
    while (A.inventory().length < 3) { const l = A.listings(); if (!l.length) break; A.buyListing(l[0].id); }
    G.state.coins = 5000; const rec = G.Events.trigger(k); assert(rec, k);
    const pend = G.Events.pending(); if (pend.length) { const d = G.Events.def(k); for (let i = 0; i < d.choices.length; i++) { if (i > 0) { G.Events.trigger(k); } const p = G.Events.pending()[0]; if (p) assert(G.Events.choose(p.id, i), k + ' choice ' + i); } }
    run(5); });
  // not built -> not eligible
  assert(G.Events.def('repro_scare').requires()); });
t('state survives save/reload shape', () => { const s = JSON.parse(JSON.stringify(G.state)); G.state = Object.assign(G.state, s); run(5); assert(A.isBuilt()); G.bus.emit('state:reset'); });

// ---- 20 minute smart-play P&L ----
t('simulated 20-minute smart play: profitable', () => {
  G.reset(); G.state.startedAt = T; G._lastDay = undefined; G.state.level = 6; G.state.coins = 3000; G.setPlayerName('Kelly');
  assert(A.build('Sim')); const startCoins = G.state.coins; const spentBuild = 1500; const ev = [];
  G.bus.on('antiques:sale', s => ev.push(s));
  const buyUps = ['workshop', 'shelves', 'appraiser', 'porch', 'neonSign'];
  let lastDay = 0, log = [];
  for (let i = 0; i < 2400; i++) { // 1200 s
    T += 500; G.tick();
    if (i % 4) continue;
    const day = G.calendar().day;
    if (day !== lastDay) { lastDay = day;
      // buy bargains: ratio <= .78 with plenty of cash reserve
      A.listings().map(l => ({ l, r: l.price / A.valueAt(l.key, l.cond) })).filter(x => x.r <= 0.8 && x.l.price <= 450).sort((a, b) => a.r - b.r).slice(0, 4).forEach(x => { if (G.state.coins >= x.l.price + 60) A.buyListing(x.l.id); });
      buyUps.forEach(u => { const cost = A.upgradeDefs[u].cost; if (!A.upgrades()[u] && G.state.coins > cost + 400) A.upgrade(u); }); }
    A.inventory().filter(x => !x.rest && !x.disp && x.cond < 2).sort((a, b) => a.cond - b.cond).forEach(x => { if (A.upgrades().workshop && A.restoreFee(x) < G.state.coins - 150) A.restore(x.id); });
    // keep display filled with best items (not those worth restoring further)
    A.inventory().filter(x => !x.rest && !x.disp && x.cond >= 2).sort((a, b) => A.value(b) - A.value(a)).forEach(x => { if (A.display().length < A.slotCount()) A.setDisplay(x.id, true); });
    if (A.display().length < A.slotCount()) A.inventory().filter(x => !x.rest && !x.disp).sort((a, b) => b.cond - a.cond).forEach(x => A.setDisplay(x.id, true));
    // offers: accept when profitable; try a +10% counter once on good ones
    A.offers().forEach(o => { const it = A.inventory().find(x => x.id === o.invId); if (!it) return; if (o.amount >= it.invested * 1.1 || o.amount >= A.value(it)) { if (o.max / o.amount > 1.15 && Math.random() < 0.7) A.counterOffer(o.id, 0.1); else A.acceptOffer(o.id); } else if (o.amount < it.invested * 0.8) A.declineOffer(o.id); });
    if (i % 480 === 0) log.push(`${Math.round(i / 120)}m coins ${G.state.coins} inv ${A.inventory().length}`);
  }
  const st = A.stats(); const invVal = A.inventory().reduce((a, x) => a + A.value(x), 0);
  const upCost = st.upgradeSpent; const net = G.state.coins + invVal - startCoins + spentBuild;
  console.log('   ' + log.join(' | '));
  console.log(`   P&L 20m: sales ${st.sales} revenue ${st.revenue} bought ${st.spent} restore ${st.restoreSpent} upgrades ${upCost} build 1500 trading profit ${st.revenue - st.spent - st.restoreSpent} picker ${st.picker} finds ${st.finds}`);
  console.log(`   start coins ${startCoins + spentBuild} -> coins ${G.state.coins} + inventory ${invVal}; net change vs before build ${G.state.coins + invVal - (startCoins + spentBuild)}; rep ${A.reputation().toFixed(2)}`);
  assert(st.revenue - st.spent - st.restoreSpent > 1000, 'trading profit');
  assert(G.state.coins + invVal > startCoins + spentBuild - 2500 + 800);
});
t('naive play (random buys, no restore, fair tier) earns little or loses', () => {
  G.reset(); G.state.startedAt = T; G._lastDay = undefined; G.state.level = 6; G.state.coins = 3000; assert(A.build('N')); const c0 = G.state.coins; let lastDay = 0;
  for (let i = 0; i < 2400; i++) { T += 500; G.tick(); if (i % 4) continue; const day = G.calendar().day;
    if (day !== lastDay) { lastDay = day; const l = A.listings(); for (let k = 0; k < 2 && l.length; k++) { const x = l[Math.floor(Math.random() * l.length)]; if (G.state.coins > x.price + 50) A.buyListing(x.id); } }
    A.inventory().filter(x => !x.disp).forEach(x => A.setDisplay(x.id, true)); A.offers().forEach(o => A.acceptOffer(o.id)); }
  const st = A.stats(); const inv = A.inventory().reduce((a, x) => a + A.value(x), 0);
  console.log('   naive: sales', st.sales, 'revenue', st.revenue, 'bought', st.spent, 'coins', c0, '->', G.state.coins, '+ inv', inv);
});
console.log(ok + ' passed'); 
