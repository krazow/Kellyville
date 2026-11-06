/* ui.js — Kellyville UI: rendering, input, toasts, modals, atmosphere. */
(function () {
  'use strict';
  const G = window.G;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Math.round(n || 0).toLocaleString('en-US');
  const fmtT = sec => String((G.util && G.util.fmtTime ? G.util.fmtTime(sec) : Math.ceil(sec) + 's')).trim();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const D = () => G.DATA || {};
  const S = () => G.state;
  const dget = (cat, k) => (D()[cat] || {})[k];
  const iEmoji = k => (G.itemInfo ? G.itemInfo(k).emoji : '📦') || '📦';
  const iName = k => (G.itemInfo ? G.itemInfo(k).name : k) || k;
  const AVATARS = ['🧑‍🌾', '👩‍🌾', '👨‍🌾', '🤠', '👵', '👴', '🧒', '🐕'];

  const UI = (G.ui = { tab: 'farm', shopTab: 'animals', sheet: null, modals: [], cur: null, seedAll: false, tapRect: null, tapAt: 0, pending: false, sig: {}, flySeq: 0, tfx: null });

  // ---------- toast (installed at load so early toasts are caught) ----------
  G.toast = function (msg, kind) {
    try {
      const box = $('#toasts');
      if (!box) { console.log('[toast]', kind || '', msg); return; }
      const t = document.createElement('div');
      t.className = 'toast ' + (kind || 'info');
      t.textContent = msg;
      box.appendChild(t);
      while (box.children.length > 4) box.firstChild.remove();
      setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2500);
    } catch (e) { console.error(e); }
  };

  // ---------- small helpers ----------
  function patchChildren(box, htmls) {
    if (!box) return;
    const kids = box.children;
    htmls.forEach((h, i) => {
      const cur = kids[i];
      if (cur && cur._h === h) return;
      const t = document.createElement('template'); t.innerHTML = h.trim();
      const n = t.content.firstElementChild; if (!n) return; n._h = h;
      if (cur) box.replaceChild(n, cur); else box.appendChild(n);
    });
    while (box.children.length > htmls.length) box.lastElementChild.remove();
  }
  function setHTML(el, html) { if (el && el._h !== html) { el.innerHTML = html; el._h = html; } }
  function setText(el, t) { if (el && el.textContent !== t) el.textContent = t; }
  function avatar() { return (S().flags && S().flags['ui.avatar']) || AVATARS[0]; }
  function pname() { return G.playerName ? G.playerName() : 'Farmer'; }
  const tm = (type, start, end, extra) => `data-tm="${type}" data-start="${Math.round(start || 0)}" data-end="${Math.round(end || 0)}"${extra || ''}`;
  function needChips(req) {
    return Object.entries(req || {}).map(([k, q]) => {
      const have = G.qty(k);
      return `<span class="need ${have >= q ? 'ok' : 'no'}">${esc(iEmoji(k))} <b>${have}</b>/${q}</span>`;
    }).join('');
  }
  function evDef(key) {
    try { if (G.Events && G.Events.def) { const d = G.Events.def(key); if (d) return d; } } catch (e) { }
    const defs = G.Events && G.Events.definitions;
    if (Array.isArray(defs)) return defs.find(d => d.key === key) || null;
    return null;
  }
  function activeEvents() {
    try { if (G.Events && G.Events.active) return G.Events.active() || []; } catch (e) { }
    return (S().activeEvents || []);
  }

  // ---------- flying text ----------
  function fly(html, from, toEl, opt) {
    opt = opt || {};
    const layer = $('#float-layer');
    if (!layer || !from || !layer.appendChild) return;
    const el = document.createElement('div');
    el.className = 'fly ' + (opt.cls || '');
    el.innerHTML = html; layer.appendChild(el);
    const sx = from.left + from.width / 2, sy = from.top + from.height / 2;
    el.style.left = sx + 'px'; el.style.top = sy + 'px';
    const tr = toEl ? toEl.getBoundingClientRect() : null;
    const dx = tr ? tr.left + tr.width / 2 - sx : 0, dy = tr ? tr.top + tr.height / 2 - sy : -90;
    if (!el.animate) { setTimeout(() => el.remove(), 900); return; }
    const a = el.animate([
      { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0, offset: 0 },
      { transform: 'translate(-50%,-110%) scale(1.15)', opacity: 1, offset: .2 },
      { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.5)`, opacity: .2, offset: 1 }
    ], { duration: opt.dur || 950, delay: opt.delay || 0, easing: 'cubic-bezier(.35,.1,.3,1)', fill: 'both' });
    a.onfinish = () => { el.remove(); if (toEl && opt.bump !== false) bump(toEl); };
  }
  function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  function tapOrigin() {
    if (UI.tapRect && Date.now() - UI.tapAt < 2000) return UI.tapRect;
    if (UI.tab === 'farm' && G.World && G.World.playerRect) { const r = G.World.playerRect(); if (r) return r; }
    return { left: innerWidth / 2 - 10, top: innerHeight * 0.55, width: 20, height: 20 };
  }
  function confetti() {
    const box = $('#confetti'); if (!box || !box.animate) return;
    const cols = ['#ff5a4d', '#ffc83d', '#5fd04a', '#4aa3e0', '#c06cf0', '#fff'];
    for (let i = 0; i < 80; i++) {
      const c = document.createElement('i'); c.className = 'cf';
      const x = Math.random() * innerWidth;
      c.style.left = x + 'px'; c.style.background = cols[i % cols.length];
      c.style.width = (6 + Math.random() * 8) + 'px'; c.style.height = (8 + Math.random() * 10) + 'px';
      box.appendChild(c);
      const dur = 1800 + Math.random() * 1800, drift = (Math.random() - .5) * 220;
      const a = c.animate([
        { transform: 'translate(0,-20px) rotate(0)', opacity: 1 },
        { transform: `translate(${drift}px,${innerHeight + 40}px) rotate(${Math.random() * 900 - 450}deg)`, opacity: .9 }
      ], { duration: dur, delay: Math.random() * 500, easing: 'cubic-bezier(.3,.6,.5,1)', fill: 'both' });
      a.onfinish = () => c.remove();
    }
  }

  // ---------- sky / season ----------
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
  const DAYSKY = {
    spring: { top: [110, 190, 240], bot: [215, 240, 255] }, summer: { top: [58, 150, 235], bot: [190, 230, 255] },
    fall: { top: [130, 168, 205], bot: [255, 222, 168] }, winter: { top: [150, 175, 200], bot: [232, 240, 246] }
  };
  function skyAt(season, p) {
    const day = DAYSKY[season] || DAYSKY.spring;
    const K = {
      night: { top: [22, 30, 74], bot: [64, 54, 118], sh: [8, 12, 44, .48], st: 1 },
      dawn: { top: [124, 120, 196], bot: [255, 178, 128], sh: [255, 140, 80, .14], st: .3 },
      day: { top: day.top, bot: day.bot, sh: [255, 255, 255, 0], st: 0 },
      dusk: { top: [92, 82, 164], bot: [255, 138, 88], sh: [255, 110, 60, .18], st: .3 }
    };
    const F = [[0, 'night'], [.08, 'night'], [.18, 'dawn'], [.3, 'day'], [.62, 'day'], [.74, 'dusk'], [.86, 'night'], [1, 'night']];
    let i = 0; while (i < F.length - 2 && p > F[i + 1][0]) i++;
    const a = F[i], b = F[i + 1], t = clamp((p - a[0]) / (b[0] - a[0]), 0, 1), A = K[a[1]], B = K[b[1]];
    return { top: mix(A.top, B.top, t), bot: mix(A.bot, B.bot, t), sh: mix(A.sh, B.sh, t), st: lerp(A.st, B.st, t) };
  }
  const rgb = c => `rgb(${c.slice(0, 3).map(Math.round).join(',')})`;
  function updateSky(cal) {
    cal = cal || G.calendar();
    const app = $('#app'), sc = $('#scene'); if (!app || !sc) return;
    if (app.dataset.season !== cal.season) app.dataset.season = cal.season;
    const s = skyAt(cal.season, (cal.dayProgress + .22) % 1);
    sc.style.setProperty('--sky-top', rgb(s.top)); sc.style.setProperty('--sky-bot', rgb(s.bot));
    sc.style.setProperty('--shade', `rgba(${s.sh.slice(0, 3).map(Math.round).join(',')},${s.sh[3].toFixed(3)})`);
    sc.style.setProperty('--stars', s.st.toFixed(2));
    const p = (cal.dayProgress + .22) % 1, orb = $('#orb'); if (!orb) return;
    let t = -1, ch = '☀️';
    if (p >= .1 && p <= .74) { t = (p - .1) / .64; ch = '☀️'; }
    else { const q = p < .5 ? p + 1 : p; if (q >= .74 && q <= 1.12) { t = (q - .74) / .38; ch = '🌙'; } }
    if (t < 0) { orb.style.opacity = 0; return; }
    const W = Math.min(innerWidth, 480);
    orb.style.opacity = 1; setText(orb, ch);
    orb.style.transform = `translate(${(-W / 2 + 24 + t * (W - 60)).toFixed(0)}px,${(-Math.sin(Math.PI * t) * 100).toFixed(0)}px)`;
  }
  function updateSeasonChip(cal) {
    cal = cal || G.calendar();
    const si = (G.SEASON_INFO || {})[cal.season] || { name: cal.season, emoji: '' };
    setText($('#hud-season'), `${si.emoji} ${si.name} · Day ${cal.dayOfSeason}` + (cal.year > 1 ? ` · Yr ${cal.year}` : ''));
  }

  // ---------- weather / event atmosphere ----------
  const FX_RULES = [['dust', /dust|wind|chinook/], ['smoke', /smoke|fire/], ['hail', /hail/], ['rain', /rain/], ['frost', /frost|freeze/], ['heat', /heat|drought/], ['snow', /snow/]];
  function fxFor(key, def) {
    const out = [], k = (key || '').toLowerCase();
    FX_RULES.forEach(([n, re]) => { if (re.test(k)) out.push(n); });
    if (!out.length && def && def.kind === 'good') out.push('sun');
    return out;
  }
  function buildFxParticles() {
    const mk = (cls, n, fn) => { const l = $('.' + cls); if (!l || l.children.length) return; for (let i = 0; i < n; i++) { const e = fn(i); l.appendChild(e); } };
    const rnd = (a, b) => a + Math.random() * (b - a);
    mk('l-rain', 34, () => { const e = document.createElement('i'); e.style.left = rnd(0, 110) + '%'; e.style.animationDuration = rnd(.55, .9) + 's'; e.style.animationDelay = -rnd(0, 1) + 's'; return e; });
    mk('l-hail', 22, () => { const e = document.createElement('i'); e.style.left = rnd(0, 120) + '%'; e.style.animationDuration = rnd(.7, 1.1) + 's'; e.style.animationDelay = -rnd(0, 1) + 's'; return e; });
    mk('l-snow', 30, () => { const e = document.createElement('i'); const s = rnd(4, 9); e.style.width = e.style.height = s + 'px'; e.style.left = rnd(0, 100) + '%'; e.style.animationDuration = rnd(5, 10) + 's'; e.style.animationDelay = -rnd(0, 8) + 's'; return e; });
    mk('l-frost', 16, i => { const e = document.createElement('b'); e.textContent = i % 3 ? '✦' : '❄'; e.style.left = rnd(2, 94) + '%'; e.style.top = rnd(4, 90) + '%'; e.style.fontSize = rnd(12, 26) + 'px'; e.style.animationDelay = -rnd(0, 2) + 's'; e.style.animationDuration = rnd(1.4, 3) + 's'; return e; });
  }
  function updateFX() {
    const fx = $('#fx'); if (!fx) return;
    // Show only ONE atmosphere at a time (the newest) so the farm stays readable.
    let pick = null;
    if (UI.tfx) { if (Date.now() < UI.tfx.until && UI.tfx.list.length) pick = UI.tfx.list[0]; else if (Date.now() >= UI.tfx.until) UI.tfx = null; }
    if (!pick) {
      const recs = activeEvents().filter(r => !r.pending).slice().sort((a, b) => (b.startAt || 0) - (a.startAt || 0));
      for (const rec of recs) { const def = evDef(rec.key); const l = fxFor(rec.key + ' ' + ((def && def.key) || ''), def); if (l.length) { pick = l[0]; break; } }
    }
    const cls = 'fx' + (pick ? ' ' + pick : '');
    if (fx.className !== cls) fx.className = cls;
  }

  // ---------- HUD ----------
  function renderHUD() {
    const s = S(); if (!s) return;
    setText($('#hud-coins'), fmt(s.coins));
    setText($('#hud-lvl-num'), String(s.level));
    const need = G.xpForLevel(s.level), pct = clamp(s.xp / need * 100, 0, 100);
    const ring = $('#hud-ring'); if (ring) ring.style.setProperty('--p', pct.toFixed(1));
    const xb = $('#hud-xpbar'); if (xb) xb.style.width = pct.toFixed(1) + '%';
    setText($('#hud-xp'), `${fmt(s.xp)}/${fmt(need)} XP`);
    const cnt = G.barnCount(), cap = s.barnCap;
    setText($('#hud-barn'), `${cnt}/${cap}`);
    const bp = $('#hud-barn-pill'); if (bp) { bp.classList.toggle('warn', cnt / cap >= .75 && cnt < cap); bp.classList.toggle('full', cnt >= cap); }
    setText($('#hud-av'), avatar());
    const nm = pname(), farm = s.farmName;
    setText($('#hud-who-txt'), s.playerName ? nm + (farm ? ' · ' + farm : '') : (farm || 'Kellyville'));
    updateSeasonChip();
    const hud = $('#hud'); if (hud) document.documentElement.style.setProperty('--hud-h', hud.offsetHeight + 'px');
  }
  function renderStrip() {
    const strip = $('#event-strip'); if (!strip) return;
    const now = Date.now();
    const recs = activeEvents().filter(r => !r.pending && r.endAt > now);
    strip.hidden = !recs.length;
    const html = recs.map(r => {
      const def = evDef(r.key) || {};
      return `<button class="echip ${esc(def.kind || 'neutral')}" data-act="echip" data-id="${esc(r.id)}"><i>${esc(def.emoji || '❗')}</i><span><b>${esc(def.name || r.key)}</b><small ${tm('txt', 0, r.endAt)}></small></span></button>`;
    }).join('');
    if (strip._h !== html) { strip.innerHTML = html; strip._h = html; }
  }

  // ---------- Farm ----------
  function plotHTML(p, i) {
    const c = dget('crops', p.crop);
    if (p.status === 'empty') return `<div class="plot empty" data-act="plot" data-i="${i}" data-plot="${i}"><span class="plus">＋</span><small>Plant</small></div>`;
    if (p.status === 'withered') return `<div class="plot withered" data-act="plot" data-i="${i}" data-plot="${i}"><span class="pe">🥀</span><small>Tap to clear</small></div>`;
    const em = c ? c.emoji : '🌾';
    if (p.status === 'ready') {
      let n = 1; try { n = Math.max(1, Math.round(c.yield * p.yieldMult * (G.mods ? G.mods.yield(p.crop) : 1))); } catch (e) { }
      return `<div class="plot ready" data-act="plot" data-i="${i}" data-plot="${i}"><span class="yb">×${n}</span><span class="pe">${esc(em)}</span><small>Ready!</small></div>`;
    }
    return `<div class="plot growing" data-act="plot" data-i="${i}" data-plot="${i}"><span class="pe" ${tm('crop', p.plantedAt, p.readyAt, ` data-emoji="${esc(em)}"`)}>🌱</span><div class="pbar"><i ${tm('bar', p.plantedAt, p.readyAt)}></i></div><small ${tm('txt', 0, p.readyAt)}></small></div>`;
  }
  function renderPlots() {
    const s = S(), h = s.plots.map(plotHTML);
    if (s.plots.length < s.maxPlots) h.push(`<div class="plot buy" data-act="buyplot"><span class="plus">＋</span><small>Buy land<br>🪙 ${fmt(G.plotCost())}</small></div>`);
    patchChildren($('#plots'), h);
    const g = s.plots.filter(p => p.status === 'growing').length, r = s.plots.filter(p => p.status === 'ready').length;
    setText($('#field-info'), `${s.plots.length} plots · ${g} growing${r ? ' · ' + r + ' ready' : ''}`);
  }
  function penHTML(a, i) {
    const d = dget('animals', a.type) || { name: a.type, emoji: '🐾' };
    const head = `<span class="em">${esc(d.emoji)}</span><b>${esc(d.name)}</b>`;
    if (a.status === 'ready') return `<div class="pen ready" data-act="collect" data-i="${i}">${head}<span class="st">${esc(iEmoji(d.product))} Collect</span></div>`;
    if (a.status === 'producing') {
      const start = a.fedAt || (a.readyAt - (d.produceSec || 60) * 1000);
      return `<div class="pen producing" data-act="pen-info" data-i="${i}">${head}<div class="mini"><i ${tm('bar', start, a.readyAt)}></i></div><span class="st" ${tm('txt', 0, a.readyAt)}></span></div>`;
    }
    const need = d.feedQty || 1, have = G.qty(d.feed);
    return `<div class="pen hungry" data-act="feed" data-i="${i}">${head}<span class="st ${have >= need ? '' : 'lack'}">Feed ${need}× ${esc(iEmoji(d.feed))}</span></div>`;
  }
  function bldHTML(b, i) {
    const d = dget('buildings', b.type) || { name: b.type, emoji: '🏭' }, now = Date.now();
    const ready = b.queue.filter(j => j.readyAt <= now).length;
    const cur = b.queue.find(j => j.readyAt > now);
    let pips = '';
    for (let k = 0; k < b.maxQueue; k++) pips += `<i class="${k < ready ? 'done' : k < b.queue.length ? 'on' : ''}"></i>`;
    let line = '<small>Idle · tap to cook</small>';
    if (cur) line = `<div class="mini" style="width:100%"><i ${tm('bar', cur.startAt, cur.readyAt)}></i></div><small ${tm('txt', cur.startAt, cur.readyAt)}></small>`;
    else if (ready) line = '<small>Ready to collect!</small>';
    return `<div class="bld ${ready ? 'has-ready' : ''}" data-act="bld" data-i="${i}">${ready ? `<span class="rb" data-act="bcollect" data-i="${i}">✓ ${ready}</span>` : ''}<span class="em">${esc(d.emoji)}</span><div class="bi"><b>${esc(d.name)}</b><div class="pips">${pips}</div>${line}</div></div>`;
  }
  function renderFarm() {
    const s = S();
    renderPlots();
    const pens = s.animals.map(penHTML);
    if (!pens.length) pens.push('<div class="empty-note">No animals yet. Visit the Shop 🏪 for chickens, cows and more!</div>');
    patchChildren($('#pens'), pens);
    setText($('#pen-info'), s.animals.length ? `${s.animals.filter(a => a.status === 'ready').length} ready · ${s.animals.length} animals` : '');
    const bl = s.buildings.map(bldHTML);
    if (!bl.length) bl.push('<div class="empty-note">No buildings yet. Build a mill or bakery in the Shop 🏪</div>');
    patchChildren($('#blds'), bl);
    setText($('#bld-info'), s.buildings.length ? s.buildings.length + ' built' : '');
  }

  // ---------- Orders ----------
  function ordersList() { try { return (G.Economy && G.Economy.orders && G.Economy.orders()) || []; } catch (e) { return []; } }
  function canFul(o) { try { if (G.Economy && G.Economy.canFulfill) return !!G.Economy.canFulfill(o.id); } catch (e) { } return G.hasItems(o.items); }
  const isSlotCool = o => !Object.keys(o.items || {}).length || (o.cooldownUntil && o.cooldownUntil > Date.now());
  function orderHTML(o) {
    const now = Date.now();
    if (isSlotCool(o)) {
      return `<div class="order cool"><span class="truck">🚚</span><b>Next order in</b><small ${tm('txt', 0, o.cooldownUntil || now, ' data-done="Arriving..."')}></small></div>`;
    }
    const rg = (D().regions || {})[o.region] || {}, can = canFul(o), exp = !!o.expiresAt;
    return `<div class="order ${exp ? 'express' : ''} ${can ? 'can' : ''}">${exp ? `<span class="o-exp">⚡ <span ${tm('txt', 0, o.expiresAt)}></span></span>` : ''}
      <div class="o-head"><div class="o-av">${esc(o.customerEmoji || '🧑')}</div><div class="o-who"><b>${esc(o.customer || 'Customer')}</b><small>${esc(rg.emoji || '📍')} ${esc(rg.name || o.region || '')}</small></div></div>
      <div class="o-items">${needChips(o.items)}</div>
      <div class="o-rew"><span>🪙 ${fmt(o.coins)}</span><span>⭐ ${fmt(o.xp)}</span></div>
      <div class="o-foot"><button class="btn btn-green sm ${can ? '' : 'off'}" data-act="odo" data-id="${esc(o.id)}" ${can ? '' : 'aria-disabled="true"'}>Deliver</button><button class="btn-ico" data-act="odel" data-id="${esc(o.id)}" aria-label="Discard order">🗑️</button></div></div>`;
  }
  function renderOrders() {
    const list = ordersList();
    const real = list.filter(o => !isSlotCool(o)), cool = list.filter(isSlotCool);
    const h = real.concat(cool).map(orderHTML);
    if (!h.length) h.push('<div class="empty-note">No orders right now. Trucks are on the way! 🚚</div>');
    patchChildren($('#orders-grid'), h);
    setText($('#orders-info'), `${real.filter(canFul).length}/${real.length} ready to deliver`);
  }
  function ordersSig() { const n = Date.now(); return ordersList().map(o => o.id + (isSlotCool(o) ? 'c' : 'o')).join(','); }

  // ---------- Shop ----------
  const TAGINFO = { irrigation: '💧 Protects vs drought & heat', windbreak: '🌲 Less wind & dust damage', frost_fans: '🌀 Frost protection', beehives: '🐝 Pollination boost', firebreak: '🚒 Wildfire protection', cold_storage: '🧊 Price-crash shield' };
  function catalog() {
    let c = null; try { c = G.Economy && G.Economy.shopCatalog && G.Economy.shopCatalog(); } catch (e) { }
    if (c) return c;
    const mk = cat => Object.keys(D()[cat] || {}).map(key => ({ key, def: D()[cat][key] })).sort((a, b) => (a.def.level || 1) - (b.def.level || 1));
    return { animals: mk('animals'), buildings: mk('buildings'), expansions: mk('expansions'), plot: { cost: G.plotCost(), available: S().plots.length < S().maxPlots } };
  }
  function shopCard(e, kind) {
    const s = S(), d = e.def || {}, lvl = d.level || 1, key = e.key;
    let owned = false, count = 0, maxed = false, locked = s.level < lvl, need = '';
    if (kind === 'animals') { count = s.animals.filter(a => a.type === key).length; maxed = count >= (d.max || 6); }
    else if (kind === 'buildings') owned = s.buildings.some(b => b.type === key);
    else { owned = G.hasExpansion(key); if (d.requires && !G.hasExpansion(d.requires)) { locked = locked || false; need = (dget('expansions', d.requires) || {}).name || d.requires; } }
    const tags = [];
    if (kind === 'animals') { tags.push(`<span class="tag">${esc(iEmoji(d.product))} ${esc(iName(d.product))} / ${fmtT(d.produceSec)}</span>`, `<span class="tag">Eats ${d.feedQty || 1}× ${esc(iEmoji(d.feed))}</span>`, `<span class="tag">${count}/${d.max || 6} owned</span>`); }
    if (kind === 'buildings') { const outs = (d.recipes || []).slice(0, 6).map(r => esc(iEmoji(r.output))).join(' '); tags.push(`<span class="tag">${(d.recipes || []).length} recipes</span>`); if (outs) tags.push(`<span class="tag">${outs}</span>`); }
    if (kind === 'upgrades') { if (d.barnCap) tags.push(`<span class="tag">🏚️ +${d.barnCap} barn space</span>`); if (d.maxPlots) tags.push(`<span class="tag">🟫 +${d.maxPlots} plot limit</span>`); if (d.tag && TAGINFO[d.tag]) tags.push(`<span class="tag">${esc(TAGINFO[d.tag])}</span>`); }
    let act;
    if (owned) act = '<span class="owned">✓ Owned</span>';
    else if (maxed) act = '<span class="owned">Max</span>';
    else if (s.level < lvl) act = `<span class="lockpill">🔒 Lv ${lvl}</span>`;
    else if (need) act = `<span class="lockpill" style="font-size:11px">Needs ${esc(need)}</span>`;
    else act = `<button class="btn btn-gold sm ${s.coins < d.cost ? 'poor' : ''}" data-act="buy" data-kind="${kind}" data-key="${esc(key)}">🪙 ${fmt(d.cost)}</button>`;
    const lock = (s.level < lvl) || (!!need && !owned);
    return `<div class="shop-card ${lock ? 'locked' : ''}"><div class="sc-e">${esc(d.emoji || '📦')}</div><div class="sc-m"><b>${esc(d.name || key)}</b><small>${esc(d.desc || '')}</small><div class="sc-tags">${tags.join('')}</div></div><div class="sc-act">${act}</div></div>`;
  }
  function renderShop() {
    $$('#shop-seg button').forEach(b => b.classList.toggle('on', b.dataset.v === UI.shopTab));
    const c = catalog(); let h = [];
    if (UI.shopTab === 'animals') h = (c.animals || []).map(e => shopCard(e, 'animals'));
    else if (UI.shopTab === 'buildings') h = (c.buildings || []).map(e => shopCard(e, 'buildings'));
    else if (UI.shopTab === 'upgrades') h = (c.expansions || []).map(e => shopCard(e, 'upgrades'));
    else {
      const s = S(), cost = G.plotCost(), avail = s.plots.length < s.maxPlots;
      h = [`<div class="shop-card"><div class="sc-e">🟫</div><div class="sc-m"><b>New field plot</b><small>More land means more crops. You own ${s.plots.length} of ${s.maxPlots} possible plots. Upgrades can raise the limit.</small><div class="sc-tags"><span class="tag">${s.plots.length}/${s.maxPlots} plots</span></div></div><div class="sc-act">${avail ? `<button class="btn btn-gold sm ${s.coins < cost ? 'poor' : ''}" data-act="buy" data-kind="land" data-key="plot">🪙 ${fmt(cost)}</button>` : '<span class="lockpill">Max land</span>'}</div></div>`];
    }
    if (!h.length) h = ['<div class="empty-note">Nothing here yet.</div>'];
    patchChildren($('#shop-list'), h);
    setText($('#shop-info'), '🪙 ' + fmt(S().coins));
  }

  // ---------- Barn ----------
  function trendDir(key) {
    let t; try { t = G.Economy && G.Economy.trend && G.Economy.trend(key); } catch (e) { }
    let d = 0;
    if (typeof t === 'string') d = /up|rise|\+|▲|↑/i.test(t) ? 1 : /down|fall|-|▼|↓/i.test(t) ? -1 : 0;
    else if (typeof t === 'number') d = t >= .5 ? (t > 1.04 ? 1 : t < .96 ? -1 : 0) : (t > .03 ? 1 : t < -.03 ? -1 : 0);
    if (!d && G.mods) { const m = G.mods.price(key); d = m > 1.04 ? 1 : m < .96 ? -1 : 0; }
    return d;
  }
  function renderBarn() {
    const s = S(), cnt = G.barnCount(), cap = s.barnCap, pct = clamp(cnt / cap * 100, 0, 100);
    const f = $('#barn-fill'); if (f) { f.style.width = pct + '%'; f.className = pct >= 100 ? 'full' : pct >= 75 ? 'warn' : ''; }
    setText($('#barn-cap-txt'), `${cnt}/${cap} stored`);
    setText($('#barn-info'), pct >= 90 ? 'Almost full! Sell or upgrade' : '');
    const items = Object.entries(s.barn).filter(([, q]) => q > 0).sort((a, b) => iName(a[0]).localeCompare(iName(b[0])));
    const h = items.map(([k, q]) => {
      const d = trendDir(k), p = G.sellPrice(k);
      return `<div class="item"><div class="it-top"><div class="it-e">${esc(iEmoji(k))}<span class="it-q">${q}</span></div><div class="it-m"><b>${esc(iName(k))}</b><div class="it-p">🪙 ${p} <span class="${d > 0 ? 'tr-up' : d < 0 ? 'tr-down' : 'tr-flat'}">${d > 0 ? '▲' : d < 0 ? '▼' : '▬'}</span></div></div></div>
      <div class="it-btns"><button class="btn btn-gold sm" data-act="sell" data-key="${esc(k)}" data-n="1">Sell 1</button><button class="btn btn-green sm" data-act="sell" data-key="${esc(k)}" data-n="all">All +${fmt(p * q)}</button></div></div>`;
    });
    if (!h.length) h.push('<div class="empty-note">The barn is empty. Harvest some crops! 🌾</div>');
    patchChildren($('#barn-grid'), h);
  }

  // ---------- Almanac ----------
  function ago(t) {
    const m = Math.floor((Date.now() - t) / 60000);
    return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : Math.floor(m / 60) + 'h ago';
  }
  function fillProfile(force) {
    const s = S();
    setText($('#pf-av'), avatar());
    $$('#pf-avatars button').forEach(b => b.classList.toggle('on', b.dataset.v === avatar()));
    const n = $('#pf-name'), f = $('#pf-farm');
    if (n && (force || document.activeElement !== n)) n.value = s.playerName || '';
    if (f && (force || document.activeElement !== f)) f.value = s.farmName || '';
  }
  function renderAlmanac() {
    const s = S(), cal = G.calendar(), st = s.stats || {};
    setText($('#alm-info'), `Year ${cal.year} · Day ${cal.day}`);
    const tile = (e, v, l) => `<div class="stat"><i>${e}</i><b>${fmt(v)}</b><small>${l}</small></div>`;
    setHTML($('#alm-stats'), tile('🌾', st.harvested, 'Harvested') + tile('📋', st.ordersDone, 'Orders done') + tile('🪙', st.coinsEarned, 'Coins earned') + tile('⚡', st.eventsSeen, 'Events seen') + tile('⭐', s.level, 'Level') + tile('🟫', s.plots.length, 'Plots'));
    const log = (s.eventLog || []).slice().reverse();
    setHTML($('#alm-log'), log.length ? log.map(e => {
      const k = e.kind === 'good' ? 'good' : e.kind === 'bad' ? 'bad' : 'neutral';
      return `<div class="log ${k}"><i>${esc(e.emoji || '❗')}</i><div><b>${esc(e.name || e.key)}</b><small>${esc(e.text || '')}</small></div><time>${ago(e.at)}</time></div>`;
    }).join('') : '<div class="empty-note">No events yet. The Palouse is quiet... for now. 🌾</div>');
    setHTML($('#alm-regions'), Object.values(D().regions || {}).map(r => `<div class="region"><i>${esc(r.emoji)}</i><div><b>${esc(r.name)}</b><small>${esc(r.blurb)}</small></div></div>`).join(''));
    fillProfile(false);
  }

  // ---------- view switching / render ----------
  function renderView() {
    ({ farm: () => { if (!worldOn()) renderFarm(); }, orders: renderOrders, shop: renderShop, barn: renderBarn, almanac: renderAlmanac }[UI.tab] || renderFarm)();
  }
  // The Farm tab is a walkable canvas world (world.js) unless the player chose the old list view or world.js is unavailable.
  function worldOn() { return !!(G.World && G.World.enabled && G.World.enabled()) && !(S().flags && S().flags['world.list']); }
  function showTab(t) {
    UI.tab = t;
    const app = $('#app'); app.dataset.tab = t;
    const wo = t === 'farm' && worldOn();
    app.dataset.world = wo ? 'on' : 'off';
    $$('.view').forEach(v => { v.hidden = v.dataset.view !== t || (wo && t === 'farm'); });
    $$('#tabbar .tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    if (t === 'almanac') fillProfile(true);
    renderAll(); scrollTo(0, 0);
    G.bus.emit('tab', t);
  }
  function renderBadges() {
    const n = ordersList().filter(o => !isSlotCool(o) && canFul(o)).length;
    const b = $('#badge-orders'); if (b) { b.hidden = !n; setText(b, String(n)); }
    const bb = $('#badge-barn'); if (bb) bb.hidden = !(G.barnCount() / S().barnCap >= .9);
  }
  function renderFab() {
    const n = S().plots.filter(p => p.status === 'ready').length, f = $('#fab-harvest');
    if (!f) return;
    f.hidden = !(UI.tab === 'farm' && n >= 2 && !UI.sheet);
    setText($('#fab-n'), '(' + n + ')');
  }
  function renderAll() {
    renderHUD(); renderStrip(); renderBadges(); renderView(); renderSheet(); renderFab(); updateFX(); updateTimers();
  }
  function queueRender() {
    if (UI.pending) return; UI.pending = true;
    requestAnimationFrame(() => { UI.pending = false; try { renderAll(); } catch (e) { console.error('[ui render]', e); } });
  }

  // ---------- timers ----------
  function updateTimers(now) {
    now = now || Date.now();
    $$('[data-tm]').forEach(el => {
      const t = el.dataset.tm, end = +el.dataset.end, start = +el.dataset.start || 0;
      if (t === 'bar') {
        const w = clamp(end > start ? (now - start) / (end - start) * 100 : 100, 0, 100).toFixed(1) + '%';
        if (el._w !== w) { el.style.width = w; el._w = w; }
      } else if (t === 'txt') {
        const left = (end - now) / 1000; let s;
        if (start && now < start) s = 'Queued'; else s = left <= 0 ? (el.dataset.done || 'Done') : fmtT(left);
        s = (el.dataset.pre || '') + s;
        if (el.textContent !== s) el.textContent = s;
      } else if (t === 'crop') {
        const prog = clamp((now - start) / Math.max(1, end - start), 0, 1), st = prog < .3 ? 0 : 1;
        const em = st ? el.dataset.emoji : '🌱';
        if (el.textContent !== em) el.textContent = em;
        const sc = (st ? .6 + .5 * ((prog - .3) / .7) : .75 + prog * .5).toFixed(2);
        if (el._s !== sc) { el.style.transform = `scale(${sc})`; el._s = sc; }
      }
    });
  }
  function tickChecks(now) {
    const bs = S().buildings.map(b => b.queue.filter(j => j.readyAt <= now).length).join('');
    let changed = false;
    if (bs !== UI.sig.b) { UI.sig.b = bs; changed = true; }
    if (UI.tab === 'orders' || true) { const os = ordersSig(); if (os !== UI.sig.o) { UI.sig.o = os; changed = true; } }
    const ev = activeEvents().filter(r => !r.pending && r.endAt > now).map(r => r.id).join();
    if (ev !== UI.sig.e) { UI.sig.e = ev; changed = true; }
    if (UI.tfx && now > UI.tfx.until) { UI.tfx = null; changed = true; }
    if (changed) queueRender();
  }

  // ---------- sheets ----------
  function openSheet(spec) {
    UI.sheet = spec;
    const w = $('#sheet-wrap'); w.hidden = false;
    const b = $('#sheet-body'); b._h = null;
    void w.offsetWidth; w.classList.add('open');
    renderSheet(); renderFab();
  }
  function closeSheet() {
    if (!UI.sheet) return;
    UI.sheet = null;
    const w = $('#sheet-wrap'); w.classList.remove('open');
    setTimeout(() => { if (!UI.sheet) w.hidden = true; }, 240);
    renderFab();
  }
  function renderSheet() {
    const sp = UI.sheet; if (!sp) return;
    let html = '';
    try { html = sp.kind === 'panel' ? panelSheet(sp) : sp.kind === 'seed' ? seedSheet(sp) : sp.kind === 'bld' ? bldSheet(sp) : eventSheet(sp); } catch (e) { console.error(e); }
    if (html == null) { closeSheet(); return; }
    const body = $('#sheet-body'); if (body._h === html) return;
    // never clobber a field the player is typing in
    if (sp.kind === 'panel' && body._h && document.activeElement && body.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const hs = $('.hscroll', body), sl = hs ? hs.scrollLeft : 0, st = body.scrollTop;
    body.innerHTML = html; body._h = html;
    const hs2 = $('.hscroll', body); if (hs2) hs2.scrollLeft = sl; body.scrollTop = st;
    updateTimers();
  }
  const head = (title, sub) => `<div class="sh-head"><div><h3>${title}</h3>${sub ? `<small>${sub}</small>` : ''}</div><button class="sh-x" data-act="sheet-close" aria-label="Close">✕</button></div>`;
  function panelSheet(sp) {
    const P = G.panels && G.panels[sp.key]; if (!P) return null;
    const body = P.render ? P.render(sp.arg) : '';
    if (body == null) return null;
    const t = P.title ? P.title(sp.arg) : sp.key, sub = P.sub ? P.sub(sp.arg) : '';
    return head(t, sub) + `<div class="panel-body" data-panel="${esc(sp.key)}">${body}</div>`;
  }
  function seedSheet(sp) {
    const s = S(), season = G.calendar().season, last = s.flags['ui.lastCrop'];
    const crops = Object.entries(D().crops || {}).sort((a, b) => (a[1].level || 1) - (b[1].level || 1) || a[1].seedCost - b[1].seedCost);
    const empties = s.plots.filter(p => p.status === 'empty').length;
    if (sp.plot != null && s.plots[sp.plot] && s.plots[sp.plot].status !== 'empty' && !UI.seedAll && sp._opened) return null;
    sp._opened = true;
    const si = (G.SEASON_INFO || {})[season] || { name: season, emoji: '' };
    const cards = crops.map(([k, c]) => {
      const locked = s.level < (c.level || 1), inS = (c.seasons || []).includes(season);
      const badge = locked ? `<span class="badge2 lock">🔒 Lv ${c.level}</span>` : inS ? '<span class="badge2 in">✓ In season</span>' : '<span class="badge2 off">Off-season ½ yield</span>';
      return `<div class="seed ${locked ? 'locked' : ''} ${last === k ? 'last' : ''} ${s.coins < c.seedCost && !locked ? 'poor' : ''}" data-act="seed" data-key="${esc(k)}"><div class="seed-e">${esc(c.emoji)}</div><div class="seed-n">${esc(c.name)}</div><div class="seed-r"><span class="cost">🪙 ${c.seedCost} seed</span><span>⏱ ${fmtT(c.growSec)}</span><span>🧺 yield ×${c.yield}</span><span>💰 sells ${c.sellPrice}</span></div>${badge}</div>`;
    }).join('');
    const lc = dget('crops', last), lcOk = lc && s.level >= (lc.level || 1);
    const cost = lcOk ? lc.seedCost * empties : 0;
    return head('🌱 Choose a crop', `${si.emoji} ${esc(si.name)} · ${empties} empty plot${empties === 1 ? '' : 's'}`) +
      `<div class="hscroll">${cards}</div><div class="sheet-foot">
      <button class="toggle ${UI.seedAll ? 'on' : ''}" data-act="seedall">${UI.seedAll ? '☑' : '☐'} Tap a seed to fill all ${empties} empty plots</button>
      <button class="btn btn-gold ${lcOk && empties ? '' : 'off'}" data-act="plantall" ${lcOk && empties ? '' : 'aria-disabled="true"'}>🚜 Plant all empty${lcOk ? ` with ${esc(lc.emoji)} ${esc(lc.name)} · 🪙 ${fmt(cost)}` : ''}</button></div>`;
  }
  function bldSheet(sp) {
    const s = S(), b = s.buildings[sp.i]; if (!b) return null;
    const d = dget('buildings', b.type) || { name: b.type, emoji: '🏭', recipes: [] }, now = Date.now();
    const ready = b.queue.filter(j => j.readyAt <= now).length;
    let q = '';
    for (let k = 0; k < b.maxQueue; k++) {
      const j = b.queue[k];
      if (!j) { q += `<div class="qrow" style="opacity:.55"><span class="qe">➕</span><div class="qm"><b>Empty slot</b></div></div>`; continue; }
      const r = G.findRecipe ? G.findRecipe(b.type, j.recipeId) : null, done = j.readyAt <= now;
      q += `<div class="qrow ${done ? 'done' : ''}"><span class="qe">${esc(r ? iEmoji(r.output) : '❔')}</span><div class="qm"><b>${esc(r ? r.name : j.recipeId)}</b>${done ? '<small>✓ Ready!</small>' : `<div class="mini" style="width:100%"><i ${tm('bar', j.startAt, j.readyAt)}></i></div><small ${tm('txt', j.startAt, j.readyAt)}></small>`}</div></div>`;
    }
    const full = b.queue.length >= b.maxQueue;
    const recs = (d.recipes || []).map(r => {
      const locked = s.level < (r.level || 1), can = !locked && !full && G.hasItems(r.inputs);
      return `<div class="rec ${locked ? 'locked' : ''}"><span class="re">${esc(iEmoji(r.output))}</span><div class="rm"><b>${esc(r.name)} ×${r.qty || 1}</b><div class="needs">${needChips(r.inputs)}</div><small>⏱ ${fmtT(r.sec)} · ⭐ ${r.xp || 0} xp</small></div>${locked ? `<span class="lockpill">🔒 Lv ${r.level}</span>` : `<button class="btn btn-green sm ${can ? '' : 'off'}" data-act="recipe" data-i="${sp.i}" data-id="${esc(r.id)}" ${can ? '' : 'aria-disabled="true"'}>Start</button>`}</div>`;
    }).join('');
    return head(`${esc(d.emoji)} ${esc(d.name)}`, esc(d.desc || '')) + `<div class="sub">Production queue (${b.queue.length}/${b.maxQueue})</div>${q}
      ${ready ? `<button class="btn btn-green" style="width:100%;margin-bottom:6px" data-act="bcollect" data-i="${sp.i}">📦 Collect ${ready} finished</button>` : ''}
      <div class="sub">Recipes</div>${recs || '<div class="empty-note">No recipes.</div>'}`;
  }
  function eventSheet(sp) {
    const rec = activeEvents().find(r => r.id === sp.id); if (!rec) return null;
    const def = evDef(rec.key) || {}, kind = def.kind || 'neutral';
    const lg = (S().eventLog || []).slice().reverse().find(e => e.key === rec.key && e.at === rec.startAt);
    let text = lg ? lg.text : (typeof def.text === 'string' ? def.text : def.desc || '');
    let mods = []; try { const m = G.Events.describeMods(rec); mods = Array.isArray(m) ? m : m ? [String(m)] : []; } catch (e) { }
    return head('Event details') + `<div class="det-banner ${esc(kind)}"><div class="big">${esc(def.emoji || '❗')}</div><h3>${esc(def.name || rec.key)}</h3><small ${tm('txt', 0, rec.endAt, ' data-pre="⏳ "')}></small></div>
      <p style="font-size:14px;line-height:1.4;margin:12px 2px">${esc(text)}</p>
      ${mods.length ? `<div class="sub">Effects</div><ul class="modlist">${mods.map(m => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}`;
  }

  // ---------- modals ----------
  function pushModal(spec) { UI.modals.push(spec); if (!UI.cur) nextModal(); }
  function nextModal() {
    const root = $('#modal-root'), spec = UI.modals.shift();
    UI.cur = spec || null;
    if (!spec) { root.hidden = true; root.innerHTML = ''; return; }
    root.hidden = false;
    root.innerHTML = `<div class="modal-bg"><div class="mwrap">${spec.html}</div></div>`;
    try { spec.onShow && spec.onShow(root); } catch (e) { console.error(e); }
    updateTimers();
  }
  function dismissEventModal(id) {
    UI.modals = UI.modals.filter(m => m.eventId !== id);
    if (UI.cur && UI.cur.eventId === id) nextModal();
  }
  function modsOf(rec) { try { const m = G.Events.describeMods(rec); return Array.isArray(m) ? m : m ? [String(m)] : []; } catch (e) { return []; } }
  function eventModal(p) {
    const def = p.def || {}, rec = p.event || {}, kind = def.kind === 'bad' ? 'bad' : def.kind === 'good' ? 'good' : 'neutral';
    const choices = p.choices && p.choices.length ? p.choices : null;
    const text = p.text || (typeof def.text === 'string' ? def.text : '') || def.desc || '';
    const mods = rec.pending ? [] : modsOf(rec);
    const kl = kind === 'bad' ? 'Trouble on the Palouse' : kind === 'good' ? 'Lucky break!' : 'News from the farm';
    let btns;
    if (choices) {
      btns = choices.map((c, i) => {
        const cost = c.cost || 0, aff = S().coins >= cost;
        return `<button class="choice ${aff ? '' : 'poor'}" data-act="m-choice" data-i="${i}"><b>${esc(c.emoji ? c.emoji + ' ' : '')}${esc(c.label || c.text || c.name || 'Option ' + (i + 1))}</b>${c.desc ? `<small>${esc(c.desc)}</small>` : ''}<span class="cost">${cost ? '🪙 ' + fmt(cost) : 'Free'}</span></button>`;
      }).join('');
    } else btns = `<button class="btn ok-btn" data-act="m-close">OK</button>`;
    return {
      eventId: rec.id, hasChoices: !!choices,
      html: `<div class="mcard ev ${kind}"><span class="ev-kind">${kl}</span><div class="ev-emoji">${esc(def.emoji || '❗')}</div><h2>${esc(def.name || def.key || 'Event')}</h2><p>${esc(text)}</p>
        ${mods.length ? `<ul class="ev-mods">${mods.map(m => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
        ${choices && rec.endAt ? `<div class="ev-timer" ${tm('txt', 0, rec.endAt, ' data-pre="⏳ Decide in "')}></div>` : ''}${btns}</div>`,
      onChoice(i) {
        let ok = true;
        try { ok = G.Events && G.Events.choose ? G.Events.choose(rec.id, i) : true; } catch (e) { console.error(e); ok = false; }
        if (ok === false) { G.toast((choices[i] && choices[i].cost && S().coins < choices[i].cost) ? 'Not enough coins for that option' : "Can't do that right now", 'bad'); return; }
        dismissEventModal(rec.id);
      },
      onShow() { if (kind === 'bad') { const a = $('#app'); a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake'); setTimeout(() => a.classList.remove('shake'), 600); } }
    };
  }
  function unlocksFor(level) {
    const out = [];
    [['crops', 'crop'], ['animals', 'animal'], ['buildings', 'building'], ['expansions', 'upgrade']].forEach(([cat, kind]) => {
      Object.values(D()[cat] || {}).forEach(d => { if ((d.level || 1) === level) out.push((d.emoji || '') + ' ' + d.name); });
    });
    Object.values(D().buildings || {}).forEach(b => (b.recipes || []).forEach(r => { if ((r.level || 1) === level && level > 1) out.push(iEmoji(r.output) + ' ' + r.name); }));
    return out;
  }
  function levelModal(level) {
    const un = unlocksFor(level);
    return {
      html: `<div class="mcard lvl-card"><div class="lvl-big">🌟</div><div class="ev-kind" style="background:rgba(120,70,0,.18)">Level up!</div><div class="num">Level ${level}</div><h2 style="font-size:20px">Nice work, ${esc(pname())}!</h2>
        ${un.length ? `<p style="margin-bottom:4px">New unlocks</p><div class="unlocks">${un.map(u => `<span>${esc(u)}</span>`).join('')}</div>` : '<p>Keep farming to unlock more!</p>'}
        <p style="font-size:12px;color:var(--ink2);margin:6px 0 0">Level-up bonus coins added!</p><button class="btn btn-gold" data-act="m-close">Awesome!</button></div>`,
      onShow: confetti
    };
  }
  function welcomeModal() {
    const named = !!S().playerName;
    return {
      html: `<div class="mcard"><div class="wel-av">${esc(avatar())}</div><h2>Welcome to Kellyville!</h2><p style="margin-bottom:6px">Farm life in Eastern Washington, from golden Palouse wheat to Wenatchee apples.</p>
        <label class="name-lbl" for="name-in">What's your name, farmer?</label><input id="name-in" class="name-in" maxlength="20" autocomplete="off" autocapitalize="words" placeholder="Your name" value="${esc(S().playerName || '')}">
        <ul class="tips"><li><i>🚶</i><span>Walk your farm! Drag anywhere to steer (a joystick appears under your thumb) or tap a spot to walk there.</span></li><li><i>🌱</i><span>Walk up to a plot, animal or building and tap the big action button to plant, harvest, feed or open it.</span></li><li><i>📋</i><span>Fill truck orders at the mailbox for coins and XP, and sell extras from the Barn.</span></li><li><i>⛈️</i><span>Dust, frost, fire and lucky breaks can strike. Buy upgrades in the Shop to protect your farm.</span></li></ul>
        <button class="btn btn-green ${named ? '' : 'off'}" id="wel-go" data-act="welcome-go" ${named ? '' : 'aria-disabled="true"'}>🚜 Start farming</button></div>`,
      onShow(root) {
        const inp = $('#name-in', root), go = $('#wel-go', root); if (!inp) return;
        const sync = () => { const ok = inp.value.trim().length > 0; go.classList.toggle('off', !ok); if (ok) go.removeAttribute('aria-disabled'); else go.setAttribute('aria-disabled', 'true'); };
        inp.addEventListener('input', sync);
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); welcomeGo(); } });
        setTimeout(() => { try { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } catch (e) { } }, 350);
      }
    };
  }
  function welcomeGo() {
    const inp = $('#name-in'); if (!inp) return;
    if (!G.setPlayerName || !G.setPlayerName(inp.value)) { G.toast('Please enter your name', 'bad'); return; }
    S().flags['ui.welcomed'] = true;
    inp.blur();
    nextModal(); G.toast(`Welcome to Kellyville, ${pname()}!`, 'good'); G.save && G.save();
  }
  function confirmReset() {
    pushModal({
      html: `<div class="mcard"><div class="wel-av">⚠️</div><h2>Reset farm?</h2><p>All progress, coins and animals will be erased. This cannot be undone.</p><button class="btn btn-red" data-act="m-yes">Yes, reset everything</button><button class="btn btn-gray" data-act="m-close">Keep farming</button></div>`,
      onYes() { nextModal(); try { G.reset(); } catch (e) { console.error(e); } }
    });
  }

  // ---------- actions ----------
  function plantMany(key) {
    const c = dget('crops', key); if (!c) return;
    S().flags['ui.lastCrop'] = key; let n = 0;
    S().plots.forEach((p, i) => { if (p.status === 'empty' && G.plant(i, key)) n++; });
    if (n) G.toast(`Planted ${n}× ${c.name}`, 'good');
    closeSheet();
  }
  const ACT = {
    tab(el) { showTab(el.dataset.tab); },
    plot(el) {
      const i = +el.dataset.i, p = S().plots[i]; if (!p) return;
      if (p.status === 'empty') openSheet({ kind: 'seed', plot: i });
      else if (p.status === 'ready') G.harvest(i);
      else if (p.status === 'withered') { G.clearWithered(i); G.toast('Cleared the withered crop', 'info'); }
      else { const c = dget('crops', p.crop) || {}; G.toast(`${c.emoji || '🌱'} ${c.name || 'Crop'}: ${fmtT((p.readyAt - Date.now()) / 1000)} left`, 'info'); }
    },
    buyplot() { if (G.buyPlot()) G.toast('New plot of land!', 'good'); },
    harvestall() {
      const idx = []; S().plots.forEach((p, i) => { if (p.status === 'ready') idx.push(i); });
      UI.flySeq = 0; let n = 0;
      for (const i of idx) { if (!G.harvest(i)) break; n++; }
      if (n) setTimeout(() => { UI.flySeq = 0; }, 800);
    },
    seed(el) {
      const key = el.dataset.key, c = dget('crops', key); if (!c) return;
      if (S().level < (c.level || 1)) { G.toast(`${c.name} unlocks at level ${c.level}`, 'bad'); return; }
      if (UI.seedAll) { plantMany(key); return; }
      const i = UI.sheet && UI.sheet.plot;
      if (G.plant(i, key)) { S().flags['ui.lastCrop'] = key; closeSheet(); }
      else if (S().plots[i] && S().plots[i].status !== 'empty') closeSheet();
    },
    seedall() { UI.seedAll = !UI.seedAll; renderSheet(); },
    plantall(el) { const k = S().flags['ui.lastCrop']; if (!k || el.getAttribute('aria-disabled')) return; plantMany(k); },
    'sheet-close'() { closeSheet(); },
    pact(el, e) {
      const sp = UI.sheet; if (!sp || sp.kind !== 'panel') return;
      const P = G.panels && G.panels[sp.key]; if (!P || !P.onAction) return;
      if (el.getAttribute('aria-disabled') === 'true' && !el.dataset.always) { if (el.dataset.why) G.toast(el.dataset.why, 'bad'); return; }
      P.onAction(el.dataset.pa, el, sp.arg, e); queueRender();
    },
    'sheet-bg'(el, e) { if (e.target === el) closeSheet(); },
    feed(el) { G.feedAnimal(+el.dataset.i); },
    collect(el) { G.collectAnimal(+el.dataset.i); },
    'pen-info'(el) { const a = S().animals[+el.dataset.i]; if (a) { const d = dget('animals', a.type) || {}; G.toast(`${d.emoji || ''} ${d.name || 'Animal'}: ${fmtT((a.readyAt - Date.now()) / 1000)} until ${iName(d.product)}`, 'info'); } },
    bld(el) { openSheet({ kind: 'bld', i: +el.dataset.i }); },
    bcollect(el, e) { if (e && e.stopPropagation) e.stopPropagation(); G.collectBuilding(+el.dataset.i); },
    recipe(el) { if (el.getAttribute('aria-disabled')) { const b = S().buildings[+el.dataset.i]; G.toast(b && b.queue.length >= b.maxQueue ? 'Queue full' : 'Missing ingredients', 'bad'); return; } G.startRecipe(+el.dataset.i, el.dataset.id); },
    odo(el) {
      if (el.getAttribute('aria-disabled')) { G.toast('You are missing some items', 'bad'); return; }
      try { if (G.Economy && G.Economy.fulfill) G.Economy.fulfill(el.dataset.id); } catch (e) { console.error(e); }
    },
    odel(el) { try { if (G.Economy && G.Economy.discard) { G.Economy.discard(el.dataset.id); G.toast('Order discarded', 'info'); } } catch (e) { console.error(e); } },
    shoptab(el) { UI.shopTab = el.dataset.v; renderShop(); },
    buy(el) {
      const k = el.dataset.key, kind = el.dataset.kind; let ok = false, nm = '';
      if (kind === 'animals') { ok = G.buyAnimal(k); nm = (dget('animals', k) || {}).name; }
      else if (kind === 'buildings') { ok = G.buyBuilding(k); nm = (dget('buildings', k) || {}).name; }
      else if (kind === 'upgrades') { ok = G.buyExpansion(k); nm = (dget('expansions', k) || {}).name; }
      else { ok = G.buyPlot(); nm = 'a new plot'; }
      if (ok) G.toast(`Bought ${nm}!`, 'good');
    },
    sell(el) {
      const k = el.dataset.key, n = el.dataset.n === 'all' ? G.qty(k) : +el.dataset.n;
      G.sell(k, n);
    },
    echip(el) { openSheet({ kind: 'event', id: el.dataset.id }); },
    avatar(el) { S().flags['ui.avatar'] = el.dataset.v; fillProfile(false); queueRender(); G.save && G.save(); },
    saveprofile() {
      const n = $('#pf-name').value, f = $('#pf-farm').value;
      if (!G.setPlayerName(n)) { G.toast('Please enter a name', 'bad'); return; }
      if (f.trim()) G.setFarmName(f);
      G.toast('Profile saved!', 'good'); fillProfile(true);
    },
    reset() { confirmReset(); },
    'm-close'() { nextModal(); },
    'm-choice'(el) { if (UI.cur && UI.cur.onChoice) UI.cur.onChoice(+el.dataset.i); },
    'm-yes'() { if (UI.cur && UI.cur.onYes) UI.cur.onYes(); },
    'welcome-go'(el) { if (el.getAttribute('aria-disabled')) { G.toast('Type your name first', 'info'); return; } welcomeGo(); }
  };
  function dispatch(el, e) {
    const a = el.dataset.act, fn = ACT[a]; if (!fn) return;
    UI.tapRect = el.getBoundingClientRect(); UI.tapAt = Date.now();
    try { fn(el, e); } catch (err) { console.error('[ui action]', a, err); }
  }
  // pointer-based tap detection (scrolling cancels the pointer, so scrolls never trigger taps)
  let down = null;
  const sigOf = el => el.dataset.act + JSON.stringify(el.dataset);
  function bindInput() {
    document.addEventListener('pointerdown', e => {
      const el = e.target.closest && e.target.closest('[data-act]');
      down = el ? { sig: sigOf(el), x: e.clientX, y: e.clientY } : null;
    }, { passive: true });
    document.addEventListener('pointerup', e => {
      const d = down; down = null; if (!d) return;
      const el = e.target.closest && e.target.closest('[data-act]');
      if (!el || sigOf(el) !== d.sig || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 14) return;
      dispatch(el, e);
      UI.lastPtr = Date.now();
    });
    document.addEventListener('pointercancel', () => { down = null; });
    // keyboard-initiated clicks only (detail 0); pointer taps are handled above
    document.addEventListener('click', e => {
      if (e.detail !== 0) return;
      const el = e.target.closest && e.target.closest('[data-act]'); if (el) dispatch(el, e);
    });
    document.addEventListener('dblclick', e => { if (e.target.closest && e.target.closest('#app')) e.preventDefault(); });
    document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('.plot,.pen,.bld,.tab')) e.preventDefault(); });
  }

  // ---------- bus wiring ----------
  function wire() {
    const on = (n, f) => G.bus.on(n, p => { try { f(p); } catch (e) { console.error('[ui]', n, e); } });
    on('change', queueRender);
    on('tick', p => {
      const now = (p && p.now) || Date.now(); updateTimers(now); updateSky(p && p.cal); updateSeasonChip(p && p.cal); tickChecks(now);
      const sp = UI.sheet; if (sp && sp.kind === 'panel') { const P = G.panels && G.panels[sp.key]; if (P && P.live) renderSheet(); }
    });
    on('state:reset', () => {
      closeSheet(); UI.modals = []; UI.cur = null; $('#modal-root').hidden = true; UI.sig = {};
      showTab('farm'); setTimeout(() => pushModal(welcomeModal()), 200);
    });
    on('harvested', p => {
      const el = $(`[data-plot="${p.plotIdx}"]`);
      let r = el ? el.getBoundingClientRect() : null;
      if (!r || !r.width) r = (G.World && G.World.plotRect && G.World.plotRect(p.plotIdx)) || tapOrigin();
      const k = ++UI.flySeq;
      fly(`+${p.n} ${esc(iEmoji(p.cropKey))}`, r, $('#hud-barn-pill'), { delay: (k - 1) * 90 });
    });
    on('collected', p => { fly(`+${p.n} ${esc(iEmoji(p.key))}`, tapOrigin(), $('#hud-barn-pill')); });
    on('coins', p => {
      const pill = $('#hud-coins-pill'); if (!p) return;
      if (p.delta > 0) fly(`+${fmt(p.delta)} 🪙`, tapOrigin(), pill, { cls: 'coin', dur: 1000 }); else if (pill) bump(pill);
    });
    on('order:done', p => {
      const o = (p && (p.order || p)) || {};
      G.toast('Order delivered!' + (o.coins ? ` +${fmt(o.coins)} 🪙` : ''), 'good');
    });
    on('levelup', p => pushModal(levelModal((p && p.level) || S().level)));
    on('event:start', p => {
      if (!p || !p.def) return;
      pushModal(eventModal(p));
      UI.tfx = { list: fxFor(p.def.key || '', p.def), until: Date.now() + 9000 };
      updateFX(); queueRender();
    });
    on('event:end', p => { if (p && p.event) dismissEventModal(p.event.id); updateFX(); queueRender(); });
    on('event:choice', p => { if (p && p.event) { dismissEventModal(p.event.id); } queueRender(); });
    on('player:rename', queueRender);
  }

  // ---------- public UI kit for other modules ----------
  G.openPanel = function (key, arg) { if (!G.panels || !G.panels[key]) { console.warn('no panel', key); return; } openSheet({ kind: 'panel', key, arg }); };
  G.closePanel = closeSheet;
  G.refreshPanel = () => { const b = $('#sheet-body'); if (b) b._h = null; renderSheet(); };
  G.panelOpen = () => (UI.sheet && UI.sheet.kind === 'panel') ? UI.sheet.key : null;
  // Generic modal: G.showModal({ emoji, title, text, html?, kind:'good'|'bad'|'neutral', buttons:[{label, cls:'btn-gold'|'btn-green'|'btn-gray'|'btn-red', onClick}] , confetti?:bool })
  G.showModal = function (o) {
    o = o || {}; const btns = (o.buttons && o.buttons.length ? o.buttons : [{ label: 'OK', cls: 'btn-gold' }]);
    const spec = {
      html: `<div class="mcard ${o.kind ? 'ev ' + esc(o.kind) : ''}">${o.emoji ? `<div class="wel-av">${esc(o.emoji)}</div>` : ''}${o.title ? `<h2>${esc(o.title)}</h2>` : ''}${o.text ? `<p>${esc(o.text)}</p>` : ''}${o.html || ''}${btns.map((b, i) => `<button class="btn ${esc(b.cls || 'btn-gold')}" data-act="m-choice" data-i="${i}">${esc(b.label)}</button>`).join('')}</div>`,
      onChoice(i) { nextModal(); try { btns[i] && btns[i].onClick && btns[i].onClick(); } catch (e) { console.error(e); } queueRender(); },
      onShow: o.confetti ? confetti : null
    };
    pushModal(spec);
  };
  G.uikit = { worldOn, openSeed: i => openSheet({ kind: 'seed', plot: i }), openBuilding: i => openSheet({ kind: 'bld', i }), openEvent: id => openSheet({ kind: 'event', id }), closeSheet, sheetOpen: () => !!UI.sheet, esc, fmt, fmtT, needChips, iEmoji, iName, tm, fly, confetti, bump, tapOrigin, queueRender, showTab: t => showTab(t), tab: () => UI.tab };

  // ---------- init ----------
  G.bus.on('init', function () {
    try {
      bindInput(); wire(); buildFxParticles();
      $$('.view').forEach(v => { v.hidden = v.dataset.view !== 'farm'; });
      updateSky(); renderAll();
      const s = S();
      if (!s.flags['ui.welcomed'] || !s.playerName) pushModal(welcomeModal());
      else setTimeout(() => G.toast(`Welcome back, ${pname()}!`, 'good'), 400);
      addEventListener('resize', () => { renderHUD(); updateSky(); });
    } catch (e) { console.error('[ui init]', e); }
  });
})();
