/* Ranch & fields art: animal pens, cattle pasture, raised crop beds, pivot track (top-down 3D). See docs/ART-3D.md */
(function () {
  'use strict';
  const G = window.G; const A = G.WorldArt = G.WorldArt || {};
  A.structures = A.structures || {}; A.terrain = A.terrain || {}; A.actors = A.actors || {};
  const TAU = Math.PI * 2;
  let K = null;                                   // the helper kit, captured from whichever hook ran last
  const use = H => { K = H; return H; };
  const lift = z => K.lift(z);
  const seedOf = s => Math.floor(K.hash(s) * 1e9) + 1;

  // ------------------------------------------------------------------ small 3D wood pieces
  function post(c, x, y, big, snow) {
    const w = big ? 7 : 5, h = big ? 25 : 17, x0 = x - w / 2, y0 = y - w / 2;
    K.box(c, x0, y0, w, w, h, { top: big ? '#ecc486' : '#e0b277', front: big ? '#7a4820' : '#8e5a2b', stroke: 'rgba(45,22,5,.6)', lw: .7 });
    K.poly(c, [[x0 + .5, y0 + w, .5], [x0 + 1.7, y0 + w, .5], [x0 + 1.7, y0 + w, h - .5], [x0 + .5, y0 + w, h - .5]], 'rgba(255,228,175,.4)');
    K.poly(c, [[x0, y0 + w, 0], [x0 + w, y0 + w, 0], [x0 + w, y0 + w, 3], [x0, y0 + w, 3]], 'rgba(30,12,0,.3)');
    if (big) K.box(c, x0 - 1.3, y0 - 1.3, w + 2.6, w + 2.6, 2.4, { z0: h, top: '#f2d29a', front: '#6a3d1a', stroke: 'rgba(45,22,5,.6)', lw: .7 });
    if (snow) K.box(c, x0 - 1, y0 - 1, w + 2, w + 2, 2.4, { z0: h + (big ? 2.4 : 0), top: '#fff', front: '#d7e3ee' });
  }
  function railH(c, xa, xb, y, z, snow) {
    K.box(c, xa, y + 2.5, xb - xa, 2, 2.4, { z0: z, top: '#ebc48a', front: '#9b6431', stroke: 'rgba(45,22,5,.45)', lw: .6 });
    if (snow) K.poly(c, [[xa, y + 2.7, z + 2.4], [xb, y + 2.7, z + 2.4], [xb, y + 4.3, z + 2.4], [xa, y + 4.3, z + 2.4]], '#fff');
  }
  function railV(c, x, ya, yb, z, snow) {
    K.box(c, x - 1.2, ya, 2.4, yb - ya, 2.4, { z0: z, top: '#ebc48a', front: '#9b6431', stroke: 'rgba(45,22,5,.45)', lw: .6 });
    if (snow) K.poly(c, [[x - .8, ya, z + 2.4], [x + .8, ya, z + 2.4], [x + .8, yb, z + 2.4], [x - .8, yb, z + 2.4]], '#fff');
  }
  // o = { kind: 'h' | 'v', a, b, at, bigA, bigB, snow }
  function drawRun(c, o) {
    const n = Math.max(1, Math.round((o.b - o.a) / 36)), pts = []; for (let k = 0; k <= n; k++) pts.push(o.a + (o.b - o.a) * k / n);
    const bigAt = k => (k === 0 && o.bigA) || (k === n && o.bigB);
    if (o.kind === 'h') {
      pts.forEach((p, k) => post(c, p, o.at, bigAt(k), o.snow));
      for (let k = 0; k < n; k++) { railH(c, pts[k], pts[k + 1], o.at, 5.5, o.snow); railH(c, pts[k], pts[k + 1], o.at, 11.5, o.snow); }
    } else {
      pts.forEach((p, k) => { post(c, o.at, p, bigAt(k), o.snow); if (k < n) { railV(c, o.at, p, pts[k + 1], 5.5, o.snow); railV(c, o.at, p, pts[k + 1], 11.5, o.snow); } });
    }
  }
  function shadowRun(c, o) {
    if (o.kind === 'h') K.castShadow(c, o.a, o.at - 1.5, o.b - o.a, 3, 15, .17); else K.castShadow(c, o.at - 1.5, o.a, 3, o.b - o.a, 15, .17);
    [[o.a, o.bigA], [o.b, o.bigB]].forEach(e => { if (e[1]) { const x = o.kind === 'h' ? e[0] : o.at, y = o.kind === 'h' ? o.at : e[0]; K.castShadow(c, x - 3.5, y - 3.5, 7, 7, 25, .22); } });
  }
  function runProp(o) {
    const v = o.kind === 'v', x0 = (v ? o.at : o.a) - 12, x1 = (v ? o.at : o.b) + 12, ya = v ? o.a : o.at, yb = v ? o.b : o.at;
    return { sortY: (yb + 4) / K.T, x0, x1, y0: ya - lift(28) - 4, y1: yb + 8, hit: { x0: x0 + 6, x1: x1 - 6, y0: ya - lift(18), y1: yb + 4 }, body: c => drawRun(c, o) };
  }
  // chop a vertical run into chunks so characters sort correctly along it
  function chunksV(at, a, b, base) {
    const len = b - a, cnt = Math.max(1, Math.ceil(len / 74)), out = [];
    for (let i = 0; i < cnt; i++) out.push(Object.assign({}, base, { kind: 'v', at, a: a + len * i / cnt, b: a + len * (i + 1) / cnt, bigA: i === 0 && base.bigA, bigB: i === cnt - 1 && base.bigB }));
    return out;
  }
  const prop = (sortYpx, x0, y0, x1, y1, body, hit) => ({ sortY: sortYpx / K.T, x0, y0, x1, y1, hit, body });

  // ------------------------------------------------------------------ props: trough, bale, coop, shelter, hive
  function trough(c, P_, x, y, w, d, h, kind) {
    const metal = kind === 'metal';
    const wood = metal ? { top: '#b9c3ca', front: '#7f8d97', rim: '#d3dce2' } : { top: '#c18d52', front: '#7a4a22', rim: '#d8a566' };
    // legs
    [x + 4, x + w - 7].forEach(lx => K.box(c, lx, y + d - 3, 3, 3, 3, { top: '#5a3a1c', front: '#3e2810' }));
    K.box(c, x, y, w, d, h, { top: wood.rim, front: wood.front, stroke: 'rgba(30,20,10,.6)', lw: .8, z0: 2 });
    const z = h + 2, m = 2.6;
    // inside: back wall (darker, visible below the back rim) then water
    K.poly(c, [[x + m, y + m, z], [x + w - m, y + m, z], [x + w - m, y + d - m, z], [x + m, y + d - m, z]], metal ? '#55636d' : '#4f2f14');
    const wz = z - 1.2;
    if (P_.snow) {
      K.poly(c, [[x + m, y + m + 1.6, wz], [x + w - m, y + m + 1.6, wz], [x + w - m, y + d - m, wz], [x + m, y + d - m, wz]], '#dcecf6');
      c.strokeStyle = 'rgba(120,160,190,.8)'; c.lineWidth = .9; c.beginPath();
      const a = K.P3(x + w * .3, y + m + 2, wz), b = K.P3(x + w * .45, y + d - m, wz), e = K.P3(x + w * .62, y + m + 3, wz); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(e[0], e[1]); c.stroke();
    } else {
      K.poly(c, [[x + m, y + m + 1.6, wz], [x + w - m, y + m + 1.6, wz], [x + w - m, y + d - m, wz], [x + m, y + d - m, wz]], '#58b4e4');
      const p0 = K.P3(x + m + 3, y + d - m - 2.2, wz), p1 = K.P3(x + w * .5, y + d - m - 2.2, wz);
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = .8; const q = K.P3(x + w * .66, y + m + 4.5, wz); c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(q[0] + 8, q[1]); c.stroke();
    }
    if (P_.snow) { K.poly(c, [[x, y, z + .3], [x + w, y, z + .3], [x + w, y + 1.6, z + .3], [x, y + 1.6, z + .3]], '#fff'); }
    // rim highlight (front lip top face re-lit)
    K.poly(c, [[x, y + d - m, z], [x + w, y + d - m, z], [x + w, y + d, z], [x, y + d, z]], wood.rim, 'rgba(30,20,10,.45)', .6);
    if (metal) { // bands
      [x + w * .2, x + w * .8].forEach(bx => K.poly(c, [[bx - 1, y + d, 2], [bx + 1, y + d, 2], [bx + 1, y + d, z], [bx - 1, y + d, z]], 'rgba(40,50,60,.45)'));
    }
  }
  // round bale lying on its side, the round face towards the camera. (cx, y1) = south ground point; r = radius, L = length
  function bale(c, P_, cx, y1, r, L) {
    const ry = lift(r), fy = y1 - ry, sn = P_.snow;
    const lo = '#b68a2c', mid = '#dcb445', hi = '#f1d874';
    // contact shadow
    c.fillStyle = 'rgba(30,15,0,.28)'; c.beginPath(); c.ellipse(cx + 1, y1 - L * .5, r + 2, L * .5 + 2.5, 0, 0, TAU); c.fill();
    // body sweep (far cap, then the rectangle)
    const gr = c.createLinearGradient(cx - r, 0, cx + r, 0); gr.addColorStop(0, hi); gr.addColorStop(.35, mid); gr.addColorStop(1, lo);
    c.fillStyle = gr; c.beginPath(); c.ellipse(cx, fy - L, r, ry, 0, 0, TAU); c.fill();
    c.fillRect(cx - r, fy - L, 2 * r, L);
    c.strokeStyle = 'rgba(120,80,10,.4)'; c.lineWidth = .8; c.beginPath();
    for (let i = 0; i < 9; i++) { const sx = cx - r + 1.5 + i * (2 * r - 3) / 8, e = Math.sqrt(Math.max(0, 1 - Math.pow((sx - cx) / r, 2))) * ry; c.moveTo(sx, fy - L - e * .7); c.lineTo(sx, fy + e * .2); }
    c.stroke();
    c.strokeStyle = 'rgba(255,240,170,.45)'; c.beginPath(); for (let i = 0; i < 5; i++) { const sx = cx - r + 3 + i * (2 * r - 6) / 4; c.moveTo(sx + 1, fy - L * .8); c.lineTo(sx + 1, fy - L * .35); } c.stroke();
    // twine bands (visible top arcs)
    c.strokeStyle = 'rgba(90,60,10,.65)'; c.lineWidth = 1.4;
    [.28, .72].forEach(t => { c.beginPath(); c.ellipse(cx, fy - L * t, r, ry, 0, Math.PI, TAU); c.stroke(); });
    // round face
    const fg = c.createRadialGradient(cx - r * .3, fy - ry * .3, 1, cx, fy, r); fg.addColorStop(0, '#f4dc7e'); fg.addColorStop(.7, '#dcb445'); fg.addColorStop(1, '#bb902e');
    c.fillStyle = fg; c.beginPath(); c.ellipse(cx, fy, r, ry, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(110,70,10,.7)'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(cx, fy, r, ry, 0, 0, TAU); c.stroke();
    c.lineWidth = .9; c.strokeStyle = 'rgba(130,85,15,.55)';
    for (let k = 1; k <= 3; k++) { const f = k * .24; c.beginPath(); c.ellipse(cx + (k % 2 ? .6 : -.5), fy, r * (1 - f) * .98, ry * (1 - f) * .98, 0, k * .9, k * .9 + TAU * .82); c.stroke(); }
    c.strokeStyle = 'rgba(255,238,160,.55)'; c.beginPath(); c.ellipse(cx - 1, fy - .5, r * .52, ry * .52, 0, 3.4, 5.2); c.stroke();
    c.fillStyle = 'rgba(110,70,10,.6)'; c.beginPath(); c.ellipse(cx, fy, r * .1, ry * .1, 0, 0, TAU); c.fill();
    // twine across the face
    c.strokeStyle = 'rgba(90,60,10,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx - r * .96, fy - ry * .1); c.lineTo(cx + r * .96, fy - ry * .1); c.stroke();
    if (sn) { // snow on the upper surface
      c.fillStyle = 'rgba(255,255,255,.93)'; c.beginPath(); c.ellipse(cx, fy - L, r * .88, ry * .66, 0, Math.PI, TAU);
      c.lineTo(cx + r * .88, fy - ry * .55); c.quadraticCurveTo(cx, fy - ry * 1.12, cx - r * .88, fy - ry * .55); c.closePath(); c.fill();
    }
  }
  function ground3(c, x, y, w, d, h, a) { K.castShadow(c, x, y, w, d, h, a); }

  function coop(c, P_, g) {
    const x0 = g.x, x1 = g.x + g.w, xm = (x0 + x1) / 2, y0 = g.y, yb = g.y + g.d, base = 3, eave = base + 6, ridge = base + 26, hw = g.w / 2, ov = 3;
    K.box(c, x0 - 1.5, y0, g.w + 3, g.d + 1.5, base, { top: '#a3a29a', front: '#7b7a74', stroke: 'rgba(0,0,0,.35)', lw: .6 });
    // ramp
    const rx = xm, ry0 = yb + 1.5;
    K.poly(c, [[rx - 6, ry0, base], [rx + 6, ry0, base], [rx + 7, ry0 + 15, 0], [rx - 7, ry0 + 15, 0]], '#cfa064', 'rgba(70,40,10,.7)', .9);
    for (let i = 1; i < 5; i++) { const t = i / 5, yy = ry0 + 15 * t, zz = base * (1 - t), hwid = 6 + t; K.poly(c, [[rx - hwid, yy, zz], [rx + hwid, yy, zz]], null, 'rgba(70,40,10,.65)', 1); }
    K.poly(c, [[rx - 6, ry0, base], [rx - 7, ry0 + 15, 0]], null, 'rgba(255,230,180,.6)', 1);
    // gable face
    K.poly(c, [[x0, yb, base], [x1, yb, base], [x1, yb, eave], [xm, yb, ridge], [x0, yb, eave]], '#c93c2d', 'rgba(60,10,5,.6)', .8);
    c.save(); c.strokeStyle = 'rgba(70,12,6,.3)'; c.lineWidth = .9;
    for (let px = x0 + 5; px < x1 - 3; px += 5.5) { if (Math.abs(px - xm) < 7) continue; const zt = eave + (ridge - eave) * (1 - Math.abs(px - xm) / hw); K.poly(c, [[px, yb, base + .5], [px, yb, zt - 1]], null, c.strokeStyle, .9); }
    c.restore();
    // roof slopes
    const slope = (xa, xb, zA, zB, darker) => {
      const p = [[xa, yb + ov, zA], [xb, yb + ov, zB], [xb, y0 - 2, zB], [xa, y0 - 2, zA]];
      K.poly(c, p, darker ? '#9d2f27' : '#e2583f', 'rgba(70,15,8,.75)', .9);
      c.save(); c.strokeStyle = darker ? 'rgba(50,5,5,.28)' : 'rgba(80,10,5,.22)'; c.lineWidth = .9;
      for (let i = 1; i < 4; i++) { const t = i / 4, xx = xa + (xb - xa) * t, zz = zA + (zB - zA) * t; K.poly(c, [[xx, yb + ov, zz], [xx, y0 - 2, zz]], null, c.strokeStyle, .9); }
      c.restore();
      if (P_.snow) { const q = [[xa + (xa < xm ? 1.2 : 0), yb + ov - .5, zA + 1.8], [xb - (xb > xm ? 1.2 : 0), yb + ov - .5, zB + 1.8], [xb, y0 - 2, zB + .6], [xa, y0 - 2, zA + .6]]; K.poly(c, q, 'rgba(255,255,255,.95)'); }
    };
    slope(x0 - ov, xm, eave - 2, ridge + 1.2, false); slope(xm, x1 + ov, ridge + 1.2, eave - 2, true);
    K.poly(c, [[xm, yb + ov, ridge + 1.2], [xm, y0 - 2, ridge + 1.2]], null, '#f7dcb0', 1.8);
    K.poly(c, [[x0 - ov, yb + ov, eave - 2], [xm, yb + ov, ridge + 1.2], [x1 + ov, yb + ov, eave - 2]], null, '#f7e3bd', 1.5);
    // door + window drawn upright on the gable
    K.bbAt(c, xm, yb, () => {
      const Y = z => yb - z * K.HZ;
      c.fillStyle = '#2b170c'; c.beginPath(); c.moveTo(xm - 5, Y(base)); c.lineTo(xm - 5, Y(base + 8)); c.arc(xm, Y(base + 8), 5, Math.PI, 0); c.lineTo(xm + 5, Y(base)); c.closePath(); c.fill();
      c.strokeStyle = '#fbe9c8'; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = 'rgba(255,190,90,.35)'; c.fillRect(xm - 4, Y(base) - 2, 8, 2);
      c.fillStyle = '#ffe7a0'; c.beginPath(); c.arc(xm, Y(base + 17.5), 3.3, 0, TAU); c.fill(); c.strokeStyle = '#fbe9c8'; c.lineWidth = 1.3; c.stroke();
      c.strokeStyle = 'rgba(120,70,10,.7)'; c.lineWidth = .8; c.beginPath(); c.moveTo(xm - 3.3, Y(base + 17.5)); c.lineTo(xm + 3.3, Y(base + 17.5)); c.moveTo(xm, Y(base + 17.5) - 3.3); c.lineTo(xm, Y(base + 17.5) + 3.3); c.stroke();
    });
    K.light(xm, yb, base + 17, 46, 'rgba(255,205,110,.5)');
  }

  function shelter(c, P_, g) {
    const x0 = g.x, x1 = g.x + g.w, y0 = g.y, yb = g.y + g.d, zF = 22, zB = 15;
    // straw bed under the roof
    c.fillStyle = '#d6b04a'; K.rr(c, x0 + 2, y0 + 5, g.w - 4, g.d - 1, 4); c.fill();
    const r = K.mulberry(seedOf('shelter')); c.strokeStyle = '#a77f22'; c.lineWidth = .9; c.beginPath();
    for (let i = 0; i < 40; i++) { const sx = x0 + 4 + r() * (g.w - 8), sy = y0 + 8 + r() * (g.d - 6), a = r() * Math.PI; c.moveTo(sx, sy); c.lineTo(sx + Math.cos(a) * 4, sy + Math.sin(a) * 2); }
    c.stroke(); c.strokeStyle = '#f2d878'; c.beginPath();
    for (let i = 0; i < 30; i++) { const sx = x0 + 4 + r() * (g.w - 8), sy = y0 + 8 + r() * (g.d - 6), a = r() * Math.PI; c.moveTo(sx, sy); c.lineTo(sx + Math.cos(a) * 4, sy + Math.sin(a) * 2); }
    c.stroke();
    // dark interior under the roof lip
    const ig = c.createLinearGradient(0, K.P3(0, yb - 22, 0)[1], 0, yb); ig.addColorStop(0, 'rgba(25,12,0,.7)'); ig.addColorStop(1, 'rgba(25,12,0,0)');
    c.fillStyle = ig; c.fillRect(x0 + 2, yb - 22, g.w - 4, 22);
    // straw spilling out the front
    c.fillStyle = '#e1bc55'; c.beginPath(); c.ellipse((x0 + x1) / 2 + 4, yb + 2, 14, 4, 0, 0, TAU); c.fill();
    c.strokeStyle = '#b8902c'; c.lineWidth = .9; c.beginPath(); for (let i = 0; i < 10; i++) { const sx = (x0 + x1) / 2 - 8 + i * 3.4; c.moveTo(sx, yb + 3); c.lineTo(sx + 3, yb); } c.stroke();
    // side wall tops
    [x0, x1 - 3.5].forEach(wx => { K.poly(c, [[wx, y0, zB], [wx + 3.5, y0, zB], [wx + 3.5, yb, zF], [wx, yb, zF]], '#8b5a2c', 'rgba(40,20,5,.6)', .8); });
    // back wall (visible edge)
    // roof plane
    const ro = [[x0 - 5, y0 - 2, zB + 1.5], [x1 + 5, y0 - 2, zB + 1.5], [x1 + 5, yb + 5, zF + 1.5], [x0 - 5, yb + 5, zF + 1.5]];
    K.poly(c, ro, '#9a6b3d', 'rgba(50,25,5,.75)', .9);
    c.save(); c.strokeStyle = 'rgba(40,18,0,.3)'; c.lineWidth = .9;
    for (let i = 1; i < 8; i++) { const xx = x0 - 5 + (g.w + 10) * i / 8; K.poly(c, [[xx, y0 - 2, zB + 1.5], [xx, yb + 5, zF + 1.5]], null, c.strokeStyle, .9); }
    for (let i = 1; i < 3; i++) { const t = i / 3; K.poly(c, [[x0 - 5, lerp(y0 - 2, yb + 5, t), lerp(zB, zF, t) + 1.5], [x1 + 5, lerp(y0 - 2, yb + 5, t), lerp(zB, zF, t) + 1.5]], null, 'rgba(255,230,180,.18)', 1); }
    c.restore();
    if (P_.snow) K.poly(c, [[x0 - 4, y0 - 1.5, zB + 3], [x1 + 4, y0 - 1.5, zB + 3], [x1 + 4, yb + 3.2, zF + 3], [x0 - 4, yb + 3.2, zF + 3]], 'rgba(255,255,255,.96)');
    // fascia (front edge board)
    K.poly(c, [[x0 - 5, yb + 5, zF + 1.5], [x1 + 5, yb + 5, zF + 1.5], [x1 + 5, yb + 5, zF - 1], [x0 - 5, yb + 5, zF - 1]], '#6d4420', 'rgba(40,20,5,.7)', .8);
    // front posts
    [x0 + 1, x1 - 5].forEach(px => { K.box(c, px, yb, 4, 4, zF - 1, { top: '#d9a76c', front: '#7a4a22', stroke: 'rgba(45,22,5,.6)', lw: .7 }); });
  }

  function hive(c, P_, cx, y1) {
    const w = 18, d = 14, x0 = cx - w / 2, y0 = y1 - d, bh = 6.5;
    // legs / stand
    K.box(c, x0 - 1, y0 + 1, w + 2, d - 1, 3, { top: '#a88252', front: '#6c4a22', stroke: 'rgba(40,20,5,.6)', lw: .6 });
    // landing board
    K.box(c, cx - 5, y1, 10, 3.5, 1, { z0: 2, top: '#d7b782', front: '#8a6334' });
    for (let k = 0; k < 3; k++) {
      const z0 = 3 + k * bh;
      K.box(c, x0, y0, w, d, bh, { z0, top: '#fbf8ee', front: k === 1 ? '#f1ecd9' : '#f4efe0', stroke: 'rgba(80,70,50,.55)', lw: .7 });
      K.poly(c, [[x0 + .5, y1, z0 + .5], [x0 + 1.8, y1, z0 + .5], [x0 + 1.8, y1, z0 + bh - .5], [x0 + .5, y1, z0 + bh - .5]], 'rgba(255,255,255,.7)');
      K.poly(c, [[x0, y1, z0], [x0 + w, y1, z0], [x0 + w, y1, z0 + 1.3], [x0, y1, z0 + 1.3]], 'rgba(120,110,80,.28)');
      K.poly(c, [[cx - 3.2, y1, z0 + bh * .55], [cx + 3.2, y1, z0 + bh * .55], [cx + 3.2, y1, z0 + bh * .55 + 1.5], [cx - 3.2, y1, z0 + bh * .55 + 1.5]], 'rgba(90,80,55,.55)');
    }
    // gold band around the middle box
    const zb = 3 + bh + bh * .28; K.poly(c, [[x0, y1, zb], [x0 + w, y1, zb], [x0 + w, y1, zb + 2.6], [x0, y1, zb + 2.6]], '#f4b82e', 'rgba(150,95,0,.6)', .6);
    K.poly(c, [[x0 + .5, y1, zb + .4], [x0 + 3, y1, zb + .4], [x0 + 3, y1, zb + 1.2], [x0 + .5, y1, zb + 1.2]], 'rgba(255,240,170,.8)');
    // entrance slot
    K.poly(c, [[cx - 4, y1, 3], [cx + 4, y1, 3], [cx + 4, y1, 4.4], [cx - 4, y1, 4.4]], '#2a1a0a');
    // roof
    const zr = 3 + 3 * bh;
    K.box(c, x0 - 2, y0 - 1.5, w + 4, d + 3, 2.6, { z0: zr, top: '#cfd5d9', front: '#8e979e', stroke: 'rgba(50,60,70,.6)', lw: .7 });
    K.poly(c, [[x0 - 1, y0 - .5, zr + 2.6], [x0 - 1 + 4, y0 - .5, zr + 2.6], [x0 + 3, y1 + 1, zr + 2.6], [x0 - 1, y1 + 1, zr + 2.6]], 'rgba(255,255,255,.4)');
    if (P_.snow) K.box(c, x0 - 2.5, y0 - 2, w + 5, d + 4, 2.2, { z0: zr + 2.6, top: '#fff', front: '#dbe6f0' });
  }

  // ------------------------------------------------------------------ pen geometry
  function penGeom(ctx) {
    const { x: X, y: Y } = ctx.rect, T = K.T, g = ctx.pen.gate, top = g.side === 't';
    const fx0 = X + 20, fx1 = X + 220, fy0 = Y + 20, fy1 = Y + 140, ga = g.x * T, gb = ga + 2 * T;
    return { X, Y, fx0, fx1, fy0, fy1, ga, gb, top };
  }
  function penRuns(ctx, snow) {
    const q = penGeom(ctx), mk = (kind, a, b, at, bigA, bigB) => ({ kind, a, b, at, bigA: !!bigA, bigB: !!bigB, snow });
    const back = q.top ? [mk('h', q.fx0, q.ga, q.fy0, 0, 1), mk('h', q.gb, q.fx1, q.fy0, 1, 0)] : [mk('h', q.fx0, q.fx1, q.fy0)];
    const front = !q.top ? [mk('h', q.fx0, q.ga, q.fy1, 0, 1), mk('h', q.gb, q.fx1, q.fy1, 1, 0)] : [mk('h', q.fx0, q.fx1, q.fy1)];
    const left = chunksV(q.fx0, q.fy0, q.fy1, { snow }), right = chunksV(q.fx1, q.fy0, q.fy1, { snow });
    return { back, front, left, right, q };
  }
  const SPOT = {
    chickens: q => ({ coop: { x: q.X + 148, y: q.Y + 26, w: 58, d: 30 } }),
    cows: q => ({ trough: { x: q.X + 34, y: q.Y + 30, w: 60, d: 15, h: 9 }, bale: { cx: q.X + 178, y1: q.Y + 60, r: 10, L: 16 } }),
    sheep: q => ({ shelter: { x: q.X + 168, y: q.Y + 26, w: 50, d: 30 }, rack: { x: q.X + 38, y: q.Y + 32, w: 38, d: 12 } }),
    bees: q => ({ hives: [[q.X + 54, q.Y + 54], [q.X + 112, q.Y + 46], [q.X + 168, q.Y + 56]] })
  };
  function rack(c, P_, g) { // sheep hay rack
    [g.x + 2, g.x + g.w - 5].forEach(lx => K.box(c, lx, g.y + g.d - 3, 3, 3, 8, { top: '#a97a42', front: '#5f3c1a' }));
    K.box(c, g.x, g.y, g.w, g.d, 6, { top: '#c99a5c', front: '#7a4a22', stroke: 'rgba(40,20,5,.6)', lw: .7, z0: 3 });
    K.poly(c, [[g.x + 2, g.y + 2, 9], [g.x + g.w - 2, g.y + 2, 9], [g.x + g.w - 2, g.y + g.d - 2, 9], [g.x + 2, g.y + g.d - 2, 9]], '#e3c05a');
    c.strokeStyle = '#b48a28'; c.lineWidth = .9; c.beginPath(); for (let i = 0; i < 14; i++) { const p = K.P3(g.x + 3 + i * (g.w - 6) / 13, g.y + 3 + (i % 3) * 2.6, 9); c.moveTo(p[0], p[1]); c.lineTo(p[0] + 2, p[1] - 2.2); } c.stroke();
    if (P_.snow) K.poly(c, [[g.x, g.y, 9.4], [g.x + g.w, g.y, 9.4], [g.x + g.w, g.y + 2, 9.4], [g.x, g.y + 2, 9.4]], '#fff');
  }

  // ------------------------------------------------------------------ pen floor
  function blob(c, x, y, rx, ry, col, a) { c.globalAlpha = a; c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); c.globalAlpha = 1; }
  function penFloor(c, ctx) {
    const { P_, pen } = ctx, type = pen.type, q = penGeom(ctx), r = K.mulberry(seedOf('pen' + type)), snow = !!P_.snow, X = q.X, Y = q.Y;
    const fx = X + 10, fy = Y + 10, fw = 220, fh = 140;
    const grass = type === 'sheep' || type === 'bees';
    const base = grass ? (type === 'bees' ? P_.g2 : P_.pasture) : (snow ? '#dccfb8' : '#c9a96e');
    c.fillStyle = 'rgba(40,25,5,.14)'; K.rr(c, fx - 3, fy - 2, fw + 6, fh + 6, 18); c.fill();
    c.fillStyle = base; K.rr(c, fx, fy, fw, fh, 16); c.fill();
    c.save(); K.rr(c, fx, fy, fw, fh, 16); c.clip();
    if (!grass) {
      for (let i = 0; i < 16; i++) blob(c, fx + r() * fw, fy + r() * fh, 14 + r() * 24, 6 + r() * 10, snow ? '#c4b496' : '#b1894c', .32);
      for (let i = 0; i < 14; i++) blob(c, fx + r() * fw, fy + r() * fh, 12 + r() * 20, 5 + r() * 8, snow ? '#efe6d4' : '#e3c991', .38);
      c.fillStyle = 'rgba(90,60,20,.4)'; for (let i = 0; i < 46; i++) { c.beginPath(); c.arc(fx + r() * fw, fy + r() * fh, .8 + r() * 1.3, 0, TAU); c.fill(); }
      c.fillStyle = 'rgba(255,245,215,.55)'; for (let i = 0; i < 30; i++) { c.beginPath(); c.arc(fx + r() * fw, fy + r() * fh, .7 + r() * 1.1, 0, TAU); c.fill(); }
      if (type === 'chickens') {
        c.strokeStyle = '#e1bc55'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 70; i++) { const sx = fx + 14 + r() * (fw - 28), sy = fy + 12 + r() * (fh - 24), a = r() * 3; c.moveTo(sx, sy); c.lineTo(sx + Math.cos(a) * 3.5, sy + Math.sin(a) * 1.8); } c.stroke();
        c.strokeStyle = 'rgba(80,50,15,.4)'; c.lineWidth = .9; c.beginPath(); for (let i = 0; i < 26; i++) { const sx = fx + 14 + r() * (fw - 28), sy = fy + 12 + r() * (fh - 24); c.moveTo(sx, sy); c.lineTo(sx, sy + 3); c.moveTo(sx, sy); c.lineTo(sx - 2, sy + 2); c.moveTo(sx, sy); c.lineTo(sx + 2, sy + 2); } c.stroke();
      } else {
        blob(c, X + 70, Y + 104, 30, 11, 'rgba(70,45,15,1)', .3); blob(c, X + 70, Y + 103, 22, 7, 'rgba(110,80,40,1)', .25);
        c.fillStyle = 'rgba(70,45,15,.38)'; for (let i = 0; i < 24; i++) { const sx = fx + 16 + r() * (fw - 32), sy = fy + 14 + r() * (fh - 28); c.beginPath(); c.ellipse(sx - 1.6, sy, 1.2, 1.7, 0, 0, TAU); c.ellipse(sx + 1.6, sy, 1.2, 1.7, 0, 0, TAU); c.fill(); }
      }
    } else {
      for (let i = 0; i < 14; i++) blob(c, fx + r() * fw, fy + r() * fh, 16 + r() * 26, 7 + r() * 11, P_.g1, .45);
      for (let i = 0; i < 10; i++) blob(c, fx + r() * fw, fy + r() * fh, 12 + r() * 22, 5 + r() * 8, P_.tuft, .22);
      c.strokeStyle = snow ? '#b7c9d8' : P_.tuft; c.lineWidth = 1.3; c.lineCap = 'round'; c.beginPath();
      for (let i = 0; i < 180; i++) { const x = fx + 8 + r() * (fw - 16), y = fy + 8 + r() * (fh - 16); c.moveTo(x, y); c.lineTo(x - 2, y - 4.5); c.moveTo(x, y); c.lineTo(x + .5, y - 5.5); c.moveTo(x, y); c.lineTo(x + 2.5, y - 4); } c.stroke();
      if (type === 'sheep') { blob(c, X + 110, Y + 108, 34, 10, 'rgba(100,70,30,1)', .22); }
      if (type === 'bees' && !snow) {
        const cols = ['#ffffff', '#ffd84a', '#ff8fbf', '#c9a8ff', '#ff9a52', '#7ec8ff'];
        for (let i = 0; i < 70; i++) {
          const x = fx + 10 + r() * (fw - 20), y = fy + 12 + r() * (fh - 22), col = cols[i % cols.length];
          c.strokeStyle = '#4b8a35'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 4); c.stroke();
          c.fillStyle = col; c.beginPath(); c.arc(x, y - 5, 2.1, 0, TAU); c.fill(); c.fillStyle = '#e8a417'; c.beginPath(); c.arc(x, y - 5, .8, 0, TAU); c.fill();
        }
      }
    }
    // darker rim where fences meet the ground
    c.strokeStyle = 'rgba(50,30,5,.16)'; c.lineWidth = 12; K.rr(c, fx, fy, fw, fh, 16); c.stroke();
    c.strokeStyle = 'rgba(50,30,5,.14)'; c.lineWidth = 5; K.rr(c, fx + 5, fy + 5, fw - 10, fh - 10, 12); c.stroke();
    if (snow) {
      for (let i = 0; i < 14; i++) blob(c, fx + r() * fw, fy + r() * fh, 14 + r() * 28, 5 + r() * 10, '#ffffff', grass ? .6 : .88);
      for (let i = 0; i < 10; i++) blob(c, fx + r() * fw, fy + 3 + r() * fh, 10 + r() * 18, 2 + r() * 3, '#b9cde0', .35);
    }
    c.restore();
    // grass fringe around the outside
    c.strokeStyle = snow ? '#b4c6d6' : P_.tuft; c.lineWidth = 1.5; c.lineCap = 'round'; c.beginPath();
    for (let i = 0; i < 70; i++) {
      const s = r(), t = r(); let x, y;
      if (s < .4) { x = fx + 6 + t * (fw - 12); y = fy - 3; } else if (s < .8) { x = fx + 6 + t * (fw - 12); y = fy + fh + 4; } else if (s < .9) { x = fx - 4; y = fy + 6 + t * (fh - 12); } else { x = fx + fw + 4; y = fy + 6 + t * (fh - 12); }
      c.moveTo(x, y); c.lineTo(x - 2, y - 5); c.moveTo(x, y); c.lineTo(x + 1, y - 6); c.moveTo(x, y); c.lineTo(x + 3, y - 4);
    }
    c.stroke();
    // worn apron at the gate
    const gy = q.top ? Y + 18 : Y + 142;
    blob(c, (q.ga + q.gb) / 2, gy + (q.top ? -7 : 7), 44, 11, snow ? '#d8cbb2' : '#b8975c', snow ? .55 : .6);
    blob(c, (q.ga + q.gb) / 2, gy + (q.top ? -6 : 6), 30, 7, snow ? '#ece2cf' : '#d5b77c', .5);
  }

  // ------------------------------------------------------------------ structures.pen
  A.structures.pen = {
    ground(c, ctx, H) {
      use(H); const { P_, pen, def } = ctx, q = penGeom(ctx), X = q.X, Y = q.Y, name = String(def.name || pen.type).toUpperCase();
      if (!pen.owned) {
        c.save(); c.globalAlpha = .6; c.setLineDash([8, 6]); c.lineWidth = 2; c.lineCap = 'round'; c.strokeStyle = '#fff'; H.rr(c, X + 18, Y + 18, 204, 124, 12); c.stroke(); c.setLineDash([]);
        c.fillStyle = 'rgba(255,255,255,.14)'; H.rr(c, X + 18, Y + 18, 204, 124, 12); c.fill(); c.restore();
        H.emStatic(c, def.emoji || '🐾', X + 120, Y + 66, 34, .42);
        H.plate(c, X + 120, Y + 100, name + ' PEN · FOR SALE', { size: 8.5, bg: '#fff4d6' });
        return;
      }
      penFloor(c, ctx);
      const runs = penRuns(ctx, false);
      ['back', 'front', 'left', 'right'].forEach(k => runs[k].forEach(o => shadowRun(c, o)));
      const sp = SPOT[pen.type] ? SPOT[pen.type](q) : {};
      if (sp.coop) { const g = sp.coop; c.fillStyle = 'rgba(30,15,0,.3)'; H.rr(c, g.x - 2, g.y + g.d - 6, g.w + 4, 10, 4); c.fill(); ground3(c, g.x, g.y, g.w, g.d, 17, .24); }
      if (sp.trough) { const g = sp.trough; ground3(c, g.x, g.y, g.w, g.d, g.h + 2, .24); }
      if (sp.bale) { const b = sp.bale; ground3(c, b.cx - b.r, b.y1 - b.L, b.r * 2, b.L, b.r * 1.7, .2); }
      if (sp.shelter) { const g = sp.shelter; ground3(c, g.x - 4, g.y, g.w + 8, g.d + 5, 20, .26); }
      if (sp.rack) { const g = sp.rack; ground3(c, g.x, g.y, g.w, g.d, 9, .2); }
      if (sp.hives) sp.hives.forEach(h => ground3(c, h[0] - 10, h[1] - 14, 20, 14, 24, .22));
      H.plate(c, X + 120, Y + 164, name + (/s$|sheep/i.test(name) ? '' : 'S'), { size: 8.5 });
    },
    props(ctx, H) {
      use(H); const { P_, pen } = ctx, q = penGeom(ctx), out = [], T = H.T, X = q.X, Y = q.Y;
      if (!pen.owned) {
        [[X + 22, Y + 22], [X + 218, Y + 22], [X + 22, Y + 138], [X + 218, Y + 138]].forEach(p => {
          out.push(prop(p[1] + 3, p[0] - 8, p[1] - lift(20), p[0] + 8, p[1] + 6, c => {
            K.box(c, p[0] - 1.6, p[1] - 1.6, 3.2, 3.2, 14, { top: '#e8c690', front: '#8a5a2b', stroke: 'rgba(45,22,5,.6)', lw: .6 });
            K.poly(c, [[p[0] + 1.6, p[1], 14], [p[0] + 8, p[1] + .5, 12], [p[0] + 7, p[1] + .5, 9], [p[0] + 1.6, p[1], 10]], '#e84b3c', 'rgba(90,10,5,.5)', .5);
          }));
        });
        return out;
      }
      const runs = penRuns(ctx, !!P_.snow);
      runs.back.forEach(o => out.push(runProp(o)));
      runs.left.concat(runs.right).forEach(o => out.push(runProp(o)));
      runs.front.forEach(o => out.push(runProp(o)));
      const sp = SPOT[pen.type] ? SPOT[pen.type](q) : {};
      if (sp.coop) { const g = sp.coop; out.push(prop(g.y + g.d + 16, g.x - 8, g.y - lift(36), g.x + g.w + 8, g.y + g.d + 20, c => coop(c, P_, g))); }
      if (sp.trough) { const g = sp.trough; out.push(prop(g.y + g.d + 2, g.x - 4, g.y - lift(14), g.x + g.w + 4, g.y + g.d + 8, c => trough(c, P_, g.x, g.y, g.w, g.d, g.h, 'wood'))); }
      if (sp.bale) { const b = sp.bale; out.push(prop(b.y1 + 1, b.cx - b.r - 4, b.y1 - lift(b.r * 2) - b.L - 6, b.cx + b.r + 4, b.y1 + 5, c => bale(c, P_, b.cx, b.y1, b.r, b.L))); }
      if (sp.shelter) { const g = sp.shelter; out.push(prop(g.y + g.d + 5, g.x - 10, g.y - lift(30), g.x + g.w + 10, g.y + g.d + 10, c => shelter(c, P_, g))); }
      if (sp.rack) { const g = sp.rack; out.push(prop(g.y + g.d + 1, g.x - 3, g.y - lift(14), g.x + g.w + 3, g.y + g.d + 5, c => rack(c, P_, g))); }
      if (sp.hives) sp.hives.forEach(h => out.push(prop(h[1] + 4, h[0] - 14, h[1] - 14 - lift(32), h[0] + 14, h[1] + 8, c => hive(c, P_, h[0], h[1]))));
      return out;
    }
  };

  // ------------------------------------------------------------------ structures.pasture
  A.structures.pasture = {
    ground(c, ctx, H) {
      use(H); const { P_ } = ctx, z = H.Z.pasture, T = H.T, X = z.x * T, Y = z.y * T, w = z.w * T, h = z.h * T, snow = !!P_.snow, r = H.mulberry(91);
      const gy1 = ctx.gate.y * T, gy2 = (ctx.gate.y + ctx.gate.h) * T;
      c.fillStyle = 'rgba(40,25,5,.12)'; H.rr(c, X + 8, Y + 10, w - 16, h - 16, 24); c.fill();
      c.fillStyle = P_.pasture; H.rr(c, X + 12, Y + 12, w - 24, h - 24, 22); c.fill();
      c.save(); H.rr(c, X + 12, Y + 12, w - 24, h - 24, 22); c.clip();
      for (let i = 0; i < 22; i++) blob(c, X + r() * w, Y + r() * h, 24 + r() * 44, 12 + r() * 20, P_.g1, .4);
      for (let i = 0; i < 16; i++) blob(c, X + r() * w, Y + r() * h, 20 + r() * 40, 10 + r() * 16, P_.tuft, .18);
      c.strokeStyle = snow ? '#b7c9d8' : P_.tuft; c.lineWidth = 1.4; c.lineCap = 'round'; c.beginPath();
      for (let i = 0; i < 380; i++) { const x = X + 20 + r() * (w - 40), y = Y + 20 + r() * (h - 40); c.moveTo(x, y); c.lineTo(x - 2, y - 5); c.moveTo(x, y); c.lineTo(x + .5, y - 6); c.moveTo(x, y); c.lineTo(x + 2.5, y - 4.5); } c.stroke();
      if (P_.flower) { const cols = ['#fff', '#ffe36a', '#ff9ec7', '#c9a8ff']; for (let i = 0; i < 70; i++) { c.fillStyle = cols[i % 4]; c.beginPath(); c.arc(X + 20 + r() * (w - 40), Y + 20 + r() * (h - 40), 1.6 + r() * .6, 0, TAU); c.fill(); } }
      // mud patches
      const mud = (mx, my, rx, ry) => {
        blob(c, mx, my, rx + 5, ry + 3, snow ? '#9a8668' : '#6d4a25', .3); blob(c, mx, my, rx, ry, snow ? '#8a7558' : '#6a4622', .6); blob(c, mx - 2, my - 1, rx * .62, ry * .55, snow ? '#a38c6c' : '#7f5830', .6);
        blob(c, mx - rx * .25, my - ry * .3, rx * .26, ry * .2, 'rgba(255,255,255,.28)', 1);
      };
      mud(X + 205, Y + 340, 42, 14); mud(X + 62, Y + 205, 28, 11); mud(X + 130, Y + 190, 34, 12); mud(X + 22, (gy1 + gy2) / 2, 28, 24); mud(X + 240, Y + 150, 20, 8);
      // hoof dimples round the mud
      c.fillStyle = 'rgba(60,35,10,.4)'; for (let i = 0; i < 40; i++) { const x = X + 40 + r() * (w - 80), y = Y + 60 + r() * (h - 110); c.beginPath(); c.ellipse(x - 1.4, y, 1.1, 1.6, 0, 0, TAU); c.ellipse(x + 1.4, y, 1.1, 1.6, 0, 0, TAU); c.fill(); }
      // worn trail from the gate
      blob(c, X + 70, (gy1 + gy2) / 2, 60, 14, '#8a6a3c', snow ? .25 : .35);
      c.strokeStyle = 'rgba(50,30,5,.15)'; c.lineWidth = 12; H.rr(c, X + 12, Y + 12, w - 24, h - 24, 22); c.stroke();
      c.strokeStyle = 'rgba(50,30,5,.12)'; c.lineWidth = 5; H.rr(c, X + 17, Y + 17, w - 34, h - 34, 18); c.stroke();
      if (snow) {
        for (let i = 0; i < 26; i++) blob(c, X + r() * w, Y + r() * h, 16 + r() * 36, 6 + r() * 12, '#ffffff', .62);
        for (let i = 0; i < 16; i++) blob(c, X + r() * w, Y + 3 + r() * h, 12 + r() * 22, 2 + r() * 3, '#b9cde0', .3);
      }
      c.restore();
      c.strokeStyle = snow ? '#b4c6d6' : P_.tuft; c.lineWidth = 1.5; c.beginPath();
      for (let i = 0; i < 130; i++) {
        const s = r(), t = r(); let x, y;
        if (s < .3) { x = X + 10 + t * (w - 20); y = Y + 8; } else if (s < .6) { x = X + 10 + t * (w - 20); y = Y + h - 6; } else if (s < .8) { x = X + 6; y = Y + 10 + t * (h - 20); } else { x = X + w - 6; y = Y + 10 + t * (h - 20); }
        c.moveTo(x, y); c.lineTo(x - 2, y - 5); c.moveTo(x, y); c.lineTo(x + 1, y - 6); c.moveTo(x, y); c.lineTo(x + 3, y - 4);
      }
      c.stroke();
      // fence shadows + prop shadows
      pastureRuns(ctx).forEach(o => shadowRun(c, o));
      const sp = pastureSpots(z, T);
      sp.bales.forEach(b => ground3(c, b.cx - b.r, b.y1 - b.L, b.r * 2, b.L, b.r * 1.7, .22));
      ground3(c, sp.trough.x, sp.trough.y, sp.trough.w, sp.trough.d, sp.trough.h + 2, .24);
      c.fillStyle = 'rgba(25,15,0,.2)'; c.beginPath(); c.ellipse(sp.tree.x + 26, sp.tree.y + 8, 40, 14, 0, 0, TAU); c.fill();
      H.plate(c, X + w / 2, Y + h + 2, 'CATTLE PASTURE', { size: 9 });
    },
    props(ctx, H) {
      use(H); const { P_ } = ctx, z = H.Z.pasture, T = H.T, out = [], sp = pastureSpots(z, T);
      pastureRuns(ctx, !!P_.snow).forEach(o => out.push(runProp(o)));
      sp.bales.forEach(b => out.push(prop(b.y1 + 1, b.cx - b.r - 4, b.y1 - lift(b.r * 2) - b.L - 6, b.cx + b.r + 4, b.y1 + 5, c => bale(c, P_, b.cx, b.y1, b.r, b.L))));
      const g = sp.trough; out.push(prop(g.y + g.d + 2, g.x - 4, g.y - lift(16), g.x + g.w + 4, g.y + g.d + 8, c => trough(c, P_, g.x, g.y, g.w, g.d, g.h, 'metal')));
      const t = sp.tree; out.push(prop(t.y + 2, t.x - 56, t.y - 110, t.x + 56, t.y + 8, c => H.tree(c, t.x, t.y, 1.25, 0, P_, 555)));
      return out;
    }
  };
  function pastureSpots(z, T) {
    const X = z.x * T, Y = z.y * T;
    return { bales: [{ cx: X + 52, y1: Y + 66, r: 11, L: 18 }, { cx: X + 88, y1: Y + 78, r: 11, L: 18 }, { cx: X + 52, y1: Y + 366, r: 11, L: 18 }], trough: { x: X + 214, y: Y + 316, w: 66, d: 16, h: 10 }, tree: { x: X + 262, y: Y + 100 } };
  }
  function pastureRuns(ctx, snow) {
    const z = K.Z.pasture, T = K.T, X = z.x * T, Y = z.y * T, w = z.w * T, h = z.h * T, g1 = ctx.gate.y * T, g2 = (ctx.gate.y + ctx.gate.h) * T;
    const x0 = X + 20, x1 = X + w - 20, y0 = Y + 20, y1 = Y + h - 20, mk = (kind, a, b, at, bigA, bigB) => ({ kind, a, b, at, bigA: !!bigA, bigB: !!bigB, snow });
    return [mk('h', x0, x1, y0), mk('h', x0, x1, y1)].concat(chunksV(x1, y0, y1, { snow }), chunksV(x0, y0, g1, { snow, bigB: true }), chunksV(x0, g2, y1, { snow, bigA: true }));
  }
  const lerp = (a, b, t) => a + (b - a) * t;

  // ------------------------------------------------------------------ terrain.plots (raised soil beds)
  const BED = { dx: 4, dy: 8, w: 72, d: 64, h: 9 };
  A.terrain.plots = function (c, P_, H) {
    use(H); const s = H.S(), T = H.T, snow = !!P_.snow, lt = H.lift(BED.h);
    for (let i = 0; i < s.plots.length; i++) { const q = H.plotRect(i); H.castShadow(c, q.x * T + BED.dx, q.y * T + BED.dy, BED.w, BED.d, BED.h, .24); }
    for (let i = 0; i < s.plots.length; i++) drawBed(c, P_, H, H.plotRect(i), i, snow, lt);
    if (s.plots.length < s.maxPlots) buySlot(c, P_, H, H.plotRect(s.plots.length));
    if (s.plots.length) H.plate(c, 8 * T, 8.45 * T, 'YOUR FIELDS', { size: 8.5 });
  };
  function drawBed(c, P_, H, q, i, snow, lt) {
    const T = H.T, x0 = q.x * T + BED.dx, y0 = q.y * T + BED.dy, w = BED.w, d = BED.d, r = H.mulberry(300 + i);
    // front face (earth wall) with rounded bottom corners
    c.save(); H.rr(c, x0, y0 - lt + 8, w, d + lt - 8, 7); c.clip();
    const fg = c.createLinearGradient(0, y0 + d - lt, 0, y0 + d); fg.addColorStop(0, P_.soil); fg.addColorStop(.45, P_.soilD); fg.addColorStop(1, '#2d180a');
    c.fillStyle = fg; c.fillRect(x0, y0 + d - lt - 2, w, lt + 4);
    c.fillStyle = 'rgba(0,0,0,.2)'; for (let k = 0; k < 14; k++) { const px = x0 + 4 + r() * (w - 8), py = y0 + d - lt * .7 + r() * lt * .6; c.beginPath(); c.ellipse(px, py, 1.2 + r() * 1.6, .8 + r(), 0, 0, TAU); c.fill(); }
    c.fillStyle = 'rgba(255,220,170,.22)'; for (let k = 0; k < 10; k++) { const px = x0 + 4 + r() * (w - 8), py = y0 + d - lt * .8 + r() * lt * .5; c.beginPath(); c.arc(px, py, .8 + r() * .9, 0, TAU); c.fill(); }
    c.strokeStyle = 'rgba(30,12,0,.35)'; c.lineWidth = .9; c.beginPath(); for (let k = 0; k < 8; k++) { const px = x0 + 6 + r() * (w - 12); c.moveTo(px, y0 + d - lt + 1); c.lineTo(px + r() * 3 - 1.5, y0 + d - lt * .4 + r() * 3); } c.stroke();
    c.fillStyle = 'rgba(255,225,180,.18)'; c.fillRect(x0, y0 + d - lt, 2.6, lt);    // lit left edge
    c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x0 + w - 3, y0 + d - lt, 3, lt);     // shaded right edge
    c.restore();
    if (snow) { c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.moveTo(x0 + 1, y0 + d - lt - 1); for (let k = 0; k <= 12; k++) { const px = x0 + 1 + (w - 2) * k / 12; c.lineTo(px, y0 + d - lt + 2.4 + (k % 2 ? 2.4 : .4) + r() * 1.4); } c.lineTo(x0 + w - 1, y0 + d - lt - 1); c.closePath(); c.fill(); }
    // top face: lit lip, then soil
    const ty = y0 - lt;
    c.fillStyle = snow ? '#f4f8fb' : P_.soilL; H.rr(c, x0, ty, w, d, 8); c.fill();
    c.strokeStyle = 'rgba(40,20,0,.45)'; c.lineWidth = 1; H.rr(c, x0, ty, w, d, 8); c.stroke();
    const tg = c.createLinearGradient(0, ty, 0, ty + d); tg.addColorStop(0, P_.soilL); tg.addColorStop(1, P_.soil);
    c.fillStyle = tg; H.rr(c, x0 + 3, ty + 3, w - 6, d - 6, 6); c.fill();
    c.save(); H.rr(c, x0 + 3, ty + 3, w - 6, d - 6, 6); c.clip();
    c.fillStyle = 'rgba(0,0,0,.16)'; H.rr(c, x0 + 3, ty + 3, w - 6, 3, 2); c.fill();                       // back inner shade
    c.fillStyle = 'rgba(255,225,170,.12)'; c.fillRect(x0 + 3, ty + d - 8, w - 6, 5);
    for (let k = 0; k < 4; k++) {
      const yy = ty + 11 + 14 * k;
      c.fillStyle = 'rgba(30,12,0,.34)'; c.fillRect(x0 + 6, yy + 4, w - 12, 3.4);
      c.fillStyle = 'rgba(255,222,165,.26)'; c.fillRect(x0 + 6, yy + 1, w - 12, 2.4);
    }
    c.fillStyle = 'rgba(30,12,0,.3)'; for (let k = 0; k < 16; k++) { c.beginPath(); c.arc(x0 + 8 + r() * (w - 16), ty + 8 + r() * (d - 16), .7 + r() * 1.1, 0, TAU); c.fill(); }
    if (snow) {
      c.fillStyle = 'rgba(255,255,255,.92)'; c.fillRect(x0 + 3, ty + 3, w - 6, d - 6);
      for (let k = 0; k < 4; k++) { const yy = ty + 11 + 14 * k; c.fillStyle = 'rgba(150,175,200,.55)'; c.fillRect(x0 + 6, yy + 4, w - 12, 2.4); c.fillStyle = 'rgba(255,255,255,1)'; c.fillRect(x0 + 6, yy + 1, w - 12, 2); }
    }
    c.restore();
  }
  function buySlot(c, P_, H, q) {
    const T = H.T, x0 = q.x * T + BED.dx, y0 = q.y * T + BED.dy, w = BED.w, d = BED.d, cx = x0 + w / 2, cy = y0 + d / 2;
    c.fillStyle = 'rgba(255,240,180,.26)'; H.rr(c, x0, y0, w, d, 8); c.fill();
    c.setLineDash([7, 6]); c.lineWidth = 2.5; c.lineCap = 'round'; c.strokeStyle = '#fff4c0'; H.rr(c, x0, y0, w, d, 8); c.stroke(); c.setLineDash([]);
    // corner stakes
    [[x0 + 2, y0 + 2], [x0 + w - 2, y0 + 2], [x0 + 2, y0 + d - 2], [x0 + w - 2, y0 + d - 2]].forEach(p => {
      c.fillStyle = 'rgba(30,15,0,.25)'; c.beginPath(); c.ellipse(p[0] + 2, p[1] + 1, 3, 1.4, 0, 0, TAU); c.fill();
      H.box(c, p[0] - 1.5, p[1] - 1.5, 3, 3, 13, { top: '#ead09a', front: '#8a5a2b', stroke: 'rgba(45,22,5,.6)', lw: .6 });
      H.box(c, p[0] - 1.6, p[1] - 1.6, 3.2, 3.2, 3, { z0: 10.5, top: '#ff6a58', front: '#d9402f' });
    });
    H.bbAt(c, cx, cy, () => {
      c.save(); c.fillStyle = '#fff'; c.font = '900 30px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 4; c.fillText('+', cx, cy - 8); c.restore();
    });
    H.plate(c, cx, cy + 16, 'BUY LAND 🪙' + G.plotCost(), { size: 9, bg: '#ffe39a' });
  }

  // ------------------------------------------------------------------ actors.plot (dynamic, cheap)
  A.actors.plot = function (c, o, H) {
    const p = o.p, x = o.x, y = o.y, t = o.t, i = o.i, F = H.F;
    const bx = x + BED.dx, by = y + BED.dy, bw = BED.w, bd = BED.d, lt = H.lift(BED.h), ty = by - lt;
    if (p.status === 'empty') {
      c.strokeStyle = 'rgba(255,240,200,.4)'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); const cx = bx + bw / 2, cy = ty + bd / 2; c.moveTo(cx - 7, cy); c.lineTo(cx + 7, cy); c.moveTo(cx, cy - 5); c.lineTo(cx, cy + 5); c.stroke();
      return;
    }
    const prog = o.prog, ready = p.status === 'ready', wither = p.status === 'withered', ay = ty + bd / 2, ax = bx + bw / 2;
    if (ready) { c.fillStyle = 'rgba(255,230,120,' + (0.13 + 0.09 * Math.sin(t * 4 + i)) + ')'; H.rr(c, bx + 2, ty + 2, bw - 4, bd - 4, 7); c.fill(); }
    if (wither) { c.fillStyle = 'rgba(70,50,30,.45)'; H.rr(c, bx + 2, ty + 2, bw - 4, bd - 4, 7); c.fill(); }
    H.bbAt(c, ax, ay, () => {
      const Y = gy => ay + (gy - ay) * F;                  // ground-space y (top face) -> upright px
      const g = 0.25 + prog * 0.75;
      if (wither) {
        c.strokeStyle = '#6b5a3a'; c.lineWidth = 1.8; c.lineCap = 'round'; c.beginPath();
        for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) { const tx = bx + 10 + k * 13 + (r % 2) * 5, tyy = Y(ty + 15 + r * 14); c.moveTo(tx, tyy); c.quadraticCurveTo(tx, tyy - 5, tx - 4, tyy - 6 + (k % 2)); }
        c.stroke();
        H.em(c, '🥀', ax, Y(ty + 36) - 4, 30, {});
        return;
      }
      c.strokeStyle = ready ? '#d6c042' : (o.P_.snow ? '#7fa07a' : '#4fb03e'); c.lineWidth = 2.1; c.lineCap = 'round'; c.beginPath();
      const hg = 3 + 8 * g;
      for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) {
        const tx = bx + 10 + k * 13 + (r % 2) * 5, tyy = Y(ty + 15 + r * 14), sw = Math.sin(t * 2 + i + k + r) * 1.2;
        c.moveTo(tx, tyy); c.lineTo(tx - 2.5 + sw, tyy - hg); c.moveTo(tx, tyy); c.lineTo(tx + 3 + sw, tyy - hg * .85); c.moveTo(tx, tyy); c.lineTo(tx + sw * .5, tyy - hg * 1.12);
      }
      c.stroke();
      // the crop, standing on the soil
      const grown = prog >= 0.28, ch = grown ? (o.crop.emoji || '🌾') : '🌱';
      const sz = grown ? 24 + 22 * Math.min(1, (prog - 0.28) / 0.72) : 15 + prog * 32, bob = ready ? -Math.abs(Math.sin(t * 3 + i)) * 3 : 0;
      H.em(c, ch, ax, Y(ty + 44) - sz * .38 + bob, sz, { rot: Math.sin(t * 1.6 + i * 1.3) * 0.05 });
      // ring standing at the back-right corner
      const rx = bx + bw - 7, ry = Y(ty + 7) - 9, col = ready ? '#8be05a' : '#ffe27a';
      c.strokeStyle = 'rgba(60,35,10,.8)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(rx, ry + 8); c.lineTo(rx, Y(ty + 7)); c.stroke();
      c.fillStyle = 'rgba(30,15,0,.55)'; c.beginPath(); c.arc(rx, ry, 9, 0, TAU); c.fill();
      c.lineWidth = 3.6; c.strokeStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.arc(rx, ry, 6.2, 0, TAU); c.stroke();
      c.strokeStyle = col; c.beginPath(); c.arc(rx, ry, 6.2, -Math.PI / 2, -Math.PI / 2 + TAU * prog); c.stroke();
      if (ready) {
        c.fillStyle = '#8be05a'; c.beginPath(); c.arc(rx, ry, 5.6, 0, TAU); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(rx - 2.6, ry); c.lineTo(rx - .6, ry + 2.4); c.lineTo(rx + 3, ry - 2.4); c.stroke();
        for (let k = 0; k < 3; k++) { const ph = (t * 1.4 + k * .37 + i * .13) % 1, sx = bx + 12 + H.hash(i + 'sx' + k) * 50, sy = Y(ty + 14 + H.hash(i + 'sy' + k) * 40) - 14 - ph * 14; H.star(c, sx, sy, 2.5 + 3.5 * Math.sin(ph * Math.PI), 1 - ph * .3); }
      }
    });
  };

  // ------------------------------------------------------------------ terrain.pivotTrack
  A.terrain.pivotTrack = function (c, P_, H) {
    if (!(G.hasExpansion && G.hasExpansion('center_pivot'))) return;
    use(H); const T = H.T, s = H.S(), cx = 8 * T, cy = 14.5 * T, R = 6.2 * T, snow = !!P_.snow;
    c.save();
    // keep the ring off the raised beds
    c.beginPath(); c.rect(0, 0, H.W * T, H.H * T);
    const n = Math.min(s.maxPlots - 1, s.plots.length);
    for (let i = 0; i <= n; i++) { const q = H.plotRect(i); c.rect(q.x * T + 1, q.y * T - 4, q.w * T - 2, q.h * T + 4); }
    c.clip('evenodd');
    c.strokeStyle = snow ? 'rgba(140,165,185,.45)' : 'rgba(70,45,15,.3)'; c.lineWidth = 9; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke();
    c.strokeStyle = snow ? 'rgba(255,255,255,.7)' : 'rgba(255,225,170,.28)'; c.lineWidth = 2; c.setLineDash([3, 9]); c.lineCap = 'round'; c.beginPath(); c.arc(cx, cy, R - 2.5, 0, TAU); c.stroke();
    c.strokeStyle = snow ? 'rgba(150,180,205,.6)' : 'rgba(190,230,255,.34)'; c.lineWidth = 1.6; c.setLineDash([2, 12]); c.beginPath(); c.arc(cx, cy, R + 2.5, 0, TAU); c.stroke();
    c.setLineDash([]); c.restore();
  };
})();
