/* restaurant.js — Kellyville farm-to-table restaurant (G.Restaurant, panel 'restaurant').
   Permit saga with the county planning board -> barn conversion -> prep dishes into the pass -> run dinner service.
   Everything is original, set in Eastern Washington. State lives in G.state.restaurant (created lazily by ensure()). */
(function () {
  'use strict';
  const G = window.G;
  if (!G) return;
  const U = G.util || {};
  const D = G.DATA = G.DATA || { crops: {}, products: {}, animals: {}, buildings: {}, expansions: {} };
  D.crops = D.crops || {}; D.products = D.products || {};
  const nowMs = () => (U.now ? U.now() : Date.now());
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Math.round(+n || 0).toLocaleString('en-US');
  const fmtT = sec => (U.fmtTime ? U.fmtTime(sec) : Math.ceil(sec) + 's');
  const pretty = k => String(k).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const tmA = (type, start, end, extra) => `data-tm="${type}" data-start="${Math.round(start || 0)}" data-end="${Math.round(end || 0)}"${extra || ''}`;

  // ---------- tunables ----------
  const UNLOCK_LEVEL = 6;
  const PERMIT_FEE = 150, GRAVEL_COST = 200, BUILD_COST = 600;
  const HEARING_DELAY_MS = 45 * 1000;
  const INSPECT_MS = 180 * 1000;       // septic + fire inspection
  const BUILD_MS = 240 * 1000;         // barn conversion
  const SERVICE_MS = 150 * 1000;       // dinner service window
  const COOLDOWN_MS = 120 * 1000;
  const PORTIONS = 3;                  // portions per cook
  const WAGES = { cook: 80, server: 100, host: 60 };
  const STAGES = ['none', 'permit', 'building', 'open'];

  // ---------- dishes ----------
  const FALLBACK_ITEMS = {
    ground_beef: { name: 'Ground Beef', emoji: '🥩' }, ribeye: { name: 'Ribeye', emoji: '🥩' }, brisket: { name: 'Brisket', emoji: '🍖' }
  };
  const BEEF = ['ground_beef', 'ribeye', 'brisket'];
  const WINEY = ['wine', 'rose', 'ipa'];
  const DISHES = {
    hummus_board: { id: 'hummus_board', name: 'Hummus Board', emoji: '🥙', inputs: { hummus: 1, bread: 1, mint: 1 }, price: 190, cookSec: 25, xp: 14, level: 6 },
    lentil_burger: { id: 'lentil_burger', name: 'Palouse Lentil Burger', emoji: '🍔', inputs: { lentils: 2, bread: 1, sweet_onions: 1 }, price: 120, cookSec: 30, xp: 16, level: 7 },
    sweet_rings: { id: 'sweet_rings', name: 'Sweet Onion Rings', emoji: '🧅', inputs: { sweet_onions: 2, flour: 1, eggs: 1 }, price: 100, cookSec: 25, xp: 14, level: 7 },
    mint_lemonade: { id: 'mint_lemonade', name: 'Mint Lemonade', emoji: '🍹', inputs: { mint: 1, honey: 1 }, price: 80, cookSec: 15, xp: 10, level: 8 },
    smash_burger: { id: 'smash_burger', name: 'Smash Burger', emoji: '🍔', inputs: { ground_beef: 1, bread: 1, sweet_onions: 1, cheese: 1 }, price: 230, cookSec: 35, xp: 22, level: 8 },
    cherry_cobbler: { id: 'cherry_cobbler', name: 'Cherry Cobbler', emoji: '🍒', inputs: { cherries: 2, flour: 1, butter: 1 }, price: 200, cookSec: 45, xp: 24, level: 9 },
    asparagus_risotto: { id: 'asparagus_risotto', name: 'Asparagus Risotto', emoji: '🍚', inputs: { asparagus: 2, butter: 1, milk: 1 }, price: 270, cookSec: 50, xp: 26, level: 9 },
    ribeye_spuds: { id: 'ribeye_spuds', name: 'Ribeye & Spuds', emoji: '🥩', inputs: { ribeye: 1, potatoes: 2, butter: 1 }, price: 330, cookSec: 55, xp: 30, level: 10 },
    brisket_plate: { id: 'brisket_plate', name: 'Smoked Brisket Plate', emoji: '🍖', inputs: { brisket: 1, bread: 1, onion_rings: 1 }, price: 380, cookSec: 70, xp: 36, level: 10 },
    pie_a_la_mode: { id: 'pie_a_la_mode', name: 'Apple Pie à la Mode', emoji: '🥧', inputs: { apple_pie: 1, milk: 1 }, price: 250, cookSec: 30, xp: 24, level: 12 },
    hop_chicken: { id: 'hop_chicken', name: 'Hop-Brined Fried Chicken', emoji: '🍗', inputs: { eggs: 2, flour: 2, ipa: 1 }, price: 280, cookSec: 60, xp: 32, level: 14 },
    wine_cheese_board: { id: 'wine_cheese_board', name: 'Wine & Cheese Board', emoji: '🧀', inputs: { wine: 1, cheese: 1, bread: 1 }, price: 480, cookSec: 40, xp: 40, level: 16 }
  };
  Object.keys(DISHES).forEach(k => {
    const d = DISHES[k];
    d.desc = d.desc || 'Farm-to-table at the old lambing barn.';
    D.products[k] = D.products[k] || { name: d.name, emoji: d.emoji, sellPrice: d.price, desc: 'A plated dish from your barn restaurant.' };
  });
  D.dishes = Object.assign(D.dishes || {}, DISHES);
  const dishList = () => Object.keys(DISHES).map(k => D.dishes[k] || DISHES[k]).filter(Boolean);
  const dishOf = id => (D.dishes && D.dishes[id]) || null;

  function itemInfo(k) { return D.products[k] || D.crops[k] || FALLBACK_ITEMS[k] || { name: pretty(k), emoji: '📦' }; }
  const known = k => !!(D.products[k] || D.crops[k]);
  const isBeef = d => Object.keys(d.inputs).some(k => BEEF.indexOf(k) >= 0);
  const isWiney = d => Object.keys(d.inputs).some(k => WINEY.indexOf(k) >= 0);
  const farmCount = d => Object.keys(d.inputs).filter(known).length;

  // ---------- upgrades / staff ----------
  const UPGRADES = {
    tables: { name: 'Extra table', emoji: '🪑', max: 6, level: 6, cost: n => Math.round(180 * Math.pow(1.45, n)), desc: n => 'Seats one more party. ' + (4 + n) + ' tables now, 10 max.' },
    kitchen: { name: 'Bigger kitchen', emoji: '🍳', max: 3, level: 7, cost: n => Math.round(400 * Math.pow(1.8, n)), desc: n => '+1 stove and a roomier pass. ' + (3 + n) + ' stoves now.' },
    menuboard: { name: 'Chalkboard menu', emoji: '📋', max: 4, level: 8, cost: n => Math.round(250 * Math.pow(1.7, n)), desc: n => 'One more dish on tonight\'s menu. ' + (4 + n) + ' slots now, 8 max.' },
    lights: { name: 'Patio string lights', emoji: '✨', max: 1, level: 6, cost: () => 500, desc: () => 'Twinkly patio. More guests and bigger tips.' },
    grill: { name: 'Wood-fired grill', emoji: '🔥', max: 1, level: 9, cost: () => 900, desc: () => 'Beef dishes sell for +20%.' },
    winelist: { name: 'Wine list', emoji: '🍷', max: 1, level: 10, cost: () => 1200, desc: () => 'Wine, rosé and IPA dishes sell for +15%.' },
    parking: { name: 'Parking', emoji: '🅿️', max: 2, level: 6, cost: n => Math.round(400 * Math.pow(2, n)), desc: n => 'A bigger gravel lot. More guests find you.' }
  };
  const STAFF = {
    cook: { name: 'Line cook', emoji: '👨‍🍳', desc: 'Dishes cook 30% faster.' },
    server: { name: 'Server', emoji: '🤵', desc: 'Quicker table turnover and +50% tips.' },
    host: { name: 'Host', emoji: '🛎️', desc: '+25% more guests walk in.' }
  };

  // ---------- state ----------
  function fill(o, defs) { Object.keys(defs).forEach(k => { if (o[k] == null || typeof o[k] !== typeof defs[k]) o[k] = defs[k]; }); return o; }
  function ensure() {
    const s = G.state; if (!s) return null;
    let r = s.restaurant;
    if (!r || typeof r !== 'object') r = s.restaurant = {};
    fill(r, { stage: 'none', rating: 3, farmOnly: false, cooldownUntil: 0, noiseUntil: 0, tab: 'service' });
    if (STAGES.indexOf(r.stage) < 0) r.stage = 'none';
    r.rating = clamp(+r.rating || 3, 1, 5);
    if (!r.permit || typeof r.permit !== 'object') r.permit = {};
    fill(r.permit, { step: 'none', delayUntil: 0, inspectStart: 0, inspectEnd: 0, buildStart: 0, buildEnd: 0, choice: '' });
    if (!r.up || typeof r.up !== 'object') r.up = {};
    Object.keys(UPGRADES).forEach(k => { r.up[k] = clamp(Math.floor(+r.up[k] || 0), 0, UPGRADES[k].max); });
    if (!r.staff || typeof r.staff !== 'object') r.staff = {};
    Object.keys(STAFF).forEach(k => { r.staff[k] = !!r.staff[k]; });
    if (!Array.isArray(r.menu)) r.menu = [];
    r.menu = r.menu.filter((id, i) => dishOf(id) && r.menu.indexOf(id) === i);
    if (!r.pass || typeof r.pass !== 'object') r.pass = {};
    Object.keys(r.pass).forEach(k => { if (!dishOf(k) || !(r.pass[k] > 0)) delete r.pass[k]; });
    if (!Array.isArray(r.queue)) r.queue = [];
    r.queue = r.queue.filter(j => j && dishOf(j.id) && j.readyAt);
    if (!r.stats || typeof r.stats !== 'object') r.stats = {};
    fill(r.stats, { covers: 0, revenue: 0, tips: 0, services: 0 });
    if (r.service && (typeof r.service !== 'object' || !Array.isArray(r.service.guests))) r.service = null;
    if (!r.service) r.service = null;
    if (r.lastSummary && typeof r.lastSummary !== 'object') r.lastSummary = null;
    return r;
  }
  const R_ = () => ensure();
  const tablesCount = () => { const r = R_(); return r ? 4 + r.up.tables : 0; };
  const stoves = () => { const r = R_(); return r ? 3 + r.up.kitchen : 3; };
  const menuCap = () => { const r = R_(); return r ? 4 + r.up.menuboard : 4; };
  const passCap = () => { const r = R_(); return r ? 12 + 4 * r.up.kitchen : 12; };
  function addRating(delta) { const r = R_(); if (!r) return 0; r.rating = clamp(r.rating + delta, 1, 5); return r.rating; }

  // ---------- pricing ----------
  function priceParts(d) {
    const r = R_(); const parts = [];
    if (r && r.up.grill && isBeef(d)) parts.push(['🔥 Grill', 0.20]);
    if (r && r.up.winelist && isWiney(d)) parts.push(['🍷 Wine list', 0.15]);
    if (r && r.farmOnly && farmCount(d) >= 1) parts.push(['🌾 Farm-sourced', 0.10]);
    return parts;
  }
  function dishPrice(d) {
    if (typeof d === 'string') d = dishOf(d); if (!d) return 0;
    let m = 1; priceParts(d).forEach(p => { m += p[1]; });
    let ev = 1; try { if (G.mods && G.mods.price) ev = G.mods.price(d.id) || 1; } catch (e) { ev = 1; }
    return Math.max(1, Math.round(d.price * m * ev));
  }
  function featureActive() {
    try { return !!(G.Events && G.Events.active && G.Events.active().some(e => e && e.key === 'restaurant_feature' && (e.pending || e.endAt > nowMs()))); } catch (e) { return false; }
  }
  const bump = () => { try { G.bus.emit('change'); } catch (e) { /* ignore */ } };
  const say = (msg, kind) => { try { G.toast(msg, kind || 'info'); } catch (e) { /* ignore */ } };
  const modal = o => { try { if (G.showModal) G.showModal(o); else say((o.title || '') + ' ' + (o.text || ''), 'info'); } catch (e) { console.error('[restaurant] modal', e); } };

  // ---------- public queries ----------
  const stage = () => { const r = R_(); return r ? r.stage : 'none'; };
  const isServing = () => { const r = R_(); return !!(r && r.service); };
  const unlocked = () => ((G.state && G.state.level) || 1) >= UNLOCK_LEVEL;

  // ---------- permit saga ----------
  const PEOPLE = {
    darlene: ['⚖️', 'Commissioner Darlene'],
    clip: ['📋', 'The neighbor with the clipboard'],
    you: ['🧑‍🌾', 'You']
  };
  function bubble(who, text) {
    const p = PEOPLE[who] || ['💬', who];
    return `<div class="rs-say ${who === 'darlene' ? 'd' : who === 'you' ? 'y' : 'n'}"><b>${p[0]} ${esc(p[1])}</b><p>${esc(text)}</p></div>`;
  }
  function applyPermit() {
    const r = R_(); if (!r || r.stage !== 'none') return false;
    if (!unlocked()) { say('The planning board only talks to farmers of level ' + UNLOCK_LEVEL + '+', 'bad'); return false; }
    if (!G.spend(PERMIT_FEE)) return false;
    r.stage = 'permit'; r.permit.step = 'hearing';
    modal({ emoji: '🏛️', title: 'Application filed!',
      html: bubble('darlene', 'A conditional-use permit for a restaurant in a lambing barn. In my 31 years, I have seen it all. This is now also in the "all."') +
        bubble('darlene', 'Pay the fee at the window, then come to the public hearing. Bring snacks. The neighbors will have opinions.'),
      buttons: [{ label: 'To the hearing room', cls: 'btn-gold' }] });
    bump(); return true;
  }
  function openHearing() {
    const r = R_(); if (!r || r.stage !== 'permit' || r.permit.step !== 'hearing') return false;
    if (r.permit.delayUntil > nowMs()) { say('The hearing is adjourned for ' + fmtT((r.permit.delayUntil - nowMs()) / 1000), 'bad'); return false; }
    modal({ emoji: '🏛️', title: 'Public Hearing',
      html: bubble('clip', 'I counted fourteen cars on our road. FOURTEEN. It is a gravel road built for one tractor and a very polite goat.') +
        bubble('darlene', 'Noted, Marlene. Farmer, the floor is yours. How do you respond?'),
      buttons: [
        { label: 'Promise a gravel parking lot (🪙 ' + GRAVEL_COST + ')', cls: 'btn-gold', onClick: () => resolveHearing('gravel') },
        { label: '"Only food grown on THIS farm"', cls: 'btn-green', onClick: () => resolveHearing('farm') },
        { label: 'Argue with the clipboard', cls: 'btn-red', onClick: () => resolveHearing('argue') }
      ] });
    return true;
  }
  function startInspection() {
    const r = R_(), t = nowMs();
    r.permit.step = 'inspection'; r.permit.inspectStart = t; r.permit.inspectEnd = t + INSPECT_MS;
  }
  function resolveHearing(choice) {
    const r = R_(); if (!r || r.stage !== 'permit' || r.permit.step !== 'hearing') return false;
    if (choice === 'gravel') {
      if (!G.spend(GRAVEL_COST)) return false;
      r.permit.choice = 'gravel'; r.up.parking = Math.max(1, r.up.parking);
      startInspection();
      modal({ emoji: '🪨', title: 'Gravel, gravel everywhere', kind: 'good',
        html: bubble('clip', 'A... parking lot. With actual lines? Fine. I will allow it, but I will be counting.') +
          bubble('darlene', 'Permit approved, pending a septic and fire inspection. Inspectors are on the way; the septic guy brought a really long stick.'),
        buttons: [{ label: 'Bring on the inspectors', cls: 'btn-gold' }] });
    } else if (choice === 'farm') {
      r.permit.choice = 'farm'; r.farmOnly = true;
      startInspection();
      modal({ emoji: '🌾', title: 'Farm-to-table, for real', kind: 'good',
        html: bubble('you', 'Everything on the menu will be built from stuff grown right here. If it did not come out of my dirt, it does not go on the plate.') +
          bubble('clip', 'So... no trucks of strange food?') + bubble('darlene', 'Motion carries. Farm-sourced dishes will get a little something extra. Now, the inspection.'),
        buttons: [{ label: 'Bring on the inspectors', cls: 'btn-gold' }] });
    } else if (choice === 'argue') {
      r.permit.choice = 'argue';
      if (Math.random() < 0.5) {
        startInspection();
        modal({ emoji: '😤', title: 'You won the shouting match', kind: 'good',
          html: bubble('clip', 'I... did not have a rebuttal prepared for "it is a BARN, Marlene, barns are LOUD already".') +
            bubble('darlene', 'Approved, mostly because I am hungry. Septic and fire inspection next.'),
          buttons: [{ label: 'Smugly proceed', cls: 'btn-gold' }] });
      } else {
        r.permit.delayUntil = nowMs() + HEARING_DELAY_MS;
        modal({ emoji: '🔔', title: 'Hearing adjourned', kind: 'bad',
          html: bubble('darlene', 'Order. ORDER. Farmer, you called the clipboard a "regulation-flavored bagel". We are adjourned until everyone cools off.') +
            bubble('clip', 'I accept your apology in advance.'),
          buttons: [{ label: 'Cool off', cls: 'btn-gray' }] });
      }
    } else return false;
    bump(); return true;
  }
  function startReno() {
    const r = R_(); if (!r || r.stage !== 'permit' || r.permit.step !== 'approved') return false;
    if (!G.spend(BUILD_COST)) return false;
    const t = nowMs();
    r.stage = 'building'; r.permit.step = 'built'; r.permit.buildStart = t; r.permit.buildEnd = t + BUILD_MS;
    modal({ emoji: '🔨', title: 'Barn conversion underway',
      html: bubble('darlene', 'Inspection passed. Barely. The septic guy said "huh" twice, which is the best review he has ever given.') +
        bubble('you', 'Time to swap the lambing pens for a pass, a stove, and a very small chalkboard.'),
      buttons: [{ label: 'Grab a hammer', cls: 'btn-gold' }] });
    bump(); return true;
  }
  function grandOpening() {
    const r = R_(); if (!r) return;
    r.stage = 'open'; r.permit.step = 'built'; r.tab = tab = 'menu';
    modal({ emoji: '🎉', title: 'Grand Opening!', kind: 'good', confetti: true,
      html: bubble('darlene', 'By the power vested in me by Whitman County, I declare this barn... a restaurant. Please validate my parking.') +
        bubble('clip', 'I will be reviewing the lentil burger. Strictly for... compliance.'),
      buttons: [{ label: 'Open the barn doors', cls: 'btn-gold', onClick: () => { try { G.openPanel('restaurant'); } catch (e) { /* ignore */ } } }] });
    say('🍽️ The Lambing Barn is open for business!', 'good');
    bump();
  }

  // ---------- kitchen ----------
  function missing(d) { return Object.entries(d.inputs).filter(([k, q]) => !known(k) || G.qty(k) < q).map(([k]) => k); }
  function cookBlock(d) {
    const r = R_();
    if (!r || r.stage !== 'open') return 'The restaurant is not open yet';
    if ((G.state.level || 1) < d.level) return d.name + ' unlocks at level ' + d.level;
    if (r.queue.length >= stoves()) return 'All stoves are busy';
    const pend = r.queue.filter(j => j.id === d.id).length;
    if ((r.pass[d.id] || 0) + pend * PORTIONS >= passCap()) return 'The pass is full of ' + d.name;
    if (missing(d).length) return 'Need ingredients: ' + missing(d).map(k => itemInfo(k).name).join(', ');
    return '';
  }
  function cook(id) {
    const r = R_(), d = dishOf(id); if (!r || !d) return false;
    const why = cookBlock(d); if (why) { say(why, 'bad'); return false; }
    if (!G.removeItems(d.inputs)) return false;
    const t = nowMs(), sec = d.cookSec * (r.staff.cook ? 0.7 : 1);
    r.queue.push({ id, startAt: t, readyAt: t + sec * 1000 });
    bump(); return true;
  }
  function cancelCook(i) {
    const r = R_(); const j = r && r.queue[i]; if (!j) return false;
    const d = dishOf(j.id); r.queue.splice(i, 1);
    if (d) Object.entries(d.inputs).forEach(([k, q]) => { try { G.addItem(k, q); } catch (e) { /* ignore */ } });
    bump(); return true;
  }
  function collectCooked(t) {
    const r = R_(); if (!r || !r.queue.length) return;
    let changed = false;
    for (let i = r.queue.length - 1; i >= 0; i--) {
      const j = r.queue[i]; if (j.readyAt > t) continue;
      r.queue.splice(i, 1); const d = dishOf(j.id); if (!d) continue;
      r.pass[d.id] = Math.min(passCap(), (r.pass[d.id] || 0) + PORTIONS);
      try { G.addXP(d.xp); } catch (e) { /* ignore */ }
      say(d.emoji + ' ' + d.name + ' is ready on the pass (×' + PORTIONS + ')', 'good');
      changed = true;
    }
    if (changed) bump();
  }

  // ---------- menu ----------
  function toggleMenu(id) {
    const r = R_(), d = dishOf(id); if (!r || !d) return false;
    const i = r.menu.indexOf(id);
    if (i >= 0) {
      if (r.service) { say('Menu is locked while service is running', 'bad'); return false; }
      r.menu.splice(i, 1); bump(); return true;
    }
    if (r.service) { say('Menu is locked while service is running', 'bad'); return false; }
    if ((G.state.level || 1) < d.level) { say(d.name + ' unlocks at level ' + d.level, 'bad'); return false; }
    if (r.farmOnly && farmCount(d) < 1) { say('Farm rule: every dish needs one of your own products', 'bad'); return false; }
    if (r.menu.length >= menuCap()) { say('Menu is full (' + menuCap() + '). Upgrade the chalkboard for more.', 'bad'); return false; }
    r.menu.push(id); bump(); return true;
  }

  // ---------- upgrades & staff ----------
  function buyUpgrade(k) {
    const r = R_(), u = UPGRADES[k]; if (!r || !u || r.stage !== 'open') return false;
    const n = r.up[k];
    if (n >= u.max) { say('Already maxed out', 'bad'); return false; }
    if ((G.state.level || 1) < u.level) { say(u.name + ' unlocks at level ' + u.level, 'bad'); return false; }
    if (!G.spend(u.cost(n))) return false;
    r.up[k] = n + 1; say(u.emoji + ' ' + u.name + ' installed!', 'good'); bump(); return true;
  }
  function toggleStaff(k) {
    const r = R_(); if (!r || !STAFF[k] || r.stage !== 'open') return false;
    if (r.service) { say('Staff changes after service', 'bad'); return false; }
    r.staff[k] = !r.staff[k]; say(STAFF[k].emoji + ' ' + STAFF[k].name + (r.staff[k] ? ' hired' : ' let go'), 'info'); bump(); return true;
  }
  const wageTotal = () => { const r = R_(); return r ? Object.keys(STAFF).reduce((s, k) => s + (r.staff[k] ? WAGES[k] : 0), 0) : 0; };

  // ---------- service ----------
  const GUESTS = ['🧑', '👩', '👨', '🧓', '👵', '👴', '🧔', '👱‍♀️', '👩‍🦰', '🧑‍🦱', '👩‍🦳', '🤠'];
  const mult = () => {
    const r = R_();
    let m = (0.7 + 0.18 * r.rating) * (1 + 0.25 * (r.staff.host ? 1 : 0)) * (1 + 0.12 * r.up.parking) * (1 + 0.1 * r.up.lights);
    if (featureActive()) m *= 1.4;
    if (r.noiseUntil > nowMs()) m *= 0.85;
    return m;
  };
  const gap = () => 9500 / Math.max(0.3, mult()) * rnd(0.6, 1.4);
  function startService() {
    const r = R_();
    if (!r || r.stage !== 'open') return false;
    if (r.service) return false;
    const t = nowMs();
    if (r.cooldownUntil > t) { say('The kitchen is resting for ' + fmtT((r.cooldownUntil - t) / 1000), 'bad'); return false; }
    if (!r.menu.length) { say('Put a dish on tonight\'s menu first', 'bad'); return false; }
    if (!r.menu.some(id => (r.pass[id] || 0) > 0)) { say('Prep some dishes onto the pass first', 'bad'); return false; }
    r.service = { startAt: t, endAt: t + SERVICE_MS, nextArrival: t + 1500, guests: [], nextId: 1, covers: 0, revenue: 0, tips: 0, unhappy: 0, away: 0, orders: {}, ratingStart: r.rating };
    say('🔔 Dinner service is open!', 'good'); bump(); return true;
  }
  function pickDish(r) {
    const stocked = r.menu.filter(id => (r.pass[id] || 0) > 0);
    if (stocked.length && Math.random() < 0.75) return U.pick ? U.pick(stocked) : stocked[0];
    return r.menu[Math.floor(Math.random() * r.menu.length)];
  }
  function occupied(sv) {
    const o = {}; sv.guests.forEach(g => { if (g.phase !== 'leaving' && g.table != null) o[g.table] = true; }); return o;
  }
  function spawn(r, sv, at) {
    const occ = occupied(sv), n = tablesCount(); let table = -1;
    const free = []; for (let i = 0; i < n; i++) if (!occ[i]) free.push(i);
    if (!free.length) { sv.away++; return; }
    table = free[Math.floor(Math.random() * free.length)];
    sv.guests.push({ id: sv.nextId++, emoji: GUESTS[Math.floor(Math.random() * GUESTS.length)], phase: 'arriving', pStart: at, pEnd: at + 3000, table, dish: null, serve: false, mood: 'meh' });
  }
  function advance(r, sv, g) {
    const srv = r.staff.server;
    if (g.phase === 'arriving') {
      g.phase = 'seated'; g.pStart = g.pEnd; g.pEnd = g.pStart + rnd(4000, 7000) * (srv ? 0.6 : 1);
      g.dish = pickDish(r);
      if (g.dish && (r.pass[g.dish] || 0) > 0) { r.pass[g.dish]--; if (r.pass[g.dish] <= 0) delete r.pass[g.dish]; g.serve = true; }
    } else if (g.phase === 'seated') {
      g.pStart = g.pEnd;
      if (g.serve) { g.phase = 'eating'; g.pEnd = g.pStart + rnd(10000, 16000) * (srv ? 0.85 : 1); g.mood = 'happy'; }
      else {
        g.phase = 'leaving'; g.pEnd = g.pStart + 2500; g.mood = 'sad'; sv.unhappy++; g.sad = true;
        const dn = dishOf(g.dish);
        addRating(-0.07); say('😞 A guest left: no ' + (dn ? dn.name : 'dinner') + ' on the pass!', 'bad');
      }
    } else if (g.phase === 'eating') {
      g.phase = 'leaving'; g.pStart = g.pEnd; g.pEnd = g.pStart + 2500;
      const d = dishOf(g.dish); if (d) {
        const price = dishPrice(d);
        const tip = Math.round(price * rnd(0.05, 0.2) * (srv ? 1.5 : 1) * (1 + 0.1 * r.up.lights) * (0.8 + 0.1 * r.rating));
        const total = price + tip;
        try { G.addCoins(total, 'restaurant'); } catch (e) { /* ignore */ }
        try { G.addXP(Math.max(1, Math.round(price / 60))); } catch (e) { /* ignore */ }
        sv.covers++; sv.revenue += price; sv.tips += tip; sv.orders[d.id] = (sv.orders[d.id] || 0) + 1;
        r.stats.covers++; r.stats.revenue += price; r.stats.tips += tip;
        addRating(r.farmOnly ? 0.015 : 0.01); g.paid = total;
        try { G.bus.emit('restaurant:served', { dish: d.id, coins: price, tip, total }); } catch (e) { /* ignore */ }
      }
    } else if (g.phase === 'leaving') { g.done = true; }
  }
  function step(t) {
    const r = R_(); if (!r) return;
    t = t == null ? nowMs() : t;
    try {
      if (r.stage === 'permit' && r.permit.step === 'inspection' && t >= r.permit.inspectEnd) {
        r.permit.step = 'approved'; say('⚖️ Darlene: "You passed. The septic guy is crying. Happy tears."', 'good'); bump();
      }
      if (r.stage === 'building' && t >= r.permit.buildEnd) grandOpening();
      if (r.stage !== 'open') return;
      if (r.queue.length) collectCooked(t);
      const sv = r.service; if (!sv) return;
      let guard = 0;
      while (sv.nextArrival <= t && sv.nextArrival < sv.endAt - 12000 && guard++ < 40) { spawn(r, sv, sv.nextArrival); sv.nextArrival += gap(); }
      sv.guests.forEach(g => { let n = 0; while (!g.done && g.pEnd <= t && n++ < 6) advance(r, sv, g); });
      sv.guests = sv.guests.filter(g => !g.done);
      if (t >= sv.endAt && (!sv.guests.length || t > sv.endAt + 60000)) finishService(t);
    } catch (e) { console.error('[restaurant] step', e); }
  }
  const QUOTES = {
    great: [
      ['The {dish} alone is worth the drive from Spokane. I wept into my napkin.', 'Spokane food critic'],
      ['A barn that cooks like a cathedral. Order everything, then apologize to your diet.', 'Spokane food critic'],
      ['Best meal I have had in Whitman County, and I have eaten at every church potluck.', 'Earl from Rosalia'],
      ['The {dish} was so good I forgot to complain about the parking.', 'Marlene, neighbor with a clipboard']
    ],
    ok: [
      ['Honest food from honest dirt. The {dish} showed promise; the service showed up.', 'Spokane food critic'],
      ['Solid. I would eat here again, perhaps after a nap.', 'Bev from Colfax'],
      ['Charming barn, decent {dish}. Bring a sweater; the lambs left a draft.', 'Dale from Pullman']
    ],
    bad: [
      ['They ran out of things. In a restaurant. I am still processing it.', 'Spokane food critic'],
      ['The barn smells great but my stomach is still waiting.', 'Earl from Rosalia'],
      ['Two stars for effort, one for the goat that greeted us.', 'Bev from Colfax']
    ]
  };
  function finishService(t) {
    const r = R_(), sv = r && r.service; if (!sv) return null;
    const wages = Math.min(wageTotal(), (G.state.coins || 0));
    if (wages > 0) { try { G.addCoins(-wages, 'wages'); } catch (e) { /* ignore */ } }
    if (sv.covers >= 8 && sv.unhappy === 0) addRating(0.05);
    const top = Object.keys(sv.orders).sort((a, b) => sv.orders[b] - sv.orders[a])[0];
    const dn = (top && dishOf(top)) ? dishOf(top).name : 'lentil burger';
    const sat = sv.covers / Math.max(1, sv.covers + sv.unhappy);
    const tone = (sv.covers === 0 || sat < 0.6) ? 'bad' : (sat > 0.9 && r.rating >= 3.6) ? 'great' : 'ok';
    const pool = QUOTES[tone], q = pool[Math.floor(Math.random() * pool.length)];
    const sum = { covers: sv.covers, revenue: sv.revenue, tips: sv.tips, wages, net: sv.revenue + sv.tips - wages, unhappy: sv.unhappy, away: sv.away,
      ratingBefore: sv.ratingStart, ratingAfter: r.rating, ratingChange: r.rating - sv.ratingStart, quote: q[0].replace('{dish}', dn), who: q[1], tone, at: t };
    r.lastSummary = sum; r.service = null; r.cooldownUntil = t + COOLDOWN_MS; r.stats.services++;
    try { G.bus.emit('restaurant:review', { rating: r.rating, change: sum.ratingChange, quote: sum.quote, who: sum.who, summary: sum }); } catch (e) { /* ignore */ }
    showSummary(sum); bump();
    return sum;
  }
  function showSummary(sum) {
    sum = sum || (R_() && R_().lastSummary); if (!sum) return;
    const ch = sum.ratingChange, arrow = ch > 0.004 ? '▲' : ch < -0.004 ? '▼' : '•';
    const html = `<div class="rs-sum"><div><b>🍽️ ${fmt(sum.covers)}</b><small>Covers</small></div><div><b>🪙 ${fmt(sum.revenue)}</b><small>Revenue</small></div><div><b>💵 ${fmt(sum.tips)}</b><small>Tips</small></div><div><b>🧾 −${fmt(sum.wages)}</b><small>Wages</small></div></div>
      <div class="rs-net ${sum.net >= 0 ? 'up' : 'dn'}">Net tonight <b>${sum.net >= 0 ? '+' : '−'}🪙 ${fmt(Math.abs(sum.net))}</b></div>
      <div class="rs-ratechg ${ch >= 0 ? 'up' : 'dn'}">${stars(sum.ratingAfter)} <b>${sum.ratingAfter.toFixed(1)}</b> <span>${arrow} ${Math.abs(ch).toFixed(2)}</span></div>
      ${sum.unhappy ? `<div class="rs-fine">😞 ${sum.unhappy} guest${sum.unhappy === 1 ? '' : 's'} left hungry</div>` : ''}
      <blockquote class="rs-quote">“${esc(sum.quote)}”<cite>— ${esc(sum.who)}</cite></blockquote>`;
    modal({ emoji: sum.tone === 'bad' ? '😬' : sum.tone === 'great' ? '🌟' : '🍽️', title: 'Dinner service complete', html, buttons: [{ label: 'Wipe down the tables', cls: 'btn-gold' }] });
  }

  function customers() {
    const r = R_(), sv = r && r.service; if (!sv) return [];
    const t = nowMs();
    return sv.guests.map(g => ({ id: 'rg' + g.id, emoji: g.emoji, phase: g.phase, t: clamp((t - g.pStart) / Math.max(1, g.pEnd - g.pStart), 0, 1), table: g.table, mood: g.mood, dish: g.dish }));
  }

  // ---------- panel ----------
  let tab = 'service';
  const stars = v => {
    const f = Math.round(clamp(v, 0, 5) * 2) / 2; let s = '';
    for (let i = 1; i <= 5; i++) s += `<i class="${f >= i ? 'on' : f >= i - 0.5 ? 'half' : ''}">★</i>`;
    return `<span class="rs-stars">${s}</span>`;
  };
  function chips(req) {
    return Object.entries(req).map(([k, q]) => {
      const it = itemInfo(k), have = G.qty(k);
      return `<span class="need ${known(k) && have >= q ? 'ok' : 'no'}">${esc(it.emoji)} ${known(k) ? `<b>${have}</b>/${q}` : esc(it.name) + ' ×' + q}</span>`;
    }).join('');
  }
  const btn = (act, label, cls, attrs, why) => `<button class="btn ${cls || 'btn-gold'} ${why ? 'off' : ''}" data-act="pact" data-pa="${act}" ${attrs || ''} ${why ? `aria-disabled="true" data-why="${esc(why)}"` : ''}>${label}</button>`;

  function renderQuest(r) {
    const p = r.permit, t = nowMs();
    const lvlOk = unlocked();
    const idx = r.stage === 'none' ? 0 : r.stage === 'building' ? 3 : p.step === 'hearing' ? 1 : p.step === 'inspection' ? 2 : 3;
    const steps = [
      { e: '📝', t: 'Apply for a conditional-use permit', s: 'Whitman County Planning & Zoning · fee 🪙 ' + PERMIT_FEE },
      { e: '🏛️', t: 'Survive the public hearing', s: p.choice === 'gravel' ? 'You promised a gravel lot.' : p.choice === 'farm' ? 'You pledged: only food grown on this farm.' : 'The neighbors have concerns about traffic.' },
      { e: '🧪', t: 'Septic & fire inspection', s: 'Takes about 3 minutes. The septic guy brought a long stick.' },
      { e: '🔨', t: 'Convert the old lambing barn', s: 'Cost 🪙 ' + BUILD_COST + ' · about 4 minutes of hammering.' },
      { e: '🎉', t: 'Grand opening', s: 'Ribbon, scissors, and one nervous commissioner.' }
    ];
    let quote = '', action = '';
    if (r.stage === 'none') {
      quote = bubble('darlene', 'You want to open a restaurant in a lambing barn? Fill out Form 27-B. In triplicate. The lambs may sign as witnesses.');
      action = lvlOk ? btn('apply', '📝 Apply for permit · 🪙 ' + PERMIT_FEE, 'btn-gold', '', G.state.coins < PERMIT_FEE ? 'You need 🪙 ' + PERMIT_FEE + ' for the fee' : '')
        : `<span class="lockpill">🔒 Level ${UNLOCK_LEVEL}</span>`;
    } else if (r.stage === 'building') {
      quote = bubble('you', 'Lambs out, stove in. The chalkboard says "Today: Whatever Is Good".');
      action = `<div class="mini rs-bar"><i ${tmA('bar', p.buildStart, p.buildEnd)}></i></div><small class="rs-time" ${tmA('txt', 0, p.buildEnd, ' data-pre="🔨 Grand opening in "')}></small>`;
    } else if (p.step === 'hearing') {
      const wait = p.delayUntil > t;
      quote = wait ? bubble('darlene', 'We are adjourned. Take a walk. Maybe a deep breath.') : bubble('clip', 'I would like it noted that I brought a chart. The chart has a LOT of arrows.');
      action = wait ? `<div class="mini rs-bar"><i ${tmA('bar', p.delayUntil - HEARING_DELAY_MS, p.delayUntil)}></i></div><small class="rs-time" ${tmA('txt', 0, p.delayUntil, ' data-pre="⏳ Hearing resumes in "')}></small>`
        : btn('hearing', '🏛️ Attend public hearing', 'btn-gold');
    } else if (p.step === 'inspection') {
      quote = bubble('darlene', 'The inspector is crawling under your barn with a flashlight. Please do not ask what he is looking for.');
      action = `<div class="mini rs-bar"><i ${tmA('bar', p.inspectStart, p.inspectEnd)}></i></div><small class="rs-time" ${tmA('txt', 0, p.inspectEnd, ' data-pre="🧪 Inspection done in "')}></small>`;
    } else {
      quote = bubble('darlene', 'Inspection passed. The septic guy said "huh" twice. That is a rave. Go convert your barn.');
      action = btn('reno', '🔨 Convert the lambing barn · 🪙 ' + BUILD_COST, 'btn-green', '', G.state.coins < BUILD_COST ? 'You need 🪙 ' + BUILD_COST : '');
    }
    const list = steps.map((s, i) => {
      const st = i < idx ? 'done' : i === idx ? 'cur' : 'todo';
      return `<div class="rs-step ${st}"><span class="rs-sd">${st === 'done' ? '✅' : s.e}</span><div><b>${esc(s.t)}</b>${st === 'cur' ? `<small>${esc(s.s)}</small>` : ''}</div></div>`;
    }).join('');
    return `<div class="rs-hero"><div class="rs-hero-e">🏛️</div><div><h4>Whitman County Planning &amp; Zoning</h4><small>Permit #27-B · farm-to-table barn restaurant</small></div></div>
      ${quote}<div class="rs-act">${action}</div><div class="sub">The paperwork trail</div><div class="rs-quest">${list}</div>`;
  }

  function stockStrip(r) {
    const ids = r.menu; if (!ids.length) return '<div class="empty-note">No dishes on tonight\'s menu yet. Open the <b>Menu</b> tab.</div>';
    return `<div class="rs-stock">${ids.map(id => { const d = dishOf(id), n = r.pass[id] || 0; return `<span class="rs-sk ${n ? '' : 'out'}">${esc(d.emoji)} <b>${n}</b></span>`; }).join('')}</div>`;
  }
  function renderService(r) {
    const t = nowMs(), sv = r.service;
    let head;
    if (sv) {
      const closing = t >= sv.endAt;
      head = `<div class="rs-status live"><div class="rs-st-t"><b>${closing ? '🌙 Last orders in!' : '🔔 Dinner service'}</b><small ${closing ? '' : tmA('txt', 0, sv.endAt, ' data-pre="Closes in "')}>${closing ? 'Wrapping up the last tables' : ''}</small></div>
        <div class="mini rs-bar"><i ${tmA('bar', sv.startAt, sv.endAt)}></i></div></div>`;
    } else if (r.cooldownUntil > t) {
      head = `<div class="rs-status"><div class="rs-st-t"><b>😮‍💨 Kitchen resting</b><small ${tmA('txt', 0, r.cooldownUntil, ' data-pre="Ready to open in "')}></small></div>
        <div class="mini rs-bar"><i ${tmA('bar', r.cooldownUntil - COOLDOWN_MS, r.cooldownUntil)}></i></div></div>`;
    } else head = '<div class="rs-status"><div class="rs-st-t"><b>🍽️ Ready for dinner</b><small>About 2½ minutes of service</small></div></div>';
    let openWhy = '';
    if (!r.menu.length) openWhy = 'Put a dish on tonight\'s menu first';
    else if (!r.menu.some(id => (r.pass[id] || 0) > 0)) openWhy = 'Prep some dishes onto the pass first';
    else if (r.cooldownUntil > t) openWhy = 'The kitchen is still resting';
    const openBtn = sv ? '' : btn('open', '🔔 Open for dinner service', 'btn-green', 'style="width:100%"', openWhy);
    const n = tablesCount();
    const byTable = {}; (sv ? sv.guests : []).forEach(g => { if (g.table != null) byTable[g.table] = g; });
    let grid = '';
    for (let i = 0; i < n; i++) {
      const g = byTable[i];
      if (!g) { grid += `<div class="rs-tbl"><div class="rs-seat">🪑</div><small>Table ${i + 1}</small></div>`; continue; }
      const d = dishOf(g.dish);
      const lab = g.phase === 'arriving' ? 'Walking in' : g.phase === 'seated' ? (g.serve || !g.dish ? 'Ordering' : 'Ordering') : g.phase === 'eating' ? 'Eating' : g.sad ? 'Left hungry' : 'Paying';
      grid += `<div class="rs-tbl ${g.phase} ${g.sad ? 'sad' : ''}"><div class="rs-guest">${g.sad ? '😞' : esc(g.emoji)}</div>${d && g.phase !== 'arriving' ? `<span class="rs-dish ${g.serve ? '' : 'no'}">${esc(d.emoji)}</span>` : ''}<small>${esc(lab)}</small></div>`;
    }
    const tonight = sv ? sv : { covers: 0, revenue: 0, tips: 0, unhappy: 0 };
    const earn = `<div class="rs-earn"><div><b>🍽️ ${fmt(tonight.covers)}</b><small>Covers</small></div><div><b>🪙 ${fmt(tonight.revenue)}</b><small>Revenue</small></div><div><b>💵 ${fmt(tonight.tips)}</b><small>Tips</small></div><div><b>😞 ${fmt(tonight.unhappy)}</b><small>Unhappy</small></div></div>`;
    const lastBtn = r.lastSummary && !sv ? btn('review', '📰 Last night\'s review', 'btn-gray sm', 'style="width:100%;margin-top:8px"') : '';
    return head + openBtn + `<div class="sub">Tonight's pass</div>` + stockStrip(r) + `<div class="sub">Tables</div><div class="rs-tables">${grid}</div><div class="sub">${sv ? 'Earnings tonight' : 'Earnings'}</div>${earn}${lastBtn}`;
  }

  function renderKitchen(r) {
    const t = nowMs(), n = stoves();
    let st = '';
    for (let i = 0; i < n; i++) {
      const j = r.queue[i], d = j && dishOf(j.id);
      st += j && d ? `<div class="rs-stove on"><span class="rs-se">${esc(d.emoji)}</span><div class="mini rs-bar"><i ${tmA('bar', j.startAt, j.readyAt)}></i></div><small ${tmA('txt', 0, j.readyAt)}></small><button class="rs-x" data-act="pact" data-pa="cancel" data-i="${i}" aria-label="Cancel and refund">✕</button></div>`
        : `<div class="rs-stove"><span class="rs-se">🔥</span><small>Free stove</small></div>`;
    }
    const passItems = Object.keys(r.pass).map(id => { const d = dishOf(id); return d ? `<span class="rs-sk">${esc(d.emoji)} ${esc(d.name)} <b>${r.pass[id]}</b></span>` : ''; }).join('');
    const rows = dishList().map(d => {
      const locked = (G.state.level || 1) < d.level, why = locked ? '' : cookBlock(d), miss = missing(d);
      const right = locked ? `<span class="lockpill">🔒 Lv ${d.level}</span>` : btn('cook', 'Cook', 'btn-green sm', `data-id="${esc(d.id)}"`, why);
      return `<div class="rs-row ${locked ? 'locked' : ''}"><span class="rs-re">${esc(d.emoji)}</span><div class="rs-rm"><b>${esc(d.name)}</b><div class="needs">${chips(d.inputs)}</div><small>⏱ ${fmtT(d.cookSec * (r.staff.cook ? 0.7 : 1))} · ×${PORTIONS} portions${!locked && miss.length && miss.some(k => !known(k)) ? ' · needs the ranch' : ''}</small></div>${right}</div>`;
    }).join('');
    return `<div class="sub">Stoves ${r.queue.length}/${n}</div><div class="rs-stoves">${st}</div>
      <div class="sub">The pass <small>(max ${passCap()} per dish)</small></div>${passItems ? `<div class="rs-stock wrap">${passItems}</div>` : '<div class="empty-note">The pass is empty. Cook something below!</div>'}
      <div class="sub">Cook a dish</div>${rows}`;
  }

  function renderMenu(r) {
    const locked = !!r.service;
    const rows = dishList().map(d => {
      const on = r.menu.indexOf(d.id) >= 0, lv = (G.state.level || 1) < d.level;
      const parts = priceParts(d), price = dishPrice(d), miss = missing(d);
      const right = lv ? `<span class="lockpill">🔒 Lv ${d.level}</span>` : btn('menu', on ? '✓ On' : 'Add', on ? 'btn-green sm' : 'btn-gray sm', `data-id="${esc(d.id)}"`, locked ? 'Menu is locked while service is running' : '');
      return `<div class="rs-row ${lv ? 'locked' : ''} ${on ? 'on' : ''}"><span class="rs-re">${esc(d.emoji)}</span><div class="rs-rm"><b>${esc(d.name)}</b><div class="rs-pr">🪙 <b>${price}</b>${parts.map(p => `<em>${p[0]} +${Math.round(p[1] * 100)}%</em>`).join('')}</div>
        <div class="needs">${!lv && miss.length ? `<span class="need no">Need ingredients</span>` : ''}${chips(d.inputs)}</div><small>In pass: <b>${r.pass[d.id] || 0}</b></small></div>${right}</div>`;
    }).join('');
    return `<div class="rs-menuhead"><b>Tonight's menu</b><span>${r.menu.length}/${menuCap()}</span></div>${r.farmOnly ? '<div class="rs-rule">🌾 Farm rule: every dish uses your own produce, and sells for +10%.</div>' : ''}${rows}`;
  }

  function renderStaff(r) {
    const staff = Object.keys(STAFF).map(k => {
      const s = STAFF[k], on = r.staff[k];
      return `<div class="rs-row ${on ? 'on' : ''}"><span class="rs-re">${s.emoji}</span><div class="rs-rm"><b>${esc(s.name)}</b><small>${esc(s.desc)}</small><small>Wage 🪙 ${WAGES[k]} per service</small></div>${btn('hire', on ? 'Hired' : 'Hire', on ? 'btn-green sm' : 'btn-gold sm', `data-k="${k}"`, r.service ? 'Staff changes after service' : '')}</div>`;
    }).join('');
    const ups = Object.keys(UPGRADES).map(k => {
      const u = UPGRADES[k], n = r.up[k], maxed = n >= u.max, lv = (G.state.level || 1) < u.level, cost = u.cost(n);
      let right;
      if (maxed) right = '<span class="lockpill">✓ Done</span>';
      else if (lv) right = `<span class="lockpill">🔒 Lv ${u.level}</span>`;
      else right = btn('up', '🪙 ' + fmt(cost), 'btn-gold sm', `data-k="${k}"`, G.state.coins < cost ? 'You need 🪙 ' + fmt(cost) : '');
      return `<div class="rs-row"><span class="rs-re">${u.emoji}</span><div class="rs-rm"><b>${esc(u.name)}${u.max > 1 ? ` <em>${n}/${u.max}</em>` : ''}</b><small>${esc(u.desc(n))}</small></div>${right}</div>`;
    }).join('');
    return `<div class="sub">Staff <small>(wages: 🪙 ${wageTotal()} per service)</small></div>${staff}<div class="sub">Upgrades</div>${ups}`;
  }

  function renderOpen(r) {
    const tabs = [['service', '🔔', 'Service'], ['kitchen', '🍳', 'Kitchen'], ['menu', '📋', 'Menu'], ['staff', '⭐', 'Staff']];
    const seg = `<div class="rs-seg" role="tablist">${tabs.map(x => `<button class="${tab === x[0] ? 'on' : ''}" data-act="pact" data-pa="tab" data-tab="${x[0]}" role="tab">${x[1]}<span>${x[2]}</span></button>`).join('')}</div>`;
    const top = `<div class="rs-top"><div class="rs-top-r">${stars(r.rating)}<b>${r.rating.toFixed(1)}</b></div><small>${fmt(r.stats.covers)} guests served${r.up.parking||r.up.lights||r.up.grill||r.up.winelist ? ' · ' : ''}${r.up.parking ? '🅿️' : ''}${r.up.lights ? '✨' : ''}${r.up.grill ? '🔥' : ''}${r.up.winelist ? '🍷' : ''}${featureActive() ? ' 📰 Featured!' : ''}</small></div>`;
    const body = tab === 'kitchen' ? renderKitchen(r) : tab === 'menu' ? renderMenu(r) : tab === 'staff' ? renderStaff(r) : renderService(r);
    return top + seg + body;
  }

  G.panels = G.panels || {};
  G.panels.restaurant = {
    live: true,
    title() { const r = R_(); return r && r.stage === 'open' ? '🍽️ The Lambing Barn' : '🍽️ Barn Restaurant'; },
    sub() { const r = R_(); if (!r) return ''; return r.stage === 'open' ? 'Farm-to-table · Whitman County' : r.stage === 'building' ? 'Barn conversion in progress' : r.stage === 'permit' ? 'Permit paperwork' : 'Coming soon'; },
    render() {
      const r = R_(); if (!r) return '<div class="empty-note">Restaurant unavailable</div>';
      step();
      if (r.stage === 'open') return renderOpen(r);
      return renderQuest(r);
    },
    onAction(action, el) {
      try {
        const ds = (el && el.dataset) || {};
        switch (action) {
          case 'tab': tab = ds.tab || 'service'; { const r = R_(); if (r) r.tab = tab; } break;
          case 'apply': applyPermit(); break;
          case 'hearing': openHearing(); break;
          case 'reno': startReno(); break;
          case 'cook': cook(ds.id); break;
          case 'cancel': cancelCook(+ds.i); break;
          case 'menu': toggleMenu(ds.id); break;
          case 'open': startService(); break;
          case 'review': showSummary(); break;
          case 'hire': toggleStaff(ds.k); break;
          case 'up': buyUpgrade(ds.k); break;
          default: break;
        }
      } catch (e) { console.error('[restaurant] action', e); }
    }
  };

  // ---------- events ----------
  const openNow = () => { try { return stage() === 'open'; } catch (e) { return false; } };
  if (G.Events && G.Events.register) {
    G.Events.register({
      key: 'restaurant_inspector', name: 'Health Inspector Surprise Visit', emoji: '🧑‍⚕️', kind: 'bad', minLevel: UNLOCK_LEVEL, weight: 1, durationSec: 0,
      desc: 'A clipboard, a flashlight and a very serious mustache.', requires: openNow,
      text: () => 'A health inspector in a spotless windbreaker has walked into the barn kitchen with a flashlight and a clipboard. "Routine," he says. Nobody believes him.',
      choices: [
        { label: 'Deep clean the kitchen', cost: () => Math.round(100 + 10 * tablesCount()), desc: 'Scrub everything, even the lamb feeder. A sure pass and a shiny reputation.',
          apply: () => { addRating(0.05); return 'The kitchen sparkles. The inspector found nothing and left a tiny gold star sticker.'; } },
        { label: 'Wing it', cost: 0, desc: 'Hide the lamb feeder and smile. 50% chance of a rating hit.',
          apply: () => { if (Math.random() < 0.5) { addRating(-0.4); return 'Busted. He found a lamb feeder in the walk-in. Rating takes a hit.'; } return 'You somehow wing it. The inspector writes "adequate (barn)" and leaves.'; } }
      ]
    });
    G.Events.register({
      key: 'restaurant_feature', name: 'Big-city food magazine names you a hidden gem', emoji: '📰', kind: 'good', minLevel: UNLOCK_LEVEL, weight: 0.8, durationSec: 300,
      desc: 'A glossy city mag discovers your barn.', requires: openNow,
      onStart() { addRating(0.25); return {}; },
      text: () => 'A big-city food magazine calls the Lambing Barn "the best meal you will ever eat next to a hay bale". Your rating jumps and diners pour in from the city.'
    });
    G.Events.register({
      key: 'restaurant_noise', name: 'Noise Complaint', emoji: '📣', kind: 'bad', minLevel: UNLOCK_LEVEL, weight: 1, durationSec: 0,
      desc: 'The neighbor with the clipboard has noticed your patio.', requires: openNow,
      text: () => 'The neighbor with the clipboard is at the fence with a decibel meter. "Your accordion night is audible in THREE townships," she says.',
      choices: [
        { label: 'Send over a pie basket', cost: () => 60, desc: 'Apologize with butter crust. Peace, and a few extra stars.',
          apply: () => { addRating(0.03); return 'Marlene accepted the pie, then asked for the recipe. All is forgiven.'; } },
        { label: 'Turn it up', cost: 0, desc: 'Keep the accordion going. Guests dip a bit for two minutes.',
          apply: () => { const r = R_(); if (r) r.noiseUntil = nowMs() + 120000; addRating(-0.15); return 'The accordion plays on. A few diners flee and the rating takes a small dip.'; } }
      ]
    });
  }

  // ---------- CSS ----------
  G.injectCSS('restaurant', `
.rs-hero{display:flex;gap:10px;align-items:center;background:linear-gradient(#fff6dc,#ffe9b3);border:3px solid #e0bd72;border-radius:18px;padding:10px 12px;box-shadow:0 4px 0 rgba(110,70,20,.22)}
.rs-hero-e{font-size:34px;width:52px;height:52px;display:grid;place-items:center;background:#fff;border-radius:16px;box-shadow:inset 0 0 0 2px #e8cf92;flex:none}
.rs-hero h4{margin:0;font-size:15px;font-weight:900}.rs-hero small{font-size:11px;color:var(--ink2,#7a5a38)}
.rs-quest{margin:4px 0 10px;display:flex;flex-direction:column;gap:6px}
.rs-step{display:flex;gap:10px;align-items:center;padding:5px 10px;border-radius:14px;background:#f6ecd0;border:2px solid transparent;opacity:.7}
.rs-step .rs-sd{font-size:22px;width:34px;height:34px;display:grid;place-items:center;flex:none}
.rs-step b{display:block;font-size:14px;line-height:1.15}.rs-step small{display:block;font-size:11px;color:var(--ink2,#7a5a38);font-weight:800;margin-top:1px}
.rs-step.cur{opacity:1;background:#fff;border-color:#f2b631;box-shadow:0 3px 0 rgba(201,138,20,.4)}
.rs-step.done{opacity:.85;background:#e3f3cf}.rs-step.done b{text-decoration:line-through;text-decoration-thickness:2px}
.rs-say{background:#fff;border:2px solid #e8cf92;border-radius:16px;padding:8px 12px;margin:8px 0;text-align:left;position:relative}
.rs-say b{font-size:12px;color:var(--ink2,#7a5a38)}.rs-say p{margin:3px 0 0!important;font-size:14px!important;line-height:1.35;font-weight:800!important;color:var(--ink,#4a2f14)}
.rs-say.d{background:#fff1c9;border-color:#f2b631}.rs-say.y{background:#e3f3cf;border-color:#8fcb62}
.rs-act{margin-top:6px;display:flex;flex-direction:column;gap:6px;align-items:stretch}.rs-act .btn{width:100%}
.rs-bar{width:100%!important;height:12px!important}.rs-time{text-align:center;font-size:12px;font-weight:900;color:var(--ink2,#7a5a38)}
.rs-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;background:linear-gradient(#fff6dc,#ffe9b3);border:3px solid #e0bd72;border-radius:16px;padding:6px 12px}
.rs-top-r{display:flex;align-items:center;gap:6px;font-size:20px}.rs-top-r b{font-size:18px}.rs-top small{font-size:11px;color:var(--ink2,#7a5a38);text-align:right}
.rs-stars{display:inline-flex}.rs-stars i{font-style:normal;color:#d9c9a0;font-size:18px;line-height:1;position:relative}.rs-stars i.on{color:#f2b631;text-shadow:0 1px 0 #c98a14}
.rs-stars i.half{background:linear-gradient(90deg,#f2b631 50%,#d9c9a0 50%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.rs-seg{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:4px;background:#ecdcb2;border-radius:18px;margin-bottom:8px;box-shadow:inset 0 2px 4px rgba(90,60,20,.2)}
.rs-seg button{min-height:48px;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;font-size:17px;font-weight:900;color:#6b5230;background:transparent;line-height:1.1}
.rs-seg button span{font-size:11px;font-weight:900}.rs-seg button.on{background:linear-gradient(#fffaf0,#fff0cc);color:var(--ink,#4a2f14);box-shadow:0 3px 0 #c9a45c,0 4px 8px rgba(80,50,10,.2)}
.rs-status{background:#fff;border:3px solid #e0bd72;border-radius:18px;padding:10px 12px;margin-bottom:8px;display:flex;flex-direction:column;gap:6px}
.rs-status.live{border-color:#5fb53c;background:#effae3}.rs-st-t b{display:block;font-size:16px}.rs-st-t small{font-size:12px;color:var(--ink2,#7a5a38);font-weight:900}
.rs-stock{display:flex;gap:6px;overflow-x:auto;padding:2px 1px 4px}.rs-stock.wrap{flex-wrap:wrap;overflow:visible}
.rs-sk{flex:none;display:inline-flex;gap:4px;align-items:center;background:#d6f2b8;color:#2e5a14;border-radius:12px;padding:5px 10px;font-size:13px;font-weight:900;min-height:32px}
.rs-sk.out{background:#ffd5cc;color:var(--red-d,#a42d23)}.rs-sk b{font-size:14px}
.rs-tables{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:8px}
.rs-tbl{position:relative;min-height:84px;border-radius:16px;background:linear-gradient(#fffaf0,#f3e4bd);border:3px solid #e0bd72;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;box-shadow:0 3px 0 rgba(110,70,20,.2)}
.rs-tbl small{font-size:10px;font-weight:900;color:var(--ink2,#7a5a38)}.rs-seat{font-size:26px;opacity:.5}
.rs-guest{font-size:32px;line-height:1;animation:rsb 1.4s ease-in-out infinite}.rs-tbl.arriving{border-color:#b8d8f0}.rs-tbl.eating{border-color:#5fb53c;background:#effae3}
.rs-tbl.leaving{border-color:#f2b631}.rs-tbl.sad{border-color:#d9533b;background:#ffe9e3}.rs-tbl.sad .rs-guest{animation:none}
.rs-dish{position:absolute;top:-8px;right:-6px;font-size:20px;background:#fff;border-radius:12px;min-width:30px;height:30px;display:grid;place-items:center;box-shadow:0 2px 0 rgba(0,0,0,.2)}
.rs-dish.no{filter:grayscale(1);opacity:.6}
@keyframes rsb{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.rs-earn,.rs-sum{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.rs-earn>div,.rs-sum>div{background:#fff;border:2px solid #e8cf92;border-radius:14px;padding:7px 2px;text-align:center}
.rs-earn b,.rs-sum b{display:block;font-size:14px}.rs-earn small,.rs-sum small{font-size:10px;color:var(--ink2,#7a5a38);font-weight:900}
.rs-stoves{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px}
.rs-stove{position:relative;min-height:84px;border-radius:16px;background:#f3e6c4;border:3px dashed #d7bd82;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:4px}
.rs-stove.on{background:linear-gradient(#fffaf0,#ffe9b3);border:3px solid #f2b631}.rs-stove .rs-se{font-size:26px}.rs-stove small{font-size:11px;font-weight:900;color:var(--ink2,#7a5a38)}
.rs-x{position:absolute;top:-8px;right:-8px;width:30px;height:30px;border-radius:50%;background:#d9533b;color:#fff;font-weight:900;font-size:13px;box-shadow:0 2px 0 #a42d23}
.rs-x::after{content:'';position:absolute;inset:-8px}
.rs-row{display:flex;gap:10px;align-items:center;background:#fffaf0;border:2px solid #ecd9a4;border-radius:16px;padding:8px 10px;margin-bottom:7px}
.rs-row.on{border-color:#5fb53c;background:#f1fbe6}.rs-row.locked{opacity:.65}
.rs-re{font-size:30px;width:40px;text-align:center;flex:none}.rs-rm{flex:1;min-width:0}.rs-rm>b{display:block;font-size:14px;line-height:1.15}
.rs-rm small{display:block;font-size:11px;color:var(--ink2,#7a5a38);font-weight:800;margin-top:2px}.rs-rm em{font-style:normal;font-size:11px;color:var(--ink2,#7a5a38)}
.rs-row .btn{flex:none;min-width:70px}.rs-pr{font-size:13px;margin-top:2px}.rs-pr em{background:#fff1c9;border-radius:8px;padding:1px 6px;margin-left:4px;font-weight:900;color:#8a5a06}
.rs-menuhead{display:flex;justify-content:space-between;align-items:center;font-size:15px;margin:2px 2px 8px}.rs-menuhead span{background:#fff1c9;border-radius:12px;padding:2px 10px;font-weight:900}
.rs-rule{background:#e3f3cf;border:2px solid #8fcb62;border-radius:14px;padding:6px 10px;font-size:12px;margin-bottom:8px}
.rs-net{margin:8px 0;padding:8px;border-radius:14px;font-size:15px}.rs-net.up{background:#d6f2b8;color:#2e5a14}.rs-net.dn{background:#ffd5cc;color:#a42d23}
.rs-ratechg{font-size:18px;margin:4px 0}.rs-ratechg span{font-size:14px}.rs-ratechg.up span{color:#3e8223}.rs-ratechg.dn span{color:#a42d23}
.rs-fine{font-size:12px;color:#a42d23;margin:2px 0}
.rs-quote{margin:10px 0 4px;padding:10px 12px;background:#fff;border-left:5px solid #f2b631;border-radius:12px;font-size:14px;font-weight:800;text-align:left;line-height:1.35}
.mcard .rs-say,.mcard .rs-sum>div,.mcard .rs-net,.mcard .rs-quote,.mcard .rs-ratechg,.mcard .rs-fine{text-shadow:none!important;color:var(--ink,#4a2f14)}
.mcard .rs-say p{color:var(--ink,#4a2f14)!important}.mcard .rs-ratechg{background:#fff;border-radius:12px;padding:4px}
.rs-quote cite{display:block;margin-top:4px;font-size:12px;font-style:normal;color:var(--ink2,#7a5a38)}
`);

  // ---------- lifecycle ----------
  G.bus.on('init', () => { try { ensure(); tab = R_().tab || 'service'; } catch (e) { console.error('[restaurant] init', e); } });
  G.bus.on('state:reset', () => { try { tab = 'service'; ensure(); } catch (e) { console.error('[restaurant] reset', e); } });
  G.bus.on('levelup', p => { try { if (p && p.level === UNLOCK_LEVEL && stage() === 'none') say('🍽️ The county planning board has a form with your name on it. A barn restaurant awaits!', 'good'); } catch (e) { /* ignore */ } });
  G.bus.on('tick', p => {
    try {
      const r = G.state && G.state.restaurant;
      if (r && r.stage === 'none') return;     // cheap exit when nothing is going on
      if (!r) return;
      step(p && p.now ? p.now : nowMs());
    } catch (e) { console.error('[restaurant] tick', e); }
  });

  G.Restaurant = {
    stage, isServing, customers, tables: tablesCount, ensure,
    rating: () => R_().rating, stars: () => R_().rating,
    // actions (also used by tests)
    apply: applyPermit, hearing: openHearing, resolveHearing, reno: startReno, cook, cancelCook, toggleMenu, startService, step,
    buyUpgrade, toggleStaff, addRating, showSummary, dishPrice, dishes: dishList,
    summary: () => R_().lastSummary, cooldownLeft: () => Math.max(0, R_().cooldownUntil - nowMs()),
    constants: { UNLOCK_LEVEL, PERMIT_FEE, GRAVEL_COST, BUILD_COST, INSPECT_MS, BUILD_MS, SERVICE_MS, COOLDOWN_MS, HEARING_DELAY_MS, PORTIONS }
  };
  ensure();
})();
