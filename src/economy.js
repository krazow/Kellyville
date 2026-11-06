/* economy.js — Kellyville economy: order board, market, shop catalog, level rewards, daily bonus.
   Fully data-driven from G.DATA at runtime. Exposes G.Economy. */
(function () {
  'use strict';
  const G = window.G;
  const U = G.util;

  const SLOTS = 6;
  const FULFILL_COOLDOWN = 20000;
  const DISCARD_COOLDOWN = 30000;
  const EXPRESS_CHANCE = 0.2;
  const MARKET_MIN = 0.8, MARKET_MAX = 1.25;
  const PREV_KEY = 'economy.prevMarket';
  const CHANGE_THROTTLE = 3000;

  const CUSTOMERS = [
    { name: 'Spokane Farmers Market', emoji: '🧺', region: 'spokane' },
    { name: 'Walla Walla Winery', emoji: '🍷', region: 'walla_walla' },
    { name: 'Yakima Brewing Co.', emoji: '🍺', region: 'yakima' },
    { name: 'Moscow Food Co-op', emoji: '🥬', region: 'palouse' },
    { name: 'Ellensburg Rodeo Grounds', emoji: '🤠', region: 'ellensburg' },
    { name: 'Tri-Cities Taqueria', emoji: '🌮', region: 'tri_cities' },
    { name: 'Wenatchee Packing House', emoji: '📦', region: 'wenatchee' },
    { name: 'Grandma June in Colfax', emoji: '👵', region: 'palouse' },
    { name: 'Pullman Cougar Diner', emoji: '🐾', region: 'palouse' },
    { name: 'Moses Lake Fish & Chips', emoji: '🍟', region: 'columbia_basin' },
    { name: 'Ritzville Grain Elevator', emoji: '🏭', region: 'columbia_basin' },
    { name: 'Leavenworth Bavarian Bakery', emoji: '🥨', region: 'wenatchee' },
    { name: 'Prosser Wine Bar', emoji: '🍇', region: 'yakima' },
    { name: 'Cle Elum Trailside Cafe', emoji: '☕', region: 'ellensburg' },
    { name: 'Kennewick Hanford Hotdogs', emoji: '🌭', region: 'tri_cities' },
    { name: 'Spokane Gonzaga Boosters', emoji: '🏀', region: 'spokane' },
    { name: 'Dayton Depot Deli', emoji: '🥪', region: 'walla_walla' },
    { name: 'Chelan Lakeside Lodge', emoji: '🏞️', region: 'wenatchee' }
  ];

  const D = () => (G.DATA || {});
  const dict = k => (D()[k] && typeof D()[k] === 'object') ? D()[k] : {};
  const now = () => U.now();
  const st = () => G.state;

  // ---------- helpers ----------
  function baseValue(key) {
    const info = (G.itemInfo ? G.itemInfo(key) : null) || {};
    return Math.max(1, Number(info.sellPrice) || 1);
  }
  function itemLabel(key) {
    const i = (G.itemInfo ? G.itemInfo(key) : null) || {};
    return ((i.emoji || '') + ' ' + (i.name || key)).trim();
  }

  // Everything the player could currently produce (key -> true).
  function producibleKeys() {
    const s = st(), lvl = s.level || 1, out = new Set();
    const crops = dict('crops'), animals = dict('animals'), buildings = dict('buildings');
    Object.keys(crops).forEach(k => { if (lvl >= (crops[k].level || 1)) out.add(k); });
    (s.animals || []).forEach(an => {
      const a = animals[an && an.type];
      if (a && a.product && lvl >= (a.level || 1)) out.add(a.product);
    });
    (s.buildings || []).forEach(b => {
      const def = buildings[b && b.type];
      if (!def || !Array.isArray(def.recipes)) return;
      def.recipes.forEach(r => { if (r && r.output && lvl >= (r.level || 1)) out.add(r.output); });
    });
    return Array.from(out);
  }
  function signature() { return producibleKeys().sort().join('|'); }

  // ---------- orders ----------
  function emptySlot(id, cooldownUntil) {
    return {
      id: id || U.uid(), customer: '', customerEmoji: '', region: '', items: {},
      coins: 0, xp: 0, createdAt: now(), expiresAt: null, cooldownUntil: cooldownUntil == null ? null : cooldownUntil
    };
  }
  function isEmptySlot(o) { return !o || !o.items || Object.keys(o.items).length === 0; }

  function pickCustomer(items) {
    const crops = dict('crops');
    const regions = {};
    Object.keys(items).forEach(k => { const r = crops[k] && crops[k].region; if (r) regions[r] = true; });
    const taken = new Set((st().orders || []).map(o => o && o.customer));
    const c = U.weightedPick(CUSTOMERS, cu => (regions[cu.region] ? 4 : 1) * (taken.has(cu.name) ? 0.25 : 1));
    return c || CUSTOMERS[0];
  }

  function buildOrder(existing) {
    const pool = producibleKeys();
    if (!pool.length) return null;
    const lvl = st().level || 1;
    // keys already requested by other open orders -> de-emphasise to add variety
    const used = {};
    (existing || []).forEach(o => { if (o && o.items) Object.keys(o.items).forEach(k => { used[k] = (used[k] || 0) + 1; }); });

    const want = Math.min(pool.length, U.weightedPick([1, 2, 3], n => (n === 1 ? 3 : n === 2 ? 3 : (lvl >= 3 ? 2 : 0.5))) || 1);
    const chosen = [];
    const left = pool.slice();
    while (chosen.length < want && left.length) {
      const k = U.weightedPick(left, key => 1 / (1 + (used[key] || 0) * 1.5));
      if (!k) break;
      chosen.push(k); left.splice(left.indexOf(k), 1);
    }
    if (!chosen.length) return null;

    const cap = U.clamp(2 + Math.floor(lvl / 2), 2, 10) * (chosen.length > 1 ? 0.75 : 1);
    const items = {};
    let sum = 0;
    chosen.forEach(k => {
      const price = baseValue(k);
      const f = U.clamp(25 / price, 0.3, 1.5);
      const maxQ = Math.max(1, Math.round(cap * f));
      const q = U.randInt(1, maxQ);
      items[k] = q; sum += price * q;
    });

    const express = Math.random() < EXPRESS_CHANCE;
    const mult = U.rand(1.25, 1.6) * (express ? 1.4 : 1);
    const coins = Math.max(1, Math.round(sum * mult));
    const xp = Math.max(1, Math.round(sum * mult * 0.2));
    const cust = pickCustomer(items);
    const t = now();
    return {
      id: U.uid(), customer: cust.name, customerEmoji: cust.emoji, region: cust.region,
      items, coins, xp, createdAt: t,
      expiresAt: express ? t + Math.round(U.rand(180, 300)) * 1000 : null,
      cooldownUntil: null, express
    };
  }

  function ensureOrdersArray() {
    const s = st();
    if (!Array.isArray(s.orders)) s.orders = [];
    s.orders = s.orders.filter(o => o && typeof o === 'object');
    while (s.orders.length < SLOTS) s.orders.push(emptySlot(null, now()));
    if (s.orders.length > SLOTS) s.orders.length = SLOTS;
  }

  // Fill slots that are empty and not cooling down. Returns number generated.
  function fillSlots() {
    ensureOrdersArray();
    const s = st(), t = now();
    let n = 0;
    s.orders.forEach((o, i) => {
      if (!isEmptySlot(o)) return;
      if (o.cooldownUntil && o.cooldownUntil > t) return;
      const neu = buildOrder(s.orders.filter((x, j) => j !== i && !isEmptySlot(x)));
      if (!neu) { o.cooldownUntil = t + 5000; return; } // nothing producible yet; retry shortly
      s.orders[i] = neu; n++;
      G.bus.emit('order:new', { order: neu, slot: i });
    });
    if (n) G.bus.emit('change');
    return n;
  }

  function findIdx(id) { return (st().orders || []).findIndex(o => o && o.id === id); }
  function isExpired(o) { return !!(o && o.expiresAt && now() >= o.expiresAt); }

  function canFulfill(id) {
    const o = (st().orders || []).find(x => x && x.id === id);
    if (!o || isEmptySlot(o) || o.cooldownUntil || isExpired(o)) return false;
    return G.hasItems(o.items);
  }

  function toCooldown(i, ms) {
    const o = st().orders[i];
    st().orders[i] = emptySlot(o && o.id, now() + ms);
  }

  function fulfill(id) {
    const i = findIdx(id);
    if (i < 0 || !canFulfill(id)) return false;
    const o = st().orders[i];
    if (!G.removeItems(o.items)) return false;
    const { coins, xp, customer } = o;
    st().stats.ordersDone = (st().stats.ordersDone || 0) + 1;
    toCooldown(i, FULFILL_COOLDOWN);           // before paying, so levelup refills see correct state
    G.addCoins(coins, 'order');
    G.bus.emit('order:done', { order: o, coins, xp, customer, slot: i });
    G.addXP(xp);
    G.bus.emit('change');
    return true;
  }

  function discard(id) {
    const i = findIdx(id);
    if (i < 0) return false;
    const o = st().orders[i];
    if (isEmptySlot(o) || o.cooldownUntil) return false;
    toCooldown(i, DISCARD_COOLDOWN);
    G.bus.emit('change');
    return true;
  }

  function ordersTick() {
    ensureOrdersArray();
    const t = now(); let changed = false;
    st().orders.forEach((o, i) => {
      if (o.cooldownUntil && t >= o.cooldownUntil) {
        st().orders[i] = emptySlot(o.id, null); changed = true; // ready for refill
      } else if (!o.cooldownUntil && o.expiresAt && t >= o.expiresAt) {
        if (G.toast) G.toast('The ' + (o.customer || 'express') + ' order expired.', 'info');
        st().orders[i] = emptySlot(o.id, null); changed = true;
      }
    });
    if (fillSlots() || changed) G.bus.emit('change');
  }

  // ---------- market ----------
  function marketKeys() { return Object.keys(dict('crops')).concat(Object.keys(dict('products'))); }
  function r3(v) { return Math.round(v * 1000) / 1000; }

  function ensureMarket() {
    const s = st();
    if (!s.market || typeof s.market !== 'object') s.market = {};
    marketKeys().forEach(k => {
      if (typeof s.market[k] !== 'number' || !isFinite(s.market[k])) s.market[k] = r3(U.rand(0.95, 1.05));
    });
    if (!s.flags) s.flags = {};
    if (!s.flags[PREV_KEY]) s.flags[PREV_KEY] = Object.assign({}, s.market);
  }

  function refreshMarket() {
    ensureMarket();
    const s = st();
    s.flags[PREV_KEY] = Object.assign({}, s.market);
    marketKeys().forEach(k => {
      const m = s.market[k];
      const next = m + (1 - m) * 0.2 + U.rand(-0.09, 0.09); // mean-reverting random walk
      s.market[k] = r3(U.clamp(next, MARKET_MIN, MARKET_MAX));
    });
    G.bus.emit('market:update', { market: s.market });
    G.bus.emit('change');
  }

  function trend(key) {
    const s = st();
    const prev = s.flags && s.flags[PREV_KEY];
    const cur = s.market && s.market[key];
    if (!prev || typeof prev[key] !== 'number' || typeof cur !== 'number') return 'flat';
    const d = cur - prev[key];
    return d > 0.015 ? 'up' : d < -0.015 ? 'down' : 'flat';
  }

  // ---------- shop ----------
  function shopCatalog() {
    const s = st(), lvl = s.level || 1, coins = s.coins || 0;
    const byLvl = (a, b) => (a.def.level || 1) - (b.def.level || 1) || (a.def.cost || 0) - (b.def.cost || 0);

    const animals = Object.keys(dict('animals')).map(key => {
      const def = dict('animals')[key];
      const count = (s.animals || []).filter(a => a && a.type === key).length;
      const max = def.max || 6;
      const locked = lvl < (def.level || 1);
      const maxed = count >= max;
      return { key, def, level: def.level || 1, locked, count, max, maxed, affordable: !locked && !maxed && coins >= (def.cost || 0) };
    }).sort(byLvl);

    const buildings = Object.keys(dict('buildings')).map(key => {
      const def = dict('buildings')[key];
      const owned = (s.buildings || []).some(b => b && b.type === key);
      const locked = lvl < (def.level || 1);
      return { key, def, level: def.level || 1, locked, owned, affordable: !locked && !owned && coins >= (def.cost || 0) };
    }).sort(byLvl);

    const owns = k => (s.ownedExpansions || []).includes(k);
    const expansions = Object.keys(dict('expansions')).map(key => {
      const def = dict('expansions')[key];
      const owned = owns(key);
      const reqMissing = !!(def.requires && !owns(def.requires));
      const locked = !owned && (lvl < (def.level || 1) || reqMissing);
      return {
        key, def, level: def.level || 1, locked, owned, requires: def.requires || null, reqMissing,
        affordable: !owned && !locked && coins >= (def.cost || 0)
      };
    }).sort(byLvl);

    const cost = G.plotCost ? G.plotCost() : 0;
    const available = (s.plots || []).length < (s.maxPlots || 0);
    return { animals, buildings, expansions, plot: { cost, available, affordable: available && coins >= cost } };
  }

  // ---------- level rewards ----------
  function unlocksAt(level) {
    const out = { crops: [], animals: [], buildings: [], expansions: [] };
    ['crops', 'animals', 'buildings', 'expansions'].forEach(cat => {
      const d = dict(cat);
      Object.keys(d).forEach(k => { if ((d[k].level || 1) === level) out[cat].push(k); });
    });
    return out;
  }

  function onLevelUp(p) {
    const level = (p && p.level) || st().level;
    const reward = 50 * level;
    G.addCoins(reward, 'levelup');
    const u = unlocksAt(level);
    const names = [];
    const add = (cat, list) => list.forEach(k => { const d = dict(cat)[k]; names.push(((d.emoji || '') + ' ' + (d.name || k)).trim()); });
    add('crops', u.crops); add('animals', u.animals); add('buildings', u.buildings); add('expansions', u.expansions);
    let msg = 'Level ' + level + '! +' + reward + ' coins';
    if (names.length) msg += '. Unlocked: ' + names.join(', ');
    G.toast(msg, 'good');
    fillSlots();
  }

  // ---------- daily ----------
  function onNewDay(cal) {
    refreshMarket();
    const day = (cal && cal.day) || G.calendar().day;
    if (day % 3 === 0) {
      const gift = 15 + 5 * (st().level || 1);
      G.addCoins(gift, 'dividend');
      G.toast('The co-op dividend arrived: +' + gift + ' coins', 'good');
    }
  }

  // ---------- wiring ----------
  let lastChange = 0, lastSig = null;
  function setup() {
    ensureMarket();
    ensureOrdersArray();
    lastSig = signature();
    fillSlots();
  }
  const safe = fn => function (p) { try { fn(p); } catch (e) { console.error('[economy]', e); } };

  G.bus.on('init', safe(setup));
  G.bus.on('state:reset', safe(setup));
  G.bus.on('tick', safe(ordersTick));
  G.bus.on('newday', safe(onNewDay));
  G.bus.on('levelup', safe(onLevelUp));
  G.bus.on('change', safe(() => {
    const t = now();
    if (t - lastChange < CHANGE_THROTTLE) return;
    lastChange = t;
    const sig = signature();
    if (sig !== lastSig) { lastSig = sig; fillSlots(); }
  }));

  G.Economy = {
    orders: () => { try { ensureOrdersArray(); } catch (e) { } return st().orders; },
    fulfill: safe2(fulfill), discard: safe2(discard), canFulfill: safe2(canFulfill),
    refreshMarket: safe2(refreshMarket), shopCatalog,
    trend, unlocksAt, producibleKeys,
    constants: { SLOTS, FULFILL_COOLDOWN, DISCARD_COOLDOWN }
  };
  function safe2(fn) { return function () { try { return fn.apply(null, arguments); } catch (e) { console.error('[economy]', e); return false; } }; }
})();
