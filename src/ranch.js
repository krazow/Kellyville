/* ranch.js — Kellyville beef-cattle ranch (G.Ranch + panel 'ranch').
   Buy calves at the Ellensburg Livestock Auction, feed them, grow calf -> yearling -> steer,
   breed with a bull, and sell at the auction or the butcher. State lives in G.state.ranch. */
(function () {
  'use strict';
  const G = window.G;
  if (!G) return;
  const U = G.util;

  // ---------- tuning ----------
  const UNLOCK_LEVEL = 4, BULL_LEVEL = 8, BASE_CAP = 4, MAX_BULLS = 2;
  const CALF_MS = 6 * 60000, YEARLING_MS = 10 * 60000;   // fed-time needed per stage
  const FEED_MS = 3 * 60000, BREED_MS = 12 * 60000;
  const BASE_PRICE = 0.22;                                 // coins per lb at market mult 1.0
  const BUTCHER_FEE = 40, BULL_COST = 650;
  const BUTCHER_YIELD = { ground_beef: 6, ribeye: 2, brisket: 2, leather: 1 };
  const MAX_DT = 6 * 3600 * 1000;

  const BREEDS = {
    angus:     { name: 'Angus',      cost: 110, level: 4, growth: 1.0,  price: 1.06, hardy: 1.0, wt: 1.0,  tag: 'Marbled, mellow, +6% auction price' },
    hereford:  { name: 'Hereford',   cost: 100, level: 4, growth: 1.0,  price: 1.0,  hardy: 0.6, wt: 1.0,  tag: 'Tough as sagebrush, hardy health' },
    red_angus: { name: 'Red Angus',  cost: 125, level: 5, growth: 1.12, price: 1.0,  hardy: 1.0, wt: 1.0,  tag: 'Fast grower, matures 12% quicker' },
    simmental: { name: 'Simmental',  cost: 150, level: 6, growth: 0.95, price: 1.0,  hardy: 1.0, wt: 1.12, tag: 'Big framed, +12% heavier' }
  };
  const BREED_ORDER = ['angus', 'hereford', 'red_angus', 'simmental'];

  const UPGRADES = [
    { key: 'fence', name: 'Cross-Fencing', emoji: '🚧', cost: 300, level: 4, cap: 8, happy: 6, desc: 'Rotate pastures. Room for 8 head, calmer cattle.' },
    { key: 'tank', name: 'Stock-Water Tank', emoji: '🪣', cost: 800, level: 7, cap: 12, happy: 6, desc: 'Fresh water in every paddock. Room for 12 head.' },
    { key: 'shed', name: 'Winter Hay Shed', emoji: '🏚️', cost: 1500, level: 10, cap: 16, happy: 8, desc: 'Dry hay all winter: no double feed. Room for 16 head.' }
  ];

  const NAMES = ['Big Red', 'Clover', 'Duke', 'Daisy', 'Biscuit', 'Maple', 'Tank', 'Pepper', 'Ruby', 'Waylon', 'Buttercup', 'Bandit',
    'Peaches', 'Hank', 'Honey', 'Moose', 'Willow', 'Gus', 'Dolly', 'Bruno', 'Sunny', 'Rusty', 'Pickles', 'Mabel', 'Tater', 'Huckleberry',
    'Lucky', 'Nugget', 'Patsy', 'Ranger', 'Bluebell', 'Cinnamon', 'Dusty', 'Marigold', 'Tex', 'Juniper', 'Barley', 'Rosie', 'Sarge', 'Penny'];

  // ---------- products ----------
  function addProducts() {
    if (!G.DATA || !G.DATA.products) return;
    const add = (k, v) => { if (!G.DATA.products[k]) G.DATA.products[k] = v; };
    add('ground_beef', { name: 'Ground Beef', emoji: '🍔', sellPrice: 24, desc: 'Lean grass-and-alfalfa finished grind.' });
    add('ribeye', { name: 'Ribeye Steak', emoji: '🥩', sellPrice: 70, desc: 'Thick, marbled, and made for the cast-iron skillet.' });
    add('brisket', { name: 'Smoked Brisket', emoji: '🍖', sellPrice: 60, desc: 'Low and slow over apple wood.' });
    add('leather', { name: 'Leather', emoji: '👢', sellPrice: 45, desc: 'Tanned hide for boots and saddles.' });
  }
  addProducts();

  // ---------- state ----------
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  function ensure() {
    const s = G.state;
    if (!s) return null;
    if (!s.ranch || typeof s.ranch !== 'object') s.ranch = {};
    const r = s.ranch;
    if (!Array.isArray(r.animals)) r.animals = [];
    r.animals = r.animals.filter(a => a && typeof a === 'object' && a.id);
    r.animals.forEach(a => {
      if (!BREEDS[a.breed]) a.breed = 'angus';
      if (['calf', 'yearling', 'steer', 'cow', 'bull'].indexOf(a.stage) < 0) a.stage = 'calf';
      a.sex = a.sex === 'f' ? 'f' : 'm';
      a.name = a.name || 'Buddy';
      a.prog = num(a.prog, 0); a.weight = num(a.weight, 200);
      a.health = U.clamp(num(a.health, 100), 0, 100);
      a.happy = U.clamp(num(a.happy, 60), 0, 100);
      a.fedUntil = num(a.fedUntil, 0); a.breedProg = num(a.breedProg, 0);
    });
    if (!r.up || typeof r.up !== 'object') r.up = {};
    if (!r.mkt || typeof r.mkt !== 'object') r.mkt = {};
    r.mkt.mult = U.clamp(num(r.mkt.mult, 1), 0.7, 1.4);
    r.mkt.pct = num(r.mkt.pct, 0);
    r.mkt.day = num(r.mkt.day, 0);
    r.lastT = num(r.lastT, 0);
    r.sold = num(r.sold, 0); r.born = num(r.born, 0);
    return r;
  }
  const R = () => ensure() || { animals: [], up: {}, mkt: { mult: 1, pct: 0, day: 0 }, lastT: 0 };
  const now = () => U.now();
  const esc = s => (G.uikit && G.uikit.esc) ? G.uikit.esc(s) : String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = n => Math.round(n || 0).toLocaleString('en-US');
  const unlocked = () => ((G.state && G.state.level) || 1) >= UNLOCK_LEVEL;
  const cap = () => BASE_CAP + 4 * UPGRADES.filter(u => R().up[u.key]).length;
  const season = () => { try { return G.calendar().season; } catch (e) { return 'spring'; } };
  const winterDouble = () => season() === 'winter' && !R().up.shed;
  const bullCount = () => R().animals.filter(a => a.stage === 'bull').length;
  const isAdult = a => a.stage === 'steer' || a.stage === 'cow' || a.stage === 'bull';

  function pickName(r) {
    const used = {}; r.animals.forEach(a => { used[a.name] = 1; });
    const free = NAMES.filter(n => !used[n]);
    if (free.length) return U.pick(free);
    const base = U.pick(NAMES); let i = 2;
    while (used[base + ' ' + i]) i++;
    return base + ' ' + i;
  }
  function mkAnimal(breed, stage, sex) {
    const r = R(), b = BREEDS[breed] || BREEDS.angus;
    const a = { id: U.uid(), name: pickName(r), breed: BREEDS[breed] ? breed : 'angus', sex: sex || (Math.random() < 0.5 ? 'f' : 'm'),
      stage: stage || 'calf', prog: 0, weight: 150 * b.wt, health: 100, happy: 65, fedUntil: 0, breedProg: 0, born: now() };
    if (a.stage === 'bull') { a.sex = 'm'; a.weight = 1300 * b.wt; }
    return a;
  }

  // ---------- simulation ----------
  function stageNeed(a) { return a.stage === 'calf' ? CALF_MS : a.stage === 'yearling' ? YEARLING_MS : 0; }
  function happyTarget(a, fed, herdN, c) {
    const ups = UPGRADES.filter(u => R().up[u.key]).reduce((s, u) => s + u.happy, 0);
    const crowd = herdN >= c ? 12 : herdN >= c - 1 ? 5 : 0;
    return U.clamp(58 + ups + (fed ? 12 : -22) - crowd - (winterDouble() ? 6 : 0), 5, 100);
  }
  function setWeight(a, b, fed) {
    if (a.stage === 'calf') a.weight = (150 + 300 * (a.prog / CALF_MS)) * b.wt;
    else if (a.stage === 'yearling') a.weight = (450 + 350 * (a.prog / YEARLING_MS)) * b.wt;
    else a.weight = Math.min(1300 * b.wt, Math.max(a.weight, 1000 * b.wt) + fed * 0.0005);
  }
  let lastRun = 0;
  function step(t, force) {
    const r = ensure(); if (!r) return;
    if (!force && t - lastRun < 1000) return;
    lastRun = t;
    if (!r.lastT || r.lastT > t) r.lastT = t;
    let dt = Math.min(t - r.lastT, MAX_DT);
    r.lastT = t;
    marketStep();
    if (dt <= 0 || !r.animals.length) return;
    const from = t - dt, n = r.animals.length, c = cap();
    const hasBull = r.animals.some(a => a.stage === 'bull');
    const births = [];
    r.animals.forEach(a => {
      const b = BREEDS[a.breed] || BREEDS.angus;
      const fed = U.clamp(Math.min(t, a.fedUntil) - from, 0, dt), hungry = dt - fed;
      a.health = U.clamp(a.health - hungry * 0.0001 * b.hardy + fed * 0.0002, 0, 100);
      const gm = b.growth * (0.92 + a.happy / 1250) * (a.health < 30 ? 0.8 : 1);
      a.prog += fed * gm;
      let guard = 0;
      while ((a.stage === 'calf' || a.stage === 'yearling') && a.prog >= stageNeed(a) && guard++ < 4) {
        a.prog -= stageNeed(a);
        if (a.stage === 'calf') a.stage = 'yearling';
        else { a.stage = a.sex === 'f' ? 'cow' : 'steer'; a.prog = 0; G.toast && G.toast('🐄 ' + a.name + ' grew into a ' + (a.sex === 'f' ? 'cow' : 'steer') + '!', 'good'); }
        G.bus.emit('ranch:grew', { animal: a });
      }
      setWeight(a, b, fed);
      const isFed = a.fedUntil > t;
      a.happy += (happyTarget(a, isFed, n, c) - a.happy) * Math.min(1, dt / 60000);
      a.happy = U.clamp(a.happy, 0, 100);
      if (a.stage === 'cow' && hasBull) a.breedProg = Math.min(BREED_MS, a.breedProg + fed);
      if (a.stage === 'cow' && a.breedProg >= BREED_MS) births.push(a);
    });
    births.forEach(mom => {
      if (r.animals.length >= cap()) return;           // pasture full: wait for room
      mom.breedProg = 0;
      const sire = r.animals.filter(a => a.stage === 'bull');
      const breed = Math.random() < 0.5 || !sire.length ? mom.breed : U.pick(sire).breed;
      const calf = mkAnimal(breed, 'calf');
      calf.fedUntil = t + 60000;
      r.animals.push(calf); r.born++;
      G.toast && G.toast('🐮 A new calf! Meet ' + calf.name + ' (' + BREEDS[calf.breed].name + ')', 'good');
      G.bus.emit('ranch:born', { animal: calf, mother: mom.id });
      G.bus.emit('change');
    });
  }

  function marketStep() {
    const r = ensure(); if (!r) return;
    let day = 0; try { day = G.calendar().day; } catch (e) { return; }
    if (!r.mkt.day) { r.mkt.day = day; return; }
    if (day === r.mkt.day) return;
    const steps = Math.min(6, Math.abs(day - r.mkt.day));
    for (let i = 0; i < steps; i++) {
      const delta = (Math.random() - 0.5) * 0.16 - 0.12 * (r.mkt.mult - 1);
      let pct = Math.round(delta * 100);
      pct = U.clamp(pct, -9, 9);
      r.mkt.mult = U.clamp(r.mkt.mult * (1 + pct / 100), 0.7, 1.4);
      r.mkt.pct = pct;
    }
    r.mkt.day = day;
    G.bus.emit('change');
  }
  const marketLine = () => {
    const p = R().mkt.pct;
    return p > 0 ? 'Cattle market is UP ' + p + '% today' : p < 0 ? 'Cattle market is DOWN ' + Math.abs(p) + '% today' : 'Cattle market is steady today';
  };
  const unitPrice = () => BASE_PRICE * R().mkt.mult;
  function auctionPrice(a) {
    const b = BREEDS[a.breed] || BREEDS.angus;
    const kind = a.stage === 'cow' ? 0.7 : a.stage === 'bull' ? 0.8 : 1;
    return Math.max(1, Math.round(a.weight * unitPrice() * b.price * kind * (0.75 + 0.25 * a.health / 100)));
  }

  // ---------- feeding ----------
  function feedPlan() {
    const m = winterDouble() ? 2 : 1;
    if (G.qty('cow_feed') >= m) return { key: 'cow_feed', qty: m };
    if (G.qty('alfalfa') >= 2 * m) return { key: 'alfalfa', qty: 2 * m };
    return { key: null, qty: m };
  }
  function feedOne(a, quiet) {
    const t = now();
    if (a.fedUntil - t > 60000) { if (!quiet) G.toast && G.toast(a.name + ' is full for now', 'info'); return false; }
    const p = feedPlan();
    if (!p.key) { if (!quiet) G.toast && G.toast('Need ' + (winterDouble() ? 'double ' : '') + 'cow feed (or 2 alfalfa per feeding)', 'bad'); return false; }
    if (!G.removeItems({ [p.key]: p.qty })) return false;
    a.fedUntil = Math.max(t, a.fedUntil) + FEED_MS;
    return true;
  }
  function feed(id) {
    const r = ensure(); if (!r) return false;
    step(now(), true);
    const a = r.animals.find(x => x.id === id); if (!a) return false;
    const ok = feedOne(a);
    if (ok) G.bus.emit('change');
    return ok;
  }
  function feedAll() {
    const r = ensure(); if (!r) return 0;
    step(now(), true);
    let n = 0;
    for (const a of r.animals) { if (a.fedUntil - now() > 60000) continue; if (!feedOne(a, true)) break; n++; }
    if (!n) G.toast && G.toast(r.animals.length ? (feedPlan().key ? 'Everyone is already fed' : 'Out of feed! Mill some cow feed or grow alfalfa') : 'No cattle yet', 'info');
    else G.toast && G.toast('Fed ' + n + ' head', 'good');
    G.bus.emit('change');
    return n;
  }

  // ---------- buying ----------
  function buyCalf(breed) {
    const r = ensure(), b = BREEDS[breed];
    if (!r || !b) return false;
    if (!unlocked()) { G.toast && G.toast('Ranching unlocks at level ' + UNLOCK_LEVEL, 'bad'); return false; }
    if (G.state.level < b.level) { G.toast && G.toast(b.name + ' calves unlock at level ' + b.level, 'bad'); return false; }
    if (r.animals.length >= cap()) { G.toast && G.toast('Pasture full (' + cap() + ' head). Upgrade or sell!', 'bad'); return false; }
    if (!G.spend(b.cost)) return false;
    const a = mkAnimal(breed, 'calf'); a.fedUntil = now() + 30000;
    r.animals.push(a);
    G.toast && G.toast('🐮 ' + a.name + ' the ' + b.name + ' calf joined the herd!', 'good');
    G.bus.emit('ranch:bought', { animal: a }); G.bus.emit('change');
    return a;
  }
  function buyBull() {
    const r = ensure(); if (!r) return false;
    if (G.state.level < BULL_LEVEL) { G.toast && G.toast('Bulls unlock at level ' + BULL_LEVEL, 'bad'); return false; }
    if (bullCount() >= MAX_BULLS) { G.toast && G.toast('One or two bulls is plenty', 'bad'); return false; }
    if (r.animals.length >= cap()) { G.toast && G.toast('Pasture full (' + cap() + ' head)', 'bad'); return false; }
    if (!G.spend(BULL_COST)) return false;
    const a = mkAnimal(U.pick(BREED_ORDER), 'bull'); a.fedUntil = now() + 30000;
    r.animals.push(a);
    G.toast && G.toast('🐂 ' + a.name + ' the bull arrived. Breeding can begin!', 'good');
    G.bus.emit('ranch:bought', { animal: a }); G.bus.emit('change');
    return a;
  }
  function buyUpgrade(key) {
    const r = ensure(); if (!r) return false;
    const i = UPGRADES.findIndex(u => u.key === key), u = UPGRADES[i];
    if (!u || r.up[key]) return false;
    if (G.state.level < u.level) { G.toast && G.toast(u.name + ' unlocks at level ' + u.level, 'bad'); return false; }
    if (i > 0 && !r.up[UPGRADES[i - 1].key]) { G.toast && G.toast('Build ' + UPGRADES[i - 1].name + ' first', 'bad'); return false; }
    if (!G.spend(u.cost)) return false;
    r.up[key] = true;
    G.toast && G.toast(u.emoji + ' ' + u.name + ' built! Pasture holds ' + cap() + ' head', 'good');
    G.bus.emit('ranch:upgrade', { key }); G.bus.emit('change');
    return true;
  }

  // ---------- selling ----------
  function remove(a) { const r = R(); const i = r.animals.indexOf(a); if (i >= 0) r.animals.splice(i, 1); }
  function sell(id) {
    const r = ensure(); if (!r) return 0;
    step(now(), true);
    const a = r.animals.find(x => x.id === id);
    if (!a || !isAdult(a)) { G.toast && G.toast('Not grown enough to sell yet', 'bad'); return 0; }
    const coins = auctionPrice(a);
    remove(a); r.sold++;
    G.addCoins(coins, 'ranch');
    G.addXP(a.stage === 'steer' ? 18 + Math.round(a.weight / 60) : 10);
    G.toast && G.toast('🔨 Sold ' + a.name + ' at auction for 🪙' + fmt(coins), 'good');
    G.bus.emit('ranch:sold', { animal: a, via: 'auction', coins }); G.bus.emit('change');
    return coins;
  }
  function butcher(id) {
    const r = ensure(); if (!r) return false;
    step(now(), true);
    const a = r.animals.find(x => x.id === id);
    if (!a || a.stage !== 'steer') { G.toast && G.toast('Only grown steers go to the butcher', 'bad'); return false; }
    const items = Object.values(BUTCHER_YIELD).reduce((x, y) => x + y, 0);
    if (G.barnFree() < items) { G.toast && G.toast('Barn needs ' + items + ' free slots for the beef', 'bad'); return false; }
    if (G.state.coins < BUTCHER_FEE) { G.toast && G.toast('Processing fee is 🪙' + BUTCHER_FEE, 'bad'); return false; }
    if (!G.spend(BUTCHER_FEE)) return false;
    remove(a); r.sold++;
    Object.keys(BUTCHER_YIELD).forEach(k => G.addItem(k, BUTCHER_YIELD[k]));
    G.addXP(35 + Math.round(a.weight / 40));
    G.toast && G.toast('🥩 ' + a.name + ' processed: 6 ground beef, 2 ribeye, 2 brisket, 1 leather', 'good');
    G.bus.emit('ranch:sold', { animal: a, via: 'butcher', coins: 0, items: BUTCHER_YIELD }); G.bus.emit('change');
    return true;
  }

  // ---------- public API ----------
  const EMOJI = { calf: '🐮', yearling: '🐮', steer: '🐂', cow: '🐄', bull: '🐂' };
  const SCALE = { calf: 0.6, yearling: 0.85, steer: 1.15, cow: 1.05, bull: 1.3 };
  G.Ranch = {
    ensure,
    unlocked,
    herd() {
      try {
        const r = ensure(), t = now(); if (!r) return [];
        return r.animals.map(a => ({
          id: a.id, stage: a.stage, emoji: EMOJI[a.stage] || '🐮', name: a.name, breed: a.breed,
          scale: Math.round(U.clamp(SCALE[a.stage] * (a.stage === 'steer' || a.stage === 'cow' ? 0.93 + a.weight / 9000 : 1), 0.6, 1.3) * 100) / 100,
          hungry: a.fedUntil <= t
        }));
      } catch (e) { return []; }
    },
    pastureCap: cap,
    breeds: BREEDS,
    upgrades: UPGRADES,
    buyCalf, buyBull, buyUpgrade, feed, feedAll, sell, butcher,
    price: auctionPrice,
    marketText: marketLine,
    marketMult: () => R().mkt.mult,
    step: t => step(t == null ? now() : t, true),
    animals: () => R().animals,
    add: (breed, stage, sex) => { const r = ensure(); const a = mkAnimal(breed, stage, sex); r.animals.push(a); return a; },
    consts: { CALF_MS, YEARLING_MS, FEED_MS, BREED_MS, BUTCHER_FEE, BULL_COST, BASE_PRICE }
  };

  // ---------- bus ----------
  G.bus.on('init', () => { try { ensure(); const r = R(); r.lastT = now(); lastRun = 0; marketStep(); } catch (e) { console.error('[ranch] init', e); } });
  G.bus.on('state:reset', () => { try { ensure(); lastRun = 0; } catch (e) { console.error('[ranch] reset', e); } });
  G.bus.on('tick', p => { try { step((p && p.now) || now(), false); } catch (e) { console.error('[ranch] tick', e); } });

  // ---------- events ----------
  const herdN = () => { try { return R().animals.length; } catch (e) { return 0; } };
  const evs = [
    {
      key: 'cattle_out', name: 'Cattle Got Out!', emoji: '🚧', kind: 'bad', minLevel: UNLOCK_LEVEL, weight: 1, durationSec: 0,
      desc: 'A gate was left open and the herd is wandering down the county road.',
      requires: () => herdN() > 0,
      text: () => 'Somebody left the gate open! Your cattle are strolling toward the neighbor\'s alfalfa and the highway.',
      choices: [
        {
          label: 'Hire the cattle dog crew', cost: c => Math.round(U.clamp(30 + herdN() * 12, 40, 220)),
          desc: 'The neighbor\'s border collies round everyone up in minutes.',
          apply: c => { c.G.addXP(4); return 'The dog crew had every head back inside before supper. Good dogs!'; }
        },
        {
          label: 'Round them up yourself', cost: 0,
          desc: 'Free, but a long afternoon on foot leaves the herd rattled (happiness drops).',
          apply: c => {
            const r = R(); r.animals.forEach(a => { a.happy = Math.max(0, a.happy - 25); a.health = Math.max(0, a.health - 3); });
            c.G.bus.emit('change');
            return 'You chased cattle through sagebrush until dark. Everyone is home, but they are quite stressed.';
          }
        }
      ]
    },
    {
      key: 'pinkeye', name: 'Pinkeye Outbreak', emoji: '👁️', kind: 'bad', seasons: ['spring', 'summer', 'fall'], minLevel: UNLOCK_LEVEL, weight: 0.8, durationSec: 0,
      desc: 'Flies are spreading pinkeye through the pasture.',
      requires: () => herdN() > 0,
      text: () => 'Pinkeye is spreading through the herd: weepy eyes and grumpy cattle. Time to call the vet.',
      choices: [
        {
          label: 'Call the vet', cost: c => Math.round(U.clamp(40 + herdN() * 15, 55, 260)),
          desc: 'Proper treatment. The whole herd is healed up.',
          apply: c => { R().animals.forEach(a => { a.health = Math.min(100, a.health + 15); }); c.G.addXP(6); c.G.bus.emit('change'); return 'The vet treated every head. Clear eyes and happy cattle.'; }
        },
        {
          label: 'Home remedy', cost: 15,
          desc: 'Eye patches and fly spray. Cheap, partly effective.',
          apply: c => { R().animals.forEach(a => { a.health = Math.max(0, a.health - 12); }); c.G.bus.emit('change'); return 'Your patches helped some. Health took a small hit.'; }
        },
        {
          label: 'Wait it out', cost: 0,
          desc: 'Save the money. The herd suffers.',
          apply: c => { R().animals.forEach(a => { a.health = Math.max(0, a.health - 30); a.happy = Math.max(0, a.happy - 10); }); c.G.bus.emit('change'); return 'Pinkeye ran its course. The herd lost a lot of condition.'; }
        }
      ]
    },
    {
      key: 'hay_prices', name: 'Hay Prices Soar', emoji: '📈', kind: 'good', minLevel: 3, weight: 0.9, durationSec: 150,
      desc: 'A dry summer upriver has hay and feed selling at a premium.',
      mods: { price: { products: ['alfalfa', 'cow_feed'], mult: 1.6, label: '🌿 Alfalfa & cow feed' } },
      text: () => 'Hay prices soar! Alfalfa and cow feed sell for far more. Feed note: if you feed cattle, stock up before the hay is gone.'
    },
    {
      key: 'county_fair', name: 'County Fair Grand Champion', emoji: '🏆', kind: 'good', seasons: ['summer', 'fall'], minLevel: UNLOCK_LEVEL, weight: 0.9, durationSec: 0,
      desc: 'Your steer wins the blue ribbon at the Kittitas County Fair.',
      requires: () => R().animals.some(a => a.stage === 'steer'),
      onStart(c) {
        const steers = R().animals.filter(a => a.stage === 'steer').sort((x, y) => y.weight - x.weight);
        const s = steers[0]; if (!s) return {};
        const prize = Math.round(120 + s.weight / 5 + (s.health / 100) * 40);
        s.happy = Math.min(100, s.happy + 15);
        c.G.addCoins(prize, 'ranch'); c.G.addXP(25);
        return { name: s.name, prize };
      },
      text: c => c.result && c.result.name ? c.result.name + ' took Grand Champion Steer at the county fair! The judges handed you 🪙' + c.result.prize + ' and a very large ribbon.' : 'The county fair judges came by, but you had no steer to show.'
    }
  ];
  evs.forEach(d => { try { if (G.Events && G.Events.register) G.Events.register(d); } catch (e) { console.error('[ranch] event', d.key, e); } });
  G.Ranch.eventKeys = evs.map(d => d.key);

  // ---------- panel ----------
  const CSS = `
.rn-head{background:linear-gradient(180deg,#fff8e7,#ffe9b3);border:3px solid #e0bd72;border-radius:18px;padding:10px 12px;box-shadow:0 4px 0 rgba(110,70,20,.25)}
.rn-head .r1{display:flex;align-items:center;justify-content:space-between;gap:8px}
.rn-head .cnt{font-size:20px;font-weight:900}.rn-head .cnt small{font-size:12px;color:var(--ink2)}
.rn-mkt{display:inline-flex;align-items:center;gap:5px;border-radius:12px;padding:4px 10px;font-size:12.5px;font-weight:900;background:#eee3c6;color:var(--ink2)}
.rn-mkt.up{background:#d9f2c6;color:#2f6d17}.rn-mkt.down{background:#ffd9d2;color:var(--red-d)}
.rn-head .r2{margin-top:6px;font-size:12px;color:var(--ink2);font-weight:800;line-height:1.35}
.rn-note{margin-top:6px;border-radius:12px;padding:6px 10px;font-size:12px;font-weight:800;background:#fff0c4;color:#7a4a06;border:2px dashed #e2b24f}
.rn-note.cold{background:#e3f1fb;color:#2c5f86;border-color:#9cc9e8}
.rn-bar{display:flex;gap:6px;margin:10px 0 2px}.rn-bar .btn{flex:1}
.rn-card{margin-top:10px;background:linear-gradient(180deg,#fffaf0,#fff0cc);border:3px solid #e0bd72;border-radius:18px;padding:10px;box-shadow:0 4px 0 rgba(110,70,20,.22)}
.rn-card.hungry{border-color:#e8a24a}.rn-card.ready{border-color:#6cbc43;box-shadow:0 4px 0 rgba(62,130,35,.35)}
.rn-top{display:flex;gap:10px;align-items:center}
.rn-em{flex:none;width:62px;height:62px;border-radius:18px;background:radial-gradient(circle at 50% 35%,#fffdf2,#f3dca0);display:grid;place-items:center;box-shadow:inset 0 -3px 0 rgba(110,70,20,.18);line-height:1}
.rn-em span{display:block;font-size:40px}
.rn-info{min-width:0;flex:1}
.rn-name{font-size:18px;font-weight:900;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rn-name i{font-style:normal;font-size:13px;color:var(--ink2);margin-left:3px}
.rn-meta{display:flex;flex-wrap:wrap;gap:4px 5px;margin-top:4px;align-items:center;font-size:11.5px;color:var(--ink2)}
.rn-chip{border-radius:9px;padding:2px 8px;font-size:11px;font-weight:900;background:#eadbb4;color:#6a4a20}
.rn-chip.st{background:#d6efc4;color:#2f6d17}.rn-chip.sire{background:#ffe0a8;color:#8a4a06}
.rn-row{display:flex;align-items:center;gap:7px;margin-top:7px;font-size:12px;font-weight:900;color:var(--ink2)}
.rn-row .lb{flex:none;min-width:78px;white-space:nowrap}.rn-row .tx{flex:1;min-width:0;font-size:11.5px;line-height:1.2}
.rn-row .tr{flex:1;height:11px;border-radius:7px;background:rgba(90,60,20,.2);overflow:hidden}
.rn-row .tr i{display:block;height:100%;border-radius:7px;background:linear-gradient(#9be86b,#56b02f);transition:width .4s}
.rn-row .tr.hp i{background:linear-gradient(#ff8f7f,#d9483b)}.rn-row .tr.hp.mid i{background:linear-gradient(#ffd45e,#f2a91c)}
.rn-row .tr.gr i{background:linear-gradient(#ffd45e,#f2a91c)}
.rn-row .v{flex:none;min-width:36px;text-align:right}
.rn-hun{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:9px}
.rn-hun .t{font-size:12.5px;font-weight:900;line-height:1.25}.rn-hun .t.bad{color:var(--red-d)}.rn-hun .t.ok{color:#2f6d17}
.rn-acts{display:flex;gap:6px;margin-top:9px}.rn-acts .btn{flex:1;padding:0 8px;font-size:13.5px}
.rn-buy{display:flex;align-items:center;gap:10px;margin-top:8px;background:#fff8e7;border:3px solid #e8d198;border-radius:16px;padding:8px 10px}
.rn-buy .em{font-size:30px;flex:none;width:40px;text-align:center}
.rn-buy .bd{flex:1;min-width:0}.rn-buy .nm{font-size:15px;font-weight:900}.rn-buy .ds{font-size:11.5px;color:var(--ink2);line-height:1.25;font-weight:800}
.rn-buy .btn{flex:none;min-width:84px;padding:0 10px;font-size:13.5px;flex-direction:column;gap:0;line-height:1.1}
.rn-buy .btn small{font-size:10px;opacity:.85;font-weight:800}
.rn-buy.owned{background:#e4f4d6;border-color:#9ccf7a}.rn-buy.locked{opacity:.75}
.rn-empty{margin-top:10px;text-align:center;padding:18px;border:3px dashed #d9b86b;border-radius:18px;font-size:13px;color:var(--ink2);background:rgba(255,248,231,.7)}
.rn-empty b{display:block;font-size:34px;margin-bottom:4px}
`;
  const barPct = (v, m) => Math.round(U.clamp(v / m, 0, 1) * 100);
  const fmtClock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); };
  const STAGE_LABEL = a => a.stage === 'yearling' && a.sex === 'f' ? 'Heifer' : a.stage === 'cow' ? 'Cow' : a.stage.charAt(0).toUpperCase() + a.stage.slice(1);
  const btn = (cls, act, label, data, off, why) => '<button class="btn sm ' + cls + (off ? ' off' : '') + '" data-act="pact" data-pa="' + act + '" ' + (data || '') + (off ? ' aria-disabled="true" data-why="' + esc(why || '') + '"' : '') + '>' + label + '</button>';

  function cardHtml(a, t) {
    const b = BREEDS[a.breed] || BREEDS.angus;
    const fedLeft = a.fedUntil - t, hungry = fedLeft <= 0;
    const ready = a.stage === 'steer';
    let grow = '';
    if (a.stage === 'calf') grow = '<div class="rn-row"><span class="lb">🌱 To yearling</span><span class="tr gr"><i style="width:' + barPct(a.prog, CALF_MS) + '%"></i></span><span class="v">' + barPct(a.prog, CALF_MS) + '%</span></div>';
    else if (a.stage === 'yearling') grow = '<div class="rn-row"><span class="lb">🌱 To ' + (a.sex === 'f' ? 'cow' : 'steer') + '</span><span class="tr gr"><i style="width:' + barPct(a.prog, YEARLING_MS) + '%"></i></span><span class="v">' + barPct(a.prog, YEARLING_MS) + '%</span></div>';
    else if (a.stage === 'cow') {
      const hasBull = bullCount() > 0;
      grow = hasBull ? '<div class="rn-row"><span class="lb">🍼 Next calf</span><span class="tr gr"><i style="width:' + barPct(a.breedProg, BREED_MS) + '%"></i></span><span class="v">' + barPct(a.breedProg, BREED_MS) + '%</span></div>'
        : '<div class="rn-row"><span class="lb">🍼 Calves</span><span class="tx">Needs a bull in the herd</span></div>';
    } else if (a.stage === 'bull') grow = '<div class="rn-row"><span class="lb">🍼 Herd sire</span><span class="tx">Cows will start calving</span></div>';
    else grow = '<div class="rn-row"><span class="lb">✅ Ready</span><span class="tx">Keep feeding to add weight</span></div>';
    const hp = Math.round(a.health);
    const hpRow = '<div class="rn-row"><span class="lb">❤️ Health</span><span class="tr hp' + (hp < 60 ? ' mid' : '') + '"><i style="width:' + hp + '%"></i></span><span class="v">' + hp + '</span></div>';
    const mood = a.happy >= 75 ? '😄' : a.happy >= 50 ? '🙂' : a.happy >= 30 ? '😐' : '😟';
    const plan = feedPlan();
    const feedLbl = '🌾 Feed ' + (plan.key === 'alfalfa' ? '🌿×' : plan.key ? '🪣×' : '') + (plan.key ? plan.qty * (plan.key === 'alfalfa' ? 1 : 1) : '');
    const full = fedLeft > 60000;
    const noFeed = !plan.key;
    const hunTxt = hungry ? '<span class="t bad">😩 Hungry' + (isAdult(a) ? '' : ': growth paused') + '</span>'
      : '<span class="t ok">😋 Fed · ' + fmtClock(fedLeft) + ' left</span>';
    let acts = '';
    if (ready) acts = btn('btn-gold', 'sell', '🔨 Sell 🪙' + fmt(auctionPrice(a)), 'data-id="' + a.id + '"') + btn('btn-red', 'butcher', '🥩 Butcher', 'data-id="' + a.id + '"');
    else if (a.stage === 'cow' || a.stage === 'bull') acts = btn('btn-gold', 'sell', '🔨 Sell 🪙' + fmt(auctionPrice(a)), 'data-id="' + a.id + '"');
    return '<div class="rn-card' + (hungry ? ' hungry' : '') + (ready ? ' ready' : '') + '">'
      + '<div class="rn-top"><div class="rn-em"><span>' + (EMOJI[a.stage] || '🐮') + '</span></div><div class="rn-info">'
      + '<div class="rn-name">' + esc(a.name) + '<i>' + (a.sex === 'f' ? '♀' : '♂') + ' ' + mood + '</i></div>'
      + '<div class="rn-meta"><span class="rn-chip">' + esc(b.name) + '</span><span class="rn-chip ' + (ready ? 'st' : a.stage === 'bull' ? 'sire' : '') + '">' + STAGE_LABEL(a) + '</span><span>' + fmt(a.weight) + ' lb</span></div>'
      + '</div></div>' + grow + hpRow
      + '<div class="rn-hun">' + hunTxt + btn(hungry ? 'btn-green' : 'btn-gray', 'feed', feedLbl, 'data-id="' + a.id + '"', full || noFeed, full ? a.name + ' is full' : 'Need cow feed or alfalfa') + '</div>'
      + (acts ? '<div class="rn-acts">' + acts + '</div>' : '') + '</div>';
  }

  function render() {
    const r = ensure(); if (!r) return '<div class="empty-note">Ranch unavailable</div>';
    if (!unlocked()) return '<div class="rn-empty"><b>🔒</b>The Ellensburg Livestock Auction opens when you reach <b style="display:inline;font-size:inherit">level ' + UNLOCK_LEVEL + '</b>.</div>';
    const t = now(), n = r.animals.length, c = cap();
    const p = r.mkt.pct, tcls = p > 0 ? 'up' : p < 0 ? 'down' : '';
    let notes = '';
    try { if (G.Events && G.Events.active && G.Events.active().some(e => e.key === 'hay_prices')) notes += '<div class="rn-note">🌿 Feed note: hay is pricey right now. Your spare alfalfa and cow feed sell high!</div>'; } catch (e) { /* ignore */ }
    if (winterDouble()) notes += '<div class="rn-note cold">❄️ Winter: cattle eat double feed. A hay shed fixes that.</div>';
    const hungryN = r.animals.filter(a => a.fedUntil <= t).length;
    let h = '<div class="rn-head"><div class="r1"><div class="cnt">🐂 Herd ' + n + '/' + c + ' <small>head</small></div>'
      + '<span class="rn-mkt ' + tcls + '">' + (p > 0 ? '▲' : p < 0 ? '▼' : '▬') + ' 🪙' + unitPrice().toFixed(2) + '/lb</span></div>'
      + '<div class="r2">' + esc(marketLine()) + '. Beef steers ~' + fmt(1150 * unitPrice()) + ' coins at auction.</div>' + notes + '</div>';
    h += '<div class="rn-bar">' + btn('btn-green', 'feedall', '🌾 Feed all' + (hungryN ? ' (' + hungryN + ' hungry)' : ''), '', !n, 'No cattle yet') + '</div>';
    if (!n) h += '<div class="rn-empty"><b>🐮</b>No cattle yet. Buy a calf below and keep it fed to grow it into a prize steer.</div>';
    r.animals.slice().sort((a, b) => (isAdult(b) - isAdult(a)) || (a.born || 0) - (b.born || 0)).forEach(a => { h += cardHtml(a, t); });
    // buy
    h += '<div class="sub">🔨 Ellensburg Livestock Auction</div>';
    const full = n >= c;
    BREED_ORDER.forEach(k => {
      const b = BREEDS[k], lock = G.state.level < b.level;
      const off = lock || full || G.state.coins < b.cost;
      h += '<div class="rn-buy' + (lock ? ' locked' : '') + '"><div class="em">🐮</div><div class="bd"><div class="nm">' + b.name + ' calf</div><div class="ds">' + b.tag + (lock ? ' · 🔒 Level ' + b.level : '') + '</div></div>'
        + btn('btn-gold', 'buy', '🪙 ' + b.cost, 'data-breed="' + k + '"', off, lock ? 'Unlocks at level ' + b.level : full ? 'Pasture is full' : 'Not enough coins') + '</div>';
    });
    const bl = G.state.level < BULL_LEVEL, bOff = bl || full || bullCount() >= MAX_BULLS || G.state.coins < BULL_COST;
    h += '<div class="rn-buy' + (bl ? ' locked' : '') + '"><div class="em">🐂</div><div class="bd"><div class="nm">Herd Bull</div><div class="ds">Lets grown cows have a calf every ~12 min' + (bl ? ' · 🔒 Level ' + BULL_LEVEL : ' · owned ' + bullCount() + '/' + MAX_BULLS) + '</div></div>'
      + btn('btn-gold', 'bull', '🪙 ' + BULL_COST, '', bOff, bl ? 'Unlocks at level ' + BULL_LEVEL : full ? 'Pasture is full' : bullCount() >= MAX_BULLS ? 'Already have ' + MAX_BULLS + ' bulls' : 'Not enough coins') + '</div>';
    // upgrades
    h += '<div class="sub">🛠️ Pasture Upgrades</div>';
    UPGRADES.forEach((u, i) => {
      const own = !!r.up[u.key], lock = G.state.level < u.level, prev = i > 0 && !r.up[UPGRADES[i - 1].key];
      const off = own || lock || prev || G.state.coins < u.cost;
      h += '<div class="rn-buy' + (own ? ' owned' : lock ? ' locked' : '') + '"><div class="em">' + u.emoji + '</div><div class="bd"><div class="nm">' + u.name + '</div><div class="ds">' + u.desc + (lock ? ' · 🔒 Level ' + u.level : '') + '</div></div>'
        + (own ? '<button class="btn sm btn-gray off" aria-disabled="true" data-why="Already built">✔ Built</button>'
          : btn('btn-green', 'upgrade', '🪙 ' + fmt(u.cost), 'data-key="' + u.key + '"', off, lock ? 'Unlocks at level ' + u.level : prev ? 'Build ' + UPGRADES[i - 1].name + ' first' : 'Not enough coins')) + '</div>';
    });
    h += '<div class="sub" style="text-align:center;text-transform:none;font-weight:800">Butcher: 🪙' + BUTCHER_FEE + ' fee → 6 ground beef, 2 ribeye, 2 brisket and 1 leather per steer.</div>';
    return h;
  }

  G.panels = G.panels || {};
  G.panels.ranch = {
    live: true,
    title() { return '🐂 Cattle Ranch'; },
    sub() { try { const r = ensure(); return unlocked() ? r.animals.length + '/' + cap() + ' head · ' + marketLine() : 'Unlocks at level ' + UNLOCK_LEVEL; } catch (e) { return ''; } },
    render() {
      try { G.injectCSS('ranch', CSS); step(now(), false); return render(); }
      catch (e) { console.error('[ranch] render', e); return '<div class="empty-note">The ranch is taking a nap.</div>'; }
    },
    onAction(action, el) {
      try {
        const id = el && el.dataset ? el.dataset.id : null;
        if (action === 'feed') feed(id);
        else if (action === 'feedall') feedAll();
        else if (action === 'sell') sell(id);
        else if (action === 'butcher') butcher(id);
        else if (action === 'buy') buyCalf(el.dataset.breed);
        else if (action === 'bull') buyBull();
        else if (action === 'upgrade') buyUpgrade(el.dataset.key);
      } catch (e) { console.error('[ranch] action', e); }
    }
  };
  try { G.injectCSS('ranch', CSS); } catch (e) { /* no DOM */ }
})();
