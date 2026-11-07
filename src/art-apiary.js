/* Kellyville 3D art: the apiary beside the pond (clover yard, Langstroth hives, honey house, bear fence, gate arch, bee actor). See docs/APIARY.md */
(function () {
  'use strict';
  const G = window.G; const A = G.WorldArt = G.WorldArt || {};
  A.structures = A.structures || {}; A.terrain = A.terrain || {}; A.actors = A.actors || {};
  const TAU = Math.PI * 2;
  let K = null;                                    // helper kit, captured from whichever hook ran last
  const use = H => { K = H; return H; };
  const lift = z => K.lift(z);
  const OUT = 'rgba(62,38,18,.82)', OUTS = 'rgba(70,50,30,.7)';

  // ------------------------------------------------------------------ colour helpers
  const hx = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
  const mix = (a, b, t) => { const x = hx(a), y = hx(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const PASTELS = ['#8fd3f0', '#f6a5bf', '#b5e07c', '#ffd75e', '#c3aef2', '#ffb27c', '#7fe0c6', '#f4efe0'];
  const seasonOf = P_ => P_.snow ? 'winter' : (P_.g1 === '#c2c15a' ? 'summer' : (P_.g1 === '#c99a48' ? 'fall' : 'spring'));
  const GREEN = { spring: ['#86d05c', '#76c350'], summer: ['#93c655', '#82b94a'], fall: ['#b6b152', '#a3a046'], winter: ['#f3f8fb', '#e4edf4'] };

  // wall-plane / 3D line helpers
  function ln(c, a, b, col, lw) { const p = K.P3(a[0], a[1], a[2]), q = K.P3(b[0], b[1], b[2]); c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.strokeStyle = col; c.lineWidth = lw || 1; c.lineCap = 'round'; c.stroke(); }
  function gradFace(c, y, z0, z1, stops) { const a = K.P3(0, y, z1)[1], b = K.P3(0, y, z0)[1], g = c.createLinearGradient(0, a, 0, b); stops.forEach(s => g.addColorStop(s[0], s[1])); return g; }
  function wallRect(c, x0, x1, y, z0, z1, fill, stroke, lw) { K.poly(c, [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], fill, stroke, lw); }

  // ================================================================== HIVE
  const HW = 20, HD = 14;
  const hiveH = hv => hv.status === 'away' ? 5 : 4 + 7 + 4.6 * Math.max(0, Math.min(3, hv.supers | 0)) + 3.6;
  const isDorm = (hv, P_) => hv.status === 'dormant' || !!P_.snow;
  function boxLayer(c, x0, y0, z0, h, col, topCol, joints) {
    const yf = y0 + HD;
    K.box(c, x0, y0, HW, HD, h, { z0, top: topCol, front: col, stroke: OUT, lw: .8 });
    K.poly(c, [[x0, yf, z0], [x0 + HW, yf, z0], [x0 + HW, yf, z0 + h], [x0, yf, z0 + h]], gradFace(c, yf, z0, z0 + h, [[0, 'rgba(255,255,255,.28)'], [.55, 'rgba(255,255,255,0)'], [1, 'rgba(60,40,10,.2)']]));
    wallRect(c, x0 + .6, x0 + 2, yf, z0 + .6, z0 + h - .6, 'rgba(255,255,255,.55)');           // sunlit west edge
    wallRect(c, x0 + HW - 2, x0 + HW - .6, yf, z0 + .6, z0 + h - .6, 'rgba(60,40,10,.14)');    // shaded east edge
    wallRect(c, x0, x0 + HW, yf, z0, z0 + .9, 'rgba(70,50,25,.3)');                            // seam
    if (joints) for (let k = 0; k < 3; k++) { const zz = z0 + 1.4 + k * (h - 2) / 3; wallRect(c, x0 + .2, x0 + 1.9, yf, zz, zz + h / 7, 'rgba(70,50,25,.22)'); wallRect(c, x0 + HW - 1.9, x0 + HW - .2, yf, zz, zz + h / 7, 'rgba(70,50,25,.22)'); }
  }
  function standParts(c, x0, y0, cx) {
    const yf = y0 + HD;
    wallRect(c, x0 + 1, x0 + HW - 1, yf - 2, 0, 3.6, 'rgba(30,18,5,.6)');
    [x0 + 1.5, x0 + HW - 4.5].forEach(lx => K.box(c, lx, yf - 5, 3, 3, 3.6, { top: '#c9a36b', front: '#7b5530', stroke: OUT, lw: .7 }));
    K.box(c, x0 - 1, y0 + 1, HW + 2, HD + 1, 1.3, { z0: 3.5, top: '#d4b27c', front: '#8b6434', stroke: OUT, lw: .8 });
    K.box(c, cx - 8.5, yf + 1, 17, 5, .9, { z0: 3.6, top: '#e0c18c', front: '#9b7342', stroke: OUT, lw: .7 });   // landing board
    ln(c, [cx - 7, yf + 3.4, 4.5], [cx + 7, yf + 3.4, 4.5], 'rgba(110,80,40,.35)', .6);
  }
  function drawHive(c, cx, cy, hv, P_) {
    const x0 = cx - HW / 2, y0 = cy - HD / 2, yf = y0 + HD;
    const pastel = PASTELS[Math.floor(K.hash(String(hv.id)) * 1e9) % 8];
    const brood = mix(pastel, '#ffffff', .0), superC = mix(pastel, '#fff8e6', .28);
    const sup = Math.max(0, Math.min(3, hv.supers | 0)), dorm = isDorm(hv, P_);
    standParts(c, x0, y0, cx);
    if (hv.status === 'away') return;
    const zb = 4, zs = zb + 7, zt = zs + 4.6 * sup;
    if (dorm) {                                                            // tar-paper winter wrap
      K.box(c, x0 - .9, y0 - .9, HW + 1.8, HD + 1.8, zt - zb, { z0: zb, top: '#2a2a31', front: '#34343b', stroke: 'rgba(15,15,20,.9)', lw: .9 });
      const wf = [[x0 - .9, yf + .9, zb], [x0 + HW + .9, yf + .9, zb], [x0 + HW + .9, yf + .9, zt], [x0 - .9, yf + .9, zt]];
      K.poly(c, wf, gradFace(c, yf + .9, zb, zt, [[0, 'rgba(190,200,230,.26)'], [.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.25)']]));
      wallRect(c, x0 - .3, x0 + 1.4, yf + .9, zb + .6, zt - .6, 'rgba(210,220,245,.3)');
      for (let k = 0; k < 4; k++) { const xx = x0 + 3 + k * 5.2; ln(c, [xx, yf + .9, zb + 1.5 + (k % 2) * 2], [xx + 2.4, yf + .9, zt - 1 - (k % 2) * 2], 'rgba(0,0,0,.28)', .7); }
      [.3, .7].forEach(f => { const zz = zb + (zt - zb) * f; wallRect(c, x0 - .9, x0 + HW + .9, yf + .9, zz - .7, zz + .7, '#d9b848', 'rgba(90,60,0,.55)', .5); });
      wallRect(c, cx - 5.5, cx + 5.5, yf + .9, zb, zb + 1.6, '#24150a');   // open entrance
    } else {
      boxLayer(c, x0, y0, zb, 7, brood, mix(brood, '#ffffff', .35), true);
      wallRect(c, cx - 5.5, cx + 5.5, yf, zb, zb + 1.5, '#2a190c');            // entrance slot
      wallRect(c, cx - 7, cx - 5.5, yf, zb, zb + 2.6, '#a77c45');              // reducer cleat
      for (let k = 0; k < sup; k++) {
        const z0 = zs + 4.6 * k;
        boxLayer(c, x0, y0, z0, 4.6, superC, mix(superC, '#ffffff', .35), false);
        const r = K.rr; wallRect(c, cx - 4, cx + 4, yf, z0 + 1.4, z0 + 2.6, 'rgba(70,50,25,.5)');   // hand hold
      }
      if (hv.status === 'active' || hv.status === 'ready') [[cx - 3, 1.2], [cx + 2.5, 2.6]].forEach(b => { c.fillStyle = '#f2b31c'; c.beginPath(); c.ellipse(b[0], K.P3(0, yf + 3.5, 4.8)[1] + b[1] * 0, 1.7, .8, 0, 0, TAU); c.fill(); });
    }
    // lid
    const zl = zt + (dorm ? 0 : 0);
    K.box(c, x0 - 1.5, y0 - 1.5, HW + 3, HD + 3, 2.2, { z0: zl, top: '#e6dfcc', front: mix(pastel, '#8f7a52', .45), stroke: OUT, lw: .8 });
    K.poly(c, [[x0 - 1.5, yf + 1.5, zl], [x0 + HW + 1.5, yf + 1.5, zl], [x0 + HW + 1.5, yf + 1.5, zl + 2.2], [x0 - 1.5, yf + 1.5, zl + 2.2]], gradFace(c, yf + 1.5, zl, zl + 2.2, [[0, 'rgba(255,255,255,.3)'], [1, 'rgba(0,0,0,.2)']]));
    const zm = zl + 2.2;
    K.box(c, x0 - 1.1, y0 - 1.1, HW + 2.2, HD + 2.2, 1.2, { z0: zm, top: '#b9c4cd', front: '#7f8b96', stroke: 'rgba(40,52,64,.75)', lw: .8 });
    const zz = zm + 1.2;
    K.poly(c, [[x0 - 1.1, y0 - 1.1, zz], [x0 + HW + 1.1, y0 - 1.1, zz], [x0 + HW + 1.1, y0 + 3, zz], [x0 - 1.1, y0 + 3, zz]], 'rgba(255,255,255,.4)');
    K.poly(c, [[x0 - 1.1, y0 - 1.1, zz], [x0 + 3, y0 - 1.1, zz], [x0 + 3, yf + 1.1, zz], [x0 - 1.1, yf + 1.1, zz]], 'rgba(255,255,255,.4)');
    K.poly(c, [[x0 + HW - 3, y0 + 3, zz], [x0 + HW + 1.1, y0 + 3, zz], [x0 + HW + 1.1, yf + 1.1, zz], [x0 + HW - 3, yf + 1.1, zz]], 'rgba(50,70,90,.14)');
    if (P_.snow) {
      K.box(c, x0 - 1.7, y0 - 1.7, HW + 3.4, HD + 3.4, 2.4, { z0: zz - .1, top: '#ffffff', front: '#d5e4f1', stroke: 'rgba(110,145,185,.85)', lw: .8 });
      wallRect(c, x0 - 1.7, x0 + HW + 1.7, yf + 1.7, zz - .1, zz + .8, 'rgba(120,160,205,.35)');
      const b = K.P3(cx, yf + 4, 0); c.fillStyle = 'rgba(255,255,255,.92)'; c.strokeStyle = 'rgba(120,150,185,.6)'; c.lineWidth = .8; c.beginPath(); c.ellipse(b[0], b[1] + 1, 14, 3.4, 0, 0, TAU); c.fill(); c.stroke();
    } else if (Math.floor(K.hash(String(hv.id) + 's') * 1e9) % 3 === 0) {
      K.box(c, cx - 4.5, cy - 2.5, 9, 5.5, 2.8, { z0: zz, top: '#bbb7ae', front: '#87837b', stroke: 'rgba(50,45,40,.8)', lw: .7 });   // brick on the lid
    }
    if (hv.status === 'sick') {                                            // red mite tag
      const p = K.P3(x0 + HW - 2, yf + 1.6, zl + 1.6);
      K.bbAt(c, p[0], p[1], () => {
        c.strokeStyle = 'rgba(60,30,10,.8)'; c.lineWidth = .9; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0], p[1] + 3); c.stroke();
        K.rr(c, p[0] - 3.2, p[1] + 2.5, 6.4, 6, 1.4); c.fillStyle = '#e23b35'; c.fill(); c.strokeStyle = '#7a1210'; c.lineWidth = 1; c.stroke();
        c.fillStyle = '#fff'; c.fillRect(p[0] - .6, p[1] + 3.3, 1.2, 4.4); c.fillRect(p[0] - 2.2, p[1] + 4.9, 4.4, 1.2);
      });
    }
  }
  function drawAway(c, cx, cy) {                                           // empty stand with a placard
    const yf = cy + HD / 2, p = K.P3(cx, yf + 1, 4.5);
    K.bbAt(c, p[0], p[1], () => {
      const bx = p[0], by = p[1] + 4;
      c.fillStyle = '#7b5530'; c.strokeStyle = OUT; c.lineWidth = .8;
      [-11, 11].forEach(o => { c.fillRect(bx + o - 1.4, by - 12, 2.8, 12); c.strokeRect(bx + o - 1.4, by - 12, 2.8, 12); });
      K.rr(c, bx - 20, by - 29, 40, 20, 4); c.fillStyle = '#fff4d0'; c.fill(); c.strokeStyle = '#8a5a2b'; c.lineWidth = 1.5; c.stroke();
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#5a3418';
      c.font = '10px system-ui,"Apple Color Emoji","Segoe UI Emoji",sans-serif'; c.fillText('🚚', bx, by - 22.5);
      c.font = '800 5.1px system-ui,-apple-system,sans-serif'; c.fillText('at the orchard', bx, by - 13.2);
    });
  }
  function hiveProp(slot, hv, P_) {
    const cx = slot[0] * K.T, cy = slot[1] * K.T, h = hiveH(hv);
    return {
      sortY: slot[1], x0: cx - 30, x1: cx + 30, y0: cy - lift(h + 6) - 24, y1: cy + HD / 2 + 10,
      hit: { x0: cx - 15, x1: cx + 15, y0: cy - lift(h) - 4, y1: cy + HD / 2 + 8 },
      body: c => { if (hv.status === 'away') { drawHive(c, cx, cy, hv, P_); drawAway(c, cx, cy); } else drawHive(c, cx, cy, hv, P_); }
    };
  }

  // ================================================================== GEOMETRY of the yard
  function geo(r) {
    return { cx: r.x + r.w / 2, hx0: r.x + 12, hx1: r.x + r.w - 12, hyf: r.y + 30, hd: 20, fx0: r.x + 3, fx1: r.x + r.w - 3, fy0: r.y + 3, fy1: r.y + r.h - 2, gx0: r.x + r.w / 2 - 26, gx1: r.x + r.w / 2 + 26 };
  }
  const padRect = (s, T) => ({ x: s[0] * T - 18, y: s[1] * T - 12, w: 36, h: 28 });
  const WALL_H = 28, ROOF_RISE = 11;

  // ================================================================== GROUND
  function blob(c, x, y, w, h, r, seed, j) {
    const rnd = K.mulberry(seed), pts = [], n = 30, per = 2 * (w + h);
    for (let i = 0; i < n; i++) {
      let d = per * i / n, px, py;
      if (d < w) { px = x + d; py = y; } else if ((d -= w) < h) { px = x + w; py = y + d; } else if ((d -= h) < w) { px = x + w - d; py = y + h; } else { d -= w; px = x; py = y + h - d; }
      const cx = x + w / 2, cy = y + h / 2; const k = (rnd() - .5) * 2 * j;
      pts.push([px + Math.sign(cx - px) * Math.abs(k) * .8 + (rnd() - .5) * j * .4, py + Math.sign(cy - py) * Math.abs(k) * .8]);
    }
    c.beginPath(); const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], s0 = m(pts[n - 1], pts[0]); c.moveTo(s0[0], s0[1]);
    for (let i = 0; i < n; i++) { const q = m(pts[i], pts[(i + 1) % n]); c.quadraticCurveTo(pts[i][0], pts[i][1], q[0], q[1]); }
    c.closePath();
  }
  function upFlower(c, x, y, col, s, kind) {
    K.bbAt(c, x, y, () => {
      c.strokeStyle = 'rgba(45,100,30,.9)'; c.lineWidth = .8; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 3.2 * s); c.stroke();
      c.fillStyle = col;
      if (kind === 1) { for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(x + Math.cos(k * 1.256) * 1.5 * s, y - 3.4 * s + Math.sin(k * 1.256) * 1.5 * s, 1.1 * s, 0, TAU); c.fill(); } c.fillStyle = '#ffd84a'; c.beginPath(); c.arc(x, y - 3.4 * s, .9 * s, 0, TAU); c.fill(); }
      else { c.beginPath(); c.arc(x, y - 3.6 * s, 1.5 * s, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(x - .5 * s, y - 4.1 * s, .55 * s, 0, TAU); c.fill(); }
    });
  }
  function clover(c, x, y, col) { c.fillStyle = col; [[-1.4, 0], [1.4, 0], [0, -1.6]].forEach(o => { c.beginPath(); c.arc(x + o[0], y + o[1], 1.25, 0, TAU); c.fill(); }); }

  function groundYard(c, ctx, H) {
    const r = ctx.rect, P_ = ctx.P_, T = H.T, g = geo(r), sea = seasonOf(P_), winter = sea === 'winter', up = ctx.upgrades || {};
    const slots = ctx.slots || H.APIARY_SLOTS, maxH = ctx.maxHives || 4, hives = ctx.hives || [];
    const gr = GREEN[sea];
    // mown clover patch
    blob(c, r.x + 1.5, r.y + 28, r.w - 3, r.h - 28, 11, 7, 3.2); c.fillStyle = gr[0]; c.fill(); c.lineWidth = 1.6; c.strokeStyle = winter ? 'rgba(150,175,200,.65)' : 'rgba(40,95,30,.4)'; c.stroke();
    c.save(); blob(c, r.x + 1.5, r.y + 28, r.w - 3, r.h - 28, 11, 7, 3.2); c.clip();
    for (let y = r.y + 30, k = 0; y < r.y + r.h; y += 9, k++) { c.fillStyle = k % 2 ? gr[1] : gr[0]; c.fillRect(r.x, y, r.w, 9); }
    const rnd = K.mulberry(4242), pads = []; slots.forEach((s, i) => { if (i < maxH) pads.push(padRect(s, T)); });
    const inPad = (x, y) => pads.some(p => x > p.x - 4 && x < p.x + p.w + 4 && y > p.y - 4 && y < p.y + p.h + 4);
    for (let i = 0; i < 260; i++) { const x = r.x + 4 + rnd() * (r.w - 8), y = r.y + 36 + rnd() * (r.h - 40); if (!inPad(x, y)) { if (winter) { c.fillStyle = 'rgba(170,195,215,.55)'; c.fillRect(x, y, 2.5, .8); } else clover(c, x, y, i % 3 ? 'rgba(48,128,40,.55)' : 'rgba(110,190,80,.6)'); } }
    c.restore();
    // gravel pads under the hives and cinder-block stands on free slots
    slots.forEach((s, i) => {
      if (i >= maxH) return; const p = padRect(s, T);
      blob(c, p.x - 1, p.y - 1, p.w + 2, p.h + 2, 7, 20 + i, 1.2); c.fillStyle = winter ? 'rgba(120,135,150,.5)' : 'rgba(70,60,45,.45)'; c.fill();
      blob(c, p.x, p.y, p.w, p.h, 7, 30 + i, 1.4); c.fillStyle = winter ? '#d5dde3' : '#cdc5b3'; c.fill();
      const pr = K.mulberry(100 + i); for (let k = 0; k < 40; k++) { c.fillStyle = k % 3 ? 'rgba(130,120,100,.5)' : 'rgba(255,255,250,.55)'; const x = p.x + 3 + pr() * (p.w - 6), y = p.y + 3 + pr() * (p.h - 6); c.fillRect(x, y, 1.6, 1); }
      if (winter) { c.fillStyle = 'rgba(255,255,255,.75)'; blob(c, p.x + 1, p.y + 1, p.w - 2, p.h * .55, 5, 40 + i, 2); c.fill(); }
      const hv = hives[i]; if (!hv || hv.status === 'empty') { [-8, 5].forEach(o => H.box(c, s[0] * T + o, s[1] * T - 3, 8, 6, 5, { top: '#c4c0b8', front: '#8e8a82', stroke: 'rgba(60,55,50,.8)', lw: .7 })); }
    });
    // stepping stones down the middle aisle
    const sr = K.mulberry(555); for (let y = r.y + 46; y < r.y + r.h - 4; y += 15) {
      const x = g.cx + (sr() - .5) * 3; c.fillStyle = 'rgba(40,40,30,.3)'; K.rr(c, x - 5, y - 2.5, 10, 7, 2.5); c.fill();
      K.rr(c, x - 5, y - 3.5, 10, 7, 2.5); c.fillStyle = winter ? '#e3eaf0' : '#b9b6ad'; c.fill(); c.strokeStyle = 'rgba(70,65,55,.55)'; c.lineWidth = .8; c.stroke();
    }
    // wildflowers (upright little stems)
    if (!winter) {
      const cols = { spring: ['#ffffff', '#ff9ec7', '#ffd84a', '#c9a3ff', '#ff6b8b'], summer: ['#ffd84a', '#b886ff', '#ffffff', '#ff8c3a', '#ff7fb0'], fall: ['#f4c20d', '#9a6bd6', '#ffffff', '#e8863a'] }[sea];
      const fr = K.mulberry(999), list = [];
      for (let i = 0; i < 90; i++) { const x = r.x + 5 + fr() * (r.w - 10), y = r.y + 40 + fr() * (r.h - 42); if (!inPad(x, y)) list.push([x, y, cols[i % cols.length], .85 + fr() * .5, i % 4 === 0 ? 0 : 1]); }
      list.sort((a, b) => a[1] - b[1]).forEach(f => upFlower(c, f[0], f[1], f[2], f[3], f[4]));
    } else {
      const fr = K.mulberry(777); for (let i = 0; i < 26; i++) { const x = r.x + 5 + fr() * (r.w - 10), y = r.y + 40 + fr() * (r.h - 44); if (inPad(x, y)) continue; K.bbAt(c, x, y, () => { c.strokeStyle = '#8c6c48'; c.lineWidth = .8; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (fr() - .5) * 2, y - 4); c.stroke(); c.fillStyle = '#7a5a38'; c.fillRect(x - .8 + (fr() - .5), y - 5, 1.6, 1.4); }); }
    }
    // log-edge stones around the yard where there's no bear fence
    if (!up.bearFence) { const er = K.mulberry(31); const stone = (x, y) => { const w = 4 + er() * 2; c.fillStyle = 'rgba(40,30,15,.28)'; c.beginPath(); c.ellipse(x + 1, y + 1.2, w * .6, 2.3, 0, 0, TAU); c.fill(); c.fillStyle = winter ? '#e8eef3' : '#aaa59a'; c.strokeStyle = 'rgba(60,55,48,.7)'; c.lineWidth = .7; c.beginPath(); c.ellipse(x, y, w * .55, 2.3, 0, 0, TAU); c.fill(); c.stroke(); };
      for (let y = g.fy0 + 36; y < g.fy1; y += 9) { stone(g.fx0, y); stone(g.fx1, y); } for (let x = g.fx0 + 6; x < g.gx0 - 2; x += 9) { stone(x, g.fy1); } for (let x = g.gx1 + 4; x < g.fx1; x += 9) stone(x, g.fy1); }
    // cast shadows
    hives.forEach((hv, i) => { const s = slots[i]; if (!s || i >= maxH || hv.status === 'empty') return; const h = hiveH(hv); H.castShadow(c, s[0] * T - HW / 2, s[1] * T - HD / 2, HW, HD, h, .24); c.fillStyle = 'rgba(30,20,5,.28)'; c.beginPath(); c.ellipse(s[0] * T, s[1] * T + HD / 2 - 1, HW / 2 + 3, 4.5, 0, 0, TAU); c.fill(); });
    if (up.honeyHouse) H.castShadow(c, g.hx0, g.hyf - g.hd, g.hx1 - g.hx0, g.hd, WALL_H + ROOF_RISE * .55, .25);
    // gate arch posts and fence
    [g.gx0, g.gx1].forEach(x => H.castShadow(c, x - 2.5, g.fy1 - 2.5, 5, 5, 44, .22));
    if (up.bearFence) {
      H.castShadow(c, g.fx0, g.fy0 - 1, g.fx1 - g.fx0, 2, 15, .12);
      H.castShadow(c, g.fx0 - 1, g.fy0, 2, g.fy1 - g.fy0, 15, .12);
      H.castShadow(c, g.fx1 - 1, g.fy0, 2, g.fy1 - g.fy0, 15, .12);
      H.castShadow(c, g.fx0, g.fy1 - 1, g.gx0 - g.fx0, 2, 15, .12); H.castShadow(c, g.gx1, g.fy1 - 1, g.fx1 - g.gx1, 2, 15, .12);
    }
  }

  function groundClearing(c, ctx, H) {
    const r = ctx.rect, P_ = ctx.P_, T = H.T, g = geo(r), sea = seasonOf(P_), winter = sea === 'winter', gr = GREEN[sea];
    blob(c, r.x + 3, r.y + 22, r.w - 6, r.h - 24, 12, 9, 2.6); c.fillStyle = winter ? '#f1f6fa' : mix(gr[0], '#c9d98a', .3); c.fill(); c.lineWidth = 1.5; c.strokeStyle = winter ? 'rgba(150,175,200,.7)' : 'rgba(60,100,30,.38)'; c.stroke();
    c.save(); blob(c, r.x + 3, r.y + 22, r.w - 6, r.h - 24, 12, 9, 2.6); c.clip();
    for (let y = r.y + 24, k = 0; y < r.y + r.h; y += 9, k++) { c.fillStyle = k % 2 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.035)'; c.fillRect(r.x, y, r.w, 9); }
    const rnd = K.mulberry(88); for (let i = 0; i < 40; i++) { const x = r.x + 6 + rnd() * (r.w - 12), y = r.y + 28 + rnd() * (r.h - 34); clover(c, x, y, winter ? 'rgba(170,195,215,.5)' : 'rgba(60,130,40,.4)'); }
    c.restore();
    // chalk-marked hive pads: first four bold, the rest faint
    (ctx.slots || H.APIARY_SLOTS).forEach((s, i) => {
      const p = padRect(s, T); c.save(); c.setLineDash([4, 3]); c.lineWidth = i < 4 ? 1.6 : 1; c.strokeStyle = winter ? 'rgba(90,120,150,.7)' : `rgba(255,255,255,${i < 4 ? .9 : .45})`; K.rr(c, p.x + 3, p.y + 3, p.w - 6, p.h - 8, 5); c.stroke(); c.restore();
    });
    // string lines down both sides, tying the corner stakes
    const sx0 = r.x + 8, sx1 = r.x + r.w - 8, sy0 = r.y + 40, sy1 = r.y + r.h - 6;
    [sx0, sx1].forEach(x => { ln(c, [x, sy0, 8], [x, sy1, 8], '#ff8a2a', 1.3); ln(c, [x, sy0, 8], [x, sy1, 8], 'rgba(255,255,255,.55)', .5); });
    c.fillStyle = 'rgba(30,20,0,.2)'; c.fillRect(sx0, sy0, 1.5, sy1 - sy0); c.fillRect(sx1, sy0, 1.5, sy1 - sy0);
    // cast shadow of the sign
    H.castShadow(c, g.cx - 40, r.y + 114, 80, 2, 40, .2);
  }

  // ================================================================== HONEY HOUSE
  function drawHoneyHouse(c, ctx) {
    const P_ = ctx.P_, r = ctx.rect, g = geo(r), x0 = g.hx0, x1 = g.hx1, yf = g.hyf, d = g.hd, xm = (x0 + x1) / 2, w = x1 - x0;
    const wh = WALL_H, rr_ = ROOF_RISE, winter = !!P_.snow;
    // stone footing + board-and-batten wall
    K.box(c, x0, yf - d, w, d, wh, { top: '#e8c26a', front: '#f0c55f', stroke: OUT, lw: 1.1 });
    K.poly(c, [[x0, yf, 0], [x1, yf, 0], [x1, yf, wh], [x0, yf, wh]], gradFace(c, yf, 0, wh, [[0, 'rgba(255,255,255,.22)'], [.5, 'rgba(255,255,255,0)'], [1, 'rgba(90,50,0,.22)']]));
    for (let x = x0 + 4; x < x1 - 1; x += 6) { ln(c, [x, yf, 6], [x, yf, wh], 'rgba(120,70,0,.28)', .7); ln(c, [x + .8, yf, 6], [x + .8, yf, wh], 'rgba(255,240,170,.38)', .6); }
    wallRect(c, x0, x0 + 3, yf, 0, wh, '#fff6d2', OUT, .8); wallRect(c, x1 - 3, x1, yf, 0, wh, '#e4c27a', OUT, .8);   // corner boards
    wallRect(c, x0, x1, yf, 0, 6, '#9a958a', OUT, .9);                                                    // stone footing
    const sr = K.mulberry(5); for (let k = 0; k < 14; k++) { const sx = x0 + 3 + sr() * (w - 7), sz = 1 + (k % 2) * 2.3; wallRect(c, sx, sx + 5 + sr() * 3, yf, sz, sz + 1.6, 'rgba(60,55,48,.35)'); }
    wallRect(c, x0 + 1, x1 - 1, yf, 4.6, 6, 'rgba(255,255,255,.4)');
    // door
    const dx0 = xm - 8, dx1 = xm + 8;
    wallRect(c, dx0 - 1.6, dx1 + 1.6, yf, 5.8, 20.4, '#fff3cf', OUT, .9);
    wallRect(c, dx0, dx1, yf, 6, 19.2, '#9b6034', OUT, .9);
    wallRect(c, dx0, dx1, yf, 6, 19.2, gradFace(c, yf, 6, 19.2, [[0, 'rgba(255,230,170,.3)'], [1, 'rgba(40,15,0,.25)']]));
    for (let k = 1; k < 3; k++) ln(c, [dx0 + k * 5.33, yf, 6.2], [dx0 + k * 5.33, yf, 19], 'rgba(50,20,0,.45)', .7);
    ln(c, [dx0 + 1, yf, 12.5], [dx1 - 1, yf, 12.5], 'rgba(50,20,0,.4)', .7);
    c.fillStyle = '#f5d96a'; const hnd = K.P3(dx1 - 2.4, yf, 12); c.beginPath(); c.arc(hnd[0], hnd[1], 1, 0, TAU); c.fill();
    wallRect(c, dx0 - 3, dx1 + 3, yf + 2.2, 5.4, 6.4, '#a9a498', OUT, .7);   // step
    // hex honeycomb sign (left) and shuttered window (right)
    const hex = (cx, z, rad, fill, st, lw) => K.poly(c, [0, 1, 2, 3, 4, 5].map(k => [cx + Math.cos(k * Math.PI / 3 + Math.PI / 6) * rad, yf, z + Math.sin(k * Math.PI / 3 + Math.PI / 6) * rad * 1.05]), fill, st, lw);
    const hxC = x0 + 18.5, hzC = 14.5;
    hex(hxC, hzC, 8.2, '#fff3cf', OUT, 1); hex(hxC, hzC, 6.5, '#d79a1c', 'rgba(90,50,0,.6)', .7);
    [[0, 0], [3.6, 2.2], [-3.6, 2.2], [0, -4.2]].forEach(o => hex(hxC + o[0], hzC + o[1], 1.8, '#ffd45a', 'rgba(120,70,0,.7)', .5));
    const wx0 = x1 - 26, wx1 = x1 - 11;
    wallRect(c, wx0 - 6, wx0 - 1, yf, 8, 19, '#4f8a7a', OUT, .8); wallRect(c, wx1 + 1, wx1 + 6, yf, 8, 19, '#4f8a7a', OUT, .8);   // shutters
    wallRect(c, wx0 - .8, wx1 + .8, yf, 7.4, 19.6, '#fff3cf', OUT, .9);
    wallRect(c, wx0, wx1, yf, 8.2, 18.8, '#a9dbe8', OUT, .7);
    wallRect(c, wx0, wx1, yf, 8.2, 18.8, gradFace(c, yf, 8.2, 18.8, [[0, 'rgba(255,255,255,.55)'], [.5, 'rgba(255,255,255,.05)'], [1, 'rgba(30,70,100,.25)']]));
    ln(c, [(wx0 + wx1) / 2, yf, 8.2], [(wx0 + wx1) / 2, yf, 18.8], '#fff3cf', 1); ln(c, [wx0, yf, 13.5], [wx1, yf, 13.5], '#fff3cf', 1);
    K.box(c, wx0 - 1.5, yf + .4, wx1 - wx0 + 3, 3, 2.6, { z0: 5.4, top: '#8a5a2b', front: '#6b4220', stroke: OUT, lw: .6 });
    [0, 1, 2, 3].forEach(k => { const p = K.P3(wx0 + 1.5 + k * 3.6, yf + 2, 8.6); c.fillStyle = ['#ff8fb3', '#ffd84a', '#fff', '#c9a3ff'][k]; c.beginPath(); c.arc(p[0], p[1], 1.2, 0, TAU); c.fill(); });
    // roof (south slope visible)
    const oh = 4, ey = yf + oh, ry = yf - d / 2, zE = wh - 1, zR = wh + rr_;
    wallRect(c, x0 - oh, x1 + oh, ey, zE - 1.8, zE + .4, '#fff1c9', OUT, .9);                                // fascia
    const q = [[x0 - oh, ey, zE], [x1 + oh, ey, zE], [x1 + oh, ry, zR], [x0 - oh, ry, zR]];
    K.poly(c, q, '#b95e3b', OUT, 1.1);
    K.poly(c, q, (() => { const a = K.P3(0, ry, zR)[1], b = K.P3(0, ey, zE)[1], gg = c.createLinearGradient(0, a, 0, b); gg.addColorStop(0, 'rgba(255,225,170,.34)'); gg.addColorStop(.5, 'rgba(255,225,170,.05)'); gg.addColorStop(1, 'rgba(60,15,0,.28)'); return gg; })());
    const rows = 6, lp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    for (let j = 1; j < rows; j++) { const t = j / rows; ln(c, lp(q[0], q[3], t), lp(q[1], q[2], t), 'rgba(70,20,0,.4)', .8); }
    for (let j = 0; j < rows; j++) for (let x = x0 - oh + (j % 2 ? 3 : 0); x < x1 + oh; x += 6) { const ta = j / rows, tb = (j + 1) / rows, e = 1 - 0; ln(c, [x, lp(q[0], q[3], ta)[1], lp(q[0], q[3], ta)[2]], [x, lp(q[0], q[3], tb)[1], lp(q[0], q[3], tb)[2]], 'rgba(70,20,0,.28)', .6); }
    ln(c, q[0], q[3], '#fff1c9', 1.6); ln(c, q[1], q[2], '#fff1c9', 1.6);                                     // barge boards
    K.box(c, x0 - oh - .5, ry - 1.3, w + 2 * oh + 1, 2.6, 1.8, { z0: zR - .6, top: '#8a3f26', front: '#6e3019', stroke: OUT, lw: .8 });   // ridge cap
    // stove pipe + skylight
    K.cyl(c, x1 - 14, ry + 5, 2.3, 9, { z0: zR - 5, side: '#555a60', top: '#2e3236', hi: 'rgba(255,255,255,.35)' });
    K.box(c, x1 - 17.5, ry + 4.2, 7, 2, 1.6, { z0: zR + 3.8, top: '#3c4046', front: '#2a2d31', stroke: OUT, lw: .6 });
    if (winter) {
      const f = .78, ta = lp(q[3], q[0], f), tb = lp(q[2], q[1], f), P = p => K.P3(p[0], p[1], p[2]);
      const a = P(q[3]), b = P(q[2]), e = P(ta), dd = P(tb), n = 16;
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(dd[0], dd[1]);
      for (let i = 0; i < n; i++) { const t0 = 1 - i / n, t1 = 1 - (i + 1) / n, p0 = P(lp(ta, tb, t0)), p1 = P(lp(ta, tb, t1)); c.quadraticCurveTo((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + 3.6, p1[0], p1[1]); }
      c.closePath(); c.fillStyle = '#f8fbff'; c.fill(); c.strokeStyle = 'rgba(120,150,185,.85)'; c.lineWidth = 1; c.lineJoin = 'round'; c.stroke();
      c.fillStyle = 'rgba(150,180,215,.3)'; c.fillRect(a[0], Math.min(e[1], dd[1]) - 1, b[0] - a[0], 3);
      K.box(c, x1 - 15.4, ry + 4.2, 3.2, 3.2, 1.2, { z0: zR + 5.4, top: '#fff', front: '#d5e4f1' });
    }
    // honey barrel + crate of jars
    const bx = x0 + 6, by = yf + 5;
    K.cyl(c, bx, by, 4.6, 9, { side: '#a56a2e', top: '#c98d4a', hi: 'rgba(255,230,170,.35)', dark: 'rgba(40,15,0,.4)' });
    [3, 6.2].forEach(z => { const p0 = K.P3(bx - 4.6, by, z), p1 = K.P3(bx + 4.6, by, z); c.strokeStyle = '#4d3a26'; c.lineWidth = .9; c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.stroke(); });
    if (winter) { const p = K.P3(bx, by, 9); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(p[0], p[1], 4.6, 2.4, 0, 0, TAU); c.fill(); }
    const kx = x1 - 14, ky = yf + 3;
    K.box(c, kx, ky, 11, 6, 5.4, { top: '#d7b075', front: '#a47840', stroke: OUT, lw: .8 });
    ln(c, [kx + 1, ky + 6, 2.7], [kx + 10, ky + 6, 2.7], 'rgba(60,30,0,.4)', .6);
    [2.4, 5.5, 8.6].forEach((o, k) => { K.cyl(c, kx + o, ky + 2.8, 1.8, 4, { z0: 5.4, side: '#e09a16', top: '#ffd45a', hi: 'rgba(255,255,255,.4)', dark: 'rgba(80,30,0,.35)' }); const lp_ = K.P3(kx + o, ky + 2.8, 9.8); c.fillStyle = '#6b4220'; c.fillRect(lp_[0] - 1.5, lp_[1] - .5, 3, 1.3); });
  }
  function honeyHouseProp(ctx) {
    const r = ctx.rect, g = geo(r), top = WALL_H + ROOF_RISE + 8;
    return { sortY: (g.hyf + 6) / K.T, x0: g.hx0 - 12, x1: g.hx1 + 12, y0: g.hyf - g.hd - lift(top) - 6, y1: g.hyf + 14, hit: { x0: g.hx0, x1: g.hx1, y0: g.hyf - lift(WALL_H + 8), y1: g.hyf + 4 }, body: c => drawHoneyHouse(c, ctx) };
  }

  // ================================================================== FENCE (low electric bear fence)
  const FZ = [3.5, 8, 12.5], FH = 15;
  function fpost(c, x, y, snow, big) {
    const w = big ? 4 : 3, h = FH + (big ? 2 : 0), x0 = x - w / 2, y0 = y - w / 2;
    K.box(c, x0, y0, w, w, h, { top: '#fff6c4', front: '#ece7d6', stroke: 'rgba(60,50,30,.8)', lw: .7 });
    K.poly(c, [[x0 + .4, y0 + w, .5], [x0 + 1.2, y0 + w, .5], [x0 + 1.2, y0 + w, h - .5], [x0 + .4, y0 + w, h - .5]], 'rgba(255,255,255,.7)');
    K.poly(c, [[x0 + w - 1, y0 + w, .5], [x0 + w, y0 + w, .5], [x0 + w, y0 + w, h - .5], [x0 + w - 1, y0 + w, h - .5]], 'rgba(80,70,40,.2)');
    K.box(c, x0 - .5, y0 - .5, w + 1, w + 1, 1.6, { z0: h, top: '#ffd23f', front: '#d19a10', stroke: 'rgba(80,50,0,.8)', lw: .6 });
    FZ.forEach(z => { const p = K.P3(x, y0 + w, z); c.fillStyle = '#ff8a2a'; c.strokeStyle = 'rgba(80,30,0,.8)'; c.lineWidth = .5; c.beginPath(); c.arc(p[0], p[1], 1, 0, TAU); c.fill(); c.stroke(); });
    if (snow) K.box(c, x0 - 1, y0 - 1, w + 2, w + 2, 1.8, { z0: h + 1.6, top: '#fff', front: '#d5e4f1' });
  }
  function wire(c, a, b, z, sag) {
    const p = K.P3(a[0], a[1], z), q = K.P3(b[0], b[1], z); c.lineCap = 'round';
    [['rgba(30,25,15,.4)', 1.6, 1], ['#fbfbf4', .95, 0]].forEach(s => { c.beginPath(); c.moveTo(p[0], p[1] + s[2]); c.quadraticCurveTo((p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + s[2] + sag, q[0], q[1] + s[2]); c.strokeStyle = s[0]; c.lineWidth = s[1]; c.stroke(); });
  }
  function fenceRun(c, o) {                // o = { h:true, a, b, at, skipA, skipB, snow }
    const n = Math.max(1, Math.round((o.b - o.a) / 30)), pts = []; for (let k = 0; k <= n; k++) pts.push(o.a + (o.b - o.a) * k / n);
    pts.forEach((p, k) => { if ((k === 0 && o.skipA) || (k === n && o.skipB)) return; o.h ? fpost(c, p, o.at, o.snow) : fpost(c, o.at, p, o.snow); });
    for (let k = 0; k < n; k++) FZ.forEach(z => { if (o.h) wire(c, [pts[k], o.at + 1.5], [pts[k + 1], o.at + 1.5], z, 1.2); else wire(c, [o.at, pts[k]], [o.at, pts[k + 1]], z, 0); });
  }
  function bolt(c, p) {                    // yellow warning diamond on the wire
    K.bbAt(c, p[0], p[1], () => {
      c.strokeStyle = 'rgba(40,30,10,.8)'; c.lineWidth = .7; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0], p[1] + 3); c.stroke();
      c.save(); c.translate(p[0], p[1] + 8); c.rotate(Math.PI / 4); K.rr(c, -4.2, -4.2, 8.4, 8.4, 1.4); c.fillStyle = '#ffd23f'; c.fill(); c.strokeStyle = '#6a4a00'; c.lineWidth = 1; c.stroke(); c.restore();
      c.fillStyle = '#2a1a00'; c.beginPath(); c.moveTo(p[0] + .8, p[1] + 4.4); c.lineTo(p[0] - 2, p[1] + 8.6); c.lineTo(p[0] - .1, p[1] + 8.6); c.lineTo(p[0] - .8, p[1] + 11.8); c.lineTo(p[0] + 2.2, p[1] + 7.2); c.lineTo(p[0] + .2, p[1] + 7.2); c.closePath(); c.fill();
    });
  }
  function charger(c, x, y, snow) {
    K.box(c, x - 5, y - 3, 10, 6, 8, { top: '#4a8a5c', front: '#3a7048', stroke: OUT, lw: .8 });
    K.poly(c, [[x - 5, y + 3, 0], [x + 5, y + 3, 0], [x + 5, y + 3, 8], [x - 5, y + 3, 8]], gradFace(c, y + 3, 0, 8, [[0, 'rgba(255,255,255,.25)'], [1, 'rgba(0,0,0,.25)']]));
    c.fillStyle = '#ffd23f'; const l = K.P3(x + 2.5, y + 3, 4.5); c.beginPath(); c.arc(l[0], l[1], 1, 0, TAU); c.fill();
    const pl = [[x - 7, y - 3, 14], [x + 7, y - 3, 14], [x + 7, y + 4, 9], [x - 7, y + 4, 9]];
    K.poly(c, pl, '#254a86', 'rgba(15,25,50,.9)', .8); K.poly(c, pl, 'rgba(120,180,255,.28)');
    for (let k = 1; k < 4; k++) { const t = k / 4; ln(c, [x - 7 + 14 * t, y - 3, 14], [x - 7 + 14 * t, y + 4, 9], 'rgba(200,225,255,.5)', .5); } ln(c, [x - 7, y + .5, 11.5], [x + 7, y + .5, 11.5], 'rgba(200,225,255,.5)', .5);
    if (snow) K.poly(c, pl, 'rgba(255,255,255,.9)');
  }
  function fenceProps(ctx) {
    const r = ctx.rect, g = geo(r), T = K.T, snow = !!ctx.P_.snow, out = [], pr = (sortYpx, x0, y0, x1, y1, body) => ({ sortY: sortYpx / T, x0, y0, x1, y1, body });
    const bk = { h: true, a: g.fx0, b: g.fx1, at: g.fy0, snow };
    out.push(pr(g.fy0 + 4, g.fx0 - 8, g.fy0 - lift(FH + 6) - 4, g.fx1 + 8, g.fy0 + 8, c => fenceRun(c, bk)));
    const len = g.fy1 - g.fy0, cnt = 3;
    [g.fx0, g.fx1].forEach(x => { for (let i = 0; i < cnt; i++) { const a = g.fy0 + len * i / cnt, b = g.fy0 + len * (i + 1) / cnt, o = { h: false, a, b, at: x, snow, skipA: i === 0, skipB: i === cnt - 1 };
      out.push(pr(b + 3, x - 8, a - lift(FH + 6), x + 8, b + 8, c => fenceRun(c, o))); } });
    const fl = { h: true, a: g.fx0, b: g.gx0 - 4, at: g.fy1, snow }, fr = { h: true, a: g.gx1 + 4, b: g.fx1, at: g.fy1, snow };
    out.push(pr(g.fy1 + 4, g.fx0 - 8, g.fy1 - lift(FH + 24), g.gx0 + 4, g.fy1 + 10, c => { fenceRun(c, fl); bolt(c, K.P3(g.fx0 + 15, g.fy1 + 1.5, 13)); }));
    out.push(pr(g.fy1 + 4, g.gx1 - 4, g.fy1 - lift(FH + 14), g.fx1 + 8, g.fy1 + 10, c => { fenceRun(c, fr); charger(c, g.fx1 - 12, g.fy1 + 7, snow); }));
    return out;
  }

  // ================================================================== GATE ARCH + PLATE
  function drawArch(c, ctx) {
    const r = ctx.rect, g = geo(r), snow = !!ctx.P_.snow, y = g.fy1, ax0 = g.gx0, ax1 = g.gx1, H_ = 44;
    [ax0, ax1].forEach(x => {
      K.box(c, x - 2.6, y - 2.6, 5.2, 5.2, H_, { top: '#ecc486', front: '#865027', stroke: OUT, lw: .9 });
      wallRect(c, x - 2, x - .8, y + 2.6, .5, H_ - .5, 'rgba(255,225,170,.45)'); wallRect(c, x + 1.1, x + 2.4, y + 2.6, .5, H_ - .5, 'rgba(30,10,0,.22)');
      wallRect(c, x - 3.6, x + 3.6, y + 2.6, 0, 3, '#a9a498', OUT, .6);
    });
    K.box(c, ax0 - 6, y - 2, ax1 - ax0 + 12, 4, 3.6, { z0: H_ - 3, top: '#f2d29a', front: '#8e5a2b', stroke: OUT, lw: .9 });
    wallRect(c, ax0 - 6, ax1 + 6, y + 2, H_ - 3, H_ - 2.2, 'rgba(30,10,0,.25)');
    [ax0 + 4.5, ax1 - 4.5].forEach(x => { wallRect(c, x - 1, x + 1, y + 2, H_ - 12, H_ - 3, '#8e5a2b', OUT, .6); });   // braces
    // hex medallion on the beam
    const mx = (ax0 + ax1) / 2, hexp = (cx, z, rad) => [0, 1, 2, 3, 4, 5].map(k => [cx + Math.cos(k * Math.PI / 3 + Math.PI / 6) * rad, y + 2, z + Math.sin(k * Math.PI / 3 + Math.PI / 6) * rad]);
    // hanging chains + lanterns
    [[ax0 + 5, 1], [ax1 - 5, 1]].forEach(a => { ln(c, [a[0], y + 2.2, H_ - 3], [a[0], y + 2.2, H_ - 8], 'rgba(40,30,20,.8)', .8); K.box(c, a[0] - 2, y + .4, 4, 3.4, 5, { z0: H_ - 13, top: '#4d4338', front: '#ffd873', stroke: 'rgba(40,30,20,.9)', lw: .8 }); });
    if (snow) { K.box(c, ax0 - 6.6, y - 2.6, ax1 - ax0 + 13.2, 5.2, 1.8, { z0: H_ + .5, top: '#fff', front: '#d5e4f1' }); [ax0, ax1].forEach(x => K.box(c, x - 3.3, y - 3.3, 6.6, 6.6, 1.6, { z0: H_, top: '#fff', front: '#d5e4f1' })); }
    // hanging plate
    const p = K.P3(mx, y + 2.5, 32);
    ln(c, [mx - 14, y + 2.4, H_ - 3], [mx - 14, y + 2.4, 38.5], 'rgba(50,35,20,.8)', .8); ln(c, [mx + 14, y + 2.4, H_ - 3], [mx + 14, y + 2.4, 38.5], 'rgba(50,35,20,.8)', .8);
    K.plate(c, p[0], p[1], 'APIARY', { size: 8.5, bg: '#ffe39a' });
  }
  function archProp(ctx) {
    const r = ctx.rect, g = geo(r), T = K.T;
    return { sortY: (g.fy1 + 4) / T, x0: g.gx0 - 14, x1: g.gx1 + 14, y0: g.fy1 - lift(58), y1: g.fy1 + 10, hit: { x0: g.gx0 - 4, x1: g.gx1 + 4, y0: g.fy1 - lift(50), y1: g.fy1 + 6 }, body: c => drawArch(c, ctx) };
  }

  // ================================================================== NOT BUILT: stakes + sign
  function stake(c, x, y, snow) {
    K.box(c, x - 1.4, y - 1.4, 2.8, 2.8, 12, { top: '#f0cf96', front: '#a9773c', stroke: OUT, lw: .7 });
    K.poly(c, [[x - 1.4, y + 1.4, 8], [x + 1.4, y + 1.4, 8], [x + 1.4, y + 1.4, 12], [x - 1.4, y + 1.4, 12]], '#ff8a2a', 'rgba(110,40,0,.7)', .5);   // tape
    K.poly(c, [[x + 1.4, y, 8.5], [x + 5, y + .4, 7.5], [x + 4, y + .4, 11], [x + 1.4, y, 11.5]], '#ff9d3c', 'rgba(110,40,0,.6)', .5);
    if (snow) K.box(c, x - 2, y - 2, 4, 4, 1.4, { z0: 12, top: '#fff', front: '#d5e4f1' });
  }
  function stakeProps(ctx) {
    const r = ctx.rect, T = K.T, snow = !!ctx.P_.snow, x0 = r.x + 8, x1 = r.x + r.w - 8, yb = r.y + 40, yf = r.y + r.h - 6, out = [];
    out.push({ sortY: yb / T + .02, x0: x0 - 8, x1: x1 + 8, y0: yb - lift(18), y1: yb + 6, body: c => { ln(c, [x0, yb, 8], [x1, yb, 8], '#ff8a2a', 1.3); ln(c, [x0, yb, 8], [x1, yb, 8], 'rgba(255,255,255,.55)', .5); [x0, x1].forEach(x => stake(c, x, yb, snow)); } });
    out.push({ sortY: yf / T + .02, x0: x0 - 8, x1: x1 + 8, y0: yf - lift(18), y1: yf + 6, body: c => { ln(c, [x0, yf, 8], [x1, yf, 8], '#ff8a2a', 1.3); ln(c, [x0, yf, 8], [x1, yf, 8], 'rgba(255,255,255,.55)', .5); [x0, x1].forEach(x => stake(c, x, yf, snow)); } });
    return out;
  }
  function drawSign(c, ctx) {
    const r = ctx.rect, snow = !!ctx.P_.snow, cx = r.x + r.w / 2, by = r.y + 118;
    
    K.bbAt(c, cx, by, () => {
      const bw = 90, bh = 34;
      c.fillStyle = '#7b4c24'; c.strokeStyle = OUT; c.lineWidth = 1;
      [-36, 36].forEach(o => { c.fillRect(cx + o - 3, by - 54, 6, 54); c.strokeRect(cx + o - 3, by - 54, 6, 54); c.fillStyle = '#ac7a42'; c.fillRect(cx + o - 3, by - 54, 2, 54); c.fillStyle = '#7b4c24'; });
      c.fillStyle = 'rgba(30,15,0,.25)'; c.fillRect(cx - bw / 2 + 2, by - 49 + bh, bw, 3);
      K.rr(c, cx - bw / 2, by - 52, bw, bh, 5); c.fillStyle = '#fff1c4'; c.fill(); c.lineWidth = 2.2; c.strokeStyle = '#8a5a2b'; c.stroke();
      K.rr(c, cx - bw / 2 + 3, by - 49, bw - 6, bh - 6, 3); c.lineWidth = .8; c.strokeStyle = 'rgba(138,90,43,.55)'; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(cx - bw / 2 + 4, by - 50, bw - 8, 2);
      // honeycomb badge
      const hexAt = (hx_, hy_, rad, f, s) => { c.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; c[k ? 'lineTo' : 'moveTo'](hx_ + Math.cos(a) * rad, hy_ + Math.sin(a) * rad); } c.closePath(); c.fillStyle = f; c.fill(); if (s) { c.strokeStyle = s; c.lineWidth = .7; c.stroke(); } };
      hexAt(cx - 35, by - 35, 8, '#f5b82a', '#7a4a00'); hexAt(cx - 35, by - 35, 4, '#fff1c4', '#7a4a00');
      c.fillStyle = '#2a1a00'; [-1.8, 1.8].forEach(o => c.fillRect(cx - 35 + o - .6, by - 37.6, 1.2, 5.2));
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#5a3418';
      c.font = '900 6.8px system-ui,-apple-system,sans-serif'; c.fillText('BUILD AN APIARY', cx + 9, by - 41.5);
      c.font = '700 6.8px system-ui,-apple-system,sans-serif'; c.fillStyle = '#8a5a2b'; c.fillText('walk up and tap', cx + 8, by - 30.5);
      if (snow) { c.fillStyle = '#fff'; c.strokeStyle = 'rgba(120,150,185,.8)'; c.lineWidth = .8; K.rr(c, cx - bw / 2 - 1, by - 56, bw + 2, 6, 3); c.fill(); c.stroke(); [-36, 36].forEach(o => { K.rr(c, cx + o - 4, by - 57, 8, 5, 2); c.fill(); }); }
    });
    K.light(cx, by, 30, 40, 'rgba(255,215,130,.4)');
  }
  function signProp(ctx) {
    const r = ctx.rect, cx = r.x + r.w / 2, by = r.y + 118;
    return { sortY: by / K.T, x0: cx - 50, x1: cx + 50, y0: by - 74, y1: by + 8, hit: { x0: cx - 46, x1: cx + 46, y0: by - 60, y1: by + 4 }, body: c => drawSign(c, ctx) };
  }

  // ================================================================== REGISTRATION
  A.structures.apiary = {
    ground(c, ctx, H) {
      use(H);
      if (ctx.built) groundYard(c, Object.assign({ upgrades: ctx.upgrades }, ctx), H); else groundClearing(c, ctx, H);
    },
    props(ctx, H) {
      use(H); const out = [], P_ = ctx.P_;
      if (!ctx.built) { out.push(signProp(ctx)); stakeProps(ctx).forEach(p => out.push(p)); return out; }
      const slots = ctx.slots || H.APIARY_SLOTS, up = ctx.upgrades || {};
      (ctx.hives || []).forEach((hv, i) => { const s = slots[i]; if (!s || i >= (ctx.maxHives || 8) || hv.status === 'empty') return; out.push(hiveProp(s, hv, P_)); });
      if (up.honeyHouse) {
        out.push(honeyHouseProp(ctx));
        const g = geo(ctx.rect); K.light(g.hx0 + 32 + 4, g.hyf, 14, 36, 'rgba(255,205,110,.5)'); K.light(g.hx1 - 18.5, g.hyf, 13, 30, 'rgba(255,215,130,.55)');
      }
      if (up.bearFence) fenceProps(ctx).forEach(p => out.push(p));
      out.push(archProp(ctx));
      const g = geo(ctx.rect); K.light(g.gx0 + 5, g.fy1 + 2, 22, 34, 'rgba(255,215,130,.55)'); K.light(g.gx1 - 5, g.fy1 + 2, 22, 34, 'rgba(255,215,130,.55)');
      return out;
    }
  };

  // ================================================================== BEE ACTOR (cached sprite, two wing frames)
  const SC = 8, BW = 14, BHT = 11, DW = 7.4, DH = 5.8;
  const beeCache = [];
  function beeSprite(f) {
    if (beeCache[f]) return beeCache[f];
    const cv = document.createElement('canvas'); cv.width = BW * SC; cv.height = BHT * SC; const g = cv.getContext('2d');
    g.scale(SC, SC); g.translate(BW / 2, BHT * .62);
    // wings
    g.fillStyle = 'rgba(235,245,255,.82)'; g.strokeStyle = 'rgba(110,140,175,.8)'; g.lineWidth = .3;
    const up = f === 0, wy = up ? -3.2 : -1.6, wr = up ? 3 : 2.2;
    [[-.8, -.6], [.6, .4]].forEach(o => { g.save(); g.translate(o[0], wy + 1); g.rotate(up ? o[0] * .5 - .15 + (o[0] > 0 ? .4 : -.3) : o[0] * .5 + (o[0] > 0 ? .9 : -.9)); g.beginPath(); g.ellipse(0, -.8, 1.35, wr, 0, 0, TAU); g.fill(); g.stroke(); g.restore(); });
    // body
    g.beginPath(); g.ellipse(0, 0, 3.7, 2.5, 0, 0, TAU); g.fillStyle = '#ffc531'; g.fill();
    g.save(); g.clip(); g.fillStyle = '#2f2112'; g.fillRect(-1.9, -3, 1.1, 6); g.fillRect(.4, -3, 1.1, 6); g.fillStyle = 'rgba(255,255,255,.38)'; g.fillRect(-3.8, -2.6, 7.6, 1); g.restore();
    g.beginPath(); g.ellipse(0, 0, 3.7, 2.5, 0, 0, TAU); g.strokeStyle = '#3a2a14'; g.lineWidth = .45; g.stroke();
    g.beginPath(); g.arc(3.5, -.2, 1.55, 0, TAU); g.fillStyle = '#3a2a14'; g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(4, -.7, .5, 0, TAU); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(4.15, -.7, .25, 0, TAU); g.fill();
    g.strokeStyle = '#3a2a14'; g.lineWidth = .3; g.beginPath(); g.moveTo(4.4, -1.4); g.lineTo(5.6, -2.6); g.stroke();
    g.beginPath(); g.moveTo(-3.6, 0); g.lineTo(-4.9, .3); g.stroke();
    return (beeCache[f] = cv);
  }
  A.actors.apiaryBee = (c, o, H) => {
    const f = Math.floor((o.t || 0) * 26 + (o.i || 0) * 3 + (o.k || 0) * 5) & 1, sp = beeSprite(f);
    const x = o.x, y = o.y, z = o.z || 0, ty = y - H.lift(z);
    c.fillStyle = 'rgba(25,15,0,.17)'; c.beginPath(); c.ellipse(x + 2, y + 1, 2.6, 1.1, 0, 0, TAU); c.fill();
    H.bbAt(c, x, ty, () => {
      c.save(); c.translate(x, ty + Math.sin((o.t || 0) * 11 + (o.i || 0) + (o.k || 0) * 2) * .5);
      if ((o.dir || 1) < 0) c.scale(-1, 1);
      c.rotate(-.1); c.drawImage(sp, -DW / 2, -DH * .62, DW, DH); c.restore();
    });
  };
})();
