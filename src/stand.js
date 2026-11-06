/* stand.js — Kellyville roadside farm stand with customers (G.Stand, panel 'stand'). */
(function () {
  'use strict';
  const G = window.G;
  const U = G.util;

  const UNLOCK_LEVEL = 3, BUILD_COST = 150, CAP = 4, SLOT_CAP = 99, OFFLINE_MAX_SALES = 30;
  const SLOT_STEPS = [4, 6, 8, 10];
  const TIERS = [
    { key: 'bargain', name: 'Bargain', emoji: '🏷️', mult: 0.9, buy: 1.12 },
    { key: 'fair', name: 'Fair', emoji: '⚖️', mult: 1.2, buy: 0.92 },
    { key: 'premium', name: 'Premium', emoji: '💎', mult: 1.6, buy: 0.55 }
  ];
  const BOOST_RE = /festival|rodeo|blossom|tourist|crush/;
  const SEASON_TRAFFIC = { summer: 1.3, fall: 1.1, spring: 1.0, winter: 0.6 };

  const UPGRADES = {
    sign: { name: 'Hand-painted sign', emoji: '🪧', cost: 250, level: 3, desc: 'Drivers spot you from the highway. +25% traffic.' },
    awning: { name: 'Shade awning', emoji: '⛱️', cost: 400, level: 4, desc: 'Cool shade keeps shoppers browsing. +10% traffic, +8% buy chance.' },
    cooler: { name: 'Cooler', emoji: '🧊', cost: 600, level: 5, desc: 'Dairy, meat and fresh produce sell for +20% more.' },
    honor: { name: 'Honor box', emoji: '📦', cost: 500, level: 5, desc: 'A coin box on the table. Sales continue at night at a reduced rate.' },
    shop: { name: 'Kellyville Farm Shop', emoji: '🏪', cost: 5000, level: 10, requires: ['sign', 'awning'], desc: 'Convert the barn into a real farm shop. Big traffic boost (+80%).' }
  };
  const SHELF_UP = [{ cost: 300, level: 4 }, { cost: 700, level: 6 }, { cost: 1500, level: 8 }];

  // ---------- item categories ----------
  const CAT = {
    eggs: 'dairy', milk: 'dairy', butter: 'dairy', cheese: 'dairy',
    ground_beef: 'meat', ribeye: 'meat', brisket: 'meat',
    bread: 'baked', apple_pie: 'baked', cherry_pie: 'baked', pumpkin_pie: 'baked', honey_cake: 'baked',
    wine: 'drink', ipa: 'drink', hefeweizen: 'drink', apple_cider: 'drink', grape_juice: 'drink', mint_tea: 'drink',
    honey: 'sweet', wool: 'craft', wool_sweater: 'craft', wool_scarf: 'craft', leather: 'craft', rose: 'flower',
    chicken_feed: 'feed', cow_feed: 'feed', sheep_feed: 'feed',
    flour: 'pantry', french_fries: 'pantry', onion_rings: 'pantry', hummus: 'pantry', lentil_soup: 'pantry', mint_oil: 'pantry'
  };
  const COOLER_CATS = { dairy: 1, meat: 1, produce: 1 };
  function cat(key) {
    if (CAT[key]) return CAT[key];
    if (G.DATA && G.DATA.crops && G.DATA.crops[key]) return 'produce';
    return 'pantry';
  }
  const FRUIT = { apples: 1, cherries: 1, grapes: 1, pumpkins: 1 };

  // ---------- customer types ----------
  const TYPES = [
    { id: 'daytripper', emoji: '🚗', name: 'Spokane day-trippers', w: 3, units: [1, 3], pref: { produce: 1.2, baked: 1.6, sweet: 1.3, dairy: 1, drink: 0.8, pantry: 0.8, flower: 1 }, sens: { 2: 0.9 },
      lines: ['Worth the drive out from Spokane!', 'Look at those colors, kids!', 'We come out here every fall.'] },
    { id: 'student', emoji: '🎓', name: 'WSU students from Pullman', w: 2.4, units: [1, 2], pref: { baked: 1.5, drink: 1.2, pantry: 1.3, produce: 1, sweet: 1, dairy: 0.9 }, sens: { 0: 1.2, 2: 0.3 },
      lines: ['Cougs on a budget, thank you!', 'Study snacks secured. Go Cougs!', 'Cheaper than the dining hall.'] },
    { id: 'tourist', emoji: '📸', name: 'Seattle tourists bound for Walla Walla', w: 2, units: [1, 3], pref: { drink: 1.8, sweet: 1.5, dairy: 1.4, produce: 1.1, baked: 1.2, craft: 1.5, flower: 1.2 }, sens: { 2: 1.2 },
      lines: ['On our way to wine country. Had to stop!', 'Instagram is going to love this.', 'We do NOT have this in Seattle.'] },
    { id: 'ranch', emoji: '🤠', name: 'Local ranch family', w: 2.4, units: [2, 3], pref: { dairy: 1.6, meat: 1.7, produce: 1.3, baked: 1, feed: 0.8, pantry: 0.8 }, sens: { 2: 0.7 },
      lines: ['Fair prices, fair folks. We will be back.', 'Supper is handled, honey.', 'Nothing beats buying local.'] },
    { id: 'cyclist', emoji: '🚴', name: 'Cyclists on the Palouse Scenic Byway', w: 1.6, units: [1, 2], pref: { produce: 1.8, drink: 1.2, baked: 1.4, sweet: 1.2, dairy: 0.6 }, sens: { 2: 0.6 },
      lines: ['Perfect fuel for the next hill!', 'Is that fresh fruit? Yes please.', 'Rolling hills, rolling snacks.'] },
    { id: 'chef', emoji: '👨‍🍳', name: 'Food-truck chefs', w: 1, units: [3, 6], bulk: true, pref: { produce: 1.8, dairy: 1.5, meat: 1.6, pantry: 1.3, baked: 0.8 }, sens: { 2: 0.8 },
      lines: ['I will take a bunch for tonight\'s special.', 'Ingredients this fresh? Sold.', 'My truck line is about to be wild.'] }
  ];
  const ITEM_LINES = {
    sweet_onions: 'These Walla Walla sweets are unreal!', apples: 'Honeycrisp! Straight from Wenatchee country.', cherries: 'Cherries this sweet should be illegal.',
    honey: 'Canola honey? Local honey for my allergies!', eggs: 'Those yolks are practically orange.', milk: 'Cold milk, glass bottles. Heaven.',
    cheese: 'This cheese is sharp in the best way.', bread: 'Warm bread, are you kidding me?', wine: 'Red Mountain red for dinner. Perfect.',
    pumpkins: 'The biggest pumpkin I have ever seen!', corn: 'Sweet corn for tonight\'s cookout.', potatoes: 'Basin russets, the real deal.',
    apple_pie: 'Apple pie. I am going to cry.', cherry_pie: 'A whole cherry pie? Do not judge me.', ipa: 'Yakima hops. Cheers!',
    ribeye: 'Ribeyes for the grill, folks!', ground_beef: 'Burgers tonight.', brisket: 'Brisket? Oh, we are SO eating well.'
  };
  const SAD_LINES = ['No %s today? Bummer.', 'I came all this way for %s...', 'Out of %s already? Next time.'];
  const MEH_LINES = ['A little steep for me.', 'Hmm, maybe next time.', 'Pretty pricey out here.'];
  const CAT_NAME = { produce: 'fresh produce', dairy: 'dairy', meat: 'beef', baked: 'baked goods', drink: 'drinks', sweet: 'honey', craft: 'wool goods', flower: 'flowers', feed: 'feed', pantry: 'pantry goods' };

  // ---------- state ----------
  let customers = [], feed = [], ui = { view: 'main', slot: null, key: null, q: 1, tier: 1, editName: false };
  let lastT = 0;
  const feedPush = (emoji, text, kind) => { feed.unshift({ id: U.uid(), emoji, text, kind: kind || '', t: U.now() }); if (feed.length > 8) feed.length = 8; };

  function defaultName() { return (G.playerName ? G.playerName() : 'Farmer') + "'s Farm Stand"; }
  function clean(name) { return String(name == null ? '' : name).replace(/[<>&"`\\\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 28); }
  function ensure() {
    const gs = G.state; if (!gs) return null;
    let s = gs.stand;
    if (!s || typeof s !== 'object') s = gs.stand = {};
    if (typeof s.built !== 'boolean') s.built = false;
    s.name = clean(s.name);
    s.slotLvl = U.clamp(Math.floor(+s.slotLvl) || 0, 0, SLOT_STEPS.length - 1);
    if (!s.up || typeof s.up !== 'object') s.up = {};
    Object.keys(UPGRADES).forEach(k => { s.up[k] = !!s.up[k]; });
    if (!Array.isArray(s.shelves)) s.shelves = [];
    s.shelves.length = Math.min(s.shelves.length, 10);
    for (let i = 0; i < s.shelves.length; i++) {   // normalise in place: callers hold references to shelf objects
      const x = s.shelves[i];
      if (!x || !x.key || !(x.qty > 0)) { s.shelves[i] = null; continue; }
      x.key = String(x.key); x.qty = Math.floor(x.qty); x.tier = U.clamp(Math.floor(x.tier == null ? 1 : x.tier) || 0, 0, 2);
    }
    while (s.shelves.length < SLOT_STEPS[s.slotLvl]) s.shelves.push(null);
    s.rep = isFinite(+s.rep) && +s.rep > 0 ? U.clamp(+s.rep, 1, 5) : 2.5;
    if (!s.daily || typeof s.daily !== 'object') s.daily = { day: 0, coins: 0, items: 0 };
    ['day', 'coins', 'items'].forEach(k => { s.daily[k] = +s.daily[k] || 0; });
    ['buzzUntil', 'slumpUntil', 'saleUntil', 'lastSeen'].forEach(k => { s[k] = +s[k] || 0; });
    return s;
  }
  const nameOf = s => s.name || defaultName();
  const S = () => ensure() || { built: false, shelves: [], up: {}, daily: {}, rep: 2.5, slotLvl: 0 };
  const slotCount = () => SLOT_STEPS[S().slotLvl];
  const isBuilt = () => !!S().built;

  // ---------- pricing ----------
  function unitPrice(slot) {
    if (!slot) return 0;
    const t = TIERS[slot.tier] || TIERS[1];
    let p = G.sellPrice(slot.key) * t.mult;
    if (S().up.cooler && COOLER_CATS[cat(slot.key)]) p *= 1.2;
    return Math.max(1, Math.round(p));
  }
  function calOf() { try { return G.calendar(); } catch (e) { return { day: 1, season: 'spring', dayProgress: 0.3 }; } }
  const isDay = cal => cal.dayProgress >= 0.05 && cal.dayProgress <= 0.8;
  function activeEv() { try { return (G.Events && G.Events.active) ? G.Events.active() : []; } catch (e) { return []; } }

  // visitors per second at a moment (excluding day/night gating)
  function trafficRate(now, cal, withEvents) {
    const s = S(), up = s.up;
    let r = (1 / 14) * (0.55 + 0.2 * s.rep);
    if (up.sign) r *= 1.25;
    if (up.awning) r *= 1.1;
    if (up.shop) r *= 1.8;
    r *= SEASON_TRAFFIC[cal.season] || 1;
    const stocked = s.shelves.filter(Boolean);
    if (!stocked.length) r *= 0.3;
    else {
      const avg = stocked.reduce((a, x) => a + (x.tier === 0 ? 1.12 : x.tier === 2 ? 0.88 : 1), 0) / stocked.length;
      r *= avg;
    }
    if (withEvents) {
      const ev = activeEv();
      if (ev.some(e => e && BOOST_RE.test(e.key))) r *= 2;
      if (ev.some(e => e && e.key === 'road_construction')) r *= 0.5;
      if (now < s.buzzUntil) r *= 1.5;
      if (now < s.slumpUntil) r *= 0.7;
      if (now < s.saleUntil) r *= 1.25;
    }
    return r;
  }

  // ---------- purchasing ----------
  const shelfItems = () => S().shelves.map((x, i) => x ? { i, slot: x } : null).filter(Boolean);
  function pickCat(type) {
    const cats = Object.keys(type.pref);
    return U.weightedPick(cats, c => type.pref[c]);
  }
  // Decide and perform a purchase for a customer. Returns {sales:[{key,n,coins}], mood, text}
  function purchase(type, opts) {
    opts = opts || {};
    const s = S(), res = { sales: [], mood: 'meh', text: null };
    const items = shelfItems().filter(e => e.slot.qty > 0);
    if (!items.length) { res.mood = 'sad'; res.text = U.pick(SAD_LINES).replace('%s', 'anything'); return res; }
    const want = pickCat(type);
    let pool = items.filter(e => cat(e.slot.key) === want);
    if (!pool.length) {
      if (Math.random() < 0.6) pool = items;
      else { res.mood = 'sad'; res.text = U.pick(SAD_LINES).replace('%s', CAT_NAME[want] || 'that'); res.missed = want; return res; }
    }
    let remaining = U.randInt(type.units[0], type.units[1]);
    const used = {}; let tierSeen = 1, priceBlocked = false;
    for (let round = 0; round < 2 && remaining > 0; round++) {
      const cand = pool.filter(e => !used[e.i] && e.slot.qty > 0);
      if (!cand.length) break;
      const e = U.weightedPick(cand, x => (type.pref[cat(x.slot.key)] || 0.4) * (FRUIT[x.slot.key] && type.id === 'cyclist' ? 1.5 : 1));
      if (!e) break;
      used[e.i] = 1;
      const t = e.slot.tier;
      let chance = 0.9 * TIERS[t].buy * (type.sens && type.sens[t] != null ? type.sens[t] : 1) * (0.82 + 0.04 * s.rep) * (s.up.awning ? 1.08 : 1);
      if (U.now() < s.saleUntil) chance *= 1.15;
      chance = U.clamp(chance, 0.05, 0.97);
      if (Math.random() > chance) { priceBlocked = true; continue; }
      const n = Math.min(remaining, e.slot.qty);
      const price = unitPrice(e.slot), coins = price * n;
      e.slot.qty -= n; if (e.slot.qty <= 0) s.shelves[e.i] = null;
      remaining -= n; tierSeen = t;
      res.sales.push({ key: e.slot.key, n, coins, tier: t });
      // bulk buyers sometimes keep going on the same item
      if (type.bulk && remaining > 0 && s.shelves[e.i]) { /* already limited by qty */ }
    }
    if (res.sales.length) {
      res.mood = tierSeen === 2 ? 'meh' : 'happy';
      res.text = null;
    } else if (priceBlocked) { res.mood = 'meh'; res.text = U.pick(MEH_LINES); }
    return res;
  }

  function settle(res, type, opts) {
    // pays out, emits events, updates reputation & daily totals. Returns {n, coins}
    opts = opts || {};
    const s = S(); let n = 0, coins = 0;
    res.sales.forEach(x => { n += x.n; coins += x.coins; });
    if (coins > 0) {
      G.addCoins(coins, 'stand');
      const cal = calOf();
      if (s.daily.day !== cal.day) s.daily = { day: cal.day, coins: 0, items: 0 };
      s.daily.coins += coins; s.daily.items += n;
      res.sales.forEach(x => { try { G.bus.emit('stand:sale', { key: x.key, n: x.n, coins: x.coins }); } catch (e) { } });
      s.rep = U.clamp(s.rep + (res.mood === 'happy' ? 0.04 : 0.015), 1, 5);
    } else if (res.mood === 'sad') s.rep = U.clamp(s.rep - 0.05, 1, 5);
    else if (res.mood === 'meh') s.rep = U.clamp(s.rep - 0.01, 1, 5);
    return { n, coins };
  }

  function quoteFor(type, res) {
    if (res.mood === 'sad' || (res.mood === 'meh' && !res.sales.length)) return res.text;
    if (!res.sales.length) return null;
    const top = res.sales[0];
    if (ITEM_LINES[top.key] && Math.random() < 0.6) return ITEM_LINES[top.key];
    return U.pick(type.lines);
  }

  // ---------- customers ----------
  function spawnCustomer(now) {
    const type = U.weightedPick(TYPES, t => t.w);
    const c = { id: U.uid(), type, emoji: type.emoji, phase: 'arriving', start: now, dur: U.rand(4, 8) * 1000, mood: undefined, res: null };
    customers.push(c);
    return c;
  }
  function advance(c, now) {
    let guard = 0;
    while (now - c.start >= c.dur && guard++ < 4) {
      const at = c.start + c.dur;
      if (c.phase === 'arriving') { c.phase = 'browsing'; }
      else if (c.phase === 'browsing') {
        c.phase = 'paying';
        const res = purchase(c.type); c.res = res; c.mood = res.mood;
        const out = settle(res, c.type);
        const q = quoteFor(c.type, res);
        if (res.sales.length) {
          const top = res.sales[0], it = G.itemInfo(top.key);
          if (Math.random() < 0.55 || out.coins >= 120) feedPush(c.emoji, q || '', 'happy');
          else feedPush('🪙', `+${out.coins} for ${top.n} ${it.emoji || ''}`, 'coin');
          c.coins = out.coins;
        } else if (q) feedPush(c.emoji, q, res.mood);
      }
      else if (c.phase === 'paying') { c.phase = 'leaving'; }
      else { c.phase = 'gone'; return; }
      c.start = at; c.dur = U.rand(4, 8) * 1000;
    }
  }
  function onTick(p) {
    const s = ensure(); if (!s || !s.built) { lastT = 0; return; }
    const now = (p && p.now) || U.now();
    const cal = (p && p.cal) || calOf();
    if (s.lastSeen && now - s.lastSeen > 30000) offlineSim(s.lastSeen, now);
    s.lastSeen = now;
    const dt = lastT ? Math.min(2, Math.max(0, (now - lastT) / 1000)) : 0.5;
    lastT = now;
    if (s.daily.day !== cal.day) s.daily = { day: cal.day, coins: 0, items: 0 };
    customers.forEach(c => advance(c, now));
    const before = customers.length;
    customers = customers.filter(c => c.phase !== 'gone');
    const day = isDay(cal), rate = trafficRate(now, cal, true);
    if (day) {
      if (customers.length < CAP && Math.random() < rate * dt) spawnCustomer(now);
    } else if (s.up.honor && Math.random() < rate * dt * 0.3) {
      const type = U.weightedPick(TYPES, t => t.w), res = purchase(type), out = settle(res, type);
      if (out.coins > 0 && Math.random() < 0.5) feedPush('📦', `Honor box: +${out.coins} 🪙`, 'coin');
    }
    if (before !== customers.length) G.bus.emit('change');
  }

  // ---------- offline ----------
  function offlineSim(from, to) {
    const s = ensure(); if (!s || !s.built || !(to > from)) return null;
    from = Math.max(from, to - 24 * 3600 * 1000);
    const start = G.state.startedAt || 0, STEP = 10000, DAYMS = G.DAY_SEC * 1000;
    let expected = 0;
    for (let t = from; t < to; t += STEP) {
      const el = (t - start) / 1000, dayIdx = Math.floor(el / G.DAY_SEC);
      const cal = { season: G.SEASONS[Math.floor(dayIdx / G.DAYS_PER_SEASON) % 4], dayProgress: (el % G.DAY_SEC) / G.DAY_SEC };
      const dtSec = Math.min(STEP, to - t) / 1000;
      const r = trafficRate(t, cal, false) * dtSec * 0.5;
      if (isDay(cal)) expected += r;
      else if (s.up.honor) expected += r * 0.3;
    }
    let count = Math.floor(expected) + (Math.random() < expected % 1 ? 1 : 0);
    let sales = 0, items = 0, coins = 0;
    for (let i = 0; i < count && sales < OFFLINE_MAX_SALES; i++) {
      if (!shelfItems().length) break;
      const type = U.weightedPick(TYPES, t => t.w), res = purchase(type);
      if (!res.sales.length) continue;
      const out = settle(res, type);
      sales++; items += out.n; coins += out.coins;
    }
    s.lastSeen = to;
    if (items > 0) {
      G.toast(`Your stand sold ${items} items while you were away: +${coins} 🪙`, 'good');
      feedPush('🌙', `While you were away: ${items} items, +${coins} 🪙`, 'coin');
    }
    G.bus.emit('change');
    return { sales, items, coins };
  }

  // ---------- actions ----------
  function build(name) {
    const s = ensure();
    if (s.built) return false;
    if ((G.state.level || 1) < UNLOCK_LEVEL) { G.toast(`Farm stand unlocks at level ${UNLOCK_LEVEL}`, 'bad'); return false; }
    if (!G.spend(BUILD_COST)) return false;
    s.built = true; s.name = clean(name) || s.name || defaultName();
    s.lastSeen = U.now(); s.rep = Math.max(s.rep, 2.5);
    G.toast('Your farm stand is open for business! 🧺', 'good');
    G.bus.emit('stand:built', {}); G.bus.emit('change'); G.save();
    return true;
  }
  function setName(name) {
    const c = clean(name); if (!c) return false;
    ensure().name = c; G.bus.emit('change'); G.save(); return true;
  }
  function stock(slotIdx, key, n, tier) {
    const s = ensure(); slotIdx = +slotIdx;
    if (!s.built || !(slotIdx >= 0 && slotIdx < slotCount())) return false;
    n = Math.floor(+n); if (!(n > 0) || !key) return false;
    const cur = s.shelves[slotIdx];
    if (cur && cur.key !== key) { G.toast('Empty this shelf first', 'bad'); return false; }
    const room = SLOT_CAP - (cur ? cur.qty : 0);
    n = Math.min(n, room, G.qty(key));
    if (n <= 0) { G.toast(room <= 0 ? 'Shelf is full' : 'None in the barn', 'bad'); return false; }
    if (!G.removeItems({ [key]: n })) return false;
    if (cur) { cur.qty += n; if (tier != null) cur.tier = U.clamp(+tier, 0, 2); }
    else s.shelves[slotIdx] = { key, qty: n, tier: U.clamp(tier == null ? 1 : +tier, 0, 2) };
    G.bus.emit('change'); G.save();
    return n;
  }
  function pull(slotIdx, n) {
    const s = ensure(), cur = s.shelves[+slotIdx]; if (!cur) return 0;
    n = n === 'all' ? cur.qty : Math.min(Math.floor(+n) || 0, cur.qty);
    n = Math.min(n, Math.max(0, G.barnFree()));
    if (n <= 0) { G.toast('Barn is full', 'bad'); return 0; }
    const got = G.addItem(cur.key, n);
    cur.qty -= got; if (cur.qty <= 0) s.shelves[+slotIdx] = null;
    G.bus.emit('change'); G.save();
    return got;
  }
  function setTier(slotIdx, tier) {
    const cur = ensure().shelves[+slotIdx]; if (!cur) return false;
    cur.tier = U.clamp(Math.floor(+tier) || 0, 0, 2); G.bus.emit('change'); return true;
  }
  function upgradeInfo(key) {
    const s = S();
    if (key === 'shelves') {
      const nx = SHELF_UP[s.slotLvl];
      return nx ? { key, name: `More shelves (${SLOT_STEPS[s.slotLvl + 1]} slots)`, emoji: '🪵', cost: nx.cost, level: nx.level, desc: `Grow from ${SLOT_STEPS[s.slotLvl]} to ${SLOT_STEPS[s.slotLvl + 1]} shelf slots.`, owned: false } : { key, name: 'Shelves maxed (10 slots)', emoji: '🪵', owned: true, cost: 0, level: 1, desc: '' };
    }
    const u = UPGRADES[key]; if (!u) return null;
    return Object.assign({ key, owned: !!s.up[key] }, u);
  }
  function upgrade(key) {
    const s = ensure(); if (!s.built) return false;
    const u = upgradeInfo(key); if (!u || u.owned) return false;
    if ((G.state.level || 1) < u.level) { G.toast(`Unlocks at level ${u.level}`, 'bad'); return false; }
    const miss = (u.requires || []).filter(r => !s.up[r]);
    if (miss.length) { G.toast('Buy the ' + miss.map(m => UPGRADES[m].name).join(' & ') + ' first', 'bad'); return false; }
    if (!G.spend(u.cost)) return false;
    if (key === 'shelves') { s.slotLvl++; ensure(); } else s.up[key] = true;
    G.toast(`${u.emoji} ${u.name} installed!`, 'good');
    G.bus.emit('stand:upgrade', { key }); G.bus.emit('change'); G.save();
    return true;
  }

  // ---------- events ----------
  function reg() {
    if (!G.Events || !G.Events.register) return;
    const built = () => { try { return isBuilt(); } catch (e) { return false; } };
    G.Events.register({
      key: 'food_blogger', name: 'Food blogger visits your stand', emoji: '📸', kind: 'good', seasons: ['spring', 'summer', 'fall', 'winter'], minLevel: UNLOCK_LEVEL, weight: 0.8, durationSec: 0,
      desc: 'A Seattle food blogger is live-posting your farm stand.', requires: built,
      onStart() { const s = ensure(); s.rep = U.clamp(s.rep + 0.5, 1, 5); s.buzzUntil = U.now() + 120000; return {}; },
      text: () => 'A Seattle food blogger raved about your farm stand to 80,000 followers! Reputation up and a wave of curious shoppers is on the way.'
    });
    G.Events.register({
      key: 'road_construction', name: 'Road construction on the highway', emoji: '🚧', kind: 'bad', seasons: ['spring', 'summer', 'fall'], minLevel: UNLOCK_LEVEL, weight: 0.8, durationSec: 120,
      desc: 'Flaggers and orange cones are keeping drivers away from your stand.', requires: built,
      text: () => 'WSDOT is repaving the highway with one lane and a pilot car. Traffic to your farm stand is cut in half until the crews pack up.'
    });
    G.Events.register({
      key: 'market_competition', name: 'Farmers market competition', emoji: '🥕', kind: 'neutral', seasons: ['spring', 'summer', 'fall'], minLevel: UNLOCK_LEVEL, weight: 0.8, durationSec: 0, requires: built,
      desc: 'A big new farmers market opened up the road.',
      text: () => 'A new weekend farmers market just opened up the road and shoppers are comparing prices. How will you respond?',
      choices: [
        { label: 'Run a sale', cost: 0, desc: 'Cut prices for a bit. More shoppers buy, for 2 minutes.', apply: c => { const s = ensure(); s.saleUntil = U.now() + 120000; return 'Your SALE sign drew crowds. Shoppers are happily buying.'; } },
        { label: 'Hand out samples', cost: 30, desc: 'Free samples win loyal fans. Reputation up a bit.', apply: c => { const s = ensure(); s.rep = U.clamp(s.rep + 0.25, 1, 5); s.buzzUntil = U.now() + 90000; return 'Free samples were a hit. Shoppers are talking about your stand.'; } },
        { label: 'Ignore it', cost: 0, desc: 'Business as usual. Traffic dips for a while.', apply: c => { const s = ensure(); s.slumpUntil = U.now() + 120000; return 'Some of your regulars wandered over to the market.'; } }
      ]
    });
  }

  // ---------- panel ----------
  const esc = s => (G.uikit && G.uikit.esc) ? G.uikit.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const itemEmoji = k => (G.itemInfo(k) || {}).emoji || '📦';
  const itemName = k => (G.itemInfo(k) || {}).name || k;
  const stars = r => { const f = Math.round(r); return '★'.repeat(f) + '☆'.repeat(5 - f); };

  function statusInfo() {
    const cal = calOf(), s = S();
    if (isDay(cal)) {
      const ev = activeEv();
      if (ev.some(e => e && e.key === 'road_construction')) return { cls: 'slow', txt: 'Open: roadwork 🚧' };
      return { cls: 'open', txt: 'Open' };
    }
    return s.up.honor ? { cls: 'honor', txt: 'Honor box' } : { cls: 'closed', txt: 'Closed' };
  }

  function css() {
    return `
.st-wrap{display:flex;flex-direction:column;gap:10px;padding-bottom:6px}
.st-head{background:linear-gradient(#fff8e7,#ffeac0);border:3px solid #c98a14;border-radius:20px;padding:12px;box-shadow:var(--card-sh)}
.st-head .row{display:flex;align-items:center;gap:8px}
.st-sign{flex:1;min-width:0;font-weight:900;font-size:17px;color:var(--ink);background:#e9c58a;border:3px solid #8a5a2b;border-radius:12px;padding:6px 10px;text-align:center;box-shadow:inset 0 2px 0 rgba(255,255,255,.4);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:inherit;min-height:44px}
.st-stats{display:flex;gap:6px;margin-top:9px}
.st-stat{flex:1;background:#fff;border-radius:12px;padding:5px 4px;text-align:center;border:2px solid #f0dcaa}
.st-stat b{display:block;font-size:15px;color:var(--ink)}.st-stat small{font-size:10px;font-weight:800;color:var(--ink2);text-transform:uppercase}
.st-star{color:#f2a91c;letter-spacing:1px}
.st-pill{display:inline-block;border-radius:10px;padding:3px 9px;font-size:12px;font-weight:900;color:#fff}
.st-pill.open{background:var(--green)}.st-pill.closed{background:#9a8a70}.st-pill.honor{background:#3b8fd0}.st-pill.slow{background:var(--gold-d)}
.st-nameedit{display:flex;gap:6px;margin-top:8px}
.st-nameedit input,.st-build input{flex:1;min-width:0;min-height:44px;border-radius:12px;border:3px solid #c98a14;padding:0 10px;font-size:16px;font-weight:800;color:var(--ink);background:#fffdf5;font-family:inherit}
.st-shelves{background:#7a4a22;border:3px solid #5a3410;border-radius:18px;padding:8px;display:grid;grid-template-columns:1fr 1fr;gap:8px;box-shadow:inset 0 3px 8px rgba(0,0,0,.35),var(--card-sh);background-image:repeating-linear-gradient(90deg,rgba(0,0,0,.06) 0 2px,transparent 2px 22px)}
.st-slot{position:relative;min-height:104px;border-radius:12px;background:linear-gradient(#f3d9a4,#e6bf79);border:0;border-bottom:7px solid #a56a32;box-shadow:0 3px 0 #5a3410;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:6px 4px 4px;cursor:pointer;color:var(--ink);font-family:inherit}
.st-slot:active{transform:translateY(2px)}
.st-slot .e{font-size:34px;line-height:1.1}
.st-slot .q{position:absolute;top:4px;right:6px;background:var(--ink);color:#fff;border-radius:10px;font-size:11px;font-weight:900;padding:1px 7px}
.st-slot .n{font-size:11px;font-weight:800;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.st-slot .p{font-size:12px;font-weight:900;background:#fffdf0;border:2px solid #c98a14;border-radius:8px;padding:0 7px;transform:rotate(-1.5deg)}
.st-slot .p.t0{border-color:var(--green-d)}.st-slot .p.t2{border-color:#8e44ad;background:#f6ebff}
.st-slot.empty{background:rgba(255,236,190,.35);border:2px dashed #e6bf79;border-bottom:2px dashed #e6bf79;box-shadow:none;color:#f7e1b0}
.st-slot.empty .e{font-size:26px;opacity:.9}.st-slot.empty .n{font-size:12px}
.st-feed{background:#fffaf0;border:3px solid #e2c98d;border-radius:18px;padding:8px}
.st-cust{display:flex;gap:6px;overflow:hidden;min-height:58px}
.st-c{flex:1 1 0;min-width:0;background:#fff;border:2px solid #f0dcaa;border-radius:12px;padding:4px 2px;text-align:center}
.st-c .e{font-size:26px;display:block;line-height:1.2}.st-c small{display:block;font-size:10px;font-weight:900;color:var(--ink2);text-transform:capitalize}
.st-c .mini{width:80%;margin:2px auto 0}
.st-c.sad{background:#ffe3dc}.st-c.happy{background:#eaf8d9}
.st-quote{display:flex;gap:7px;align-items:flex-start;margin-top:7px}
.st-quote .e{font-size:22px;flex:none}
.st-quote .b{background:#fff;border:2px solid #f0dcaa;border-radius:4px 14px 14px 14px;padding:4px 9px;font-size:13px;font-weight:700;color:var(--ink)}
.st-quote.coin .b{background:#fff3c8;border-color:#f2b631;font-weight:900}.st-quote.sad .b{background:#ffe3dc;border-color:#f0b0a0}
.st-up{display:flex;align-items:center;gap:9px;background:#fff8e7;border:3px solid #e2c98d;border-radius:16px;padding:8px 10px}
.st-up.own{background:#eaf8d9;border-color:#a6d68a}
.st-up .e{font-size:28px;flex:none}.st-up .t{flex:1;min-width:0}.st-up b{display:block;font-size:14px;color:var(--ink)}.st-up small{display:block;font-size:11px;font-weight:700;color:var(--ink2);line-height:1.25}
.st-up .btn{min-width:84px;padding:0 10px;font-size:13px}
.st-build{text-align:center;background:linear-gradient(#fff8e7,#ffeac0);border:3px solid #c98a14;border-radius:20px;padding:16px;box-shadow:var(--card-sh);display:flex;flex-direction:column;gap:10px}
.st-build .big{font-size:56px}.st-build h3{margin:0;font-size:19px}.st-build p{margin:0;font-size:13px;color:var(--ink2);font-weight:700}
.st-pick{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-height:230px;overflow-y:auto;padding:2px}
.st-pi{background:#fff8e7;border:3px solid #e2c98d;border-radius:12px;padding:5px 2px;text-align:center;font-family:inherit;color:var(--ink);min-height:70px;cursor:pointer}
.st-pi.sel{border-color:var(--green);background:#eaf8d9}
.st-pi .e{font-size:26px;display:block}.st-pi small{display:block;font-size:10px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.st-pi b{font-size:11px;color:var(--ink2)}
.st-chips{display:flex;gap:6px}.st-chips .btn{flex:1;padding:0 4px}
.st-tier{flex:1;min-height:56px;border-radius:14px;border:3px solid #e2c98d;background:#fff8e7;font-family:inherit;font-weight:900;font-size:12px;color:var(--ink);cursor:pointer;line-height:1.3}
.st-tier.sel{border-color:var(--green);background:#eaf8d9;box-shadow:0 3px 0 var(--green-d)}
.st-cur{display:flex;align-items:center;gap:10px;background:#fff8e7;border:3px solid #e2c98d;border-radius:16px;padding:8px 10px}
.st-cur .e{font-size:38px}.st-cur b{display:block;font-size:15px}.st-cur small{font-size:12px;font-weight:700;color:var(--ink2)}
`;
  }
  if (typeof document !== 'undefined') G.injectCSS('stand', css());

  const btn = (act, label, cls, extra) => `<button class="btn ${cls || 'btn-gold'} sm" data-act="pact" data-pa="${act}" ${extra || ''}>${label}</button>`;

  function renderBuild() {
    const lvl = G.state.level || 1, lock = lvl < UNLOCK_LEVEL;
    if (lock) return `<div class="st-build"><div class="big">🧺</div><h3>Farm Stand</h3><p>Sell your goods to passing travelers. Unlocks at level ${UNLOCK_LEVEL}.</p><div><span class="lockpill">🔒 Level ${UNLOCK_LEVEL}</span></div></div>`;
    const poor = G.state.coins < BUILD_COST;
    return `<div class="st-build"><div class="big">🧺</div><h3>Build your farm stand</h3>
<p>A roadside stand where day-trippers, cyclists and ranch families buy straight from your shelves. You set the prices.</p>
<input class="st-name-in" type="text" maxlength="28" value="${esc(nameOf(ensure()))}" aria-label="Stand name">
${btn('build', `Build your farm stand 🪙 ${BUILD_COST}`, 'btn-green', poor ? 'aria-disabled="true" data-why="You need ' + BUILD_COST + ' coins"' : '')}</div>`;
  }

  function renderMain() {
    const s = S(), st = statusInfo();
    const head = `<div class="st-head"><div class="row"><button class="st-sign" data-act="pact" data-pa="editname" aria-label="Rename stand">${s.up.shop ? '🏪' : '🧺'} ${esc(nameOf(s))} ✏️</button></div>
${ui.editName ? `<div class="st-nameedit"><input class="st-name-in" type="text" maxlength="28" value="${esc(nameOf(s))}" aria-label="Stand name">${btn('savename', 'Save', 'btn-green')}</div>` : ''}
<div class="st-stats"><div class="st-stat"><b class="st-star">⭐ ${s.rep.toFixed(1)}</b><small>${stars(s.rep)}</small></div>
<div class="st-stat"><b>🪙 ${s.daily.day === calOf().day ? s.daily.coins : 0}</b><small>Today</small></div>
<div class="st-stat"><b><span class="st-pill ${st.cls}">${st.txt}</span></b><small>${s.up.shop ? 'Kellyville Farm Shop' : 'Status'}</small></div></div></div>`;
    const slots = s.shelves.slice(0, slotCount()).map((x, i) => {
      if (!x) return `<button class="st-slot empty" data-act="pact" data-pa="slot" data-i="${i}"><span class="e">＋</span><span class="n">Stock shelf</span></button>`;
      return `<button class="st-slot" data-act="pact" data-pa="slot" data-i="${i}"><span class="q">×${x.qty}</span><span class="e">${esc(itemEmoji(x.key))}</span><span class="n">${esc(itemName(x.key))}</span><span class="p t${x.tier}">🪙 ${unitPrice(x)}</span></button>`;
    }).join('');
    const now = U.now();
    const cs = customers.length ? customers.map(c => {
      const t = U.clamp((now - c.start) / c.dur, 0, 1);
      return `<div class="st-c ${c.mood && c.phase !== 'arriving' && c.phase !== 'browsing' ? c.mood : ''}"><span class="e">${c.emoji}</span><small>${c.phase}</small><div class="mini"><i style="width:${Math.round(t * 100)}%"></i></div></div>`;
    }).join('') : '<div class="empty-note" style="width:100%;margin:0;padding:10px">No shoppers right now. Stock your shelves and keep the sign up!</div>';
    const quotes = feed.slice(0, 5).map(f => `<div class="st-quote ${f.kind}"><span class="e">${f.emoji}</span><div class="b">${f.kind === 'coin' ? esc(f.text) : '“' + esc(f.text) + '”'}</div></div>`).join('');
    const ups = ['shelves', 'sign', 'awning', 'cooler', 'honor', 'shop'].map(k => {
      const u = upgradeInfo(k); if (!u) return '';
      if (u.owned) return `<div class="st-up own"><span class="e">${u.emoji}</span><div class="t"><b>${esc(u.name)}</b><small>${k === 'shelves' ? 'All shelves built.' : 'Installed.'}</small></div><span class="need ok">✓</span></div>`;
      const lvlLock = (G.state.level || 1) < u.level;
      const miss = (u.requires || []).filter(r => !s.up[r]);
      let b;
      if (lvlLock) b = `<span class="lockpill">🔒 Lv ${u.level}</span>`;
      else if (miss.length) b = `<span class="lockpill" style="font-size:11px">Needs ${miss.map(m => esc(UPGRADES[m].name.split(' ').pop())).join(' + ')}</span>`;
      else b = btn('up', `🪙 ${u.cost}`, 'btn-gold', `data-k="${k}"` + (G.state.coins < u.cost ? ` aria-disabled="true" data-why="You need ${u.cost} coins"` : ''));
      return `<div class="st-up"><span class="e">${u.emoji}</span><div class="t"><b>${esc(u.name)}</b><small>${esc(u.desc)}</small></div>${b}</div>`;
    }).join('');
    return `<div class="st-wrap">${head}<div class="sub" style="margin:2px 2px 0">Shelves · tap to stock</div><div class="st-shelves">${slots}</div>
<div class="sub" style="margin:2px 2px 0">Shoppers</div><div class="st-feed"><div class="st-cust">${cs}</div>${quotes}</div>
<div class="sub" style="margin:2px 2px 0">Upgrades</div>${ups}</div>`;
  }

  function barnList(onlyKey) {
    return Object.entries(G.state.barn || {}).filter(([k, q]) => q > 0 && (!onlyKey || k === onlyKey)).sort((a, b) => itemName(a[0]).localeCompare(itemName(b[0])));
  }
  function renderSlot() {
    const s = S(), i = ui.slot, x = s.shelves[i];
    if (i == null || i >= slotCount()) { ui.view = 'main'; return renderMain(); }
    const list = barnList(x && x.key);
    if (!ui.key || !G.qty(ui.key) || (x && ui.key !== x.key)) ui.key = x ? x.key : (list[0] ? list[0][0] : null);
    if (x) ui.tier = x.tier;
    const have = ui.key ? G.qty(ui.key) : 0;
    const amt = ui.q === 'all' ? have : Math.min(ui.q, have);
    const base = ui.key ? G.sellPrice(ui.key) : 0;
    const prev = k => ui.key ? Math.max(1, Math.round(base * TIERS[k].mult * (s.up.cooler && COOLER_CATS[cat(ui.key)] ? 1.2 : 1))) : 0;
    const cur = x ? `<div class="st-cur"><span class="e">${esc(itemEmoji(x.key))}</span><div style="flex:1"><b>${esc(itemName(x.key))}</b><small>${x.qty} on the shelf · 🪙 ${unitPrice(x)} each</small></div></div>
<div class="st-chips">${btn('pull', 'Take 1', 'btn-gray', 'data-n="1"')}${btn('pull', 'Take 5', 'btn-gray', 'data-n="5"')}${btn('pull', 'Take all', 'btn-red', 'data-n="all"')}</div>` : '';
    const pick = list.length ? `<div class="st-pick">${list.map(([k, q]) => `<button class="st-pi ${k === ui.key ? 'sel' : ''}" data-act="pact" data-pa="pick" data-k="${esc(k)}"><span class="e">${esc(itemEmoji(k))}</span><small>${esc(itemName(k))}</small><b>×${q}</b></button>`).join('')}</div>` : `<div class="empty-note">${x ? 'No more of this in the barn.' : 'Your barn is empty. Harvest something first!'}</div>`;
    const tiers = TIERS.map((t, k) => `<button class="st-tier ${ui.tier === k ? 'sel' : ''}" data-act="pact" data-pa="tier" data-t="${k}">${t.emoji} ${t.name}<br>🪙 ${prev(k)}</button>`).join('');
    return `<div class="st-wrap"><div>${btn('back', '‹ Back to stand', 'btn-gray')}</div>
${cur}
<div class="sub" style="margin:2px 2px 0">${x ? 'Price' : 'Choose an item from the barn'}</div>
${x ? '' : pick}
<div class="st-chips" style="gap:6px">${tiers}</div>
${x ? `<div class="sub" style="margin:2px 2px 0">Add more</div>${pick}` : ''}
${list.length ? `<div class="sub" style="margin:2px 2px 0">Quantity</div><div class="st-chips">${[1, 5, 'all'].map(q => `<button class="btn ${ui.q === q ? 'btn-green' : 'btn-gray'} sm" data-act="pact" data-pa="qty" data-q="${q}">${q === 'all' ? 'All' : q}</button>`).join('')}</div>
${btn('stock', amt > 0 ? `Stock ${amt} ${esc(itemEmoji(ui.key))}` : 'Nothing to stock', 'btn-green', amt > 0 ? '' : 'aria-disabled="true" data-why="Nothing to stock"')}` : ''}</div>`;
  }

  function onAction(a, el) {
    try {
      const s = ensure();
      switch (a) {
        case 'build': { const inp = el.closest('.panel-body') && el.closest('.panel-body').querySelector('.st-name-in'); build(inp ? inp.value : ''); break; }
        case 'editname': ui.editName = !ui.editName; break;
        case 'savename': { const inp = el.closest('.panel-body').querySelector('.st-name-in'); if (inp) setName(inp.value); ui.editName = false; break; }
        case 'slot': ui.view = 'slot'; ui.slot = +el.dataset.i; ui.key = null; ui.tier = s.shelves[ui.slot] ? s.shelves[ui.slot].tier : 1; break;
        case 'back': ui.view = 'main'; break;
        case 'pick': ui.key = el.dataset.k; break;
        case 'qty': ui.q = el.dataset.q === 'all' ? 'all' : +el.dataset.q; break;
        case 'tier': ui.tier = +el.dataset.t; if (s.shelves[ui.slot]) setTier(ui.slot, ui.tier); break;
        case 'stock': {
          const have = G.qty(ui.key), n = ui.q === 'all' ? have : Math.min(ui.q, have);
          if (stock(ui.slot, ui.key, n, ui.tier)) ui.view = 'main';
          break;
        }
        case 'pull': { pull(ui.slot, el.dataset.n === 'all' ? 'all' : +el.dataset.n); if (!s.shelves[ui.slot]) ui.view = 'main'; break; }
        case 'up': upgrade(el.dataset.k); break;
      }
    } catch (e) { console.error('[stand] action', e); }
  }

  G.panels.stand = {
    live: true,
    title() { return isBuilt() ? 'Farm Stand' : 'Farm Stand'; },
    sub() { const s = S(); return s.built ? esc(nameOf(s)) : ''; },
    render() {
      try {
        ensure();
        if (!isBuilt()) return renderBuild();
        return ui.view === 'slot' ? renderSlot() : renderMain();
      } catch (e) { console.error('[stand] render', e); return '<div class="empty-note">Stand unavailable.</div>'; }
    },
    onAction
  };

  // ---------- public API ----------
  G.Stand = {
    isBuilt,
    customers() { return customers.filter(c => c.phase !== 'gone').map(c => ({ id: c.id, emoji: c.emoji, phase: c.phase, t: U.clamp((U.now() - c.start) / c.dur, 0, 1), mood: c.mood })); },
    build, setName, stock, pull, setTier, upgrade, ensure, offlineSim,
    shelves: () => S().shelves.slice(0, slotCount()).map(x => x && Object.assign({}, x)),
    slotCount, reputation: () => S().rep, todaySales: () => (S().daily.day === calOf().day ? S().daily.coins : 0),
    unitPrice: slot => unitPrice(slot), name: () => nameOf(S()),
    trafficRate: () => trafficRate(U.now(), calOf(), true),
    feed: () => feed.slice(), unlockLevel: UNLOCK_LEVEL, buildCost: BUILD_COST,
    status: () => statusInfo().txt
  };

  // ---------- wiring ----------
  const safe = (n, f) => G.bus.on(n, p => { try { f(p); } catch (e) { console.error('[stand]', n, e); } });
  safe('init', () => {
    const s = ensure(); customers = []; feed = []; lastT = 0;
    if (s && s.built) {
      const from = s.lastSeen || (G.state.lastTick || 0), now = U.now();
      if (from && now - from > 30000) offlineSim(from, now);
      s.lastSeen = now;
    }
  });
  safe('state:reset', () => { customers = []; feed = []; lastT = 0; ui = { view: 'main', slot: null, key: null, q: 1, tier: 1, editName: false }; ensure(); });
  safe('tick', onTick);
  reg();
})();
