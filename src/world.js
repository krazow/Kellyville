/* world.js — Kellyville walkable farm world. A top-down 2D canvas the player walks around.
   Owns: G.World. Reads core state + the optional v2 modules (Machines, Ranch, Stand, Restaurant) behind guards.
   Everything is drawn with vector shapes + emoji sprites; static terrain is cached to an offscreen canvas. */
(function () {
  'use strict';
  const G = window.G; if (!G) return;
  const T = 40, W = 40, H = 30, TAU = Math.PI * 2;
  const S = () => G.state;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const safe = (fn, d) => { try { const v = fn(); return v === undefined || v === null ? d : v; } catch (e) { return d; } };
  const hash = str => { let h = 2166136261; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };
  const mulberry = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const el = id => document.getElementById(id);
  const iEmoji = k => safe(() => G.itemInfo(k).emoji, '📦') || '📦';
  const iName = k => safe(() => G.itemInfo(k).name, k) || k;

  // ---------------------------------------------------------------- layout constants (tile units)
  const Z = {
    barn: { x: 2, y: 2, w: 6, h: 5, pt: [5, 7.6], emoji: '🏚️', label: 'Barn' },
    shed: { x: 9, y: 3, w: 5, h: 4, pt: [11.5, 7.6], emoji: '🚜', label: 'Tractor shed' },
    house: { x: 15, y: 2, w: 6, h: 5, pt: [17.5, 7.7], emoji: '🏠', label: 'Farmhouse' },
    restaurant: { x: 30, y: 2, w: 8, h: 5, pt: [34, 7.5], emoji: '🍽️', label: 'Restaurant' },
    orders: { x: 11, y: 23, w: 2, h: 1, pt: [12, 24.8], emoji: '📋', label: 'Orders' },
    stand: { x: 4, y: 23, w: 5, h: 2, pt: [6.5, 25.55], emoji: '🧺', label: 'Farm stand' },
    shop: { x: 32, y: 23, w: 5, h: 2, pt: [34.5, 25.55], emoji: '🏪', label: 'Co-op store' },
    pasture: { x: 30, y: 12, w: 8, h: 10, pt: [29.4, 17], emoji: '🐄', label: 'Pasture' },
    fields: { x: 2, y: 9, w: 12, h: 12, pt: [7, 8.6], emoji: '🌾', label: 'Fields', nosolid: true },
    pens: { x: 15, y: 9, w: 12, h: 9, pt: [21, 13.5], emoji: '🐔', label: 'Animal pens', nosolid: true },
    buildings: { x: 15, y: 19, w: 12, h: 5, pt: [20.5, 21], emoji: '🏭', label: 'Buildings', nosolid: true }
  };
  const ZONE_ORDER = ['house', 'fields', 'pens', 'buildings', 'barn', 'orders', 'shop', 'shed', 'pasture', 'stand', 'restaurant'];
  const PEN_POS = [[15, 9, 'b'], [22, 9, 'b'], [15, 14, 't'], [22, 14, 't']]; // x, y, gate side (6x4 footprint)
  const PASTURE_GATE = { x: 30, y: 16, h: 2 };
  const POND = { cx: 24.5, cy: 4.4, rx: 2.9, ry: 1.8 };
  const TABLE_XS = [31.4, 33.2, 35.0, 36.8], TABLE_YS = [8.7, 10.6];
  const SPAWN = [17.5, 8.5];
  const ROAD0 = 26, ROAD1 = 28;
  const DECOR_TREES = [[10.5, 21.6, 0], [13.4, 22.4, 1], [9.4, 25.2, 0], [27.3, 7.6, 0], [31, 22.4, 1], [38 - 0.4, 22.2, 0], [26.6, 20.6, 1], [14, 26 - 0.4 - 0.2, 0]].slice(0, 7);

  const PAL = {
    spring: { g1: '#7cc152', g2: '#6bb447', tuft: '#5da13c', hill: '#98d466', hillA: '#aee27c', hillB: '#7fbf55', path: '#d2b27a', pathD: '#bf9d63', soil: '#7b4d26', soilD: '#5f3a1b', soilL: '#946034', pasture: '#6ab843', deck: '#b48a58', pond: '#68b8e2', pond2: '#9bd6f2', road: '#a8a396', roadD: '#8c877b', trees: ['#4a9a38', '#62b247', '#86cf5a'], snow: 0, flower: 1 },
    summer: { g1: '#c2c15a', g2: '#b5b84c', tuft: '#9ea23c', hill: '#ecca5c', hillA: '#f8de7e', hillB: '#d3ad44', path: '#dcbc7c', pathD: '#c6a263', soil: '#855426', soilD: '#6a421d', soilL: '#9b6430', pasture: '#9fc14c', deck: '#b48a58', pond: '#4fa6dc', pond2: '#8ccff0', road: '#aaa496', roadD: '#8e887a', trees: ['#3d8c33', '#56a440', '#7bbf59'], snow: 0, flower: 0 },
    fall: { g1: '#c99a48', g2: '#bd8d3e', tuft: '#a8742c', hill: '#de9b45', hillA: '#ecb468', hillB: '#c4802f', path: '#caa26d', pathD: '#b48b57', soil: '#6f4524', soilD: '#563419', soilL: '#865632', pasture: '#b2a049', deck: '#a67c4c', pond: '#5a9fc9', pond2: '#86c1de', road: '#a29c90', roadD: '#867f73', trees: ['#d0652a', '#e68f2e', '#c43f2a'], snow: 0, flower: 0 },
    winter: { g1: '#eef3f7', g2: '#dfe8f0', tuft: '#bccbd8', hill: '#e5edf4', hillA: '#f8fbfd', hillB: '#cbd8e4', path: '#d7cfc4', pathD: '#bdb3a6', soil: '#86705c', soilD: '#6a5846', soilL: '#a08a74', pasture: '#e8f0f5', deck: '#9d8a74', pond: '#b6dcf0', pond2: '#e4f4fc', road: '#b4b3b0', roadD: '#98978f', trees: ['#3a6a4b', '#4d7f5c', '#6a9c78'], snow: 1, flower: 0 }
  };

  // ---------------------------------------------------------------- module state
  const V = { box: null, cv: null, ctx: null, cssW: 0, cssH: 0, dpr: 1, zoom: 1, camX: 0, camY: 0, run: false, raf: 0, last: 0, t: 0, ready: false, boxLeft: 0, boxTop: 0, acc: 0 };
  const P = { x: SPAWN[0], y: SPAWN[1], dir: 1, moving: false, walk: 0, path: null, pi: 0, pend: null, stuck: 0, goal: null };
  const IN = { jx: 0, jy: 0, keys: {}, joy: null };
  const ptrs = new Map();
  let pinch = null;
  let L = null;            // layout (solids etc.)
  let cache = null, cacheScale = 1, cacheSig = '';
  let hint = null, hintT = 0;
  let lastAct = null;      // world position of the last action (for floating text)
  const floats = [], parts = [], trucks = [], marks = [];
  let truckT = 4;
  const wander = new Map(); // animal / cattle id -> {x,y,tx,ty,wait,dir}
  const npcPaths = new Map();
  const driveCool = new Map();
  let driveFail = 0, driveT = 0, lastDriving = false;
  let ducks = [{ x: 24, y: 4.2, a: 0, s: 1 }, { x: 25.8, y: 4.7, a: 2, s: -1 }];
  const snow = Array.from({ length: 42 }, (_, i) => ({ x: hash('sx' + i), y: hash('sy' + i), s: 0.5 + hash('ss' + i), p: hash('sp' + i) * 6 }));

  // ---------------------------------------------------------------- emoji sprite cache
  const EMF = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
  const emc = new Map();
  let emCount = 0;
  function sprite(ch) {
    let c = emc.get(ch);
    if (!c) {
      if (emc.size > 260) emc.clear();
      c = document.createElement('canvas'); c.width = c.height = 112;
      const g = c.getContext('2d'); g.font = '84px ' + EMF; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(ch, 56, 60);
      emc.set(ch, c);
    }
    return c;
  }
  // draw emoji centred at (x,y) world px with the given size; counts against the per-frame budget unless force
  function em(c, ch, x, y, size, o) {
    o = o || {};
    if (!o.force && emCount >= 64) return;
    emCount++;
    const sp = sprite(ch), s = size * 1.18;
    if (o.flip || o.rot || o.alpha != null) {
      c.save(); c.translate(x, y);
      if (o.rot) c.rotate(o.rot);
      if (o.flip) c.scale(-1, 1);
      if (o.alpha != null) c.globalAlpha = o.alpha;
      c.drawImage(sp, -s / 2, -s / 2, s, s); c.restore();
    } else c.drawImage(sp, x - s / 2, y - s / 2, s, s);
  }
  // emoji drawn straight into a (static) context
  function emStatic(c, ch, x, y, size, alpha) {
    c.save(); c.globalAlpha = alpha == null ? 1 : alpha; c.font = size + 'px ' + EMF; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch, x, y + size * 0.06); c.restore();
  }

  // ---------------------------------------------------------------- module accessors
  const standBuilt = () => !!safe(() => G.Stand && G.Stand.isBuilt && G.Stand.isBuilt(), false);
  const restStage = () => safe(() => (G.Restaurant && G.Restaurant.stage) ? G.Restaurant.stage() : 'none', 'none');
  const tableCount = () => clamp(+safe(() => G.Restaurant.tables(), 4) || 4, 1, 8);
  const equipped = () => safe(() => G.Machines && G.Machines.equipped && G.Machines.equipped(), null);
  const driving = () => !!safe(() => G.Machines && G.Machines.isDriving && G.Machines.isDriving() && G.Machines.equipped && G.Machines.equipped(), false);
  const hasTractor = () => !!equipped() || safe(() => G.Machines.owned().length > 0, false);
  const penTypes = () => Object.keys((G.DATA && G.DATA.animals) || {}).slice(0, 4);
  const plotRect = i => ({ x: 2 + 2 * (i % 6), y: 9 + 2 * Math.floor(i / 6), w: 2, h: 2 });
  const buildingSlot = i => ({ x: 15 + 2 * (i % 6), y: 19 + 3 * Math.floor(i / 6), w: 2, h: 2 });
  const rectDist = (x, y, r) => { const dx = Math.max(r.x - x, 0, x - (r.x + r.w)), dy = Math.max(r.y - y, 0, y - (r.y + r.h)); return Math.hypot(dx, dy); };
  const inRect = (x, y, r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

  // ---------------------------------------------------------------- layout: solids + slots
  function lotTypes() {
    const owned = new Set(S().buildings.map(b => b.type));
    return Object.keys(G.DATA.buildings || {}).filter(k => !owned.has(k)).sort((a, b) => (G.DATA.buildings[a].level || 1) - (G.DATA.buildings[b].level || 1));
  }
  function buildLayout() {
    const s = S(), solid = new Uint8Array(W * H);
    const fill = (x0, y0, w, h, v) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (x >= 0 && y >= 0 && x < W && y < H) solid[y * W + x] = v == null ? 1 : v; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ring = x <= 1 || x >= 38 || y <= 1 || y >= 29;
      if (ring && !(y >= ROAD0 && y <= ROAD1)) solid[y * W + x] = 1;
    }
    ['barn', 'shed', 'house', 'shop', 'orders'].forEach(k => fill(Z[k].x, Z[k].y, Z[k].w, Z[k].h));
    const stage = restStage();
    if (stage === 'open' || stage === 'building') fill(Z.restaurant.x, Z.restaurant.y, Z.restaurant.w, Z.restaurant.h); else fill(33, 5, 2, 1);
    if (standBuilt()) fill(Z.stand.x, Z.stand.y, Z.stand.w, Z.stand.h); else fill(6, 24, 1, 1);
    // pond
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = (x + .5 - POND.cx) / POND.rx, dy = (y + .5 - POND.cy) / POND.ry; if (dx * dx + dy * dy < 1.05) solid[y * W + x] = 1; }
    // pens (owned): fence ring minus a 2-tile gate
    const types = penTypes(), pens = [];
    types.forEach((type, k) => {
      const [x, y, gs] = PEN_POS[k], owned = s.animals.some(a => a.type === type);
      const rect = { x, y, w: 6, h: 4 };
      const gate = gs === 'b' ? { x: x + 2, y: y + 3, w: 2, h: 1 } : { x: x + 2, y: y, w: 2, h: 1 };
      const pen = { type, k, rect, gate, owned, gx: x + 3, gy: gs === 'b' ? y + 4.45 : y - 0.45 };
      if (owned) { for (let yy = y; yy < y + 4; yy++) for (let xx = x; xx < x + 6; xx++) if (xx === x || xx === x + 5 || yy === y || yy === y + 3) solid[yy * W + xx] = 1; fill(gate.x, gate.y, 2, 1, 0); }
      pens.push(pen);
    });
    // pasture ring minus gate
    for (let yy = Z.pasture.y; yy < Z.pasture.y + Z.pasture.h; yy++) for (let xx = Z.pasture.x; xx < Z.pasture.x + Z.pasture.w; xx++) if (xx === Z.pasture.x || xx === Z.pasture.x + 7 || yy === Z.pasture.y || yy === Z.pasture.y + 9) solid[yy * W + xx] = 1;
    fill(PASTURE_GATE.x, PASTURE_GATE.y, 1, PASTURE_GATE.h, 0);
    // owned production buildings
    const slots = s.buildings.map((b, i) => buildingSlot(i));
    slots.forEach(r => fill(r.x, r.y, r.w, r.h));
    // restaurant tables
    const tables = [];
    if (stage === 'open') {
      const n = tableCount();
      for (let i = 0; i < n; i++) { const tx = TABLE_XS[i % 4], ty = TABLE_YS[Math.floor(i / 4)]; tables.push({ x: tx, y: ty }); fill(Math.floor(tx), Math.floor(ty), 1, 1); }
    }
    DECOR_TREES.forEach(t => fill(Math.floor(t[0]), Math.floor(t[1]), 1, 1));
    // lots for sale
    const lots = lotTypes().slice(0, 3).map((type, k) => ({ type, rect: buildingSlot(s.buildings.length + k) }));
    const emptyPens = pens.filter(p => !p.owned);
    L = { solid, pens, slots, tables, lots, emptyPens, stage };
  }
  const solidAt = (tx, ty) => tx < 0 || ty < 0 || tx >= W || ty >= H || L.solid[ty * W + tx] === 1;
  function blocked(x, y, r) {
    const x0 = Math.floor(x - r), x1 = Math.floor(x + r), y0 = Math.floor(y - r), y1 = Math.floor(y + r);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solidAt(tx, ty)) return true;
    return false;
  }
  function lineFree(x0, y0, x1, y1, r) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 0.18));
    for (let i = 1; i <= n; i++) { const t = i / n; if (blocked(lerp(x0, x1, t), lerp(y0, y1, t), r)) return false; }
    return true;
  }
  function nearestFree(tx, ty) {
    for (let rad = 0; rad < 8; rad++) {
      let best = null, bd = 1e9;
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
        const x = tx + dx, y = ty + dy; if (solidAt(x, y)) continue;
        const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [x, y]; }
      }
      if (best) return best;
    }
    return null;
  }
  // grid A* (8-way, no corner cutting) followed by line-of-sight smoothing. Returns [[x,y],...] in tile units
  function findPath(sx, sy, gx, gy, r) {
    r = r || 0.3;
    let g = [Math.floor(gx), Math.floor(gy)];
    if (solidAt(g[0], g[1])) { g = nearestFree(g[0], g[1]); if (!g) return null; gx = g[0] + .5; gy = g[1] + .5; }
    let s = [Math.floor(sx), Math.floor(sy)];
    if (solidAt(s[0], s[1])) { const f = nearestFree(s[0], s[1]); if (!f) return null; s = f; }
    if (lineFree(sx, sy, gx, gy, r)) return [[gx, gy]];
    const N = W * H, gs = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const open = [], idx = (x, y) => y * W + x, hf = (x, y) => { const dx = Math.abs(x - g[0]), dy = Math.abs(y - g[1]); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    const si = idx(s[0], s[1]), gi = idx(g[0], g[1]); gs[si] = 0; open.push([hf(s[0], s[1]), si]);
    let found = false, guard = 0;
    while (open.length && guard++ < 4000) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const cur = open[bi][1]; open.splice(bi, 1);
      if (closed[cur]) continue; closed[cur] = 1;
      if (cur === gi) { found = true; break; }
      const cx = cur % W, cy = (cur / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy; if (solidAt(nx, ny)) continue;
        if (dx && dy && (solidAt(cx + dx, cy) || solidAt(cx, cy + dy))) continue;
        const ni = idx(nx, ny); if (closed[ni]) continue;
        const ng = gs[cur] + (dx && dy ? 1.414 : 1);
        if (ng < gs[ni]) { gs[ni] = ng; from[ni] = cur; open.push([ng + hf(nx, ny), ni]); }
      }
    }
    if (!found) return null;
    const raw = []; for (let c = gi; c !== -1 && c !== si; c = from[c]) raw.push([c % W + .5, ((c / W) | 0) + .5]);
    raw.reverse(); raw[raw.length - 1] = [gx, gy];
    const out = []; let cx = sx, cy = sy, i = 0;
    while (i < raw.length) {
      let j = raw.length - 1; while (j > i && !lineFree(cx, cy, raw[j][0], raw[j][1], r)) j--;
      out.push(raw[j]); cx = raw[j][0]; cy = raw[j][1]; i = j + 1;
    }
    return out;
  }

  // ---------------------------------------------------------------- targets (things the player can use)
  function plotAct(i, p) {
    const c = G.DATA.crops[p.crop];
    if (p.status === 'empty') return { emoji: '🌱', text: 'Plant', prio: 2, tone: 'green', fn: () => G.uikit.openSeed(i) };
    if (p.status === 'ready') return { emoji: c ? c.emoji : '🌾', text: 'Harvest', prio: 3, tone: 'gold', fn: () => { G.harvest(i); } };
    if (p.status === 'withered') return { emoji: '🥀', text: 'Clear', prio: 2, tone: 'green', fn: () => { G.clearWithered(i); G.toast('Cleared the withered crop', 'info'); } };
    return null;
  }
  function penAct(pen) {
    const s = S(), d = G.DATA.animals[pen.type] || {}, ready = [], hungry = [];
    s.animals.forEach((a, i) => { if (a.type !== pen.type) return; if (a.status === 'ready') ready.push(i); else if (a.status === 'hungry') hungry.push(i); });
    if (ready.length) return { emoji: iEmoji(d.product), text: 'Collect' + (ready.length > 1 ? ' ×' + ready.length : ''), prio: 3, tone: 'gold', fn: () => { ready.forEach(i => G.collectAnimal(i)); } };
    if (hungry.length) return { emoji: d.emoji || '🐾', text: 'Feed' + (hungry.length > 1 ? ' ×' + hungry.length : ''), prio: 2, tone: 'green', fn: () => { for (const i of hungry) if (!G.feedAnimal(i)) break; } };
    return null;
  }
  function openPanelOr(key, soon) { return () => { if (G.panels && G.panels[key]) G.openPanel(key); else G.toast(soon || 'Coming soon!', 'info'); }; }
  function ordersReady() {
    return safe(() => (G.Economy.orders() || []).filter(o => Object.keys(o.items || {}).length && !(o.cooldownUntil && o.cooldownUntil > Date.now()) && G.Economy.canFulfill(o.id)).length, 0);
  }
  function getTargets() {
    const s = S(), out = [];
    const T_ = (id, r, pt, range, a, extra) => { const o = { id, r, pt, range, a }; if (extra) Object.assign(o, extra); out.push(o); return o; };
    s.plots.forEach((p, i) => { const r = plotRect(i); T_('plot' + i, r, [r.x + 1, r.y + 1], 0.75, plotAct(i, p), { plot: i }); });
    if (s.plots.length < s.maxPlots) {
      const r = plotRect(s.plots.length);
      T_('buyland', r, [r.x + 1, r.y + 1], 0.75, { emoji: '➕', text: 'Buy land 🪙' + G.plotCost(), prio: 1, tone: 'gold', fn: () => { if (G.buyPlot()) G.toast('New plot of land!', 'good'); } });
    }
    L.pens.forEach(pen => {
      if (pen.owned) T_('pen' + pen.k, pen.rect, [pen.gx, pen.gy], 1.2, penAct(pen), { pen });
      else T_('penlot' + pen.k, pen.rect, [pen.gx, pen.gy], 1.2, { emoji: (G.DATA.animals[pen.type] || {}).emoji || '🐾', text: 'Animals for sale', prio: 0.5, tone: 'blue', fn: () => { G.ui.shopTab = 'animals'; G.uikit.showTab('shop'); } });
    });
    s.buildings.forEach((b, i) => {
      const r = buildingSlot(i), d = G.DATA.buildings[b.type] || { name: b.type, emoji: '🏭' }, now = Date.now();
      const ready = b.queue.filter(j => j.readyAt <= now).length;
      const a = ready ? { emoji: '📦', text: 'Collect ' + d.name, prio: 2.5, tone: 'gold', fn: () => { G.collectBuilding(i); } }
        : { emoji: d.emoji, text: 'Open ' + d.name, prio: 1, tone: 'green', fn: () => G.uikit.openBuilding(i) };
      T_('bld' + i, r, [r.x + 1, r.y + 2.45], 1.2, a, { bld: i });
    });
    L.lots.forEach((lot, k) => {
      const r = lot.rect, d = G.DATA.buildings[lot.type] || {};
      T_('lot' + k, r, [r.x + 1, r.y + 2.45], 1.2, { emoji: '🏗️', text: 'Building for sale', prio: 0.5, tone: 'blue', fn: () => { G.ui.shopTab = 'buildings'; G.uikit.showTab('shop'); } });
    });
    const zone = (id, a, ex) => { const z = Z[id]; T_('z_' + id, z, z.pt, id === 'house' ? 0.7 : 1.25, a, Object.assign({ zone: id }, ex)); };
    const ord = ordersReady();
    zone('barn', { emoji: '🏚️', text: 'Barn', prio: 1, tone: 'green', fn: () => G.uikit.showTab('barn') });
    zone('orders', { emoji: '📋', text: 'Orders' + (ord ? ' (' + ord + ')' : ''), prio: ord ? 2 : 1, tone: ord ? 'gold' : 'green', fn: () => G.uikit.showTab('orders') });
    zone('shop', { emoji: '🏪', text: 'Co-op store', prio: 1, tone: 'blue', fn: () => G.uikit.showTab('shop') });
    zone('shed', { emoji: '🚜', text: 'Tractor shed', prio: 1, tone: 'green', fn: openPanelOr('machines', 'The tractor shed is closed for now.') });
    zone('pasture', { emoji: '🐄', text: 'Pasture', prio: 1, tone: 'green', fn: openPanelOr('ranch', 'The pasture is not open yet.') });
    zone('stand', { emoji: '🧺', text: standBuilt() ? 'Farm stand' : 'Build farm stand', prio: 1, tone: 'green', fn: openPanelOr('stand', 'The farm stand is coming soon!') });
    zone('restaurant', { emoji: '🍽️', text: 'Restaurant', prio: 1, tone: 'green', fn: openPanelOr('restaurant', 'The restaurant is coming soon!') });
    zone('house', { emoji: '🏠', text: 'Farmhouse', prio: 0.8, tone: 'blue', fn: () => G.uikit.showTab('almanac') });
    return out;
  }
  function bestTarget(px, py) {
    let best = null, bs = 1e9;
    for (const t of getTargets()) {
      if (!t.a) continue;
      const rd = rectDist(px, py, t.r); if (rd > t.range) continue;
      const cx = t.r.x + t.r.w / 2, cy = t.r.y + t.r.h / 2;
      const sc = rd + Math.hypot(px - cx, py - cy) * 0.03 - t.a.prio * 0.18;
      if (sc < bs) { bs = sc; best = t; }
    }
    return best;
  }
  function runAction(t) {
    if (!t || !t.a) return;
    lastAct = { x: t.pt[0], y: t.pt[1] - 0.6 };
    try { t.a.fn(); } catch (e) { console.error('[world action]', e); }
    hintT = 0;
  }
  function px_() { return P.x; } // player position accessors (tractor shares the player's position)

  // ---------------------------------------------------------------- walking
  function goTo(x, y, pend) {
    const r = driving() ? 0.4 : 0.3;
    P.pend = pend || null; P.stuck = 0; P.goal = [x, y];
    const path = findPath(P.x, P.y, x, y, r);
    if (!path) { P.path = null; P.pend = null; return false; }
    P.path = path; P.pi = 0; return true;
  }
  function tapAt(wx, wy) { // world tile coords
    const ts = getTargets();
    let hit = null;
    for (const t of ts) if (inRect(wx, wy, t.r) && (!hit || (t.plot != null || t.zone) )) { if (!hit || t.r.w * t.r.h < hit.r.w * hit.r.h) hit = t; }
    marks.push({ x: wx, y: wy, t: 0 });
    if (!hit) { goTo(wx, wy, null); return; }
    if (hit.plot != null && !hit.a) {
      const p = S().plots[hit.plot], c = G.DATA.crops[p.crop] || {};
      G.toast(`${c.emoji || '🌱'} ${c.name || 'Crop'}: ${G.uikit.fmtT((p.readyAt - Date.now()) / 1000)} left`, 'info');
    }
    if (!hit.a) { goTo(hit.pt[0], hit.pt[1], null); return; }
    const rd = rectDist(P.x, P.y, hit.r);
    if (rd <= hit.range) { P.path = null; runAction(hit); return; }
    goTo(hit.pt[0], hit.pt[1], () => { const t2 = getTargets().find(q => q.id === hit.id); if (t2) runAction(t2); });
  }

  // ---------------------------------------------------------------- input
  const typing = () => { const a = document.activeElement; return !!(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)); };
  const uiBlocked = () => typing() || safe(() => G.uikit.sheetOpen(), false) || !(el('modal-root') || {}).hidden;
  function toWorld(cx, cy) { return [(V.camX + cx / V.zoom) / T, (V.camY + cy / V.zoom) / T]; }
  function localXY(e) { const r = V.cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function setZoom(z) {
    V.zoom = clamp(z, 0.7, 1.5);
    if (S().flags) S().flags['world.zoom'] = +V.zoom.toFixed(2);
    clampCam(true);
  }
  function showJoy(on, x, y) {
    const j = el('w-joy'); if (!j) return;
    j.hidden = !on;
    if (on) { j.style.left = x + 'px'; j.style.top = y + 'px'; }
  }
  function moveKnob(dx, dy) { const k = el('w-joy') && el('w-joy').firstElementChild; if (k) k.style.transform = `translate(${dx}px,${dy}px)`; }
  function bindInput() {
    const cv = V.cv;
    cv.addEventListener('pointerdown', e => {
      if (uiBlocked()) return;
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (_) { }
      const [x, y] = localXY(e);
      ptrs.set(e.pointerId, { x0: x, y0: y, x, y, t0: performance.now(), joy: false });
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: V.zoom };
        IN.jx = IN.jy = 0; IN.joy = null; showJoy(false);
      }
    });
    cv.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      const [x, y] = localXY(e); p.x = x; p.y = y;
      if (pinch && ptrs.size >= 2) {
        const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch.d > 10) setZoom(pinch.z * d / pinch.d); return;
      }
      const dx = x - p.x0, dy = y - p.y0, d = Math.hypot(dx, dy);
      if (!p.joy && d > 10) { p.joy = true; IN.joy = e.pointerId; P.path = null; P.pend = null; showJoy(true, p.x0, p.y0); }
      if (p.joy && IN.joy === e.pointerId) {
        const R = 46, m = Math.min(d, R), ux = d ? dx / d : 0, uy = d ? dy / d : 0;
        moveKnob(ux * m, uy * m);
        const mag = clamp((d - 6) / R, 0, 1);
        IN.jx = ux * mag; IN.jy = uy * mag;
      }
    });
    const end = e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      ptrs.delete(e.pointerId);
      if (IN.joy === e.pointerId) { IN.joy = null; IN.jx = IN.jy = 0; showJoy(false); moveKnob(0, 0); }
      if (pinch && ptrs.size < 2) { pinch = null; if (ptrs.size === 1) { const q = [...ptrs.values()][0]; q.joy = true; q.x0 = q.x; q.y0 = q.y; } return; }
      if (e.type === 'pointerup' && !p.joy && performance.now() - p.t0 < 500 && Math.hypot(p.x - p.x0, p.y - p.y0) < 14) {
        const [wx, wy] = toWorld(p.x, p.y); tapAt(wx, wy);
      }
    };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', e => { e.preventDefault(); setZoom(V.zoom * (e.deltaY < 0 ? 1.1 : 0.9)); }, { passive: false });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    const KM = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down' };
    addEventListener('keydown', e => {
      if (!V.run || uiBlocked() || e.metaKey || e.ctrlKey || e.defaultPrevented || e.isComposing) return;
      const tg = e.target, tn = tg && tg.tagName; if (tn === 'INPUT' || tn === 'TEXTAREA' || tn === 'SELECT' || (tg && tg.isContentEditable)) return;
      const k = KM[e.key]; if (k) { IN.keys[k] = true; P.path = null; P.pend = null; e.preventDefault(); }
      else if ((e.key === 'e' || e.key === 'E' || e.key === ' ' || e.key === 'Enter') && hint) { runAction(hint); e.preventDefault(); }
    });
    addEventListener('keyup', e => { const k = KM[e.key]; if (k) IN.keys[k] = false; });
    addEventListener('blur', () => { IN.keys = {}; });
    const tap = (id, fn) => { const b = el(id); if (b) b.addEventListener('click', e => { e.stopPropagation(); fn(e); }); };
    tap('w-act', () => { if (hint) runAction(hint); });
    tap('w-zin', () => setZoom(V.zoom + 0.15));
    tap('w-zout', () => setZoom(V.zoom - 0.15));
    tap('w-list', () => setList(true));
    tap('w-back', () => setList(false));
    tap('w-go', () => { const z = el('w-zones'); z.hidden = !z.hidden; });
    tap('w-drive', () => { safe(() => G.Machines.setDriving(!driving())); P.path = null; P.pend = null; hintT = 0; });
    const zl = el('w-zones');
    zl.innerHTML = ZONE_ORDER.map(id => `<button type="button" data-z="${id}">${Z[id].emoji} ${Z[id].label}</button>`).join('');
    zl.addEventListener('click', e => { const b = e.target.closest('[data-z]'); if (b) { goToZone(b.dataset.z); zl.hidden = true; } });
  }
  function setList(on) {
    S().flags['world.list'] = !!on;
    el('w-zones').hidden = true;
    G.uikit.showTab('farm');
  }
  function goToZone(id) {
    const z = Z[id]; if (!z) return false;
    return goTo(z.pt[0], z.pt[1], null);
  }

  // ---------------------------------------------------------------- update
  function movePlayer(dt) {
    const drv = driving(), def = drv ? equipped() : null;
    const sp = 3.3 * (drv && def ? (+def.speed || 1.6) : 1), r = drv ? 0.4 : 0.3;
    let ix = IN.jx, iy = IN.jy; const k = IN.keys;
    if (k.left || k.right || k.up || k.down) { ix = (k.right ? 1 : 0) - (k.left ? 1 : 0); iy = (k.down ? 1 : 0) - (k.up ? 1 : 0); const m = Math.hypot(ix, iy) || 1; ix /= m; iy /= m; }
    let dx = 0, dy = 0, want = 0;
    if (Math.hypot(ix, iy) > 0.08) { P.path = null; P.pend = null; dx = ix * sp * dt; dy = iy * sp * dt; want = Math.hypot(dx, dy); }
    else if (P.path) {
      const wp = P.path[P.pi], vx = wp[0] - P.x, vy = wp[1] - P.y, d = Math.hypot(vx, vy);
      if (d < 0.08) { P.pi++; if (P.pi >= P.path.length) { P.path = null; const f = P.pend; P.pend = null; if (f) f(); } }
      else { const step = Math.min(d, sp * dt); dx = vx / d * step; dy = vy / d * step; want = step; }
    }
    const n = Math.max(1, Math.ceil(want / 0.15)), sx = dx / n, sy = dy / n, ox = P.x, oy = P.y;
    for (let i = 0; i < n; i++) {
      if (sx && !blocked(P.x + sx, P.y, r)) P.x += sx;
      if (sy && !blocked(P.x, P.y + sy, r)) P.y += sy;
    }
    P.x = clamp(P.x, 0.4, W - 0.4); P.y = clamp(P.y, 0.4, H - 0.4);
    const moved = Math.hypot(P.x - ox, P.y - oy);
    P.moving = moved > 0.0005;
    if (Math.abs(P.x - ox) > 0.0008) P.dir = P.x > ox ? 1 : -1;
    if (P.moving) P.walk += dt * (drv ? 9 : 11);
    if (P.path && want > 0) {
      if (moved < want * 0.25) { P.stuck += dt; if (P.stuck > 0.45) { const g = P.goal, pf = P.pend; P.path = null; P.stuck = 0; if (g) { const np = findPath(P.x, P.y, g[0], g[1], r); if (np && np.length > 1) { P.path = np; P.pi = 0; P.pend = pf; } else P.pend = null; } } }
      else P.stuck = 0;
    }
  }
  function autoDrive(dt) {
    const def = equipped(), now = Date.now(); if (!driving() || !def) return;
    driveT += dt; if (driveT < 0.12) return; driveT = 0;
    if (now < driveFail) return;
    const s = S(), rad = +def.radius || 0, last = s.flags['ui.lastCrop'], lc = G.DATA.crops[last];
    for (let i = 0; i < s.plots.length; i++) {
      const p = s.plots[i], r = plotRect(i);
      if (p.status !== 'ready' && !(def.seeder && p.status === 'empty')) continue;
      if (rectDist(P.x, P.y, r) > rad + 0.05) continue;
      if ((driveCool.get(i) || 0) > now) continue;
      driveCool.set(i, now + 2500);
      if (p.status === 'ready') { if (!G.harvest(i)) { driveFail = now + 3000; return; } }
      else if (lc && s.level >= (lc.level || 1) && s.coins >= lc.seedCost) G.plant(i, last);
    }
  }
  function updateWander(dt, id, def, box, sp, extra) {
    let w = wander.get(id);
    if (!w) { w = { x: box.x + Math.random() * box.w, y: box.y + Math.random() * box.h, tx: 0, ty: 0, wait: Math.random() * 2, dir: Math.random() < .5 ? 1 : -1, seen: 0 }; w.tx = w.x; w.ty = w.y; wander.set(id, w); }
    w.seen = V.t;
    if (w.wait > 0) w.wait -= dt;
    else {
      const dx = w.tx - w.x, dy = w.ty - w.y, d = Math.hypot(dx, dy);
      if (d < 0.05) { w.wait = 0.6 + Math.random() * 3.2; w.tx = box.x + Math.random() * box.w; w.ty = box.y + Math.random() * box.h; }
      else { const st = Math.min(d, sp * dt); w.x += dx / d * st; w.y += dy / d * st; if (Math.abs(dx) > 0.02) w.dir = dx > 0 ? 1 : -1; }
    }
    return w;
  }
  function updateTrucks(dt) {
    truckT -= dt;
    if (truckT <= 0 && trucks.length < 3) {
      truckT = 7 + Math.random() * 12;
      const east = Math.random() < .5;
      trucks.push({ x: east ? -2 : W + 2, dir: east ? 1 : -1, y: east ? 28.0 : 26.9, v: 3.2 + Math.random() * 2, e: ['🛻', '🛻', '🚚', '🚐', '🚗', '🛻'][Math.floor(Math.random() * 6)] });
    }
    for (let i = trucks.length - 1; i >= 0; i--) { const t = trucks[i]; t.x += t.dir * t.v * dt; if (t.x < -4 || t.x > W + 4) trucks.splice(i, 1); }
  }
  function clampCam(snap) {
    const vw = V.cssW / V.zoom, vh = V.cssH / V.zoom, mw = W * T, mh = H * T;
    let tx = P.x * T - vw / 2, ty = P.y * T - vh / 2 - 10 / V.zoom * 0;
    tx = mw <= vw ? (mw - vw) / 2 : clamp(tx, 0, mw - vw);
    ty = mh <= vh ? (mh - vh) / 2 : clamp(ty, 0, mh - vh);
    V.tcx = tx; V.tcy = ty;
    if (snap) { V.camX = tx; V.camY = ty; }
  }
  function update(dt) {
    V.acc += dt;
    if (V.acc > 0.25) { V.acc = 0; checkLayout(); }
    const drv = driving();
    if (lastDriving && !drv) { /* stopped */ } lastDriving = drv;
    const eq = equipped();
    const dc = el('w-drive');
    if (dc) { dc.hidden = !eq; if (eq) { const txt = drv ? '🚶 Walk' : '🚜 Drive'; if (dc.textContent !== txt) dc.textContent = txt; dc.classList.toggle('on', drv); } }
    movePlayer(dt);
    autoDrive(dt);
    clampCam(false);
    const k = 1 - Math.pow(0.0008, dt); V.camX += (V.tcx - V.camX) * k; V.camY += (V.tcy - V.camY) * k;
    updateTrucks(dt);
    ducks.forEach(d => { d.a += dt * 0.5; });
    hintT -= dt;
    if (hintT <= 0) { hintT = 0.12; setHint(bestTarget(P.x, P.y)); }
    for (let i = floats.length - 1; i >= 0; i--) { floats[i].t += dt; if (floats[i].t > 1.4) floats.splice(i, 1); }
    for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 90 * dt; if (q.t > q.life) parts.splice(i, 1); }
    for (let i = marks.length - 1; i >= 0; i--) { marks[i].t += dt; if (marks[i].t > 0.7) marks.splice(i, 1); }
  }
  function setHint(t) {
    hint = t;
    const b = el('w-act'); if (!b) return;
    if (!t || !t.a || uiBlocked()) { if (!b.hidden) b.hidden = true; b._k = null; return; }
    const key = t.a.emoji + '|' + t.a.text + '|' + t.a.tone;
    if (b._k !== key) { b._k = key; el('w-act-e').textContent = t.a.emoji; el('w-act-t').textContent = t.a.text; b.className = t.a.tone === 'gold' ? 'gold' : t.a.tone === 'blue' ? 'blue' : ''; }
    if (b.hidden) b.hidden = false;
  }

  // ---------------------------------------------------------------- effects: floating text + particles
  function floatText(x, y, text, color) { floats.push({ x, y, text, color: color || '#fff', t: 0 }); if (floats.length > 12) floats.shift(); }
  function burst(x, y, colors, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = 30 + Math.random() * 60;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0, life: 0.5 + Math.random() * 0.4, c: colors[i % colors.length], s: 2 + Math.random() * 2.5 });
    }
    while (parts.length > 90) parts.shift();
  }

  // ---------------------------------------------------------------- static terrain painting (cached)
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function shade(c, x, y, w, h, a) { c.fillStyle = `rgba(30,20,0,${a || .2})`; c.beginPath(); c.ellipse(x + w / 2 + 3, y + h - 1, w / 2 + 3, Math.min(10, h / 3), 0, 0, TAU); c.fill(); }
  function plate(c, cx, cy, text, o) {
    o = o || {}; c.save(); c.font = `800 ${o.size || 10}px system-ui,-apple-system,"Segoe UI",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = c.measureText(text).width + 12, h = (o.size || 10) + 7;
    rr(c, cx - w / 2, cy - h / 2, w, h, h / 2); c.fillStyle = o.bg || '#fff4d6'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = o.bd || '#8a5a2b'; c.stroke();
    c.fillStyle = o.fg || '#5a3418'; c.fillText(text, cx, cy + 0.5); c.restore();
  }
  function tree(c, x, y, s, kind, P_, seed) {
    // (x,y) = base of trunk in px, s = scale (1 ≈ 44px canopy)
    const r = mulberry(seed || 1), pal = P_.trees;
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(2, 1, 17 * s, 6 * s, 0, 0, TAU); c.fill();
    const winter = P_.snow;
    if (kind === 1) { // conifer
      c.fillStyle = '#6b4220'; c.fillRect(-2 * s, -8 * s, 4 * s, 9 * s);
      for (let i = 0; i < 3; i++) {
        const by = -8 * s - i * 12 * s, w = (19 - i * 4) * s;
        c.fillStyle = pal[i % 3 === 0 ? 0 : i % 3]; c.beginPath(); c.moveTo(-w, by); c.lineTo(0, by - 20 * s); c.lineTo(w, by); c.closePath(); c.fill();
        if (winter) { c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.moveTo(-w * .62, by - 8 * s); c.lineTo(0, by - 20 * s); c.lineTo(w * .62, by - 8 * s); c.quadraticCurveTo(0, by - 4 * s, -w * .62, by - 8 * s); c.fill(); }
      }
    } else {
      c.fillStyle = '#6e4521'; c.fillRect(-2.5 * s, -14 * s, 5 * s, 15 * s);
      if (winter) {
        c.strokeStyle = '#6e4521'; c.lineWidth = 2 * s; c.beginPath(); c.moveTo(0, -12 * s); c.lineTo(-11 * s, -28 * s); c.moveTo(0, -14 * s); c.lineTo(10 * s, -30 * s); c.moveTo(0, -18 * s); c.lineTo(0, -36 * s); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.95)'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc((r() - .5) * 20 * s, -22 * s - r() * 14 * s, 3.5 * s, 0, TAU); c.fill(); }
      } else {
        const blobs = [[-9, -22, 12, 0], [9, -23, 12, 0], [0, -32, 13, 1], [-3, -20, 14, 0]];
        blobs.forEach(b => { c.fillStyle = pal[b[3] === 1 ? 2 : b[0] < 0 ? 0 : 1]; c.beginPath(); c.arc(b[0] * s, b[1] * s, b[2] * s, 0, TAU); c.fill(); });
        c.fillStyle = 'rgba(255,255,255,.14)'; c.beginPath(); c.arc(-4 * s, -35 * s, 8 * s, 0, TAU); c.fill();
        if (P_.flower && r() < .6) { c.fillStyle = '#ffd3e6'; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc((r() - .5) * 28 * s, -22 * s - r() * 18 * s, 2.2 * s, 0, TAU); c.fill(); } }
      }
    }
    c.restore();
  }
  function fence(c, x1, y1, x2, y2, P_) {
    // wooden fence segment between two px points (axis aligned)
    const horiz = Math.abs(y2 - y1) < 0.01, len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.round(len / 20));
    c.save(); c.lineCap = 'round';
    const pts = []; for (let i = 0; i <= n; i++) pts.push([lerp(x1, x2, i / n), lerp(y1, y2, i / n)]);
    c.strokeStyle = '#8a5a2b'; c.lineWidth = 3;
    c.beginPath();
    if (horiz) { c.moveTo(x1, y1 - 9); c.lineTo(x2, y2 - 9); c.moveTo(x1, y1 - 4); c.lineTo(x2, y2 - 4); } else { c.moveTo(x1, y1 - 9); c.lineTo(x2, y2 - 9); c.moveTo(x1, y1 - 3); c.lineTo(x2, y2 - 3); }
    c.stroke();
    pts.forEach(p => { c.fillStyle = '#6b4220'; c.fillRect(p[0] - 2.5, p[1] - 13, 5, 15); c.fillStyle = '#8f5f31'; c.fillRect(p[0] - 2.5, p[1] - 13, 2, 15); if (P_.snow) { c.fillStyle = '#fff'; c.fillRect(p[0] - 3.5, p[1] - 15, 7, 3.5); } });
    if (P_.snow) { c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x1, y1 - 10.5); c.lineTo(x2, y2 - 10.5); c.stroke(); }
    c.restore();
  }
  function fenceRect(c, x, y, w, h, gates, P_) { // px; gates = [{side:'t'|'b'|'l'|'r', a, b}] gaps in px along the side
    const seg = (x1, y1, x2, y2, side) => {
      const gs = (gates || []).filter(g => g.side === side);
      if (!gs.length) { fence(c, x1, y1, x2, y2, P_); return; }
      const g = gs[0], horiz = side === 't' || side === 'b';
      if (horiz) { fence(c, x1, y1, g.a, y2, P_); fence(c, g.b, y1, x2, y2, P_); gatePosts(c, g.a, y1, g.b, y1, true); }
      else { fence(c, x1, y1, x2, g.a, P_); fence(c, x1, g.b, x2, y2, P_); gatePosts(c, x1, g.a, x1, g.b, false); }
    };
    seg(x, y, x + w, y, 't'); seg(x, y + h, x + w, y + h, 'b'); seg(x, y, x, y + h, 'l'); seg(x + w, y, x + w, y + h, 'r');
  }
  function gatePosts(c, x1, y1, x2, y2, horiz) {
    c.save(); c.fillStyle = '#5a3418';
    [[x1, y1], [x2, y2]].forEach(p => { c.fillRect(p[0] - 4, p[1] - 17, 8, 19); c.fillStyle = '#e8c070'; c.fillRect(p[0] - 4, p[1] - 17, 8, 3); c.fillStyle = '#5a3418'; });
    c.restore();
  }

  function paintGround(c, P_) {
    const r = mulberry(11);
    c.fillStyle = P_.g1; c.fillRect(0, 0, W * T, H * T);
    for (let i = 0; i < 260; i++) { c.globalAlpha = .45; c.fillStyle = P_.g2; c.beginPath(); c.ellipse(r() * W * T, r() * H * T, 20 + r() * 50, 12 + r() * 30, r() * 3, 0, TAU); c.fill(); }
    c.globalAlpha = 1;
    c.strokeStyle = P_.tuft; c.lineWidth = 1.5; c.lineCap = 'round'; c.beginPath();
    for (let i = 0; i < 1100; i++) { const x = r() * W * T, y = r() * H * T; c.moveTo(x, y); c.lineTo(x - 2.5, y - 5); c.moveTo(x, y); c.lineTo(x + .5, y - 6.5); c.moveTo(x, y); c.lineTo(x + 3, y - 4); }
    c.stroke();
    if (P_.flower) { const cols = ['#fff', '#ffe36a', '#ff9ec7', '#c9a8ff']; for (let i = 0; i < 220; i++) { c.fillStyle = cols[i % 4]; c.beginPath(); c.arc(r() * W * T, r() * H * T, 1.6 + r(), 0, TAU); c.fill(); } }
    if (P_.snow) { c.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 90; i++) { c.beginPath(); c.ellipse(r() * W * T, r() * H * T, 14 + r() * 26, 5 + r() * 9, 0, 0, TAU); c.fill(); } c.fillStyle = 'rgba(170,190,210,.35)'; for (let i = 0; i < 60; i++) { c.beginPath(); c.ellipse(r() * W * T, r() * H * T, 10 + r() * 20, 3 + r() * 5, 0, 0, TAU); c.fill(); } }
  }
  function paintHills(c, P_) {
    const r = mulberry(5);
    c.save(); c.beginPath(); c.rect(0, 0, W * T, H * T); c.rect(2 * T, 2 * T, (W - 4) * T, (H - 3) * T); c.clip('evenodd');
    c.fillStyle = P_.hill; c.fillRect(0, 0, W * T, H * T);
    for (let k = 0; k < 34; k++) {
      const by = k * 36 - 8 + r() * 10; c.beginPath();
      for (let x = -20; x <= W * T + 20; x += 16) { const y = by + Math.sin(x * 0.012 + k * 1.7) * 13 + Math.sin(x * 0.031 + k) * 5; if (x === -20) c.moveTo(x, y); else c.lineTo(x, y); }
      c.strokeStyle = k % 2 ? P_.hillA : P_.hillB; c.globalAlpha = .55; c.lineWidth = 9 + r() * 9; c.lineCap = 'round'; c.stroke();
    }
    c.globalAlpha = 1;
    // soft rolling shading
    for (let i = 0; i < 16; i++) {
      const x = r() * W * T, y = r() * H * T, rx = 60 + r() * 90, ry = 28 + r() * 40;
      const g = c.createRadialGradient(x - 10, y - 10, 4, x, y, rx); g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(.7, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.1)');
      c.fillStyle = g; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill();
    }
    c.restore();
    // inner fence line between hills and farmland
    const f = (x1, y1, x2, y2) => fence(c, x1, y1, x2, y2, P_);
    f(2 * T, 2 * T + 6, 2 * T, ROAD0 * T - 4); f(38 * T, 2 * T + 6, 38 * T, ROAD0 * T - 4);
    f(14 * T, 2 * T + 6, 30 * T, 2 * T + 6);
  }
  function paintPaths(c, P_) {
    const r = mulberry(21);
    const rects = [[2, 7, 36, 1], [2, 8, 12, 1], [14, 8, 1, 18], [28, 7, 2, 19], [15, 13, 12, 1], [15, 18, 12, 1], [15, 21, 12, 1], [15, 24, 12, 1], [4, 25, 5, 1], [10, 24, 4, 1], [32, 25, 5, 1], [30, 22, 7, 1]];
    c.fillStyle = P_.path;
    rects.forEach(q => { rr(c, q[0] * T + 2, q[1] * T + 4, q[2] * T - 4, q[3] * T - 8, 12); c.fill(); });
    c.fillStyle = P_.pathD;
    for (let i = 0; i < 900; i++) { const q = rects[Math.floor(r() * rects.length)], x = q[0] * T + 6 + r() * (q[2] * T - 12), y = q[1] * T + 6 + r() * (q[3] * T - 12); c.globalAlpha = .55; c.beginPath(); c.arc(x, y, .8 + r() * 1.4, 0, TAU); c.fill(); }
    c.globalAlpha = 1;
    if (P_.snow) { c.fillStyle = 'rgba(255,255,255,.55)'; rects.forEach(q => { rr(c, q[0] * T + 6, q[1] * T + 8, q[2] * T - 12, q[3] * T - 16, 10); c.fill(); }); }
  }
  function paintRoad(c, P_) {
    const r = mulberry(33), y0 = ROAD0 * T, h = (ROAD1 - ROAD0 + 1) * T;
    // grassy shoulder
    c.fillStyle = P_.roadD; c.fillRect(0, y0 - 6, W * T, 6);
    c.fillStyle = P_.road; c.fillRect(0, y0, W * T, h);
    for (let i = 0; i < 1600; i++) { c.fillStyle = r() < .5 ? P_.roadD : 'rgba(255,255,255,.35)'; c.globalAlpha = .6; c.beginPath(); c.arc(r() * W * T, y0 + r() * h, .7 + r() * 1.3, 0, TAU); c.fill(); }
    c.globalAlpha = 1;
    // wheel ruts
    c.strokeStyle = 'rgba(0,0,0,.08)'; c.lineWidth = 6; [y0 + 26, y0 + 40, y0 + 80, y0 + 94].forEach(y => { c.beginPath(); c.moveTo(0, y); c.lineTo(W * T, y); c.stroke(); });
    c.strokeStyle = P_.snow ? '#e8d890' : '#e9c85a'; c.lineWidth = 2.5; c.setLineDash([22, 18]); c.beginPath(); c.moveTo(0, y0 + h / 2); c.lineTo(W * T, y0 + h / 2); c.stroke(); c.setLineDash([]);
    c.fillStyle = P_.roadD; c.fillRect(0, y0 + h, W * T, 4);
    if (P_.snow) { c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(0, y0 - 6, W * T, 4); }
    // road sign
    plate(c, 22.4 * T, 25.2 * T, 'COUNTY RD 9', { size: 8.5, bg: '#2f7d4f', fg: '#fff', bd: '#fff' });
  }
  function paintTreeLine(c, P_) {
    const r = mulberry(77), items = [], dense = G.hasExpansion && G.hasExpansion('windbreak_trees');
    const step = dense ? 0.55 : 1.35;
    for (let x = 0.4; x < W; x += step * (0.8 + r() * 0.4)) { items.push([x * T, (1.0 + r() * 0.5) * T + 10, (dense ? 1.15 : 0.85) + r() * .25, r() < (dense ? .75 : .5) ? 1 : 0]); }
    if (dense) for (let x = 0.8; x < W; x += 0.8) items.push([x * T, 0.55 * T + 6, 1.2, 1]);
    for (let y = 2.4; y < ROAD0 - 0.5; y += step * 1.6) { items.push([(0.6 + r() * 0.7) * T, y * T, 0.85 + r() * .25, r() < .5 ? 1 : 0]); items.push([(38.7 + r() * 0.7) * T, y * T, 0.85 + r() * .25, r() < .5 ? 1 : 0]); }
    items.sort((a, b) => a[1] - b[1]).forEach((t, i) => tree(c, t[0], t[1], t[2], t[3], P_, 100 + i));
  }
  function paintPond(c, P_) {
    const cx = POND.cx * T, cy = POND.cy * T, rx = POND.rx * T, ry = POND.ry * T;
    c.fillStyle = P_.snow ? '#e9f2f8' : (P_.g2); c.beginPath(); c.ellipse(cx, cy + 3, rx + 8, ry + 8, 0, 0, TAU); c.fill();
    c.fillStyle = P_.snow ? '#cfe2ee' : '#c7b784'; c.beginPath(); c.ellipse(cx, cy + 2, rx + 3, ry + 3, 0, 0, TAU); c.fill();
    const g = c.createLinearGradient(0, cy - ry, 0, cy + ry); g.addColorStop(0, P_.pond2); g.addColorStop(1, P_.pond);
    c.fillStyle = g; c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.5; for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(cx - 20 + i * 14, cy - 12 + (i % 3) * 14, 16, 4, 0, 0, Math.PI); c.stroke(); }
    if (P_.snow) { c.strokeStyle = 'rgba(120,160,190,.7)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(cx - 40, cy - 8); c.lineTo(cx - 10, cy + 8); c.lineTo(cx + 18, cy - 4); c.lineTo(cx + 46, cy + 14); c.moveTo(cx - 10, cy + 8); c.lineTo(cx - 4, cy + 28); c.stroke(); }
    else {
      [[-34, 6], [28, -10], [4, 22]].forEach(p => { c.fillStyle = '#4f9a3f'; c.beginPath(); c.ellipse(cx + p[0], cy + p[1], 9, 5, 0, 0, TAU); c.fill(); c.fillStyle = '#ff9ec7'; c.beginPath(); c.arc(cx + p[0] + 2, cy + p[1] - 2, 2.4, 0, TAU); c.fill(); });
      c.strokeStyle = '#4b7a32'; c.lineWidth = 1.6; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, x = cx + Math.cos(a) * (rx + 2), y = cy + Math.sin(a) * (ry + 2); if (Math.sin(a) < 0.4) continue; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 1, y - 10 - (i % 3) * 3); c.stroke(); c.fillStyle = '#6b4a22'; c.fillRect(x - 1.5 + 1, y - 14 - (i % 3) * 3, 3, 6); }
    }
  }
  function paintPlots(c, P_) {
    const s = S();
    for (let i = 0; i < s.plots.length; i++) {
      const q = plotRect(i), x = q.x * T + 2, y = q.y * T + 2, w = q.w * T - 4, h = q.h * T - 4;
      c.fillStyle = 'rgba(0,0,0,.2)'; rr(c, x + 1, y + 4, w, h, 10); c.fill();
      c.fillStyle = P_.soilD; rr(c, x, y, w, h, 10); c.fill();
      const gr = c.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, P_.soilL); gr.addColorStop(1, P_.soil);
      c.fillStyle = gr; rr(c, x + 3, y + 3, w - 6, h - 8, 8); c.fill();
      for (let k = 0; k < 5; k++) { const yy = y + 11 + k * 12; c.fillStyle = 'rgba(40,20,0,.28)'; c.fillRect(x + 7, yy + 4, w - 14, 3); c.fillStyle = 'rgba(255,220,160,.2)'; c.fillRect(x + 7, yy, w - 14, 2); }
      if (P_.snow) { c.fillStyle = 'rgba(255,255,255,.7)'; rr(c, x + 3, y + 3, w - 6, 8, 6); c.fill(); for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(x + 8 + hash(i + 'a' + k) * (w - 16), y + 12 + hash(i + 'b' + k) * (h - 20), 2.5, 0, TAU); c.fill(); } }
    }
    // buy-land slot
    if (s.plots.length < s.maxPlots) {
      const q = plotRect(s.plots.length), x = q.x * T + 4, y = q.y * T + 4, w = q.w * T - 8, h = q.h * T - 8;
      c.fillStyle = 'rgba(255,240,180,.28)'; rr(c, x, y, w, h, 10); c.fill();
      c.setLineDash([7, 6]); c.lineWidth = 2.5; c.strokeStyle = '#fff4c0'; rr(c, x, y, w, h, 10); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#fff'; c.font = '900 30px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 4; c.fillText('+', x + w / 2, y + h / 2 - 8); c.restore();
      plate(c, x + w / 2, y + h / 2 + 15, 'BUY LAND 🪙' + G.plotCost(), { size: 9, bg: '#ffe39a' });
    }
    // field label
    if (s.plots.length) plate(c, 8 * T, 8.45 * T, 'YOUR FIELDS', { size: 8.5 });
  }

  // --- buildings ---
  function paintBarn(c, R) {
    const { x, y, w, h } = R;
    shade(c, x, y, w, h, .26);
    const siloW = 34, bw = w - siloW - 4, wallH = h * .5, wy = y + h - wallH;
    // silo
    const sx = x + w - siloW;
    c.fillStyle = '#c9d1d6'; c.fillRect(sx, y + 14, siloW, h - 14);
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(sx + 4, y + 14, 6, h - 14); c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(sx + siloW - 9, y + 14, 9, h - 14);
    for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(sx, y + 34 + i * 26, siloW, 2); }
    c.fillStyle = '#8f9ba3'; c.beginPath(); c.moveTo(sx - 2, y + 16); c.quadraticCurveTo(sx + siloW / 2, y - 18, sx + siloW + 2, y + 16); c.closePath(); c.fill();
    // main barn (gambrel gable face)
    const bx = x, top = y + 4, brk = y + h * .3;
    c.fillStyle = '#b8342a'; c.beginPath(); c.moveTo(bx + 2, wy + 2); c.lineTo(bx + 2, brk + 10); c.lineTo(bx + bw * .16, brk - 10); c.lineTo(bx + bw / 2, top); c.lineTo(bx + bw * .84, brk - 10); c.lineTo(bx + bw - 2, brk + 10); c.lineTo(bx + bw - 2, wy + 2); c.lineTo(bx + bw - 2, y + h - 2); c.lineTo(bx + 2, y + h - 2); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 1.2; for (let i = 1; i < 14; i++) { c.beginPath(); c.moveTo(bx + 2 + i * (bw - 4) / 14, brk - 6 - Math.min(i, 14 - i) * 4); c.lineTo(bx + 2 + i * (bw - 4) / 14, y + h - 2); c.stroke(); }
    c.strokeStyle = '#4b2b21'; c.lineWidth = 6; c.lineJoin = 'round'; c.beginPath(); c.moveTo(bx - 2, brk + 14); c.lineTo(bx + bw * .16 - 2, brk - 13); c.lineTo(bx + bw / 2, top - 3); c.lineTo(bx + bw * .84 + 2, brk - 13); c.lineTo(bx + bw + 2, brk + 14); c.stroke();
    c.strokeStyle = '#fbeed2'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(bx + 4, brk + 12); c.lineTo(bx + bw * .16, brk - 7); c.lineTo(bx + bw / 2, top + 4); c.lineTo(bx + bw * .84, brk - 7); c.lineTo(bx + bw - 4, brk + 12); c.stroke();
    // loft door
    c.fillStyle = '#6e1f18'; c.fillRect(bx + bw / 2 - 14, brk - 2, 28, 24); c.strokeStyle = '#fbeed2'; c.lineWidth = 2.5; c.strokeRect(bx + bw / 2 - 14, brk - 2, 28, 24); c.beginPath(); c.moveTo(bx + bw / 2 - 14, brk - 2); c.lineTo(bx + bw / 2 + 14, brk + 22); c.moveTo(bx + bw / 2 + 14, brk - 2); c.lineTo(bx + bw / 2 - 14, brk + 22); c.stroke();
    // big doors
    const dw = bw * .46, dx = bx + bw / 2 - dw / 2, dh = wallH * .82, dy = y + h - dh - 2;
    c.fillStyle = '#8a2a21'; c.fillRect(dx, dy, dw, dh); c.strokeStyle = '#fbeed2'; c.lineWidth = 3; c.strokeRect(dx, dy, dw, dh); c.beginPath(); c.moveTo(dx + dw / 2, dy); c.lineTo(dx + dw / 2, dy + dh); c.stroke();
    c.beginPath(); c.moveTo(dx, dy); c.lineTo(dx + dw / 2, dy + dh); c.moveTo(dx + dw / 2, dy); c.lineTo(dx, dy + dh); c.moveTo(dx + dw / 2, dy); c.lineTo(dx + dw, dy + dh); c.moveTo(dx + dw, dy); c.lineTo(dx + dw / 2, dy + dh); c.stroke();
    // side windows
    [bx + 14, bx + bw - 14 - 18].forEach(wx => { c.fillStyle = '#3a2a20'; c.fillRect(wx, wy + 14, 18, 22); c.strokeStyle = '#fbeed2'; c.lineWidth = 2; c.strokeRect(wx, wy + 14, 18, 22); });
    plate(c, bx + bw / 2, y + h + 9, 'THE BARN', { size: 9 });
  }
  function paintHouse(c, R) {
    const { x, y, w, h } = R;
    shade(c, x, y, w, h, .24);
    const roofH = h * .42, wy = y + roofH - 4, wall = '#f7ecd1';
    // chimney
    c.fillStyle = '#a5503c'; c.fillRect(x + w * .72, y - 4, 20, 40); c.fillStyle = '#6e3a2c'; c.fillRect(x + w * .72 - 3, y - 7, 26, 6);
    // wall
    c.fillStyle = wall; c.fillRect(x + 14, wy, w - 28, h - roofH - 16 + 4);
    c.strokeStyle = 'rgba(120,90,50,.22)'; c.lineWidth = 1.2; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(x + 14, wy + 10 + i * 11); c.lineTo(x + w - 14, wy + 10 + i * 11); c.stroke(); }
    // roof (hip)
    c.fillStyle = '#6a86a3'; c.beginPath(); c.moveTo(x + 2, wy + 8); c.lineTo(x + 30, y + 4); c.lineTo(x + w - 30, y + 4); c.lineTo(x + w - 2, wy + 8); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1.4; for (let i = 1; i < 6; i++) { const yy = y + 4 + i * (wy + 4 - y) / 6; c.beginPath(); c.moveTo(x + 2 + (1 - i / 6) * 28, yy); c.lineTo(x + w - 2 - (1 - i / 6) * 28, yy); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.moveTo(x + 30, y + 4); c.lineTo(x + w - 30, y + 4); c.lineTo(x + w - 34, y + 12); c.lineTo(x + 34, y + 12); c.fill();
    c.fillStyle = '#4c627a'; c.fillRect(x + 2, wy + 6, w - 4, 6);
    if (G.state && 0) { }
    // windows
    const win = (wx) => { c.fillStyle = '#9fd0ea'; c.fillRect(wx, wy + 22, 28, 30); c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(wx + 2, wy + 24, 8, 26); c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(wx, wy + 22, 28, 30); c.beginPath(); c.moveTo(wx + 14, wy + 22); c.lineTo(wx + 14, wy + 52); c.moveTo(wx, wy + 37); c.lineTo(wx + 28, wy + 37); c.stroke(); c.fillStyle = '#b8342a'; c.fillRect(wx - 7, wy + 22, 6, 30); c.fillRect(wx + 29, wy + 22, 6, 30); };
    win(x + 32); win(x + w - 60);
    // door + porch
    const dx = x + w / 2 - 15;
    c.fillStyle = '#8a4b2a'; rr(c, dx, wy + 22, 30, h - roofH - 26, 4); c.fill(); c.fillStyle = '#ffd45e'; c.beginPath(); c.arc(dx + 24, wy + 52, 2.2, 0, TAU); c.fill();
    c.fillStyle = '#d9b46a'; c.fillRect(x + w / 2 - 54, y + h - 26, 108, 6); c.fillStyle = '#b8342a'; c.fillRect(x + w / 2 - 58, y + h - 36, 116, 8);
    c.fillStyle = '#fff'; [-52, 52].forEach(o => c.fillRect(x + w / 2 + o - 2, y + h - 30, 4, 22));
    c.fillStyle = '#a9794a'; c.fillRect(x + w / 2 - 54, y + h - 12, 108, 10);
    c.fillStyle = '#e1a35c'; c.fillRect(x + w / 2 - 54, y + h - 12, 108, 3);
    // flower boxes
    [x + 32, x + w - 60].forEach(wx => { c.fillStyle = '#7a4a25'; c.fillRect(wx, wy + 52, 28, 7); ['#ff6b8b', '#ffd45e', '#ff9ec7', '#fff'].forEach((col, k) => { c.fillStyle = col; c.beginPath(); c.arc(wx + 4 + k * 7, wy + 51, 3, 0, TAU); c.fill(); }); });
    plate(c, x + w / 2, y + h + 9, 'FARMHOUSE', { size: 9 });
  }
  function paintShed(c, R, owned) {
    const { x, y, w, h } = R;
    shade(c, x, y, w, h, .22);
    c.fillStyle = '#4a3b2e'; c.fillRect(x + 6, y + 36, w - 12, h - 38);
    c.fillStyle = '#2a2018'; c.fillRect(x + 14, y + 44, w - 28, h - 46);
    c.strokeStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(x + 14, y + 52 + i * 11); c.lineTo(x + w - 14, y + 52 + i * 11); c.stroke(); }
    // posts + roof
    c.fillStyle = '#6a8a58'; c.beginPath(); c.moveTo(x - 2, y + 40); c.lineTo(x + 14, y + 8); c.lineTo(x + w - 14, y + 8); c.lineTo(x + w + 2, y + 40); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 2; for (let i = 1; i < 12; i++) { c.beginPath(); c.moveTo(x + 6 + i * (w - 12) / 12, y + 10); c.lineTo(x + 2 + i * (w - 4) / 12, y + 38); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(x + 14, y + 8, w - 28, 5);
    c.fillStyle = '#4f6a42'; c.fillRect(x - 2, y + 38, w + 4, 6);
    c.fillStyle = '#6b4220'; c.fillRect(x + 6, y + 40, 7, h - 42); c.fillRect(x + w - 13, y + 40, 7, h - 42);
    if (!owned) { c.fillStyle = 'rgba(255,255,255,.6)'; c.font = '700 10px system-ui,sans-serif'; c.textAlign = 'center'; c.fillText('(empty bay)', x + w / 2, y + h - 22); }
    plate(c, x + w / 2, y + h + 9, 'TRACTOR SHED', { size: 9 });
  }
  function paintStall(c, R, built) {
    const { x, y, w, h } = R;
    if (!built) {
      c.setLineDash([8, 6]); c.lineWidth = 2.5; c.strokeStyle = 'rgba(255,255,255,.85)'; rr(c, x + 4, y + 4, w - 8, h - 8, 10); c.stroke(); c.setLineDash([]);
      c.fillStyle = 'rgba(255,255,255,.25)'; rr(c, x + 4, y + 4, w - 8, h - 8, 10); c.fill();
      emStatic(c, '🧺', x + w / 2 - 70, y + h / 2, 30, .8);
      c.fillStyle = '#6b4220'; c.fillRect(x + 10, y + 10, 5, 30);
      plate(c, x + w / 2 + 8, y + h / 2 - 6, 'BUILD A FARM STAND', { size: 10, bg: '#ffe39a' });
      plate(c, x + w / 2 + 8, y + h / 2 + 12, 'walk up and tap', { size: 8, bg: '#fff4d6' });
      return;
    }
    shade(c, x, y, w, h, .22);
    c.fillStyle = '#5a3a20'; c.fillRect(x + 6, y + 18, w - 12, h - 20);
    c.fillStyle = '#c99a5a'; c.fillRect(x + 6, y + h - 22, w - 12, 20); c.fillStyle = '#e1b878'; c.fillRect(x + 6, y + h - 22, w - 12, 5);
    ['🍎', '🌽', '🥕', '🎃', '🥚', '🍞', '🍯', '🥔'].forEach((e, i) => emStatic(c, e, x + 20 + i * ((w - 40) / 7), y + h - 30, 18));
    // awning
    const n = 10, aw = (w - 4) / n;
    for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? '#fff4e0' : '#d9483b'; c.beginPath(); c.moveTo(x + 2 + i * aw, y + 2); c.lineTo(x + 2 + (i + 1) * aw, y + 2); c.lineTo(x + 2 + (i + 1) * aw, y + 26); c.arc(x + 2 + (i + .5) * aw, y + 26, aw / 2, 0, Math.PI); c.closePath(); c.fill(); }
    c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(x + 2, y + 2, w - 4, 5);
    c.fillStyle = '#6b4220'; c.fillRect(x + 2, y + 6, 5, h - 8); c.fillRect(x + w - 7, y + 6, 5, h - 8);
    plate(c, x + w / 2, y + h + 9, 'FARM STAND', { size: 9 });
  }
  function paintCoop(c, R) {
    const { x, y, w, h } = R;
    shade(c, x, y, w, h, .22);
    c.fillStyle = '#f4e7c8'; c.fillRect(x + 6, y + 20, w - 12, h - 22);
    c.strokeStyle = 'rgba(120,90,50,.2)'; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(x + 6, y + 30 + i * 11); c.lineTo(x + w - 6, y + 30 + i * 11); c.stroke(); }
    c.fillStyle = '#4e8b4a'; c.beginPath(); c.moveTo(x, y + 24); c.lineTo(x + 10, y + 2); c.lineTo(x + w - 10, y + 2); c.lineTo(x + w, y + 24); c.closePath(); c.fill();
    for (let i = 0; i < 10; i++) { c.fillStyle = i % 2 ? '#f4e7c8' : '#4e8b4a'; c.fillRect(x + 4 + i * (w - 8) / 10, y + 24, (w - 8) / 10, 8); }
    c.fillStyle = '#9fd0ea'; [x + 14, x + w - 46].forEach(wx => { c.fillRect(wx, y + 38, 32, 18); c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.strokeRect(wx, y + 38, 32, 18); });
    c.fillStyle = '#8a4b2a'; rr(c, x + w / 2 - 12, y + 36, 24, h - 38, 3); c.fill();
    emStatic(c, '🏪', x + w / 2, y + 14, 22);
    plate(c, x + w / 2, y + h + 9, 'CO-OP STORE', { size: 9, bg: '#dff3c8' });
  }
  function paintOrders(c, R) {
    const { x, y, w, h } = R;
    c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(x + w / 2, y + h - 2, w / 2, 6, 0, 0, TAU); c.fill();
    c.fillStyle = '#6b4220'; c.fillRect(x + 8, y - 14, 6, h + 14); c.fillRect(x + w - 24, y - 14, 6, h + 14);
    rr(c, x + 2, y - 36, w - 22, 36, 5); c.fillStyle = '#c99a5a'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#6b4220'; c.stroke();
    [['#fff', 6, -32, -.08], ['#ffe39a', 26, -30, .06], ['#fff', 46, -33, -.04]].forEach(n => { c.save(); c.translate(x + n[1], y + n[2]); c.rotate(n[3]); c.fillStyle = n[0]; c.fillRect(0, 0, 16, 20); c.fillStyle = '#d9483b'; c.fillRect(6, -1, 3, 3); c.fillStyle = 'rgba(0,0,0,.3)'; for (let i = 0; i < 4; i++) c.fillRect(2, 5 + i * 4, 12, 1.2); c.restore(); });
    // mailbox
    c.fillStyle = '#6b4220'; c.fillRect(x + w - 10, y - 6, 5, h + 6);
    c.fillStyle = '#d9483b'; rr(c, x + w - 20, y - 24, 24, 18, 8); c.fill(); c.fillStyle = '#a42d23'; c.fillRect(x + w - 20, y - 12, 24, 3);
    c.fillStyle = '#ffd45e'; c.fillRect(x + w - 2, y - 30, 3, 14); c.fillRect(x + w - 2, y - 30, 8, 5);
    plate(c, x + w / 2, y + h + 9, 'ORDERS', { size: 9, bg: '#ffe39a' });
  }
  const BCOL = [['#f0d9b5', '#a65f3a'], ['#e3d6c5', '#6f8aa6'], ['#f3e1c1', '#b8574a'], ['#e8dfc9', '#5f8f5a'], ['#f0dcc0', '#8a6a9a'], ['#ead8b8', '#c08a3a']];
  function paintBuilding(c, R, type) {
    const { x, y, w, h } = R, d = G.DATA.buildings[type] || { name: type, emoji: '🏭' }, col = BCOL[Math.floor(hash(type) * BCOL.length)];
    shade(c, x, y, w, h, .22);
    c.fillStyle = col[0]; c.fillRect(x + 6, y + 30, w - 12, h - 34);
    c.strokeStyle = 'rgba(100,70,30,.18)'; c.lineWidth = 1; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(x + 6, y + 40 + i * 9); c.lineTo(x + w - 6, y + 40 + i * 9); c.stroke(); }
    c.fillStyle = col[1]; c.beginPath(); c.moveTo(x + 1, y + 34); c.lineTo(x + 13, y + 5); c.lineTo(x + w - 13, y + 5); c.lineTo(x + w - 1, y + 34); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(x + 14, y + 5, w - 28, 4); c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(x + 1, y + 31, w - 2, 5);
    c.fillStyle = 'rgba(255,255,255,.75)'; rr(c, x + w / 2 - 17, y + 38, 34, 24, 8); c.fill();
    emStatic(c, d.emoji, x + w / 2, y + 50, 22);
    c.font = '800 8px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const nm = String(d.name || type).toUpperCase(); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.95)'; c.strokeText(nm, x + w / 2, y + h + 7); c.fillStyle = '#5a3418'; c.fillText(nm, x + w / 2, y + h + 7);
  }
  function paintLot(c, R, type) {
    const { x, y, w, h } = R, d = G.DATA.buildings[type] || { name: type, emoji: '🏭', level: 1 };
    c.save(); c.globalAlpha = .55;
    c.fillStyle = 'rgba(255,255,255,.35)'; rr(c, x + 3, y + 3, w - 6, h - 6, 8); c.fill();
    c.setLineDash([6, 5]); c.lineWidth = 2; c.strokeStyle = '#fff'; rr(c, x + 3, y + 3, w - 6, h - 6, 8); c.stroke(); c.setLineDash([]);
    c.globalAlpha = .32; emStatic(c, d.emoji, x + w / 2, y + 28, 30);
    c.globalAlpha = .9;
    c.fillStyle = '#6b4220'; c.fillRect(x + w / 2 - 2, y + 40, 4, 20); c.restore();
    plate(c, x + w / 2, y + 44, 'FOR SALE', { size: 8, bg: '#fff4d6' });
    c.save(); c.globalAlpha = .8; c.font = '800 8px system-ui,sans-serif'; c.textAlign = 'center'; const nm = String(d.name).toUpperCase(); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.9)'; c.strokeText(nm, x + w / 2, y + h + 7); c.fillStyle = '#5a3418'; c.fillText(nm, x + w / 2, y + h + 7); c.restore();
  }
  function paintPen(c, pen, P_) {
    const { x, y } = pen.rect, X = x * T, Y = y * T, d = G.DATA.animals[pen.type] || { name: pen.type, emoji: '🐾' };
    const w = 6 * T, h = 4 * T;
    if (!pen.owned) {
      c.save(); c.globalAlpha = .5; c.setLineDash([7, 6]); c.lineWidth = 2; c.strokeStyle = '#fff'; rr(c, X + 8, Y + 8, w - 16, h - 16, 10); c.stroke(); c.setLineDash([]);
      c.fillStyle = 'rgba(255,255,255,.2)'; rr(c, X + 8, Y + 8, w - 16, h - 16, 10); c.fill(); c.globalAlpha = .45; emStatic(c, d.emoji, X + w / 2, Y + h / 2 - 14, 38); c.restore();
      plate(c, X + w / 2, Y + h / 2 + 24, (d.name || pen.type).toUpperCase() + ' PEN · FOR SALE', { size: 8.5, bg: '#fff4d6' });
      return;
    }
    const floor = pen.type === 'sheep' ? P_.pasture : pen.type === 'bees' ? P_.g2 : (P_.snow ? '#e4e8ec' : '#cdb07a');
    c.fillStyle = floor; rr(c, X + 10, Y + 12, w - 20, h - 16, 10); c.fill();
    if (pen.type === 'chickens' || pen.type === 'cows') { c.fillStyle = 'rgba(120,80,30,.25)'; for (let i = 0; i < 40; i++) { c.beginPath(); c.arc(X + 20 + hash(pen.type + i) * (w - 40), Y + 20 + hash(pen.type + 'y' + i) * (h - 36), 1 + hash('r' + i) * 1.8, 0, TAU); c.fill(); } }
    if (pen.type === 'bees' || pen.type === 'sheep') { c.fillStyle = pen.type === 'bees' ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.1)'; for (let i = 0; i < 18; i++) { c.beginPath(); c.arc(X + 20 + hash(pen.type + i) * (w - 40), Y + 24 + hash(pen.type + 'y' + i) * (h - 40), 1.6, 0, TAU); c.fill(); } }
    // props
    if (pen.type === 'chickens') { // coop
      c.fillStyle = '#b8342a'; c.fillRect(X + w - 66, Y + 20, 40, 26); c.fillStyle = '#6e3a2c'; c.beginPath(); c.moveTo(X + w - 70, Y + 22); c.lineTo(X + w - 46, Y + 6); c.lineTo(X + w - 22, Y + 22); c.closePath(); c.fill(); c.fillStyle = '#2a1a10'; c.fillRect(X + w - 52, Y + 30, 12, 16);
    } else if (pen.type === 'cows') {
      c.fillStyle = '#6b4220'; rr(c, X + 18, Y + h - 38, 42, 12, 4); c.fill(); c.fillStyle = '#6fb6e0'; rr(c, X + 21, Y + h - 36, 36, 7, 3); c.fill();
      c.fillStyle = '#d9b650'; c.beginPath(); c.arc(X + w - 36, Y + 30, 14, 0, TAU); c.fill(); c.strokeStyle = '#a8872e'; c.lineWidth = 1.6; c.beginPath(); c.arc(X + w - 36, Y + 30, 9, 0, TAU); c.stroke();
    } else if (pen.type === 'sheep') {
      c.fillStyle = '#8a5a2b'; rr(c, X + w - 70, Y + 20, 46, 12, 4); c.fill(); c.fillStyle = '#d9b650'; c.fillRect(X + w - 66, Y + 14, 38, 8);
    } else if (pen.type === 'bees') {
      [[28, 22], [58, 22], [43, 36]].forEach(p => { c.fillStyle = '#fff4d6'; c.fillRect(X + p[0], Y + p[1], 22, 12); c.fillStyle = '#f2b631'; c.fillRect(X + p[0] + 1, Y + p[1] + 4, 20, 3); c.fillStyle = '#c98a14'; c.fillRect(X + p[0] - 2, Y + p[1] - 3, 26, 4); });
    }
    const gx = pen.gate.x * T, gy = pen.gate.y * T, bot = pen.gate.y === y + 3;
    // fence on footprint centre line
    const fx = X + T / 2, fy = Y + T / 2, fw = w - T, fh = h - T;
    const gate = bot ? { side: 'b', a: gx, b: gx + 2 * T } : { side: 't', a: gx, b: gx + 2 * T };
    fenceRect(c, fx, fy, fw, fh, [gate], P_);
    plate(c, X + w / 2, bot ? Y + h + 2 : Y + h + 2, (d.name || pen.type).toUpperCase() + (/s$|sheep/i.test(d.name || '') ? '' : 'S'), { size: 8.5 });
  }
  function paintPasture(c, P_) {
    const z = Z.pasture, X = z.x * T, Y = z.y * T, w = z.w * T, h = z.h * T;
    c.fillStyle = P_.pasture; rr(c, X + 16, Y + 16, w - 32, h - 32, 18); c.fill();
    const r = mulberry(91); c.strokeStyle = 'rgba(0,0,0,.13)'; c.lineWidth = 1.5; c.beginPath();
    for (let i = 0; i < 200; i++) { const x = X + 24 + r() * (w - 48), y = Y + 24 + r() * (h - 48); c.moveTo(x, y); c.lineTo(x - 2, y - 5); c.moveTo(x, y); c.lineTo(x + 2, y - 5); } c.stroke();
    // mud patches + trough + hay + shade tree
    c.fillStyle = 'rgba(110,75,35,.35)'; [[w * .3, h * .62, 38, 20], [w * .68, h * .35, 30, 16]].forEach(p => { c.beginPath(); c.ellipse(X + p[0], Y + p[1], p[2], p[3], 0, 0, TAU); c.fill(); });
    c.fillStyle = '#6b4220'; rr(c, X + w - 100, Y + h - 60, 52, 14, 4); c.fill(); c.fillStyle = '#6fb6e0'; rr(c, X + w - 97, Y + h - 58, 46, 8, 3); c.fill();
    [[X + 50, Y + 44], [X + 82, Y + 54]].forEach(p => { c.fillStyle = '#d9b650'; c.beginPath(); c.arc(p[0], p[1], 15, 0, TAU); c.fill(); c.strokeStyle = '#a8872e'; c.lineWidth = 1.6; c.beginPath(); c.arc(p[0], p[1], 9, 0, TAU); c.stroke(); c.beginPath(); c.arc(p[0], p[1], 4, 0, TAU); c.stroke(); });
    tree(c, X + w - 60, Y + 84, 1.15, 0, P_, 555);
    fenceRect(c, X + T / 2, Y + T / 2, w - T, h - T, [{ side: 'l', a: PASTURE_GATE.y * T, b: (PASTURE_GATE.y + 2) * T }], P_);
    plate(c, X + w / 2, Y + h + 2, 'CATTLE PASTURE', { size: 9 });
  }
  function paintRestaurant(c, P_, stage) {
    const z = Z.restaurant, X = z.x * T, Y = z.y * T, w = z.w * T, h = z.h * T;
    if (stage === 'open' || stage === 'building') {
      // deck patio
      c.fillStyle = P_.deck; rr(c, X + 4, Y + h - 6, w - 8, 4.4 * T, 12); c.fill();
      c.strokeStyle = 'rgba(60,30,0,.25)'; c.lineWidth = 1.4; for (let i = 0; i < 20; i++) { c.beginPath(); c.moveTo(X + 8, Y + h + i * 10); c.lineTo(X + w - 8, Y + h + i * 10); c.stroke(); }
      if (P_.snow) { c.fillStyle = 'rgba(255,255,255,.55)'; rr(c, X + 8, Y + h - 2, w - 16, 4.2 * T - 8, 10); c.fill(); }
    }
    if (stage === 'open') {
      shade(c, X, Y, w, h, .26);
      c.fillStyle = '#a9763f'; c.fillRect(X + 6, Y + 52, w - 12, h - 54);
      c.strokeStyle = 'rgba(60,30,10,.3)'; c.lineWidth = 1.4; for (let i = 0; i < 26; i++) { c.beginPath(); c.moveTo(X + 6 + i * (w - 12) / 26, Y + 52); c.lineTo(X + 6 + i * (w - 12) / 26, Y + h - 2); c.stroke(); }
      c.fillStyle = '#6b6f76'; c.beginPath(); c.moveTo(X - 4, Y + 58); c.lineTo(X + 24, Y + 6); c.lineTo(X + w - 24, Y + 6); c.lineTo(X + w + 4, Y + 58); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = 2; for (let i = 1; i < 22; i++) { c.beginPath(); c.moveTo(X + i * w / 22, Y + 8); c.lineTo(X - 4 + i * (w + 8) / 22, Y + 56); c.stroke(); }
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(X - 4, Y + 52, w + 8, 7);
      if (P_.snow) { c.fillStyle = 'rgba(255,255,255,.92)'; c.beginPath(); c.moveTo(X - 4, Y + 58); c.lineTo(X + 24, Y + 6); c.lineTo(X + w - 24, Y + 6); c.lineTo(X + w + 4, Y + 58); c.lineTo(X + w - 10, Y + 44); c.lineTo(X + 10, Y + 44); c.closePath(); c.fill(); }
      // windows
      [X + 22, X + 66, X + w - 100, X + w - 56].forEach(wx => { c.fillStyle = '#ffe9a8'; c.fillRect(wx, Y + 74, 34, 44); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(wx + 3, Y + 77, 8, 38); c.strokeStyle = '#fff4d6'; c.lineWidth = 3; c.strokeRect(wx, Y + 74, 34, 44); c.beginPath(); c.moveTo(wx + 17, Y + 74); c.lineTo(wx + 17, Y + 118); c.stroke(); });
      // door
      c.fillStyle = '#5a3418'; c.beginPath(); c.moveTo(X + w / 2 - 22, Y + h - 2); c.lineTo(X + w / 2 - 22, Y + 92); c.arc(X + w / 2, Y + 92, 22, Math.PI, 0); c.lineTo(X + w / 2 + 22, Y + h - 2); c.closePath(); c.fill();
      c.fillStyle = '#ffd45e'; c.beginPath(); c.arc(X + w / 2 + 12, Y + 130, 2.2, 0, TAU); c.fill();
      plate(c, X + w / 2, Y + 70, 'THE LAMBING BARN', { size: 10, bg: '#fff0c8' });
      emStatic(c, '🍽️', X + w / 2, Y + 30, 22, .95);
      // string lights across eaves and patio
      const bulbs = [];
      const lights = (x1, y1, x2, y2, sag) => { c.strokeStyle = 'rgba(40,30,20,.7)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo((x1 + x2) / 2, y1 + sag * 2, x2, y2); c.stroke(); const n = Math.round(Math.abs(x2 - x1) / 18); for (let i = 1; i < n; i++) { const t = i / n, bx = lerp(x1, x2, t), by = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * (y1 + sag * 2) + t * t * y2; bulbs.push([bx, by + 3]); } };
      lights(X + 10, Y + 62, X + w - 10, Y + 62, 10);
      lights(X + 10, Y + h + 4, X + w - 10, Y + h + 4, 12);
      c.save(); bulbs.forEach((b, i) => { c.fillStyle = ['#ffd45e', '#ffb86b', '#fff2b0'][i % 3]; c.beginPath(); c.arc(b[0], b[1], 2.6, 0, TAU); c.fill(); }); c.restore();
      L.lights.push(...bulbs.map(b => ({ x: b[0], y: b[1], r: 22, c: 'rgba(255,200,110,.5)' })));
      [X + 40, X + 100, X + w - 106, X + w - 44].forEach(x => L.lights.push({ x: x + 17, y: Y + 96, r: 44, c: 'rgba(255,215,130,.55)' }));
      // tables
      TABLE_YS.forEach((ty, row) => TABLE_XS.forEach((tx, col) => {
        const i = row * 4 + col; if (i >= tableCount()) return;
        const x = tx * T, y = ty * T;
        c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(x, y + 12, 17, 6, 0, 0, TAU); c.fill();
        [-1, 1].forEach(s => { c.fillStyle = '#6b4220'; rr(c, x + s * 26 - 6, y - 2, 12, 16, 3); c.fill(); c.fillStyle = '#a9794a'; rr(c, x + s * 26 - 6, y - 4, 12, 6, 3); c.fill(); });
        c.fillStyle = '#7a4a25'; c.fillRect(x - 2, y + 2, 4, 12);
        c.fillStyle = i % 2 ? '#d9483b' : '#fff4e0'; c.beginPath(); c.ellipse(x, y, 17, 12, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 1.4; c.stroke();
        c.fillStyle = '#ffd45e'; c.beginPath(); c.arc(x, y - 1, 2.4, 0, TAU); c.fill();
      }));
      // flower pots
      [[X + 14, Y + h + 20], [X + w - 14, Y + h + 20]].forEach(p => { emStatic(c, '🪴', p[0], p[1], 20); });
    } else if (stage === 'building') {
      shade(c, X, Y, w, h, .2);
      c.fillStyle = '#a9763f'; c.fillRect(X + 10, Y + 90, w - 20, h - 92); c.strokeStyle = 'rgba(60,30,10,.35)'; for (let i = 0; i < 20; i++) { c.beginPath(); c.moveTo(X + 10 + i * (w - 20) / 20, Y + 90); c.lineTo(X + 10 + i * (w - 20) / 20, Y + h - 2); c.stroke(); }
      c.strokeStyle = '#d8a864'; c.lineWidth = 5; c.beginPath(); c.moveTo(X + 10, Y + 90); c.lineTo(X + w / 2, Y + 20); c.lineTo(X + w - 10, Y + 90); c.moveTo(X + 10, Y + 90); c.lineTo(X + w - 10, Y + 90); c.moveTo(X + w / 2, Y + 20); c.lineTo(X + w / 2, Y + 90); c.stroke();
      c.strokeStyle = '#e8c070'; c.lineWidth = 3; for (let i = 0; i <= 6; i++) { const sx = X + 10 + i * (w - 20) / 6; c.beginPath(); c.moveTo(sx, Y + h); c.lineTo(sx, Y + 50); c.stroke(); } for (let j = 0; j < 4; j++) { c.beginPath(); c.moveTo(X + 10, Y + 60 + j * 34); c.lineTo(X + w - 10, Y + 60 + j * 34); c.stroke(); }
      emStatic(c, '🚧', X + 50, Y + h + 4, 26); emStatic(c, '🚧', X + w - 50, Y + h + 4, 26); emStatic(c, '🏗️', X + w / 2, Y + 70, 34);
      plate(c, X + w / 2, Y + 4 * T + 40, 'UNDER CONSTRUCTION', { size: 10, bg: '#ffe39a' });
    } else {
      // empty lot with permit sign
      c.fillStyle = 'rgba(255,255,255,.18)'; rr(c, X + 10, Y + 20, w - 20, h - 10, 12); c.fill();
      c.setLineDash([9, 7]); c.lineWidth = 2.5; c.strokeStyle = 'rgba(255,255,255,.8)'; rr(c, X + 10, Y + 20, w - 20, h - 10, 12); c.stroke(); c.setLineDash([]);
      [[X + 24, Y + 34], [X + w - 24, Y + 34], [X + 24, Y + h - 6], [X + w - 24, Y + h - 6]].forEach(p => { c.fillStyle = '#d9483b'; c.fillRect(p[0] - 2, p[1] - 14, 4, 16); c.fillStyle = '#fff'; c.fillRect(p[0] - 2, p[1] - 14, 4, 4); });
      emStatic(c, '🍽️', X + w / 2, Y + 62, 40, .55);
      // sign
      c.fillStyle = '#6b4220'; c.fillRect(X + w / 2 - 38, Y + 140, 5, 30); c.fillRect(X + w / 2 + 33, Y + 140, 5, 30);
      rr(c, X + w / 2 - 54, Y + 104, 108, 44, 6); c.fillStyle = '#fff8e6'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#8a5a2b'; c.stroke();
      c.fillStyle = '#5a3418'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 10px system-ui,sans-serif';
      const l1 = stage === 'permit' ? 'PLANNING PERMIT' : 'FUTURE SITE OF', l2 = stage === 'permit' ? 'PENDING' : 'A FARM-TO-TABLE', l3 = stage === 'permit' ? '📜 Hearing soon' : 'RESTAURANT';
      c.fillText(l1, X + w / 2, Y + 118); c.fillText(l2, X + w / 2, Y + 131); c.font = '700 8.5px system-ui,sans-serif'; c.fillText(l3, X + w / 2, Y + 142);
    }
  }
  function paintDecor(c, P_) {
    DECOR_TREES.forEach((t, i) => tree(c, t[0] * T, t[1] * T + 8, 0.95, t[2], P_, 300 + i));
    // hay bales + water well near house
    c.save(); [[22.2, 7.6], [22.9, 7.5]].forEach(p => { c.fillStyle = '#d9b650'; c.fillRect(p[0] * T - 10, p[1] * T - 8, 20, 14); c.strokeStyle = '#a8872e'; c.lineWidth = 1.2; c.strokeRect(p[0] * T - 10, p[1] * T - 8, 20, 14); c.beginPath(); c.moveTo(p[0] * T - 3, p[1] * T - 8); c.lineTo(p[0] * T - 3, p[1] * T + 6); c.moveTo(p[0] * T + 4, p[1] * T - 8); c.lineTo(p[0] * T + 4, p[1] * T + 6); c.stroke(); }); c.restore();
    // lamp posts
    [[14.2, 7.2], [28.2, 7.2], [14.2, 21.3], [28.2, 24.2], [10.2, 24.4]].forEach(p => {
      c.fillStyle = 'rgba(0,0,0,.16)'; c.beginPath(); c.ellipse(p[0] * T + 2, p[1] * T + 3, 7, 3, 0, 0, TAU); c.fill();
      c.fillStyle = '#3b3b40'; c.fillRect(p[0] * T - 1.5, p[1] * T - 30, 3, 32); c.fillStyle = '#ffe9a8'; rr(c, p[0] * T - 5, p[1] * T - 38, 10, 10, 3); c.fill(); c.strokeStyle = '#3b3b40'; c.lineWidth = 1.6; c.stroke();
      L.lights.push({ x: p[0] * T, y: p[1] * T - 32, r: 62, c: 'rgba(255,215,130,.55)' });
    });
  }
  function paintPivotTrack(c, P_) {
    if (!(G.hasExpansion && G.hasExpansion('center_pivot'))) return;
    const cx = 8 * T, cy = 14.5 * T, R = 6.2 * T;
    c.save(); c.strokeStyle = P_.snow ? 'rgba(160,190,210,.4)' : 'rgba(190,230,255,.28)'; c.lineWidth = 7; c.setLineDash([2, 10]); c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke(); c.restore();
  }

  function paintStatic() {
    const cal = G.calendar(), P_ = PAL[cal.season] || PAL.spring, s = S();
    buildLayout(); L.lights = [];
    const cs = clamp(Math.max(1.4, V.dpr), 1.4, 1.8);
    if (!cache) cache = document.createElement('canvas');
    cacheScale = cs; cache.width = Math.round(W * T * cs); cache.height = Math.round(H * T * cs);
    const c = cache.getContext('2d'); c.setTransform(cs, 0, 0, cs, 0, 0);
    paintGround(c, P_); paintHills(c, P_); paintPaths(c, P_); paintRoad(c, P_);
    paintPlots(c, P_);
    paintPivotTrack(c, P_);
    paintPond(c, P_);
    paintPasture(c, P_);
    // depth-sorted structures (by bottom edge)
    const st = [];
    const R = z => ({ x: z.x * T, y: z.y * T, w: z.w * T, h: z.h * T });
    st.push([Z.barn.y + Z.barn.h, () => paintBarn(c, R(Z.barn))]);
    st.push([Z.house.y + Z.house.h, () => paintHouse(c, R(Z.house))]);
    st.push([Z.shed.y + Z.shed.h, () => paintShed(c, R(Z.shed), hasTractor())]);
    st.push([Z.restaurant.y + Z.restaurant.h, () => paintRestaurant(c, P_, L.stage)]);
    st.push([Z.stand.y + Z.stand.h, () => paintStall(c, R(Z.stand), standBuilt())]);
    st.push([Z.shop.y + Z.shop.h, () => paintCoop(c, R(Z.shop))]);
    st.push([Z.orders.y + 1, () => paintOrders(c, R(Z.orders))]);
    L.pens.forEach(p => st.push([p.rect.y + 4, () => paintPen(c, p, P_)]));
    s.buildings.forEach((b, i) => { const q = buildingSlot(i); st.push([q.y + 2, () => paintBuilding(c, R(q), b.type)]); });
    L.lots.forEach(lot => st.push([lot.rect.y + 2, () => paintLot(c, R(lot.rect), lot.type)]));
    st.sort((a, b) => a[0] - b[0]).forEach(q => q[1]());
    paintTreeLine(c, P_);
    paintDecor(c, P_);
    cacheSig = layoutSig();
  }
  function layoutSig() {
    const s = S(), cal = G.calendar();
    return [cal.season, s.plots.length, s.maxPlots > s.plots.length ? G.plotCost() : 0, s.buildings.map(b => b.type).join(','), penTypes().map(t => s.animals.some(a => a.type === t) ? 1 : 0).join(''),
      (s.ownedExpansions || []).filter(k => k === 'center_pivot' || k === 'windbreak_trees').join(','), standBuilt() ? 1 : 0, restStage(), restStage() === 'open' ? tableCount() : 0, hasTractor() ? 1 : 0, Math.round(V.dpr * 10)].join('|');
  }
  function checkLayout() {
    if (!S()) return;
    const sg = layoutSig();
    if (sg !== cacheSig) { try { paintStatic(); } catch (e) { console.error('[world paint]', e); cacheSig = sg; } }
  }

  // ---------------------------------------------------------------- dynamic drawing
  const vis = (x, y, pad) => x > V.camX - pad && x < V.camX + V.cssW / V.zoom + pad && y > V.camY - pad && y < V.camY + V.cssH / V.zoom + pad;
  function shadow(c, x, y, rx, a) { c.fillStyle = `rgba(20,10,0,${a || .25})`; c.beginPath(); c.ellipse(x, y, rx, rx * 0.36, 0, 0, TAU); c.fill(); }
  function drawPlots(c, t, now, P_) {
    const s = S();
    for (let i = 0; i < s.plots.length; i++) {
      const p = s.plots[i], q = plotRect(i), x = q.x * T, y = q.y * T;
      if (!vis(x + T, y + T, 90)) continue;
      const cx = x + T, cy = y + T;
      if (p.status === 'empty') {
        c.strokeStyle = 'rgba(255,240,200,.38)'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - 7, cy); c.lineTo(cx + 7, cy); c.moveTo(cx, cy - 7); c.lineTo(cx, cy + 7); c.stroke();
        continue;
      }
      const crop = G.DATA.crops[p.crop] || {}, span = Math.max(1, p.readyAt - p.plantedAt);
      let prog = p.status === 'ready' ? 1 : clamp((now - p.plantedAt) / span, 0, 1);
      if (p.status === 'withered') {
        c.fillStyle = 'rgba(70,50,30,.55)'; rr(c, x + 5, y + 5, 2 * T - 10, 2 * T - 12, 9); c.fill();
        c.strokeStyle = '#6b5a3a'; c.lineWidth = 2; c.beginPath(); for (let k = 0; k < 5; k++) { const tx = x + 14 + k * 13, ty = y + 40 + (k % 2) * 14; c.moveTo(tx, ty); c.lineTo(tx - 4, ty - 9); c.moveTo(tx, ty); c.lineTo(tx + 5, ty - 7); } c.stroke();
        em(c, '🥀', cx, cy - 2, 30, {}); continue;
      }
      // seedling tufts along the furrows
      const g = 0.25 + prog * 0.75;
      c.strokeStyle = p.status === 'ready' ? '#d8c24a' : (P_.snow ? '#7fa07a' : '#4fb03e'); c.lineWidth = 2.2; c.lineCap = 'round'; c.beginPath();
      for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
        const tx = x + 14 + k * 17 + (r % 2) * 6, ty = y + 22 + r * 14, hgt = 3 + 8 * g, sw = Math.sin(t * 2 + i + k + r) * 1.2;
        c.moveTo(tx, ty); c.lineTo(tx - 2.5 + sw, ty - hgt); c.moveTo(tx, ty); c.lineTo(tx + 3 + sw, ty - hgt * .85); c.moveTo(tx, ty); c.lineTo(tx + sw * .5, ty - hgt * 1.1);
      }
      c.stroke();
      // crop emoji, growth-scaled
      const stage = prog < 0.28 ? 0 : 1, em_ = stage ? (crop.emoji || '🌾') : '🌱';
      const sz = stage ? 22 + 24 * clamp((prog - 0.28) / 0.72, 0, 1) : 16 + prog * 30;
      const bob = p.status === 'ready' ? -Math.abs(Math.sin(t * 3 + i)) * 4 : 0;
      em(c, em_, cx, cy + 6 + bob - sz * .12, sz, { rot: Math.sin(t * 1.6 + i * 1.3) * 0.05 });
      // progress ring
      const rx = x + 2 * T - 15, ry = y + 15;
      c.lineWidth = 4; c.strokeStyle = 'rgba(30,15,0,.5)'; c.beginPath(); c.arc(rx, ry, 8, 0, TAU); c.stroke();
      c.strokeStyle = p.status === 'ready' ? '#8be05a' : '#ffe27a'; c.beginPath(); c.arc(rx, ry, 8, -Math.PI / 2, -Math.PI / 2 + TAU * prog); c.stroke();
      if (p.status === 'ready') {
        c.fillStyle = 'rgba(255,230,120,' + (0.14 + 0.1 * Math.sin(t * 4 + i)) + ')'; rr(c, x + 4, y + 4, 2 * T - 8, 2 * T - 10, 9); c.fill();
        for (let k = 0; k < 3; k++) { const ph = (t * 1.4 + k * .37 + i * .13) % 1, sx = x + 14 + hash(i + 'sx' + k) * 52, sy = y + 12 + hash(i + 'sy' + k) * 50; star(c, sx, sy - ph * 8, 2.5 + 3.5 * Math.sin(ph * Math.PI), 1 - ph * .3); }
        c.fillStyle = '#8be05a'; c.beginPath(); c.arc(rx, ry, 5.5, 0, TAU); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(rx - 2.6, ry); c.lineTo(rx - .6, ry + 2.4); c.lineTo(rx + 3, ry - 2.4); c.stroke();
      }
    }
  }
  function star(c, x, y, r, a) { c.save(); c.globalAlpha = a; c.fillStyle = '#fff8c8'; c.beginPath(); for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2; c.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); c.lineTo(x + Math.cos(an + Math.PI / 4) * r * .35, y + Math.sin(an + Math.PI / 4) * r * .35); } c.closePath(); c.fill(); c.restore(); }
  function bubble(c, x, y, ch, t, size) {
    const b = Math.sin(t * 4) * 2; c.save(); c.translate(x, y + b);
    c.fillStyle = '#fff'; c.strokeStyle = 'rgba(80,50,20,.5)'; c.lineWidth = 1.5; rr(c, -11, -12, 22, 20, 9); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-3, 8); c.lineTo(0, 13); c.lineTo(3, 8); c.fillStyle = '#fff'; c.fill(); c.restore();
    em(c, ch, x, y + b - 2, size || 15, {});
  }
  function collectSprites(t, now) {
    const s = S(), out = [];
    const push = (y, fn) => out.push([y, fn]);
    // ---- animals in pens
    L.pens.forEach(pen => {
      if (!pen.owned) return;
      const d = G.DATA.animals[pen.type] || {}, box = { x: pen.rect.x + 1.1, y: pen.rect.y + 1.0, w: 3.8, h: 1.6 };
      s.animals.forEach((a, i) => {
        if (a.type !== pen.type) return;
        const id = a.id || (pen.type + i);
        const bees = pen.type === 'bees';
        const w = bees ? null : updateWander(V.dt, id, d, box, pen.type === 'cows' ? 0.45 : 0.7);
        let x, y;
        if (bees) { const ph = hash(id) * TAU; x = pen.rect.x + 3 + Math.cos(t * 1.3 + ph) * 1.5 + Math.sin(t * 3.1 + ph) * .2; y = pen.rect.y + 1.5 + Math.sin(t * 1.7 + ph * 2) * .7 + Math.sin(t * 5 + ph) * .1; }
        else { x = w.x; y = w.y; }
        const px = x * T, py = y * T; if (!vis(px, py, 60)) return;
        const size = pen.type === 'cows' ? 26 : pen.type === 'sheep' ? 24 : bees ? 14 : 20;
        push(y + 0.25, c => {
          if (!bees) shadow(c, px, py + size * .4, size * .42, .22);
          const hop = !bees && w.wait <= 0 ? Math.abs(Math.sin(t * 9 + i)) * 2 : 0;
          em(c, d.emoji || '🐾', px, py - hop - (bees ? 0 : size * .1), size, { flip: bees ? (Math.cos(t * 1.3 + hash(id) * TAU) > 0) : (w.dir > 0) });
          if (a.status === 'ready') bubble(c, px, py - size * .85, iEmoji(d.product), t + i, 14);
          else if (a.status === 'hungry') bubble(c, px, py - size * .85, '🍽️', t + i, 13);
        });
      });
    });
    // ---- cattle
    const herd = safe(() => (G.Ranch && G.Ranch.herd) ? G.Ranch.herd() : [], []) || [];
    const z = Z.pasture, pbox = { x: z.x + 1.3, y: z.y + 1.4, w: z.w - 2.6, h: z.h - 2.8 };
    const night = (() => { const p = G.calendar().dayProgress; return p < 0.05 || p > 0.8; })();
    herd.slice(0, 18).forEach((h, i) => {
      const id = 'c' + (h.id != null ? h.id : i), w = updateWander(V.dt, id, h, pbox, night ? 0 : 0.35 + hash(id) * .2), px = w.x * T, py = w.y * T;
      if (!vis(px, py, 60)) return;
      const sc = clamp(+h.scale || 1, 0.5, 1.5), size = 26 * sc;
      push(w.y + 0.3, c => {
        shadow(c, px, py + size * .38, size * .5, .22);
        const grazing = w.wait > 0 ? Math.sin(t * 2 + i) * 0.06 : 0;
        em(c, h.emoji || '🐄', px, py - size * .1, size, { flip: w.dir > 0, rot: grazing });
        if (h.hungry) bubble(c, px, py - size * .9, night ? '💤' : '🍽️', t + i, 13);
        else if (night) { c.save(); c.font = '800 11px system-ui'; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 2; const zy = py - size * .8 - ((t * 8 + i * 5) % 14); c.strokeText('z', px + 8, zy); c.fillText('z', px + 8, zy); c.restore(); }
      });
    });
    for (const [id, w] of wander) if (V.t - w.seen > 5) wander.delete(id);
    // ---- ducks
    ducks.forEach((d, i) => {
      const x = POND.cx + Math.cos(d.a + i * 2) * 1.7, y = POND.cy + Math.sin(d.a + i * 2) * 0.8, px = x * T, py = y * T; if (!vis(px, py, 40)) return;
      push(y, c => { c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1.4; c.beginPath(); c.ellipse(px, py + 6, 12, 4, 0, 0, TAU); c.stroke(); em(c, '🦆', px, py, 18, { flip: Math.sin(d.a + i * 2) < 0 }); });
    });
    // ---- road traffic
    trucks.forEach(tr => { const px = tr.x * T, py = tr.y * T; if (!vis(px, py, 80)) return; push(tr.y + 0.4, c => { shadow(c, px, py + 14, 24, .22); em(c, tr.e, px, py, 40, { flip: tr.dir > 0 }); }); });
    // ---- stand customers
    if (standBuilt()) {
      const cs = safe(() => G.Stand.customers(), []) || [];
      cs.slice(0, 10).forEach((cu, i) => {
        const h = hash(cu.id), h2 = hash('b' + cu.id), fx = 4.9 + h * 3.2, fy = 25.6 + (h2 * .4), sx = fx + (h2 - .5) * 6, sy = 27.4 + h2 * .5, tt = clamp(+cu.t || 0, 0, 1);
        let x, y, walk = false;
        if (cu.phase === 'arriving') { const e = ease(tt); x = lerp(sx, fx, e); y = lerp(sy, fy, e); walk = true; }
        else if (cu.phase === 'leaving') { const e = ease(tt), ex = fx + (h < .5 ? -5 : 5); x = lerp(fx, ex, e); y = lerp(fy, 27.5, e); walk = true; }
        else if (cu.phase === 'paying') { x = fx; y = 25.35; }
        else { x = fx + Math.sin(t * .8 + h * 6) * .3; y = fy; }
        npcSprite(push, cu, x, y, walk, t, i);
      });
    }
    // ---- restaurant customers
    if (L.stage === 'open' || L.stage === 'building') {
      const cs = safe(() => G.Restaurant.customers(), []) || [];
      cs.slice(0, 14).forEach((cu, i) => {
        const pth = npcPath(cu); if (!pth) return;
        const tt = clamp(+cu.t || 0, 0, 1); let f, walk = false, sit = false;
        if (cu.phase === 'arriving') { f = tt; walk = tt < 1; }
        else if (cu.phase === 'leaving') { f = 1 - tt; walk = true; }
        else { f = 1; sit = true; }
        const pos = along(pth, ease(f));
        npcSprite(push, cu, pos[0], pos[1] + (sit ? 0.1 : 0), walk, t, i, sit);
      });
    }
    // ---- parked tractor
    if (hasTractor() && !driving()) {
      const px = 11.5 * T, py = 5.9 * T;
      if (vis(px, py, 60)) push(5.9, c => drawTractor(c, px, py, 1, equipped(), t, false, false));
    }
    // ---- player (or tractor)
    push(P.y + 0.05, c => drawPlayer(c, t));
    return out;
  }
  function npcSprite(push, cu, x, y, walk, t, i, sit) {
    const px = x * T, py = y * T; if (!vis(px, py, 50)) return;
    push(y + 0.1, c => {
      shadow(c, px, py + 10, 11, .26);
      const bob = walk ? Math.abs(Math.sin(t * 9 + i * 2)) * 3 : 0;
      em(c, cu.emoji || '🧑', px, py - 5 - bob + (sit ? 5 : 0), 27, { flip: false });
      if (cu.phase === 'paying' || (cu.phase === 'leaving' && cu.mood === 'happy' && cu.t < .3)) bubble(c, px, py - 28, cu.mood === 'sad' ? '💢' : cu.mood === 'meh' ? '💬' : '❤️', t + i, 12);
      else if (cu.phase === 'eating') em(c, '🍽️', px + (hash(cu.id) < .5 ? 14 : -14), py + 8, 12, {});
    });
  }
  function npcPath(cu) {
    const key = String(cu.id);
    let p = npcPaths.get(key);
    if (p) return p;
    const h = hash(cu.id), n = L.tables.length || 4, ti = cu.table != null ? (cu.table % n) : Math.floor(h * n);
    const tb = L.tables[ti] || { x: TABLE_XS[ti % 4], y: TABLE_YS[Math.floor(ti / 4) % 2] };
    const side = hash('s' + cu.id) < .5 ? -1 : 1, seat = [tb.x + side * 0.72, tb.y + 0.05];
    const start = [28.6 + h * 0.8, 27.4];
    let pts = findPath(start[0], start[1], tb.x, tb.y + 1.15, 0.25);
    pts = [start].concat(pts || [[28.7, 9.2], [tb.x, tb.y + 1.15]], [seat]);
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    p = { pts, cum, len: cum[cum.length - 1] || 1 };
    if (npcPaths.size > 80) npcPaths.clear();
    npcPaths.set(key, p); return p;
  }
  function along(p, f) {
    const d = clamp(f, 0, 1) * p.len; let i = 1; while (i < p.cum.length - 1 && p.cum[i] < d) i++;
    const a = p.pts[i - 1], b = p.pts[i], seg = (p.cum[i] - p.cum[i - 1]) || 1, u = clamp((d - p.cum[i - 1]) / seg, 0, 1);
    return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
  }
  function drawTractor(c, x, y, dir, def, t, moving, withDriver) {
    const col = (def && def.color) || '#2e8b3a';
    c.save(); c.translate(x, y); if (dir < 0) c.scale(-1, 1);
    shadow(c, 0, 14, 28, .28);
    const bounce = moving ? Math.sin(t * 28) * 0.8 : 0; c.translate(0, bounce);
    // exhaust
    c.fillStyle = '#444'; c.fillRect(14, -26, 3.5, 12);
    if (moving) { c.fillStyle = 'rgba(200,200,200,.55)'; for (let i = 0; i < 3; i++) { const ph = (t * 1.6 + i / 3) % 1; c.beginPath(); c.arc(16 - ph * 10, -28 - ph * 16, 2.5 + ph * 4, 0, TAU); c.fill(); } }
    // hood + body
    c.fillStyle = col; rr(c, 2, -18, 28, 17, 4); c.fill(); rr(c, -22, -12, 28, 12, 3); c.fill();
    c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(-22, -4, 52, 3); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(4, -17, 24, 3);
    // cab
    c.fillStyle = col; rr(c, -20, -34, 22, 26, 3); c.fill(); c.fillStyle = '#bfe6f5'; rr(c, -17, -31, 16, 15, 2); c.fill(); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(-15, -29, 4, 11);
    c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(-22, -37, 26, 4);
    // wheels
    const wheel = (wx, wy, r) => { c.save(); c.translate(wx, wy); c.fillStyle = '#2a2a2e'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.fillStyle = '#e6c04a'; c.beginPath(); c.arc(0, 0, r * .5, 0, TAU); c.fill(); c.strokeStyle = '#2a2a2e'; c.lineWidth = 2; c.rotate(moving ? t * 12 : 0); c.beginPath(); c.moveTo(-r * .5, 0); c.lineTo(r * .5, 0); c.moveTo(0, -r * .5); c.lineTo(0, r * .5); c.stroke(); c.restore(); };
    wheel(-12, 2, 13); wheel(22, 7, 8);
    c.restore();
    if (withDriver) em(c, avatarEm(), x - dir * 7, y - 28, 15, { force: true });
  }
  const avatarEm = () => (S().flags && S().flags['ui.avatar']) || '🧑‍🌾';
  function drawPlayer(c, t) {
    const x = P.x * T, y = P.y * T, drv = driving(), def = equipped();
    if (drv && def) {
      if (def.radius > 0) { c.save(); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.setLineDash([6, 6]); c.beginPath(); c.arc(x, y, def.radius * T + T / 2, 0, TAU); c.stroke(); c.restore(); }
      if (def.color || !def.emoji) drawTractor(c, x, y, P.dir, def, t, P.moving, true);
      else { shadow(c, x, y + 12, 22, .28); em(c, def.emoji, x, y - 4, 44, { flip: P.dir > 0, force: true }); }
    } else {
      shadow(c, x, y + 11, 12, .3);
      const bob = P.moving ? Math.abs(Math.sin(P.walk)) * 4 : Math.sin(t * 2) * 0.6, tilt = P.moving ? Math.sin(P.walk) * 0.1 : 0;
      em(c, avatarEm(), x, y - 7 - bob, 32, { rot: tilt, force: true });
    }
    // name tag
    c.save(); c.font = '800 10px system-ui,-apple-system,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const nm = G.playerName ? G.playerName() : 'Farmer', ty = y - (drv ? 50 : 34), w = c.measureText(nm).width + 12;
    rr(c, x - w / 2, ty - 8, w, 16, 8); c.fillStyle = 'rgba(40,24,8,.72)'; c.fill(); c.fillStyle = '#fff6dc'; c.fillText(nm, x, ty + .5); c.restore();
  }

  function drawOverlays(c, t, now) {
    const s = S(), ord = ordersReady();
    // buildings: progress / ready markers + smoke
    s.buildings.forEach((b, i) => {
      const q = buildingSlot(i), x = q.x * T, y = q.y * T; if (!vis(x + T, y + T, 60)) return;
      const ready = b.queue.filter(j => j.readyAt <= now).length, cur = b.queue.find(j => j.readyAt > now);
      if (cur) {
        const prog = clamp((now - cur.startAt) / Math.max(1, cur.readyAt - cur.startAt), 0, 1);
        c.fillStyle = 'rgba(30,15,0,.6)'; rr(c, x + 14, y + 2, 52, 8, 4); c.fill(); c.fillStyle = '#8be05a'; rr(c, x + 15, y + 3, Math.max(5, 50 * prog), 6, 3); c.fill();
        c.fillStyle = 'rgba(240,240,240,.5)'; for (let k = 0; k < 3; k++) { const ph = (t * .7 + k / 3) % 1; c.beginPath(); c.arc(x + 58 - ph * 4, y + 6 - ph * 22, 3 + ph * 5, 0, TAU); c.fill(); }
      }
      if (ready) { const bb = Math.sin(t * 4 + i) * 2; c.save(); c.translate(x + T, y - 8 + bb); c.fillStyle = '#5fb53c'; c.strokeStyle = '#fff'; c.lineWidth = 2.5; rr(c, -17, -12, 34, 22, 11); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.font = '900 13px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('✓ ' + ready, 0, 0.5); c.restore(); }
    });
    // orders badge
    if (ord) { const q = Z.orders, x = (q.x + 0.5) * T, y = q.y * T - 36 + Math.sin(t * 4) * 2; c.save(); c.translate(x, y); c.fillStyle = '#d9483b'; c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 0, 11, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.font = '900 13px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(ord), 0, 1); c.restore(); }
    // tap marks
    marks.forEach(m => { const a = 1 - m.t / 0.7; c.strokeStyle = `rgba(255,255,255,${a * .9})`; c.lineWidth = 3; c.beginPath(); c.arc(m.x * T, m.y * T, 6 + m.t * 34, 0, TAU); c.stroke(); });
    // hint ring on the target
    if (hint && hint.a) { const r = hint.r, a = .55 + .3 * Math.sin(t * 6); c.save(); c.strokeStyle = `rgba(255,244,160,${a})`; c.lineWidth = 3; c.setLineDash([8, 6]); c.lineDashOffset = -t * 16; rr(c, r.x * T + 3, r.y * T + 3, r.w * T - 6, Math.min(r.h * T - 6, 2.2 * T), 12); if (hint.zone || hint.pen || hint.bld != null) { /* drawn below instead */ } if (hint.plot != null || hint.id === 'buyland') c.stroke(); c.restore(); }
    // particles
    parts.forEach(q => { c.globalAlpha = clamp(1 - q.t / q.life, 0, 1); c.fillStyle = q.c; c.beginPath(); c.arc(q.x, q.y, q.s, 0, TAU); c.fill(); }); c.globalAlpha = 1;
    // floating texts
    floats.forEach(f => {
      const u = f.t / 1.4, y = f.y * T - 20 - u * 46; c.save(); c.globalAlpha = clamp(1.6 - u * 1.6, 0, 1); c.font = '900 17px system-ui,-apple-system,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 4; c.strokeStyle = 'rgba(60,30,0,.85)'; c.lineJoin = 'round'; c.strokeText(f.text, f.x * T, y); c.fillStyle = f.color; c.fillText(f.text, f.x * T, y); c.restore();
    });
  }
  function drawPivot(c, t) {
    if (!(G.hasExpansion && G.hasExpansion('center_pivot'))) return;
    const cx = 8 * T, cy = 14.5 * T, R = 6.2 * T, a = t * 0.12; if (!vis(cx, cy, R + 40)) return;
    c.save(); c.translate(cx, cy);
    c.fillStyle = '#9aa3a8'; c.beginPath(); c.arc(0, 0, 8, 0, TAU); c.fill(); c.fillStyle = '#5c666c'; c.beginPath(); c.arc(0, 0, 4, 0, TAU); c.fill();
    c.rotate(a);
    c.strokeStyle = 'rgba(210,225,235,.9)'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(R, 0); c.stroke();
    c.strokeStyle = 'rgba(120,135,145,.9)'; c.lineWidth = 1.2; c.beginPath(); for (let x = 12; x < R; x += 14) { c.moveTo(x, -4); c.lineTo(x + 7, 0); c.moveTo(x, 4); c.lineTo(x + 7, 0); } c.stroke();
    [R * .33, R * .66, R].forEach(x => { c.fillStyle = '#7d878d'; c.fillRect(x - 2, -9, 4, 18); c.fillStyle = '#333'; c.fillRect(x - 4, 9, 8, 4); c.fillRect(x - 4, -13, 8, 4); });
    // spray
    c.fillStyle = 'rgba(190,230,255,.55)'; for (let x = 20; x < R; x += 22) { for (let k = 0; k < 3; k++) { const ph = (t * 2 + x * .1 + k * .3) % 1; c.beginPath(); c.arc(x + 2, 4 + ph * 14, 1.6, 0, TAU); c.fill(); } }
    c.restore();
  }
  function tintAt(p) {
    const q = (p + .22) % 1;
    const K = [[0, [92, 104, 178]], [.08, [92, 104, 178]], [.18, [255, 208, 176]], [.3, [255, 255, 255]], [.62, [255, 255, 255]], [.74, [255, 180, 134]], [.86, [92, 104, 178]], [1, [92, 104, 178]]];
    let i = 0; while (i < K.length - 2 && q > K[i + 1][0]) i++;
    const a = K[i], b = K[i + 1], u = clamp((q - a[0]) / (b[0] - a[0]), 0, 1);
    return a[1].map((v, k) => v + (b[1][k] - v) * u);
  }

  function render() {
    const c = V.ctx, k = V.zoom * V.dpr, cal = G.calendar(), P_ = PAL[cal.season] || PAL.spring, t = V.t, now = Date.now();
    emCount = 0;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#2f3d20'; c.fillRect(0, 0, V.cv.width, V.cv.height);
    c.setTransform(k, 0, 0, k, -V.camX * k, -V.camY * k);
    const vw = V.cssW / V.zoom, vh = V.cssH / V.zoom;
    if (cache) {
      const x0 = Math.max(V.camX, 0), y0 = Math.max(V.camY, 0), x1 = Math.min(V.camX + vw, W * T), y1 = Math.min(V.camY + vh, H * T);
      if (x1 > x0 && y1 > y0) c.drawImage(cache, x0 * cacheScale, y0 * cacheScale, (x1 - x0) * cacheScale, (y1 - y0) * cacheScale, x0, y0, x1 - x0, y1 - y0);
    }
    // cloud shadows
    c.fillStyle = 'rgba(20,30,40,.07)';
    for (let i = 0; i < 3; i++) { const cx = ((t * 14 + i * 520) % (W * T + 400)) - 200, cy = 220 + i * 330 + Math.sin(i * 3) * 60; c.beginPath(); c.ellipse(cx, cy, 160, 70, .3, 0, TAU); c.fill(); }
    drawPlots(c, t, now, P_);
    const items = collectSprites(t, now); items.sort((a, b) => a[0] - b[0]);
    for (const it of items) it[1](c);
    drawPivot(c, t);
    drawOverlays(c, t, now);
    if (P_.snow) drawSnow(c, t, vw, vh);
    // day / night tint
    const tn = tintAt(cal.dayProgress);
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (tn[0] + tn[1] + tn[2] < 760) { c.globalCompositeOperation = 'multiply'; c.fillStyle = `rgb(${tn.map(Math.round).join(',')})`; c.fillRect(0, 0, V.cv.width, V.cv.height); c.globalCompositeOperation = 'source-over'; }
    const lum = (tn[0] + tn[1] + tn[2]) / 765, la = clamp((0.92 - lum) / 0.4, 0, 1);
    if (la > 0.02 && L) {
      c.setTransform(k, 0, 0, k, -V.camX * k, -V.camY * k); c.globalCompositeOperation = 'lighter';
      const glow = (x, y, r, col) => { if (!vis(x, y, r)) return; const g = c.createRadialGradient(x, y, 1, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,200,100,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
      c.globalAlpha = la;
      L.lights.forEach(l => glow(l.x, l.y, l.r, l.c));
      // house windows + barn lantern
      const hz = Z.house; [[hz.x * T + 46, hz.y * T + 70], [(hz.x + hz.w) * T - 46, hz.y * T + 70]].forEach(p => glow(p[0], p[1], 38, 'rgba(255,214,120,.7)'));
      glow(Z.barn.x * T + 3 * T - 6, (Z.barn.y + 5) * T - 20, 50, 'rgba(255,200,100,.35)');
      if (standBuilt()) glow((Z.stand.x + 2.5) * T, (Z.stand.y + 1) * T, 70, 'rgba(255,200,110,.5)');
      glow(P.x * T, P.y * T - 6, 46, 'rgba(255,230,160,.28)');
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
  }
  function drawSnow(c, t, vw, vh) {
    c.fillStyle = 'rgba(255,255,255,.85)';
    snow.forEach(f => { const x = V.camX + ((f.x * vw + Math.sin(t * .8 + f.p) * 14 + t * 6 * f.s) % vw + vw) % vw, y = V.camY + ((f.y * vh + t * 24 * f.s) % vh); c.beginPath(); c.arc(x, y, 1.4 + f.s * 1.1, 0, TAU); c.fill(); });
  }

  // ---------------------------------------------------------------- sizing + loop
  function resize() {
    const app = el('app'), hud = el('hud'), tb = el('tabbar'); if (!app || !V.box) return;
    const ar = app.getBoundingClientRect(), top = hud ? Math.round(hud.getBoundingClientRect().bottom) - 14 : 100, bottom = tb ? tb.getBoundingClientRect().top + 6 : innerHeight - 70;
    const hudBottom = hud ? hud.getBoundingClientRect().bottom : 100;
    V.box.style.left = ar.left + 'px'; V.box.style.width = ar.width + 'px'; V.box.style.top = Math.round(hudBottom - 8) + 'px'; V.box.style.height = Math.max(120, Math.round(bottom - (hudBottom - 8))) + 'px';
    V.dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    V.cssW = V.box.clientWidth; V.cssH = V.box.clientHeight;
    const w = Math.round(V.cssW * V.dpr), h = Math.round(V.cssH * V.dpr);
    if (V.cv.width !== w || V.cv.height !== h) { V.cv.width = w; V.cv.height = h; }
    V.ctx.imageSmoothingEnabled = true; V.ctx.imageSmoothingQuality = 'high';
    clampCam(true);
  }
  function frame(ts) {
    V.raf = 0; if (!V.run) return;
    const dt = Math.min(0.05, Math.max(0.001, (ts - V.last) / 1000 || 0.016)); V.last = ts; V.t += dt; V.dt = dt;
    try { update(dt); render(); } catch (e) { console.error('[world frame]', e); }
    V.raf = requestAnimationFrame(frame);
  }
  function setRunning(on) {
    if (on && !V.run) { V.run = true; V.last = performance.now(); resize(); checkLayout(); clampCam(true); V.raf = requestAnimationFrame(frame); }
    else if (!on && V.run) { V.run = false; if (V.raf) cancelAnimationFrame(V.raf); V.raf = 0; IN.jx = IN.jy = 0; IN.keys = {}; IN.joy = null; ptrs.clear(); pinch = null; showJoy(false); }
  }
  function syncVisible() {
    if (!V.ready) return;
    const on = safe(() => G.uikit.tab(), 'farm') === 'farm' && !S().flags['world.list'];
    V.box.hidden = !on;
    setRunning(on && !document.hidden);
  }

  // ---------------------------------------------------------------- public API
  G.World = {
    goTo: id => goToZone(id),
    zones: () => ZONE_ORDER.map(id => ({ id, label: Z[id].label, emoji: Z[id].emoji, x: Z[id].pt[0], y: Z[id].pt[1] })),
    player: () => ({ x: P.x, y: P.y, dir: P.dir, moving: P.moving, driving: driving(), walking: !!P.path }),
    enabled: () => V.ready,
    playerRect: () => { if (!V.ready || V.box.hidden) return null; const r = V.box.getBoundingClientRect(); return { left: r.left + (P.x * T - V.camX) * V.zoom - 10, top: r.top + (P.y * T - V.camY) * V.zoom - 30, width: 20, height: 20 }; },
    plotRect: i => { if (!V.ready || V.box.hidden) return null; const q = plotRect(i), r = V.box.getBoundingClientRect(); return { left: r.left + (q.x * T - V.camX) * V.zoom, top: r.top + (q.y * T - V.camY) * V.zoom, width: q.w * T * V.zoom, height: q.h * T * V.zoom }; },
    teleport: (x, y) => { P.x = x; P.y = y; P.path = null; clampCam(true); },   // test/debug helper
    setZoom,
    _v: V
  };

  // ---------------------------------------------------------------- init
  function init() {
    V.box = el('world'); V.cv = el('w-cv');
    if (!V.box || !V.cv || !V.cv.getContext) return;
    V.ctx = V.cv.getContext('2d', { alpha: false });
    if (!V.ctx) return;
    const z = S().flags['world.zoom']; V.zoom = clamp(+z || 0.9, 0.7, 1.5);
    bindInput();
    V.ready = true;
    const bus = (n, f) => G.bus.on(n, p => { try { f(p); } catch (e) { console.error('[world]', n, e); } });
    bus('tab', syncVisible);
    bus('harvested', p => {
      const q = plotRect(p.plotIdx), x = q.x + 1, y = q.y + 1;
      floatText(x, y - 0.4, `+${p.n} ${iEmoji(p.cropKey)}`, '#fff3b0');
      burst(x * T, y * T, ['#ffe27a', '#8be05a', '#fff'], 14);
    });
    bus('collected', p => {
      const o = lastAct || { x: P.x, y: P.y - 0.6 };
      floatText(o.x, o.y - 0.3, `+${p.n} ${iEmoji(p.key)}`, '#fff3b0'); burst(o.x * T, (o.y + 0.5) * T, ['#ffe27a', '#fff'], 8);
    });
    bus('planted', p => { const q = plotRect(p.plotIdx); burst((q.x + 1) * T, (q.y + 1) * T, ['#a9743a', '#7b4d26', '#8be05a'], 10); });
    bus('state:reset', () => { P.x = SPAWN[0]; P.y = SPAWN[1]; P.path = null; floats.length = 0; wander.clear(); npcPaths.clear(); cacheSig = ''; clampCam(true); });
    bus('drive:stop', () => { P.path = null; });
    bus('expansion', () => { cacheSig = ''; });
    bus('change', () => { hintT = 0; });
    document.addEventListener('visibilitychange', syncVisible);
    addEventListener('resize', () => { resize(); });
    if (window.ResizeObserver) { try { new ResizeObserver(() => { if (V.run) resize(); }).observe(el('hud')); } catch (e) { } }
    // re-run the tab logic so the Farm tab switches from the list grid to the world
    G.uikit.showTab(G.uikit.tab());
    resize(); clampCam(true);
    syncVisible();
  }
  G.bus.on('init', function () { try { init(); } catch (e) { console.error('[world init]', e); V.ready = false; } });
})();
