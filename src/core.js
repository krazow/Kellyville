/* core.js — Kellyville engine. Owns state, time, inventory, actions.
   Load order: core.js -> data.js -> events.js -> economy.js -> ui.js -> boot (in core, on DOMContentLoaded) */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.DATA = G.DATA || { crops: {}, products: {}, animals: {}, buildings: {}, expansions: {} };

  // ---------- event bus ----------
  const handlers = {};
  G.bus = {
    on(name, fn) { (handlers[name] = handlers[name] || []).push(fn); },
    emit(name, payload) { (handlers[name] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error('[bus]', name, e); } }); }
  };

  // ---------- utils ----------
  G.util = {
    now: () => Date.now(),
    rand: (a, b) => a + Math.random() * (b - a),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: arr => arr[Math.floor(Math.random() * arr.length)],
    weightedPick(items, weightFn) {
      const total = items.reduce((s, i) => s + Math.max(0, weightFn(i)), 0);
      if (total <= 0) return null;
      let r = Math.random() * total;
      for (const i of items) { r -= Math.max(0, weightFn(i)); if (r <= 0) return i; }
      return items[items.length - 1];
    },
    fmtTime(sec) {
      sec = Math.max(0, Math.ceil(sec));
      if (sec < 60) return sec + 's';
      if (sec < 3600) return Math.floor(sec / 60) + 'm ' + (sec % 60 ? (sec % 60) + 's' : '');
      return Math.floor(sec / 3600) + 'h ' + Math.floor((sec % 3600) / 60) + 'm';
    },
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    uid: () => Math.random().toString(36).slice(2, 9)
  };

  // ---------- calendar ----------
  // One in-game day = DAY_SEC real seconds. 7 days per season. 4 seasons per year.
  G.DAY_SEC = 90;
  G.DAYS_PER_SEASON = 7;
  G.SEASONS = ['spring', 'summer', 'fall', 'winter'];
  G.SEASON_INFO = {
    spring: { name: 'Spring', emoji: '🌱' }, summer: { name: 'Summer', emoji: '☀️' },
    fall: { name: 'Fall', emoji: '🍂' }, winter: { name: 'Winter', emoji: '❄️' }
  };
  G.calendar = function () {
    const elapsed = (G.util.now() - G.state.startedAt) / 1000;
    const dayIndex = Math.floor(elapsed / G.DAY_SEC);
    const seasonIndex = Math.floor(dayIndex / G.DAYS_PER_SEASON) % 4;
    return {
      day: dayIndex + 1,
      dayOfSeason: (dayIndex % G.DAYS_PER_SEASON) + 1,
      season: G.SEASONS[seasonIndex],
      year: Math.floor(dayIndex / (G.DAYS_PER_SEASON * 4)) + 1,
      dayProgress: (elapsed % G.DAY_SEC) / G.DAY_SEC
    };
  };

  // ---------- levels ----------
  G.xpForLevel = lvl => Math.floor(20 * Math.pow(lvl, 1.6)); // xp needed to go from lvl -> lvl+1

  // ---------- state ----------
  const SAVE_KEY = 'palouse-harvest-v1';
  function newState() {
    const now = G.util.now();
    return {
      version: 1, startedAt: now, lastTick: now,
      farmName: 'Palouse Homestead',
      playerName: '',
      coins: 250, xp: 0, level: 1,
      barn: { wheat: 4, lentils: 2 }, barnCap: 60,
      plots: Array.from({ length: 6 }, (_, i) => ({ id: i, crop: null, plantedAt: 0, readyAt: 0, status: 'empty', yieldMult: 1 })),
      maxPlots: 24,
      animals: [], buildings: [],
      orders: [],            // owned by economy.js
      market: {},            // owned by economy.js: productKey -> price multiplier
      activeEvents: [],      // owned by events.js
      eventLog: [],          // owned by events.js: [{key, name, emoji, kind, at, text}]
      ownedExpansions: [],   // keys of G.DATA.expansions bought
      stats: { harvested: 0, ordersDone: 0, coinsEarned: 0, eventsSeen: 0 },
      flags: {}              // free-form, any module may namespace keys e.g. flags['events.lastRoll']
    };
  }
  G.save = function () { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.state)); } catch (e) { /* storage unavailable */ } };
  G.load = function () {
    try { const raw = localStorage.getItem(SAVE_KEY); if (raw) { const s = JSON.parse(raw); if (s && s.version === 1) return Object.assign(newState(), s); } } catch (e) { }
    return null;
  };
  G.reset = function () { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } G.state = newState(); G.bus.emit('state:reset'); G.bus.emit('change'); };
  G.state = newState();

  // ---------- modifiers (events.js supplies G.Events.mods; defaults are neutral) ----------
  // Every multiplier hook receives a key and returns a number (1 = no effect).
  G.mods = {
    growth(cropKey) { return (G.Events && G.Events.growthMult) ? G.Events.growthMult(cropKey) : 1; },   // >1 = slower growth (time multiplier)
    yield(cropKey) { return (G.Events && G.Events.yieldMult) ? G.Events.yieldMult(cropKey) : 1; },       // >1 = more harvest
    animal(animalKey) { return (G.Events && G.Events.animalMult) ? G.Events.animalMult(animalKey) : 1; }, // >1 = slower production
    price(productKey) {
      const ev = (G.Events && G.Events.priceMult) ? G.Events.priceMult(productKey) : 1;
      const mk = (G.state.market && G.state.market[productKey]) || 1;
      return ev * mk;
    },
    seasonYield(cropKey) {
      const c = G.DATA.crops[cropKey]; if (!c || !c.seasons) return 1;
      return c.seasons.includes(G.calendar().season) ? 1 : 0.5; // out-of-season planting halves yield
    }
  };

  // ---------- inventory ----------
  G.barnCount = () => Object.values(G.state.barn).reduce((a, b) => a + b, 0);
  G.barnFree = () => G.state.barnCap - G.barnCount();
  G.itemInfo = key => G.DATA.products[key] || G.DATA.crops[key] || { name: key, emoji: '📦', sellPrice: 1 };
  G.qty = key => G.state.barn[key] || 0;
  G.hasItems = req => Object.entries(req || {}).every(([k, q]) => G.qty(k) >= q);
  G.addItem = function (key, n) {
    const room = G.barnFree();
    const add = Math.min(n, room);
    if (add > 0) G.state.barn[key] = G.qty(key) + add;
    if (add < n) G.toast(`Barn full! Lost ${n - add} ${G.itemInfo(key).name}`, 'bad');
    G.bus.emit('change');
    return add;
  };
  G.removeItems = function (req) {
    if (!G.hasItems(req)) return false;
    for (const [k, q] of Object.entries(req)) { G.state.barn[k] -= q; if (G.state.barn[k] <= 0) delete G.state.barn[k]; }
    G.bus.emit('change');
    return true;
  };
  G.addCoins = function (n, reason) {
    G.state.coins = Math.max(0, Math.round(G.state.coins + n));
    if (n > 0) G.state.stats.coinsEarned += n;
    G.bus.emit('coins', { delta: n, reason }); G.bus.emit('change');
  };
  G.spend = function (n) { if (G.state.coins < n) { G.toast('Not enough coins', 'bad'); return false; } G.addCoins(-n, 'spend'); return true; };
  G.addXP = function (n) {
    G.state.xp += n;
    while (G.state.xp >= G.xpForLevel(G.state.level)) {
      G.state.xp -= G.xpForLevel(G.state.level); G.state.level++;
      G.bus.emit('levelup', { level: G.state.level });
    }
    G.bus.emit('change');
  };
  G.sellPrice = key => Math.max(1, Math.round((G.itemInfo(key).sellPrice || 1) * G.mods.price(key)));
  G.sell = function (key, n) {
    n = Math.min(n, G.qty(key)); if (n <= 0) return 0;
    const total = G.sellPrice(key) * n;
    G.removeItems({ [key]: n }); G.addCoins(total, 'sell');
    G.bus.emit('sold', { key, n, total });
    return total;
  };

  // ---------- player identity ----------
  G.playerName = () => G.state.playerName || 'Farmer';
  G.setPlayerName = function (name) {
    const clean = String(name || '').replace(/[<>&"]/g, '').trim().slice(0, 20);
    if (!clean) return false;
    G.state.playerName = clean;
    if (!G.state.farmName || G.state.farmName === 'Palouse Homestead') G.state.farmName = clean + "'s Farm";
    G.bus.emit('player:rename', { name: clean }); G.bus.emit('change'); G.save();
    return true;
  };
  G.setFarmName = function (name) {
    const clean = String(name || '').replace(/[<>&"]/g, '').trim().slice(0, 28);
    if (!clean) return false;
    G.state.farmName = clean; G.bus.emit('change'); G.save(); return true;
  };

  // ---------- notifications (UI overrides G.toast) ----------
  G.toast = G.toast || function (msg, kind) { console.log('[toast]', kind || '', msg); };

  // ---------- crops ----------
  G.plant = function (plotIdx, cropKey) {
    const p = G.state.plots[plotIdx], c = G.DATA.crops[cropKey];
    if (!p || !c || p.status !== 'empty') return false;
    if (G.state.level < (c.level || 1)) { G.toast(`${c.name} unlocks at level ${c.level}`, 'bad'); return false; }
    if (!G.spend(c.seedCost)) return false;
    const now = G.util.now();
    p.crop = cropKey; p.plantedAt = now; p.status = 'growing';
    p.readyAt = now + c.growSec * 1000 * G.mods.growth(cropKey);
    p.yieldMult = G.mods.seasonYield(cropKey);
    G.bus.emit('planted', { plotIdx, cropKey }); G.bus.emit('change');
    return true;
  };
  G.harvest = function (plotIdx) {
    const p = G.state.plots[plotIdx];
    if (!p || p.status !== 'ready') return 0;
    const c = G.DATA.crops[p.crop];
    const n = Math.max(1, Math.round(c.yield * p.yieldMult * G.mods.yield(p.crop)));
    const got = G.addItem(p.crop, n);
    if (got === 0) return 0;
    G.addXP(c.xp || 1); G.state.stats.harvested += got;
    const key = p.crop;
    p.crop = null; p.status = 'empty'; p.plantedAt = 0; p.readyAt = 0; p.yieldMult = 1;
    G.bus.emit('harvested', { plotIdx, cropKey: key, n: got }); G.bus.emit('change');
    return got;
  };
  // Used by events: damage growing/ready crops. fraction 0..1 of matching plots get hit.
  // mode: 'destroy' (plot -> withered), 'delay' (adds seconds), 'reduce' (yieldMult *= amount), 'boost' (yieldMult *= amount), 'ripen' (ready now)
  G.affectPlots = function ({ crops = 'all', fraction = 1, mode = 'reduce', amount = 0.5, includeReady = true } = {}) {
    const hit = [];
    G.state.plots.forEach((p, i) => {
      if (!(p.status === 'growing' || (includeReady && p.status === 'ready'))) return;
      if (crops !== 'all' && !crops.includes(p.crop)) return;
      if (Math.random() > fraction) return;
      if (mode === 'destroy') { p.status = 'withered'; }
      else if (mode === 'delay') { if (p.status === 'growing') p.readyAt += amount * 1000; }
      else if (mode === 'reduce' || mode === 'boost') { p.yieldMult *= amount; }
      else if (mode === 'ripen') { p.readyAt = G.util.now(); }
      hit.push(i);
    });
    G.bus.emit('change');
    return hit; // plot indexes affected
  };
  G.clearWithered = function (plotIdx) {
    const p = G.state.plots[plotIdx]; if (!p || p.status !== 'withered') return false;
    p.crop = null; p.status = 'empty'; p.yieldMult = 1; G.bus.emit('change'); return true;
  };
  G.plotCost = () => Math.round(100 * Math.pow(1.35, G.state.plots.length - 6));
  G.buyPlot = function () {
    if (G.state.plots.length >= G.state.maxPlots) { G.toast('No more land available', 'bad'); return false; }
    if (!G.spend(G.plotCost())) return false;
    G.state.plots.push({ id: G.state.plots.length, crop: null, plantedAt: 0, readyAt: 0, status: 'empty', yieldMult: 1 });
    G.bus.emit('change'); return true;
  };

  // ---------- animals ----------
  G.buyAnimal = function (type) {
    const a = G.DATA.animals[type]; if (!a) return false;
    if (G.state.level < (a.level || 1)) { G.toast(`${a.name} unlocks at level ${a.level}`, 'bad'); return false; }
    const owned = G.state.animals.filter(x => x.type === type).length;
    if (owned >= (a.max || 6)) { G.toast(`Max ${a.max || 6} ${a.name}`, 'bad'); return false; }
    if (!G.spend(a.cost)) return false;
    G.state.animals.push({ id: G.util.uid(), type, status: 'hungry', fedAt: 0, readyAt: 0 });
    G.bus.emit('change'); return true;
  };
  G.feedAnimal = function (idx) {
    const an = G.state.animals[idx]; if (!an || an.status !== 'hungry') return false;
    const a = G.DATA.animals[an.type];
    const need = { [a.feed]: a.feedQty || 1 };
    if (!G.removeItems(need)) { G.toast(`Need ${a.feedQty || 1} ${G.itemInfo(a.feed).name}`, 'bad'); return false; }
    const now = G.util.now();
    an.status = 'producing'; an.fedAt = now; an.readyAt = now + a.produceSec * 1000 * G.mods.animal(an.type);
    G.bus.emit('change'); return true;
  };
  G.collectAnimal = function (idx) {
    const an = G.state.animals[idx]; if (!an || an.status !== 'ready') return 0;
    const a = G.DATA.animals[an.type];
    const got = G.addItem(a.product, a.productQty || 1); if (!got) return 0;
    G.addXP(a.xp || 2); an.status = 'hungry';
    G.bus.emit('collected', { kind: 'animal', key: a.product, n: got }); G.bus.emit('change');
    return got;
  };

  // ---------- buildings ----------
  G.buyBuilding = function (type) {
    const b = G.DATA.buildings[type]; if (!b) return false;
    if (G.state.buildings.some(x => x.type === type)) { G.toast('Already built', 'bad'); return false; }
    if (G.state.level < (b.level || 1)) { G.toast(`${b.name} unlocks at level ${b.level}`, 'bad'); return false; }
    if (!G.spend(b.cost)) return false;
    G.state.buildings.push({ id: G.util.uid(), type, queue: [], maxQueue: 3 });
    G.bus.emit('change'); return true;
  };
  G.findRecipe = (type, recipeId) => (G.DATA.buildings[type].recipes || []).find(r => r.id === recipeId);
  G.startRecipe = function (bIdx, recipeId) {
    const b = G.state.buildings[bIdx]; if (!b) return false;
    const r = G.findRecipe(b.type, recipeId); if (!r) return false;
    if (G.state.level < (r.level || 1)) { G.toast(`Unlocks at level ${r.level}`, 'bad'); return false; }
    if (b.queue.length >= b.maxQueue) { G.toast('Queue full', 'bad'); return false; }
    if (!G.removeItems(r.inputs)) { G.toast('Missing ingredients', 'bad'); return false; }
    // jobs run sequentially: start after the last job in queue
    const now = G.util.now();
    const last = b.queue.length ? b.queue[b.queue.length - 1].readyAt : now;
    const start = Math.max(now, last);
    b.queue.push({ recipeId, startAt: start, readyAt: start + r.sec * 1000 });
    G.bus.emit('change'); return true;
  };
  // Collects all finished jobs at front of queue
  G.collectBuilding = function (bIdx) {
    const b = G.state.buildings[bIdx]; if (!b) return 0;
    const now = G.util.now(); let total = 0;
    while (b.queue.length && b.queue[0].readyAt <= now) {
      const r = G.findRecipe(b.type, b.queue[0].recipeId);
      const got = G.addItem(r.output, r.qty || 1); if (!got) break;
      G.addXP(r.xp || 3); total += got; b.queue.shift();
      G.bus.emit('collected', { kind: 'building', key: r.output, n: got });
    }
    G.bus.emit('change'); return total;
  };

  // ---------- expansions (barn upgrades, irrigation, etc. defined in DATA.expansions) ----------
  G.buyExpansion = function (key) {
    const x = G.DATA.expansions[key]; if (!x) return false;
    if (G.state.ownedExpansions.includes(key)) return false;
    if (G.state.level < (x.level || 1)) { G.toast(`Unlocks at level ${x.level}`, 'bad'); return false; }
    if (x.requires && !G.state.ownedExpansions.includes(x.requires)) { G.toast('Buy the previous upgrade first', 'bad'); return false; }
    if (!G.spend(x.cost)) return false;
    G.state.ownedExpansions.push(key);
    if (x.barnCap) G.state.barnCap += x.barnCap;
    if (x.maxPlots) G.state.maxPlots += x.maxPlots;
    G.bus.emit('expansion', { key }); G.bus.emit('change'); return true;
  };
  G.hasExpansion = key => G.state.ownedExpansions.includes(key);

  // ---------- tick ----------
  G.tick = function () {
    const now = G.util.now(); let changed = false;
    G.state.plots.forEach(p => { if (p.status === 'growing' && now >= p.readyAt) { p.status = 'ready'; changed = true; } });
    G.state.animals.forEach(a => { if (a.status === 'producing' && now >= a.readyAt) { a.status = 'ready'; changed = true; } });
    const cal = G.calendar();
    if (G._lastDay !== cal.day) { const prev = G._lastDay; G._lastDay = cal.day; if (prev !== undefined) G.bus.emit('newday', cal); }
    if (G._lastSeason !== cal.season) { const prev = G._lastSeason; G._lastSeason = cal.season; if (prev !== undefined) G.bus.emit('newseason', cal); }
    G.bus.emit('tick', { now, cal });   // events.js and economy.js hook here
    if (changed) G.bus.emit('change');
    G.state.lastTick = now;
  };

  // ---------- boot ----------
  G.boot = function () {
    const loaded = G.load(); if (loaded) G.state = loaded;
    G.bus.emit('init');            // modules set up (economy seeds orders, events restores, ui renders)
    G.tick();
    setInterval(G.tick, 500);
    setInterval(G.save, 4000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(); });
  };
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => G.boot());
})();
