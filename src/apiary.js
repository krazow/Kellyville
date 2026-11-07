/* apiary.js — Kellyville apiary: a beekeeping yard beside the pond (G.Apiary, panel 'apiary').
   Real Eastern Washington beekeeping, simplified: seasons, forage from flowering crops, honey supers,
   pollination yield bonus, spring orchard contracts (Wenatchee / Yakima), Varroa mites, swarming and splits,
   winter dormancy with syrup feeding, upgrades (bear fence, honey house + candles, windbreak, more hives)
   and four events. Contract: docs/APIARY.md. State: G.state.apiary (lazy ensure()). */
(function () {
  'use strict';
  const G = window.G;
  const U = G.util;

  // ---------- tuning ----------
  const UNLOCK_LEVEL = 5, BUILD_COST = 600, START_HIVES = 2, BASE_MAX = 4, SLOTS = 8;
  const HIVE_COST = n => 120 + 30 * n;                 // n = hives already owned (3rd hive 210)
  const SUPER_COST = [80, 120, 170], MAX_SUPERS = 3;
  const FILL_SEC = { spring: 350, summer: 250, fall: 340 };   // seconds to fill an empty single-box hive at forage 1.0, strength 1
  const SUPER_TIME = 0.2;                              // each super: +20% fill time, +50% honey (net about +25% honey/min)
  const BASE_HONEY = 3, SUPER_HONEY = 1.5;
  const FORAGE_BASE = 0.8, FORAGE_CAP_ADD = 0.8, FORAGE_PER_PLOT = 0.1;
  const FORAGE = { canola: 1, apples: 1, cherries: 1, alfalfa: 0.7, pumpkins: 0.7, mint: 0.8, sweet_onions: 0.5 };
  const POLL = { apples: 1, cherries: 1, canola: 0.9, pumpkins: 0.8, alfalfa: 0.6, mint: 0.25, sweet_onions: 0.2, peas: 0.15, corn: 0.1, grapes: 0.1 };
  const POLL_CAP = 0.25;
  const TREAT_COST = 35, SYRUP_COST = 20, REQUEEN_COST = 45;
  const MITE_SICK = 0.8;
  const MITE_SEC = { spring: 1600, summer: 800, fall: 500 };
  const QUEEN_OLD_SEC = 2520;                          // one in-game year
  const SWARM_WARN_SEC = 75;
  const MAX_DT = 300;                                  // offline catch-up cap (seconds)
  const NAMES = ['Clover', 'Sagebrush', 'Lupine', 'Fireweed', 'Balsamroot', 'Yarrow', 'Bitterroot', 'Camas'];
  const CONTRACTS = [
    { id: 'wenatchee', name: 'Wenatchee apple orchard', emoji: '🍎', hives: 2, sec: 150, pay: 240, desc: 'Apple bloom needs bees fast. Two hives ride out on a flatbed.' },
    { id: 'yakima', name: 'Yakima cherry & mint growers', emoji: '🍒', hives: 3, sec: 240, pay: 420, desc: 'A bigger job in the valley: three hives for the whole bloom.' }
  ];
  const UPGRADES = {
    bearFence: { name: 'Electric bear fence', emoji: '⚡', cost: 350, desc: 'Blue Mountains bears bounce off the wire. Raids do no damage.' },
    windbreak: { name: 'Windbreak hedge', emoji: '🌲', cost: 300, desc: 'Smoke and wind hurt less, and winter stores last 30% longer.' },
    honeyHouse: { name: 'Honey house', emoji: '🏡', cost: 550, desc: 'Cleaner extraction: +10% honey, and you can craft beeswax candles.' },
    moreHives1: { name: 'Bigger yard', emoji: '🪵', cost: 450, desc: 'Room for 6 hives.' },
    moreHives2: { name: 'Yard expansion', emoji: '🏞️', cost: 900, desc: 'Room for 8 hives.', requires: ['moreHives1'] }
  };
  const UP_ORDER = ['bearFence', 'windbreak', 'honeyHouse', 'moreHives1', 'moreHives2'];
  const CANDLE = { wax: 3, out: 2, sec: 75 };

  // ---------- products ----------
  const P = G.DATA.products;
  if (!P.honeycomb) P.honeycomb = { name: 'Honeycomb', emoji: '🧇', sellPrice: 46, desc: 'A frame of capped comb, chewy and golden.' };
  if (!P.beeswax) P.beeswax = { name: 'Beeswax', emoji: '🟡', sellPrice: 26, desc: 'Cappings rendered into clean golden wax.' };
  if (!P.beeswax_candle) P.beeswax_candle = { name: 'Beeswax Candle', emoji: '🕯️', sellPrice: 78, desc: 'Hand-dipped, honey-scented, burns slow.' };

  // ---------- state ----------
  const ui = { tab: 'hives' };
  let acc = 0;
  function blank() {
    return { built: false, hives: Array.from({ length: SLOTS }, () => null), up: {}, last: 0, season: '', active: [], done: {}, smokeUntil: 0, flowUntil: 0, candle: null, nameN: 0,
      stats: { harvests: 0, honey: 0, comb: 0, wax: 0, earned: 0, contracts: 0, contractCoins: 0, swarms: 0, splits: 0 } };
  }
  function ensure() {
    const st = G.state; if (!st) return null;
    if (!st.apiary || typeof st.apiary !== 'object') st.apiary = blank();
    const s = st.apiary, b = blank();
    Object.keys(b).forEach(k => { if (s[k] == null) s[k] = b[k]; });
    if (!Array.isArray(s.hives)) s.hives = b.hives;
    while (s.hives.length < SLOTS) s.hives.push(null);
    if (!s.up || typeof s.up !== 'object') s.up = {};
    if (!Array.isArray(s.active)) s.active = [];
    if (!s.done) s.done = {}; if (!s.stats) s.stats = b.stats;
    Object.keys(b.stats).forEach(k => { if (typeof s.stats[k] !== 'number') s.stats[k] = 0; });
    return s;
  }
  const S = () => ensure();
  const calOf = () => { try { return G.calendar(); } catch (e) { return { season: 'spring', day: 1, dayProgress: 0.3 }; } };
  const seasonOf = () => calOf().season;
  const isBuilt = () => !!(S() && S().built);
  const maxHives = () => { const u = S().up; return u.moreHives2 ? 8 : u.moreHives1 ? 6 : BASE_MAX; };
  const owned = () => S().hives.filter(Boolean);
  const freeSlot = () => { const m = maxHives(), h = S().hives; for (let i = 0; i < m; i++) if (!h[i]) return i; return -1; };
  const emitStruct = () => { G.bus.emit('apiary:change'); G.bus.emit('change'); };
  const esc = s => (G.uikit && G.uikit.esc) ? G.uikit.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tmAttr = (type, a, b) => (G.uikit && G.uikit.tm) ? G.uikit.tm(type, a, b) : '';
  const coins = n => '🪙 ' + Math.round(n).toLocaleString('en-US');

  function newHive(strength, name) {
    const s = S();
    const used = s.hives.filter(Boolean).map(h => h.name);
    let nm = name; if (!nm) { nm = NAMES.find(n => !used.includes(n)) || ('Hive ' + (s.nameN + 1)); }
    s.nameN++;
    return { id: U.uid(), name: nm, status: 'active', strength, fill: 0, supers: 0, queen: 'young', qAge: 0, mites: 0.03, food: 0.75, sick: false, awayUntil: 0, swarmAt: 0 };
  }

  // ---------- derived numbers ----------
  function forage() {
    const s = S(); let sum = 0;
    (G.state.plots || []).forEach(p => { if (p && (p.status === 'growing' || p.status === 'ready') && FORAGE[p.crop]) sum += FORAGE[p.crop]; });
    const now = U.now();
    return FORAGE_BASE + Math.min(FORAGE_CAP_ADD, sum * FORAGE_PER_PLOT) + (s.flowUntil > now ? 0.5 : 0);
  }
  const smokeMult = () => (S().smokeUntil > U.now() ? (S().up.windbreak ? 0.7 : 0.45) : 1);
  const capOf = h => (h.queen === 'old' ? 0.8 : 1);
  function fillRate(h, season) { // fraction of a full hive per second
    const base = FILL_SEC[season || seasonOf()]; if (!base) return 0;
    const sickM = h.sick ? 0.4 : 1;
    return (1 / (base * (1 + SUPER_TIME * h.supers))) * forage() * (0.45 + 0.55 * h.strength) * smokeMult() * sickM;
  }
  function workingStrength() {
    if (seasonOf() === 'winter') return 0;
    return owned().reduce((a, h) => a + ((h.status === 'active' || h.status === 'ready') ? h.strength : h.status === 'sick' ? h.strength * 0.5 : 0), 0);
  }
  const pollFactor = () => Math.min(1, workingStrength() / 3);
  const pollinationBonus = key => (!isBuilt() || !POLL[key]) ? 0 : POLL_CAP * POLL[key] * pollFactor();
  const pollinationPct = () => Math.round(POLL_CAP * pollFactor() * 100);
  G.addModHook('yield', key => { try { return 1 + pollinationBonus(key); } catch (e) { return 1; } });

  function statusOf(h, now) {
    if (h.awayUntil > now) return 'away';
    if (seasonOf() === 'winter') return 'dormant';
    if (h.sick) return 'sick';
    return h.fill >= 1 ? 'ready' : 'active';
  }
  const structKey = h => (h.status === 'away' || h.status === 'dormant' || h.status === 'sick') ? h.status : 'on';

  // ---------- tick ----------
  function onTick() {
    const s = S(); if (!s) return;
    const now = U.now();
    if (!s.last) s.last = now;
    acc += Math.max(0, now - s.last); s.last = now;
    if (acc < 1000) return;
    const dt = Math.min(MAX_DT, acc / 1000); acc = 0;
    if (!s.built) return;
    step(s, now, dt);
  }
  function step(s, now, dt) {
    const season = seasonOf();
    let struct = false;
    if (s.season !== season) { // season change: winter prep / spring wake-up
      const first = !s.season;
      s.season = season;
      owned().forEach(h => { if (season === 'winter' && (!first || h.food == null)) h.food = s.up.windbreak ? 0.9 : 0.75; h.swarmAt = 0; });
      if (!first) G.toast(season === 'winter' ? '❄️ The bees are clustering for winter. Keep an eye on their syrup.' : season === 'spring' ? '🌱 Spring! The colonies are building up.' : season === 'summer' ? '☀️ Summer flow! Add supers and watch the mites.' : '🍂 Fall: a smaller flow. Treat for mites before winter.', 'info');
      struct = true;
    }
    // contracts returning
    s.active = s.active.filter(c => {
      if (now < c.until) return true;
      const hs = c.ids.map(id => owned().find(h => h.id === id)).filter(Boolean);
      hs.forEach(h => { h.awayUntil = 0; h.strength = Math.min(capOf(h), h.strength + 0.1); if (Math.random() < 0.35) h.mites = Math.min(1, h.mites + 0.2); });
      G.addCoins(c.pay, 'apiary'); s.stats.contracts++; s.stats.contractCoins += c.pay;
      G.toast('🚚 Your hives are home from the ' + c.name + '. They paid ' + c.pay + ' coins!', 'good');
      G.bus.emit('apiary:contract', { id: c.cid, pay: c.pay });
      struct = true; return false;
    });
    s.hives.forEach(h => {
      if (!h) return;
      const prev = structKey(h), wasReady = h.status === 'ready';
      if (h.awayUntil > now) { h.status = 'away'; return; }
      if (h.awayUntil) h.awayUntil = 0;
      if (season === 'winter') {
        const drain = (1 / 700) * (s.up.windbreak ? 0.7 : 1);
        h.food = Math.max(0, (h.food == null ? 0.75 : h.food) - drain * dt);
        if (h.food <= 0) h.strength = Math.max(0.1, h.strength - dt / 900);
      } else {
        h.qAge = (h.qAge || 0) + dt; if (h.qAge > QUEEN_OLD_SEC && h.queen !== 'old') { h.queen = 'old'; G.toast('👑 ' + h.name + '\'s queen is getting old. Requeen for a stronger hive.', 'info'); }
        h.mites = Math.min(1, h.mites + dt / (MITE_SEC[season] || 1000));
        if (!h.sick && h.mites >= MITE_SICK) { h.sick = true; G.toast('🦠 ' + h.name + ' is crawling with Varroa mites! Treat it.', 'bad'); }
        const cap = capOf(h);
        if (h.sick) h.strength = Math.max(0.1, h.strength - dt / 1500);
        else {
          const g = season === 'spring' ? 1 / 260 : season === 'summer' ? 1 / 500 : 0;
          if (h.strength < cap) h.strength = Math.min(cap, h.strength + g * dt * (h.mites > 0.45 ? 0.5 : 1));
          else if (h.strength > cap) h.strength = cap;
        }
        if (h.fill < 1) h.fill = Math.min(1, h.fill + fillRate(h, season) * dt);
        // swarming: crowded strong colonies in spring
        if (season === 'spring' && !h.swarmAt && !h.sick && h.strength >= 0.8 && Math.random() < (dt / 150) * (h.queen === 'old' ? 2 : 1)) {
          h.swarmAt = now + SWARM_WARN_SEC * 1000;
          G.toast('🐝 ' + h.name + ' is crowded and about to swarm! Split it or lose half the colony.', 'bad');
          G.bus.emit('apiary:swarm', { id: h.id });
        } else if (h.swarmAt && now >= h.swarmAt) {
          h.swarmAt = 0; h.strength = Math.max(0.15, h.strength * 0.5); h.fill *= 0.6; s.stats.swarms++;
          G.toast('💨 ' + h.name + ' swarmed and half the bees flew off to a tree.', 'bad');
        }
      }
      h.status = statusOf(h, now);
      if (structKey(h) !== prev) struct = true;
      if (h.status === 'ready' && !wasReady) G.bus.emit('apiary:ready', { id: h.id });
    });
    if (struct) emitStruct();
  }

  // ---------- actions ----------
  function build() {
    const s = S();
    if (s.built) return false;
    if ((G.state.level || 1) < UNLOCK_LEVEL) { G.toast('The apiary unlocks at level ' + UNLOCK_LEVEL, 'bad'); return false; }
    if (!G.spend(BUILD_COST)) return false;
    s.built = true; s.last = U.now(); acc = 0; s.season = ''; s.hives = Array.from({ length: SLOTS }, () => null);
    for (let i = 0; i < START_HIVES; i++) { const h = newHive(0.6); h.fill = 0.1 * i; s.hives[i] = h; }
    owned().forEach(h => { h.status = statusOf(h, U.now()); if (seasonOf() === 'winter') h.food = 0.75; });
    s.season = seasonOf();
    emitStruct();
    G.showModal({ emoji: '🐝', title: 'Your apiary is open!', text: 'Two hives of Italian bees moved in beside the pond. Harvest honey, add supers, and keep the mites down. Strong hives also boost your orchard and canola yields.', kind: 'good', confetti: true, buttons: [{ label: 'Bee-utiful!', cls: 'btn-gold' }] });
    return true;
  }
  function buyHive() {
    const s = S(); if (!s.built) return false;
    const i = freeSlot();
    if (i < 0) { G.toast(maxHives() < SLOTS ? 'Yard is full. Buy a bigger yard first.' : 'No more room in the yard.', 'bad'); return false; }
    const cost = HIVE_COST(owned().length);
    if (!G.spend(cost)) return false;
    const h = newHive(0.35); if (seasonOf() === 'winter') h.food = 0.75;
    h.status = statusOf(h, U.now()); s.hives[i] = h;
    emitStruct(); G.toast('🐝 A new colony of ' + h.name + ' bees moved in.', 'good');
    return true;
  }
  function hiveAt(i) { const h = S().hives[i]; return h && i < maxHives() ? h : null; }
  function harvest(i) {
    const s = S(), h = hiveAt(i);
    if (!s.built || !h || h.status !== 'ready') return 0;
    let honey = Math.round((BASE_HONEY + SUPER_HONEY * h.supers) * (0.55 + 0.45 * h.strength) * (s.up.honeyHouse ? 1.1 : 1) * U.rand(0.92, 1.12));
    honey = Math.max(1, honey);
    if (G.barnFree() < honey) { G.toast('Your barn is full. Make room for the honey!', 'bad'); return 0; }
    let comb = Math.random() < 0.35 + 0.08 * h.supers ? (h.supers >= 2 && Math.random() < 0.4 ? 2 : 1) : 0;
    let wax = Math.random() < 0.4 ? (s.up.honeyHouse && Math.random() < 0.5 ? 2 : 1) : 0;
    const room = G.barnFree() - honey; comb = Math.min(comb, Math.max(0, room)); wax = Math.min(wax, Math.max(0, room - comb));
    G.addItem('honey', honey); if (comb) G.addItem('honeycomb', comb); if (wax) G.addItem('beeswax', wax);
    G.addXP(5 + 2 * h.supers);
    h.fill = 0; h.status = statusOf(h, U.now());
    const st = s.stats; st.harvests++; st.honey += honey; st.comb += comb; st.wax += wax;
    st.earned += honey * (G.DATA.products.honey.sellPrice || 0) + comb * P.honeycomb.sellPrice + wax * P.beeswax.sellPrice;
    G.bus.emit('collected', { kind: 'apiary', key: 'honey', n: honey });
    G.bus.emit('apiary:harvest', { id: h.id, honey, comb, wax });
    G.toast('🍯 ' + h.name + ': +' + honey + ' honey' + (comb ? ', +' + comb + ' comb' : '') + (wax ? ', +' + wax + ' wax' : ''), 'good');
    G.bus.emit('change');
    return honey;
  }
  function harvestAll() {
    let n = 0;
    S().hives.forEach((h, i) => { if (h && i < maxHives() && h.status === 'ready' && harvest(i)) n++; });
    return n;
  }
  const readyCount = () => isBuilt() ? S().hives.filter((h, i) => h && i < maxHives() && h.status === 'ready').length : 0;
  const superCost = h => SUPER_COST[Math.min(h.supers, MAX_SUPERS - 1)];
  function addSuper(i) {
    const h = hiveAt(i); if (!h) return false;
    if (h.status === 'away') { G.toast('That hive is away at the orchard.', 'bad'); return false; }
    if (h.supers >= MAX_SUPERS) { G.toast('Already three supers high.', 'bad'); return false; }
    if (!G.spend(superCost(h))) return false;
    h.supers++; h.status = statusOf(h, U.now()); emitStruct(); return true;
  }
  function treat(i) {
    const h = hiveAt(i); if (!h || h.status === 'away') return false;
    if (h.mites < 0.2 && !h.sick) { G.toast(h.name + ' has few mites. No treatment needed.', 'info'); return false; }
    if (!G.spend(TREAT_COST)) return false;
    const wasSick = h.sick; h.mites = 0.05; h.sick = false; h.status = statusOf(h, U.now());
    if (wasSick) emitStruct(); else G.bus.emit('change');
    G.toast('🧪 Oxalic acid vaporized. ' + h.name + ' is mite-free.', 'good');
    return true;
  }
  function feed(i) {
    const h = hiveAt(i); if (!h) return false;
    if (h.status !== 'dormant') { G.toast('Syrup is for the winter cluster.', 'info'); return false; }
    if (h.food >= 0.95) { G.toast(h.name + ' has plenty of stores.', 'info'); return false; }
    if (!G.spend(SYRUP_COST)) return false;
    h.food = Math.min(1, h.food + 0.6); G.bus.emit('change'); return true;
  }
  function requeen(i) {
    const h = hiveAt(i); if (!h || h.status === 'away' || h.status === 'dormant') return false;
    if (h.queen !== 'old') { G.toast(h.name + ' already has a young queen.', 'info'); return false; }
    if (!G.spend(REQUEEN_COST)) return false;
    h.queen = 'young'; h.qAge = 0; G.bus.emit('change'); return true;
  }
  function canSplit(i) {
    const h = hiveAt(i); if (!h) return 'No such hive';
    const sn = seasonOf();
    if (sn === 'winter') return 'Bees are dormant in winter';
    if (h.status === 'away') return 'That hive is away';
    if (h.sick) return 'Treat the mites first';
    if (h.strength < 0.7 && !h.swarmAt) return 'Needs a stronger colony (70%)';
    if (freeSlot() < 0) return maxHives() < SLOTS ? 'No free slot. Buy a bigger yard' : 'No free slot in the yard';
    return '';
  }
  function split(i) {
    const why = canSplit(i); if (why) { G.toast(why, 'bad'); return false; }
    const s = S(), h = hiveAt(i), slot = freeSlot();
    const n = newHive(0.4); n.mites = Math.min(0.2, h.mites); n.food = h.food;
    h.strength = Math.max(0.3, h.strength * 0.65); h.swarmAt = 0; h.fill *= 0.5;
    n.status = statusOf(n, U.now()); h.status = statusOf(h, U.now()); s.hives[slot] = n; s.stats.splits++;
    emitStruct(); G.toast('✂️ Split! ' + n.name + ' got a fresh queen cell.', 'good');
    return true;
  }
  const eligibleForContract = () => owned().filter(h => (h.status === 'active' || h.status === 'ready') && h.strength >= 0.4);
  const yearKey = () => String(calOf().year || 1);
  function contractWhy(c) {
    const s = S();
    if (seasonOf() !== 'spring') return 'Orchards only rent hives in spring';
    if (s.done[yearKey() + ':' + c.id]) return 'Already done this spring';
    if (s.active.some(a => a.cid === c.id)) return 'Already out on this job';
    if (eligibleForContract().length < c.hives) return 'Needs ' + c.hives + ' healthy hives (40%+ strength)';
    if (owned().length - c.hives < 0) return 'Not enough hives';
    return '';
  }
  function sendContract(cid) {
    const c = CONTRACTS.find(x => x.id === cid); if (!c || !isBuilt()) return false;
    const why = contractWhy(c); if (why) { G.toast(why, 'bad'); return false; }
    const s = S(), now = U.now();
    const hs = eligibleForContract().sort((a, b) => b.strength - a.strength).slice(0, c.hives);
    hs.forEach(h => { h.awayUntil = now + c.sec * 1000; h.status = 'away'; h.swarmAt = 0; });
    s.active.push({ cid: c.id, name: c.name, ids: hs.map(h => h.id), start: now, until: now + c.sec * 1000, pay: c.pay });
    s.done[yearKey() + ':' + c.id] = 1;
    emitStruct(); G.toast('🚚 ' + c.hives + ' hives loaded for the ' + c.name + '.', 'good');
    return true;
  }
  function upgrade(key) {
    const u = UPGRADES[key], s = S(); if (!u || !s.built) return false;
    if (s.up[key]) return false;
    const miss = (u.requires || []).filter(r => !s.up[r]);
    if (miss.length) { G.toast('Buy the ' + miss.map(m => UPGRADES[m].name).join(' & ') + ' first', 'bad'); return false; }
    if (!G.spend(u.cost)) return false;
    s.up[key] = true; emitStruct(); G.toast(u.emoji + ' ' + u.name + ' built!', 'good'); return true;
  }
  function craftCandles() {
    const s = S(); if (!s.built || !s.up.honeyHouse) return false;
    if (s.candle) { G.toast('The candle pot is busy.', 'bad'); return false; }
    if (!G.hasItems({ beeswax: CANDLE.wax })) { G.toast('Need ' + CANDLE.wax + ' beeswax', 'bad'); return false; }
    G.removeItems({ beeswax: CANDLE.wax });
    const now = U.now(); s.candle = { startAt: now, readyAt: now + CANDLE.sec * 1000 };
    G.bus.emit('change'); return true;
  }
  function collectCandles() {
    const s = S(); if (!s.candle || U.now() < s.candle.readyAt) return 0;
    if (G.barnFree() < CANDLE.out) { G.toast('Barn is full.', 'bad'); return 0; }
    G.addItem('beeswax_candle', CANDLE.out); G.addXP(8); s.candle = null; G.bus.emit('change'); return CANDLE.out;
  }

  // ---------- public views ----------
  function snapshot(h, i) {
    if (!h || i >= maxHives()) return { id: 'slot' + i, name: '', status: 'empty', strength: 0, fill: 0, supers: 0 };
    return { id: h.id, name: h.name, status: h.status, strength: Math.round(h.strength * 1000) / 1000, fill: Math.round(h.fill * 1000) / 1000, supers: h.supers, queen: h.queen,
      mites: Math.round(h.mites * 100) / 100, food: Math.round((h.food == null ? 0 : h.food) * 100) / 100, swarm: !!h.swarmAt };
  }
  const hives = () => isBuilt() ? Array.from({ length: maxHives() }, (_, i) => snapshot(S().hives[i], i)) : [];

  // ---------- events (active only when built) ----------
  function reg() {
    if (!G.Events || !G.Events.register) return;
    const built = () => { try { return isBuilt() && owned().length > 0; } catch (e) { return false; } };
    const live = () => built() && seasonOf() !== 'winter';
    G.Events.register({
      key: 'apiary_bear', name: 'Black Bear Raids a Hive', emoji: '🐻', kind: 'bad', seasons: ['spring', 'summer', 'fall'], minLevel: UNLOCK_LEVEL, weight: 0.8, durationSec: 0, requires: live,
      desc: 'A hungry black bear wanders down from the Blue Mountains.',
      onStart() {
        const s = S(), cands = owned().filter(h => h.status === 'active' || h.status === 'ready');
        if (!cands.length) return { fenced: false, none: true };
        const h = U.pick(cands);
        if (s.up.bearFence) return { fenced: true, name: h.name };
        const lost = h.supers > 0; h.fill = 0; h.strength = Math.max(0.15, h.strength - 0.3);
        if (lost) h.supers--;
        h.status = statusOf(h, U.now()); emitStruct();
        return { fenced: false, name: h.name, lost };
      },
      text: c => c.result.none ? 'A black bear sniffed around the yard but found nothing worth raiding.'
        : c.result.fenced ? '🛡️ A black bear came down from the Blue Mountains and met your electric fence. It left offended and hungry, and ' + c.result.name + ' is untouched.'
          : 'A black bear from the Blue Mountains tore into ' + c.result.name + ', eating the honey and scattering the bees' + (c.result.lost ? ' and a super' : '') + '. An electric fence would stop this.'
    });
    G.Events.register({
      key: 'apiary_smoke', name: 'Smoke Grounds the Foragers', emoji: '😶‍🌫️', kind: 'bad', seasons: ['summer', 'fall'], minLevel: UNLOCK_LEVEL, weight: 0.9, durationSec: 150, requires: live,
      desc: 'Wildfire smoke drifts over the apiary and bees stay home.',
      onStart() { S().smokeUntil = U.now() + 150000; return {}; },
      text: () => 'Wildfire smoke from the Cascades hangs over the yard. The foragers stay in the hive, so honey fills ' + (S().up.windbreak ? 'about 30% slower (your windbreak helps)' : 'less than half as fast') + ' for a couple of minutes.'
    });
    G.Events.register({
      key: 'apiary_canola', name: 'Canola Bloom Nectar Flow', emoji: '🌼', kind: 'good', seasons: ['spring', 'summer'], minLevel: UNLOCK_LEVEL, weight: 1.2, durationSec: 120, requires: live,
      desc: 'The Palouse canola fields explode in yellow.',
      onStart() { S().flowUntil = U.now() + 120000; return {}; },
      text: () => 'Canola is blooming across the hills and the bees are working overtime. Forage is up for two minutes: honey fills much faster.'
    });
    G.Events.register({
      key: 'apiary_varroa', name: 'Varroa Mite Outbreak', emoji: '🦠', kind: 'bad', seasons: ['summer', 'fall'], minLevel: UNLOCK_LEVEL, weight: 0.9, durationSec: 0, requires: live,
      desc: 'Mites are exploding in the colonies.',
      onStart() { owned().forEach(h => { if (h.status !== 'away') h.mites = Math.min(1, Math.max(h.mites, 0.35)); }); return {}; },
      text: () => 'A neighbor\'s collapsing hives have sent a wave of Varroa mites into your yard. Treat now, or watch your colonies weaken.',
      choices: [
        { label: 'Treat every hive', cost: () => TREAT_COST * Math.max(1, owned().length), desc: 'Oxalic vaporizer on all colonies. Mites reset.',
          apply: () => { let n = 0; owned().forEach(h => { if (h.status !== 'away') { if (h.sick) { n++; } h.mites = 0.05; h.sick = false; h.status = statusOf(h, U.now()); } }); emitStruct(); return 'The vaporizer cleared every colony. Healthy bees, happy beekeeper.'; } },
        { label: 'Treat the worst hive', cost: () => TREAT_COST, desc: 'Only the most infested hive; the rest stay at risk.',
          apply: () => { const w = owned().filter(h => h.status !== 'away').sort((a, b) => b.mites - a.mites)[0]; if (w) { w.mites = 0.05; w.sick = false; w.status = statusOf(w, U.now()); } owned().forEach(h => { if (h !== w) h.mites = Math.min(1, h.mites + 0.15); }); emitStruct(); return 'You treated ' + (w ? w.name : 'the worst hive') + '. The others are still itchy.'; } },
        { label: 'Wait and watch', cost: 0, desc: 'Save coins. Mites surge and weaken the bees.',
          apply: () => { owned().forEach(h => { if (h.status !== 'away') { h.mites = Math.min(1, h.mites + 0.45); if (h.mites >= MITE_SICK) h.sick = true; h.status = statusOf(h, U.now()); } }); emitStruct(); return 'The mites boomed. Several hives are sick and need treatment.'; } }
      ]
    });
  }

  // ---------- panel ----------
  const TIPS = {
    spring: 'Buildup: colonies grow fast. Split crowded hives and rent bees to orchards.',
    summer: 'Main flow: add supers, harvest often and watch for mites.',
    fall: 'Smaller flow. Treat for mites and harvest before the cold.',
    winter: 'Dormant. Feed syrup when a cluster runs low on stores.'
  };
  const STATUS = { active: ['Foraging', 'on'], ready: ['Honey ready', 'rdy'], dormant: ['Dormant', 'dor'], away: ['At orchard', 'awy'], sick: ['Mites!', 'sck'] };
  const pct = v => Math.round(Math.max(0, Math.min(1, v)) * 100);
  const bar = (cls, v) => `<div class="ap-bar ${cls}"><i style="width:${pct(v)}%"></i></div>`;
  const btn = (act, label, cls, extra) => `<button class="btn ${cls || 'btn-gold'} sm" data-act="pact" data-pa="${act}" ${extra || ''}>${label}</button>`;
  const dis = why => `aria-disabled="true" data-why="${esc(why)}"`;
  const gate = (why) => why ? dis(why) : '';
  const miteWord = m => m < 0.25 ? 'low' : m < 0.5 ? 'rising' : m < 0.8 ? 'high' : 'infested';

  function css() {
    return `
.ap-wrap{display:flex;flex-direction:column;gap:10px;padding-bottom:8px}
.ap-head{background:linear-gradient(#fff0b8,#f7c95a);border:3px solid #a26a14;border-radius:20px;padding:11px;box-shadow:var(--card-sh)}
.ap-sign{display:flex;align-items:center;gap:8px;font-size:18px;font-weight:900;color:#4a2f14}
.ap-sign .e{font-size:30px}
.ap-pills{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.ap-pill{display:inline-flex;align-items:center;gap:3px;border-radius:12px;padding:3px 9px;font-size:12px;font-weight:900;color:#fff;white-space:nowrap}
.ap-pill.sea{background:#5fae3a}.ap-pill.poll{background:#d98c0c}.ap-pill.for{background:#3b8fd0}.ap-pill.bad{background:#d9483b}.ap-pill.good{background:#8e44ad}
.ap-tip{margin-top:8px;font-size:12px;font-weight:800;color:#6b4a1c;line-height:1.35}
.ap-tabs{display:flex;gap:4px;background:#e9d6aa;border-radius:16px;padding:4px}
.ap-tab{flex:1;min-width:0;min-height:44px;border-radius:12px;border:0;background:transparent;font-family:inherit;font-weight:900;font-size:11px;color:var(--ink2);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.15;position:relative}
.ap-tab .e{font-size:18px}.ap-tab.sel{background:#fffaf0;color:var(--ink);box-shadow:0 2px 0 #b58a42}
.ap-tab i{position:absolute;top:1px;right:4px;background:var(--red);color:#fff;font-style:normal;font-size:10px;min-width:16px;height:16px;border-radius:8px;display:grid;place-items:center;padding:0 3px}
.ap-card{background:#fffaf0;border:3px solid #e2c98d;border-radius:18px;padding:10px;display:flex;flex-direction:column;gap:7px}
.ap-card.rdy{border-color:#f2b631;background:#fff6d4;box-shadow:0 0 0 2px rgba(242,182,49,.35)}
.ap-card.sck{border-color:#e08a7c;background:#fff0ec}.ap-card.dor{background:#eef5fb;border-color:#b9d3ea}.ap-card.awy{background:#f3ecfa;border-color:#cdb8e6}
.ap-card.slot{border-style:dashed;background:rgba(255,246,220,.7);align-items:stretch}
.ap-row{display:flex;align-items:center;gap:9px}.ap-row .e{font-size:30px;flex:none}.ap-row .t{flex:1;min-width:0}
.ap-row b{display:block;font-size:15px;color:var(--ink);line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ap-row small{display:block;font-size:11px;font-weight:700;color:var(--ink2);line-height:1.3}
.ap-st{border-radius:10px;padding:2px 9px;font-size:11px;font-weight:900;color:#fff;white-space:nowrap}
.ap-st.on{background:#5fae3a}.ap-st.rdy{background:#e39b12}.ap-st.dor{background:#5b8fc0}.ap-st.awy{background:#8e5bc0}.ap-st.sck{background:#d9483b}
.ap-meter{display:grid;grid-template-columns:84px 1fr 46px;align-items:center;gap:6px;font-size:11px;font-weight:900;color:var(--ink2)}
.ap-meter span:first-child{white-space:nowrap}.ap-row small.ap-sm{display:flex;align-items:center;gap:6px;flex-wrap:nowrap;white-space:nowrap}
.ap-meter span:last-child{text-align:right;color:var(--ink)}
.ap-bar{height:10px;border-radius:6px;background:rgba(90,60,20,.18);overflow:hidden}.ap-bar i{display:block;height:100%;border-radius:6px}
.ap-bar.str i{background:linear-gradient(#8be05a,#4fa52f)}.ap-bar.hon i{background:linear-gradient(#ffd45e,#f2a91c)}.ap-bar.mit i{background:linear-gradient(#f2705f,#d2402f)}.ap-bar.stk i{background:linear-gradient(#8cc8f4,#3b8fd0)}
.ap-supers{display:flex;gap:3px;align-items:center}.ap-supers u{display:inline-block;width:18px;height:11px;border-radius:3px;background:#e8d9b0;border:2px solid #c7ab6c;text-decoration:none}.ap-supers u.on{background:#f6c94a;border-color:#b98712}
.ap-acts{display:flex;flex-wrap:wrap;gap:6px}.ap-acts .btn{flex:1 1 calc(50% - 6px);min-width:0;padding:0 6px;font-size:13px}
.ap-warn{background:#ffe3dc;border:2px solid #f0a090;border-radius:12px;padding:5px 9px;font-size:12px;font-weight:900;color:#a42d23}
.ap-note{font-size:12px;font-weight:700;color:var(--ink2);line-height:1.4}
.ap-build{text-align:center;background:linear-gradient(#fff3c9,#f7d27a);border:3px solid #a26a14;border-radius:20px;padding:16px;box-shadow:var(--card-sh);display:flex;flex-direction:column;gap:10px}
.ap-build .big{font-size:56px}.ap-build h3{margin:0;font-size:20px}.ap-build p{margin:0;font-size:13px;color:var(--ink2);font-weight:700;line-height:1.4}
.ap-steps{display:flex;gap:6px}.ap-steps div{flex:1;background:#fffaf0;border:2px solid #ecd49a;border-radius:12px;padding:6px 3px;font-size:11px;font-weight:800;color:var(--ink)}.ap-steps .e{display:block;font-size:24px}
.ap-ledger{display:grid;grid-template-columns:1fr 1fr;gap:6px}.ap-ledger div{background:#fffaf0;border:2px solid #ecd49a;border-radius:12px;padding:5px 8px;font-size:11px;font-weight:800;color:var(--ink2)}.ap-ledger b{display:block;font-size:15px;color:var(--ink)}
.ap-price{font-size:14px;font-weight:900;color:var(--ink);white-space:nowrap}
`;
  }
  if (typeof document !== 'undefined') G.injectCSS('apiary', css());

  function renderBuild() {
    const lvl = G.state.level || 1, lock = lvl < UNLOCK_LEVEL;
    const intro = `<div class="ap-steps"><div><span class="e">🍯</span>Sell honey, comb &amp; wax</div><div><span class="e">🍎</span>Pollinate crops +25%</div><div><span class="e">🚚</span>Rent hives to orchards</div></div>`;
    if (lock) return `<div class="ap-build"><div class="big">🐝</div><h3>Apiary</h3>${intro}<p>A yard of Langstroth hives beside the pond. Unlocks at level ${UNLOCK_LEVEL}.</p><div><span class="lockpill">🔒 Level ${UNLOCK_LEVEL}</span></div></div>`;
    const poor = G.state.coins < BUILD_COST;
    return `<div class="ap-build"><div class="big">🐝</div><h3>Build an apiary</h3>${intro}
<p>Start with two hives of Italian bees. Strong colonies pay for the yard in about 15 to 20 minutes, boost apple, cherry and canola harvests, and can be rented to Wenatchee and Yakima orchards every spring. Watch for mites, swarms and bears.</p>
${btn('build', `Build the apiary ${coins(BUILD_COST)}`, 'btn-green', poor ? dis('You need ' + BUILD_COST + ' coins') : '')}</div>`;
  }

  function renderHead(s) {
    const sn = seasonOf(), si = (G.SEASON_INFO && G.SEASON_INFO[sn]) || { name: sn, emoji: '' }, now = U.now();
    const pills = [`<span class="ap-pill sea">${si.emoji} ${si.name}</span>`, `<span class="ap-pill">🐝 ${owned().length}/${maxHives()} hives</span>`.replace('class="ap-pill"', 'class="ap-pill sea" style="background:#7a5a38"')];
    pills.push(`<span class="ap-pill poll">🍎 Pollination +${pollinationPct()}%</span>`);
    if (sn !== 'winter') pills.push(`<span class="ap-pill for">🌼 Forage ${forage().toFixed(1)}x</span>`);
    if (s.smokeUntil > now) pills.push(`<span class="ap-pill bad">😶‍🌫️ Smoke</span>`);
    if (s.flowUntil > now) pills.push(`<span class="ap-pill good">🌼 Nectar flow</span>`);
    return `<div class="ap-head"><div class="ap-sign"><span class="e">🐝</span>Pond-side apiary</div><div class="ap-pills">${pills.join('')}</div><div class="ap-tip">${TIPS[sn]}</div></div>`;
  }

  function renderTabs(s) {
    const rc = readyCount();
    const tabs = [['hives', '🐝', 'Hives'], ['orch', '🚚', 'Orchards'], ['up', '🏡', 'Yard']];
    return `<div class="ap-tabs">${tabs.map(([k, e, n]) => `<button class="ap-tab ${ui.tab === k ? 'sel' : ''}" data-act="pact" data-pa="tab" data-k="${k}"><span class="e">${e}</span>${n}${k === 'hives' && rc ? `<i>${rc}</i>` : ''}</button>`).join('')}</div>`;
  }

  function meter(label, cls, v, txt) { return `<div class="ap-meter"><span>${label}</span>${bar(cls, v)}<span>${txt == null ? pct(v) + '%' : txt}</span></div>`; }

  function renderHive(h, i) {
    const [stTxt, stCls] = STATUS[h.status] || ['', 'on'], now = U.now();
    const supers = `<span class="ap-supers" aria-label="${h.supers} supers">${[0, 1, 2].map(k => `<u class="${k < h.supers ? 'on' : ''}"></u>`).join('')}</span>`;
    const rate = fillRate(h), eta = rate > 0 ? (1 - h.fill) / rate : 0;
    let m = meter('💪 Strength', 'str', h.strength);
    if (h.status === 'dormant') m += meter('🧁 Stores', 'stk', h.food, h.food <= 0.05 ? 'Empty' : null);
    else if (h.status !== 'away') m += meter('🍯 Honey', 'hon', h.fill, h.status === 'ready' ? 'Full' : (eta > 0 ? U.fmtTime(eta) : pct(h.fill) + '%'));
    if (h.status !== 'dormant' && h.status !== 'away' && (h.mites >= 0.2 || h.sick)) m += meter('🦠 Mites', 'mit', h.mites, miteWord(h.mites));
    let warn = '';
    if (h.swarmAt) warn = `<div class="ap-warn">🐝 Swarming in <span ${tmAttr('txt', now, h.swarmAt)}>${U.fmtTime((h.swarmAt - now) / 1000)}</span>. Split the hive!</div>`;
    if (h.status === 'dormant' && h.food <= 0.05) warn = `<div class="ap-warn">🥶 Out of stores. The cluster is weakening. Feed syrup!</div>`;
    if (h.status === 'away') {
      const c = S().active.find(a => a.ids.includes(h.id));
      if (c) warn = `<div class="ap-note">🚚 Pollinating at the ${esc(c.name)}. Back in <span ${tmAttr('txt', now, c.until)}>${U.fmtTime((c.until - now) / 1000)}</span></div><div class="ap-bar stk"><i ${tmAttr('bar', c.start, c.until)}></i></div>`;
    }
    const acts = [];
    if (h.status === 'ready') acts.push(btn('harvest', '🍯 Harvest', 'btn-green', `data-i="${i}"`));
    if (h.status !== 'away') {
      acts.push(h.supers >= MAX_SUPERS ? btn('super', '📦 Supers maxed', 'btn-gray', `data-i="${i}" ${dis('Three supers is the limit')}`)
        : btn('super', `📦 Add super ${coins(superCost(h))}`, 'btn-gold', `data-i="${i}" ${G.state.coins < superCost(h) ? dis('You need ' + superCost(h) + ' coins') : ''}`));
    }
    if (h.status === 'sick' || (h.mites >= 0.2 && h.status !== 'dormant' && h.status !== 'away') || (h.status === 'dormant' && h.mites >= 0.2))
      acts.push(btn('treat', `🧪 Treat mites ${coins(TREAT_COST)}`, h.sick ? 'btn-red' : 'btn-gold', `data-i="${i}" ${G.state.coins < TREAT_COST ? dis('You need ' + TREAT_COST + ' coins') : ''}`));
    if (h.status === 'dormant') acts.push(btn('feed', `🧁 Feed syrup ${coins(SYRUP_COST)}`, h.food < 0.4 ? 'btn-green' : 'btn-gold', `data-i="${i}" ${h.food >= 0.95 ? dis('Plenty of stores already') : G.state.coins < SYRUP_COST ? dis('You need ' + SYRUP_COST + ' coins') : ''}`));
    if (seasonOf() !== 'winter' && h.status !== 'away') {
      const why = canSplit(i);
      if (h.swarmAt || (seasonOf() === 'spring' && h.strength >= 0.7) || !why) acts.push(btn('split', '✂️ Split hive', h.swarmAt ? 'btn-red' : 'btn-gray', `data-i="${i}" ${gate(why)}`));
    }
    if (h.queen === 'old' && h.status !== 'away' && h.status !== 'dormant') acts.push(btn('requeen', `👑 Requeen ${coins(REQUEEN_COST)}`, 'btn-gold', `data-i="${i}" ${G.state.coins < REQUEEN_COST ? dis('You need ' + REQUEEN_COST + ' coins') : ''}`));
    return `<div class="ap-card ${stCls}"><div class="ap-row"><span class="e">🐝</span><div class="t"><b>${esc(h.name)}</b><small class="ap-sm">${h.queen === 'old' ? '👑 Old queen' : '👑 Young queen'} · Supers ${supers}</small></div><span class="ap-st ${stCls}">${stTxt}</span></div>${m}${warn}${acts.length ? `<div class="ap-acts">${acts.join('')}</div>` : ''}</div>`;
  }

  function renderHives(s) {
    const hs = hives(); let html = '';
    const rc = readyCount();
    if (rc > 1) html += btn('harvestall', `🍯 Harvest all ready (${rc})`, 'btn-green');
    hs.forEach((h, i) => { if (h.status !== 'empty') html += renderHive(S().hives[i], i); });
    const free = freeSlot();
    const cost = HIVE_COST(owned().length);
    if (free >= 0) html += `<div class="ap-card slot"><div class="ap-row"><span class="e">📦</span><div class="t"><b>Empty hive stand</b><small>A package of bees starts weak (35%) and builds up.</small></div></div>${btn('buyhive', `Buy a hive ${coins(cost)}`, 'btn-green', G.state.coins < cost ? dis('You need ' + cost + ' coins') : '')}</div>`;
    else html += `<div class="ap-note" style="text-align:center">${maxHives() < SLOTS ? 'The yard is full. A bigger yard (Yard tab) makes room for more hives.' : 'All eight stands are in use.'}</div>`;
    return html;
  }

  function renderOrch(s) {
    const sn = seasonOf(), now = U.now();
    let html = `<div class="ap-note" style="padding:0 2px">Every spring, Wenatchee and Yakima orchards rent hives for the bloom. Your hives ride out on a truck and come home stronger, with coins.${sn !== 'spring' ? ' <b>Offers open in spring.</b>' : ''}</div>`;
    s.active.forEach(a => {
      html += `<div class="ap-card awy"><div class="ap-row"><span class="e">🚚</span><div class="t"><b>${esc(a.name)}</b><small>${a.ids.length} hives away · pays ${coins(a.pay)}</small></div><span class="ap-st awy" ${tmAttr('txt', now, a.until)}>${U.fmtTime((a.until - now) / 1000)}</span></div><div class="ap-bar stk"><i ${tmAttr('bar', a.start, a.until)}></i></div></div>`;
    });
    CONTRACTS.forEach(c => {
      const why = contractWhy(c);
      html += `<div class="ap-card"><div class="ap-row"><span class="e">${c.emoji}</span><div class="t"><b>${esc(c.name)}</b><small>${esc(c.desc)}<br>${c.hives} hives · ${U.fmtTime(c.sec)} away</small></div><div class="ap-price">${coins(c.pay)}</div></div>${btn('contract', '🚚 Send hives', 'btn-gold', `data-c="${c.id}" ${gate(why)}`)}</div>`;
    });
    return html;
  }

  function renderUp(s) {
    const st = s.stats;
    let html = `<div class="ap-ledger"><div>Harvests<b>${st.harvests}</b></div><div>Honey<b>🍯 ${st.honey}</b></div><div>Comb &amp; wax<b>${st.comb} / ${st.wax}</b></div><div>Orchard pay<b>${coins(st.contractCoins)}</b></div></div>`;
    html += UP_ORDER.map(k => {
      const u = UPGRADES[k], own = s.up[k], miss = (u.requires || []).filter(r => !s.up[r]), poor = G.state.coins < u.cost;
      const b = own ? `<span class="lockpill" style="background:#cfe8b8;color:#2f6a1c;min-width:80px">Owned</span>` : btn('upgrade', coins(u.cost), 'btn-gold', `data-k="${k}" ${miss.length ? dis('Buy the ' + miss.map(m => UPGRADES[m].name).join(' & ') + ' first') : poor ? dis('You need ' + u.cost + ' coins') : ''}`);
      return `<div class="ap-card" style="${own ? 'background:#eaf8d9;border-color:#a6d68a' : ''}"><div class="ap-row"><span class="e">${u.emoji}</span><div class="t"><b>${esc(u.name)}</b><small>${esc(u.desc)}</small></div>${b}</div></div>`;
    }).join('');
    if (s.up.honeyHouse) {
      const now = U.now(), c = s.candle, wax = G.qty('beeswax');
      let body;
      if (c && now >= c.readyAt) body = btn('collect', `🕯️ Collect ${CANDLE.out} candles`, 'btn-green');
      else if (c) body = `<div class="ap-bar hon"><i ${tmAttr('bar', c.startAt, c.readyAt)}></i></div><small class="ap-note">Dipping candles... <span ${tmAttr('txt', c.startAt, c.readyAt)}>${U.fmtTime((c.readyAt - now) / 1000)}</span></small>`;
      else body = btn('craft', `🕯️ Dip ${CANDLE.out} candles (${CANDLE.wax} 🟡)`, 'btn-gold', wax < CANDLE.wax ? dis('Need ' + CANDLE.wax + ' beeswax (you have ' + wax + ')') : '');
      html += `<div class="ap-card"><div class="ap-row"><span class="e">🕯️</span><div class="t"><b>Candle workshop</b><small>${CANDLE.wax} beeswax makes ${CANDLE.out} candles worth ${P.beeswax_candle.sellPrice} each. You have ${wax} beeswax.</small></div></div>${body}</div>`;
    }
    return html;
  }

  function onAction(a, el) {
    try {
      const i = +el.dataset.i;
      switch (a) {
        case 'build': build(); break;
        case 'tab': ui.tab = el.dataset.k; break;
        case 'harvest': harvest(i); break;
        case 'harvestall': harvestAll(); break;
        case 'super': addSuper(i); break;
        case 'treat': treat(i); break;
        case 'feed': feed(i); break;
        case 'split': split(i); break;
        case 'requeen': requeen(i); break;
        case 'buyhive': buyHive(); break;
        case 'contract': sendContract(el.dataset.c); break;
        case 'upgrade': upgrade(el.dataset.k); break;
        case 'craft': craftCandles(); break;
        case 'collect': collectCandles(); break;
      }
    } catch (e) { console.error('[apiary] action', e); }
  }

  G.panels.apiary = {
    live: true,
    title() { return 'Apiary'; },
    sub() { return isBuilt() ? 'Pond-side hives' : ''; },
    render() {
      try {
        const s = ensure();
        if (!s.built) return renderBuild();
        const body = ui.tab === 'orch' ? renderOrch(s) : ui.tab === 'up' ? renderUp(s) : renderHives(s);
        return `<div class="ap-wrap">${renderHead(s)}${renderTabs(s)}${body}</div>`;
      } catch (e) { console.error('[apiary] render', e); return '<div class="empty-note">Apiary unavailable.</div>'; }
    },
    onAction
  };

  // ---------- public API ----------
  G.Apiary = {
    isBuilt, build, hives, maxHives, buyHive, harvest, harvestAll, readyCount,
    upgrades: () => { const o = {}; if (!isBuilt()) return o; Object.keys(S().up).forEach(k => { if (S().up[k]) o[k] = true; }); return o; },
    // extras
    ensure, forage, pollinationBonus, pollinationPct, addSuper, treat, feed, requeen, split, canSplit, sendContract, contracts: () => CONTRACTS.map(c => Object.assign({ why: contractWhy(c) }, c)),
    upgrade, upgradeDefs: UPGRADES, craftCandles, collectCandles, fillRate: i => { const h = hiveAt(i); return h ? fillRate(h) : 0; },
    stats: () => Object.assign({}, S().stats), active: () => S().active.slice(),
    buildCost: BUILD_COST, unlockLevel: UNLOCK_LEVEL, hiveCost: () => HIVE_COST(owned().length), superCost: i => { const h = hiveAt(i); return h ? superCost(h) : 0; }
  };

  // ---------- wiring ----------
  const safe = (n, f) => G.bus.on(n, p => { try { f(p); } catch (e) { console.error('[apiary]', n, e); } });
  safe('init', () => { ensure(); acc = 0; ui.tab = 'hives'; });
  safe('state:reset', () => { acc = 0; ui.tab = 'hives'; ensure(); });
  safe('tick', onTick);
  reg();
})();
