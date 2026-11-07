/* Kellyville 3D art: the antique store (unbuilt lot with a sign; built false-front shop with porch, windows full of display items,
   upgrade variants, gravel lot, walkways, rusty pickup and a vintage gas pump). Sun in the north-west; shadows fall south-east.
   Hooks: G.WorldArt.structures.antiques = { ground(c, ctx, H), props(ctx, H) }. All randomness is deterministic. */
(function () {
  'use strict';
  const G = window.G; const A = G.WorldArt = G.WorldArt || {};
  A.structures = A.structures || {}; A.terrain = A.terrain || {}; A.actors = A.actors || {};

  const OUT = 'rgba(62,34,14,.88)';
  const SERIF = 'Georgia,"Times New Roman",serif';
  const SANS = 'system-ui,-apple-system,"Segoe UI",sans-serif';
  // ---------------------------------------------------------------- tiny helpers
  const hx = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
  const mix = (a, b, t) => { const x = hx(a), y = hx(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const lit = (a, t) => mix(a, '#ffffff', t), drk = (a, t) => mix(a, '#1a0e00', t);
  const lp = (a, b, t) => a + (b - a) * t;

  function ln(c, H, a, b, col, lw) {
    const p = H.P3(a[0], a[1], a[2]), q = H.P3(b[0], b[1], b[2]);
    c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.strokeStyle = col; c.lineWidth = lw || 1; c.lineCap = 'round'; c.stroke();
  }
  // rectangle on the vertical plane y (facing south), x0..x1 x z0..z1
  function wp(c, H, x0, x1, y, z0, z1, fill, stroke, lw) { H.poly(c, [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], fill, stroke, lw); }
  function gradV(c, H, y, z0, z1, top, bot) {
    const a = H.P3(0, y, z1)[1], b = H.P3(0, y, z0)[1], g = c.createLinearGradient(0, a, 0, b);
    g.addColorStop(0, top); g.addColorStop(1, bot); return g;
  }
  // upright text on a wall at (xc, zc); fn gets the 2d context in screen-true space
  function wtext(c, H, xc, y, zc, txt, o) {
    o = o || {};
    H.bbAt(c, xc, y, g => {
      const sy = y - zc * H.HZ;
      g.font = (o.w || 800) + ' ' + (o.s || 9) + 'px ' + (o.f || SANS); g.textAlign = 'center'; g.textBaseline = 'middle';
      if (o.ls != null && 'letterSpacing' in g) g.letterSpacing = o.ls + 'px';
      let s = o.s || 9;
      if (o.maxW) { while (g.measureText(txt).width > o.maxW && s > 5) { s -= .5; g.font = (o.w || 800) + ' ' + s + 'px ' + (o.f || SANS); } }
      if (o.shadow) { g.fillStyle = o.shadow; g.fillText(txt, xc + (o.sx == null ? 1 : o.sx), sy + (o.sy == null ? 1.4 : o.sy)); }
      if (o.stroke) { g.lineWidth = o.slw || 2; g.strokeStyle = o.stroke; g.lineJoin = 'round'; g.strokeText(txt, xc, sy); }
      g.fillStyle = o.fg || '#fff'; g.fillText(txt, xc, sy + (o.dy || 0.5));
      if ('letterSpacing' in g) g.letterSpacing = '0px';
    });
  }
  function snowStrip(c, H, x0, x1, y, z, depth, th) { // snow lying on a horizontal ledge
    H.poly(c, [[x0 - 1, y - (depth || 0) - 1, z + (th || 2)], [x1 + 1, y - (depth || 0) - 1, z + (th || 2)], [x1 + 1, y + 1, z + (th || 2)], [x0 - 1, y + 1, z + (th || 2)]], '#f8fbff', 'rgba(140,165,195,.8)', 1);
  }
  function rrFill(c, H, x, y, w, h, r, fill, stroke, lw) { H.rr(c, x, y, w, h, r); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1.4; c.stroke(); } }

  // ---------------------------------------------------------------- geometry
  function geo(ctx, H) {
    const r = ctx.rect, up = ctx.upgrades || {}, lvl = ctx.level || 1, xm = r.x + r.w / 2, bw = 184;
    const sec = !!(up.secondFloor || lvl >= 3), big = !!up.porch;
    const yf = r.y + 98, d = 80;
    return {
      r, xm, bw, x0: xm - bw / 2, x1: xm + bw / 2, yf, d, yb: yf - d, sec, dz: sec ? 32 : 0, FT: 80, S: 86 + (sec ? 32 : 0),
      big, deckD: big ? 30 : 22, deckX0: xm - bw / 2 - (big ? 30 : 20), deckX1: xm + bw / 2 + (big ? 30 : 20),
      work: !!up.workshop, neon: !!up.neonSign, lvl, appraiser: !!up.appraiser
    };
  }
  const WOOD = '#a77a4a', WALL = '#7fa6b2', WALL_D = '#4f7886', TRIM = '#f7ecd0', RUST = '#a4472f';

  // ================================================================ GROUND (baked into terrain tiles)
  function gravelPatch(c, H, P_, x, y, w, h, rad, seed, a) {
    const snow = P_.snow;
    H.rr(c, x - 3, y - 3, w + 6, h + 6, rad + 3); c.fillStyle = snow ? 'rgba(210,222,235,.55)' : 'rgba(90,70,40,.18)'; c.fill();
    H.rr(c, x, y, w, h, rad); c.fillStyle = snow ? 'rgba(238,243,248,.92)' : 'rgba(190,170,138,' + (a || .92) + ')'; c.fill();
    const rn = H.mulberry(seed), n = Math.round(w * h / 90);
    for (let i = 0; i < n; i++) {
      const px = x + 6 + rn() * (w - 12), py = y + 6 + rn() * (h - 12), s = .8 + rn() * 1.5, k = rn();
      c.fillStyle = snow ? (k < .5 ? 'rgba(170,185,205,.55)' : 'rgba(255,255,255,.9)') : (k < .33 ? 'rgba(120,100,72,.55)' : k < .66 ? 'rgba(236,222,196,.85)' : 'rgba(150,134,108,.6)');
      c.beginPath(); c.ellipse(px, py, s * 1.3, s * .8, 0, 0, H.TAU); c.fill();
    }
  }
  function pathStroke(c, H, P_, pts, wd) {
    const snow = P_.snow;
    const run = (lw, col) => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.lineWidth = lw; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); };
    run(wd + 5, snow ? 'rgba(160,178,200,.65)' : 'rgba(80,58,30,.38)');
    run(wd + 1.5, snow ? '#d8e2ee' : '#a89574');
    run(wd - 3, snow ? '#f1f5fa' : '#d3bf98');
    // pebbles
    const rn = H.mulberry(Math.round(pts[0][0] * 7 + pts[0][1]));
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.round(L * wd / 70);
      for (let i = 0; i < n; i++) {
        const t = rn(), px = lp(a[0], b[0], t) + (rn() - .5) * (wd - 6), py = lp(a[1], b[1], t) + (rn() - .5) * (wd - 6);
        c.fillStyle = snow ? 'rgba(150,170,195,.5)' : (rn() < .5 ? 'rgba(112,92,62,.5)' : 'rgba(250,240,215,.8)');
        c.beginPath(); c.ellipse(px, py, 1.4, .9, 0, 0, H.TAU); c.fill();
      }
    }
  }

  function groundBuilt(c, ctx, H) {
    const g = geo(ctx, H), P_ = ctx.P_, r = g.r, snow = !!P_.snow, rn = H.mulberry(77);
    const { x0, x1, xm, yf, yb } = g;
    // wide gravel lot with a grassy fringe
    gravelPatch(c, H, P_, 612, r.y + 14, 388, 176, 26, 11, .82);
    gravelPatch(c, H, P_, 640, r.y + 26, 340, 168, 22, 12, .5);
    // walkways: from the road on both sides, then along the front to the door
    const fy = yf + 46;
    pathStroke(c, H, P_, [[632, r.y - 20], [632, fy - 14], [650, fy], [xm - 30, fy], [xm, yf + 36]], 26);
    pathStroke(c, H, P_, [[980, r.y - 20], [980, fy - 14], [962, fy], [xm + 30, fy], [xm, yf + 36]], 26);
    pathStroke(c, H, P_, [[xm, yf + g.deckD + 6], [xm, yf + 40]], 22);
    // stepping stones from the west walk toward the lean-to / building side
    // deck planks
    const dx0 = g.deckX0, dx1 = g.deckX1, dy0 = yf - 2, dy1 = yf + g.deckD;
    c.fillStyle = 'rgba(25,15,0,.3)'; c.fillRect(dx0 - 1, dy1 + 1, dx1 - dx0 + 2, 5);       // front lip shadow
    c.fillStyle = drk('#8a5f35', .1); c.fillRect(dx0, dy1 - 1, dx1 - dx0, 4);              // front fascia of the deck
    c.fillStyle = '#c59b66'; c.fillRect(dx0, dy0, dx1 - dx0, dy1 - dy0 - 1);
    for (let y = dy0 + 4; y < dy1 - 1; y += 4.5) { c.fillStyle = 'rgba(70,40,15,.28)'; c.fillRect(dx0, y, dx1 - dx0, 1); c.fillStyle = 'rgba(255,235,200,.18)'; c.fillRect(dx0, y + 1, dx1 - dx0, 1); }
    for (let y = dy0; y < dy1 - 4; y += 4.5) for (let x = dx0 + 8 + rn() * 30; x < dx1 - 4; x += 28 + rn() * 40) { c.fillStyle = 'rgba(70,40,15,.3)'; c.fillRect(x, y, 1, 4.5); }
    c.strokeStyle = OUT; c.lineWidth = 1.2; c.strokeRect(dx0, dy0, dx1 - dx0, dy1 - dy0 - 1);
    // steps down to the walk
    for (let i = 0; i < 2; i++) { c.fillStyle = i ? '#b08550' : '#c9a06b'; c.fillRect(xm - 20 + i * 2, dy1 + i * 5, 40 - i * 4, 5); c.strokeStyle = OUT; c.lineWidth = 1; c.strokeRect(xm - 20 + i * 2, dy1 + i * 5, 40 - i * 4, 5); }
    if (snow) {
      for (let i = 0; i < 14; i++) { const sx = dx0 + 4 + rn() * (dx1 - dx0 - 20), sy = dy0 + 6 + rn() * (dy1 - dy0 - 14); c.fillStyle = 'rgba(250,252,255,.9)'; c.beginPath(); c.ellipse(sx, sy, 7 + rn() * 9, 2 + rn() * 2, 0, 0, H.TAU); c.fill(); }
    }
    // cast shadows (sun in the north-west)
    const top = g.S + 40;
    H.castShadow(c, g.x0, g.yb, g.bw, g.d, top * .62, .2);
    H.castShadow(c, g.x0 + 6, yf - 4, g.bw - 12, 6, top * .5, .12);
    // portico shadow on the deck
    H.castShadow(c, xm - 50, yf + 12, 100, 2, 66, .15);
    if (g.work) H.castShadow(c, 660, yf - 52, 48, 44, 40, .22);
    // pickup + pump contact shadows
    H.castShadow(c, 930, yf - 62, 30, 56, 20, .22);
    H.castShadow(c, 940, yf + 20, 14, 8, 30, .22);
    // rocks, weeds and rusty bits in the lot
    for (let i = 0; i < 16; i++) {
      const px = 618 + rn() * 376, py = r.y + 20 + rn() * 160;
      if (px > x0 - 14 && px < x1 + 14 && py < yf + 36) continue;
      if (px > 622 && px < 646) continue; if (px > 968 && px < 992) continue;
      c.fillStyle = snow ? 'rgba(235,240,246,.95)' : 'rgba(120,108,92,.8)'; c.beginPath(); c.ellipse(px, py, 3 + rn() * 2, 2 + rn(), 0, 0, H.TAU); c.fill();
      c.strokeStyle = 'rgba(60,45,30,.6)'; c.lineWidth = 1; c.stroke();
    }
    if (!snow) for (let i = 0; i < 22; i++) { // weed tufts
      const px = 616 + rn() * 380, py = r.y + 16 + rn() * 180;
      if (px > x0 - 16 && px < x1 + 16 && py < yf + 40) continue;
      c.strokeStyle = P_.tuft || '#4a8a2d'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(px - 2, py); c.lineTo(px - 3, py - 4); c.moveTo(px, py); c.lineTo(px, py - 5); c.moveTo(px + 2, py); c.lineTo(px + 3, py - 4); c.stroke();
    }
  }

  function groundUnbuilt(c, ctx, H) {
    const r = ctx.rect, P_ = ctx.P_, snow = !!P_.snow, xm = r.x + r.w / 2;
    gravelPatch(c, H, P_, r.x + 24, r.y + 40, r.w - 48, r.h - 36, 18, 21, .55);
    // staked-out footprint
    c.setLineDash([8, 6]); c.lineWidth = 2.2; c.strokeStyle = 'rgba(255,255,255,.92)'; H.rr(c, xm - 100, r.y + 30, 200, 82, 8); c.stroke(); c.setLineDash([]);
    c.strokeStyle = '#e24a3a'; c.lineWidth = 1.3; c.beginPath(); c.rect(xm - 96, r.y + 34, 192, 74); c.stroke();
    // worn path from the walk-up point
    pathStroke(c, H, P_, [[xm, r.y + 118], [xm, r.y + 150]], 22);
    H.castShadow(c, xm - 56, r.y + 96, 5, 5, 28, .2); H.castShadow(c, xm + 52, r.y + 96, 5, 5, 28, .2);
  }

  // ================================================================ small props (drawn inside bodies)
  function post(c, H, x, y, h, col) { H.box(c, x - 2.5, y - 2.5, 5, 5, h, { top: lit(col || WOOD, .3), front: col || WOOD, stroke: OUT, lw: 1 }); }

  function wagonWheel(c, H, x, y, R, rot, snow) { // leaning wheel, faces the camera
    H.bbAt(c, x, y, g => {
      g.save(); g.translate(x, y - R * .85); g.rotate(rot);
      g.fillStyle = 'rgba(30,15,0,.28)'; g.beginPath(); g.ellipse(2, R * .85, R * .8, 3, 0, 0, H.TAU); g.fill();
      g.beginPath(); g.arc(0, 0, R, 0, H.TAU); g.strokeStyle = OUT; g.lineWidth = 6.2; g.stroke();
      g.strokeStyle = '#8e6a3f'; g.lineWidth = 4.2; g.stroke();
      g.beginPath(); g.arc(0, 0, R - 2.4, 0, H.TAU); g.strokeStyle = '#50433a'; g.lineWidth = 1.2; g.stroke();
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.beginPath(); g.moveTo(Math.cos(a) * 3, Math.sin(a) * 3); g.lineTo(Math.cos(a) * (R - 2), Math.sin(a) * (R - 2)); g.strokeStyle = OUT; g.lineWidth = 3; g.stroke(); g.strokeStyle = '#b98d55'; g.lineWidth = 1.7; g.stroke(); }
      g.beginPath(); g.arc(0, 0, 4, 0, H.TAU); g.fillStyle = '#7a5530'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.3; g.stroke();
      g.beginPath(); g.arc(0, 0, 1.5, 0, H.TAU); g.fillStyle = '#2e2218'; g.fill();
      if (snow) { g.beginPath(); g.arc(0, 0, R + .5, Math.PI * 1.15, Math.PI * 1.85); g.strokeStyle = '#f8fbff'; g.lineWidth = 3; g.stroke(); }
      g.restore();
    });
  }
  function milkCan(c, H, x, y, s, snow) {
    H.bbAt(c, x, y, g => {
      s = s || 1; g.fillStyle = 'rgba(30,15,0,.3)'; g.beginPath(); g.ellipse(x + 2, y, 8 * s, 2.6 * s, 0, 0, H.TAU); g.fill();
      const gr = g.createLinearGradient(x - 6 * s, 0, x + 6 * s, 0); gr.addColorStop(0, '#f4f7f9'); gr.addColorStop(.4, '#c9d3d9'); gr.addColorStop(1, '#8b99a3');
      g.beginPath(); g.moveTo(x - 6.5 * s, y); g.lineTo(x - 6 * s, y - 13 * s); g.lineTo(x - 3.2 * s, y - 17 * s); g.lineTo(x - 3.2 * s, y - 20 * s); g.lineTo(x + 3.2 * s, y - 20 * s); g.lineTo(x + 3.2 * s, y - 17 * s); g.lineTo(x + 6 * s, y - 13 * s); g.lineTo(x + 6.5 * s, y); g.closePath();
      g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(40,50,60,.85)'; g.lineWidth = 1.2; g.stroke();
      g.strokeStyle = 'rgba(70,85,100,.65)'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(x - 6.3 * s, y - 4 * s); g.lineTo(x + 6.3 * s, y - 4 * s); g.moveTo(x - 6 * s, y - 11 * s); g.lineTo(x + 6 * s, y - 11 * s); g.stroke();
      g.fillStyle = '#a23b2d'; g.beginPath(); g.ellipse(x, y - 20.5 * s, 4.6 * s, 2 * s, 0, 0, H.TAU); g.fill(); g.strokeStyle = 'rgba(40,20,10,.8)'; g.stroke();
      g.strokeStyle = '#4a5560'; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y - 13 * s, 5 * s, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      if (snow) { g.fillStyle = '#f8fbff'; g.beginPath(); g.ellipse(x, y - 21.5 * s, 5 * s, 2 * s, 0, 0, H.TAU); g.fill(); }
    });
  }
  function rocker(c, H, x, y, col, snow, flip) { // rocking chair, front view
    H.bbAt(c, x, y, g => {
      g.fillStyle = 'rgba(30,15,0,.3)'; g.beginPath(); g.ellipse(x + 3, y, 12, 3.4, 0, 0, H.TAU); g.fill();
      const dk = drk(col, .35), lt = lit(col, .25);
      // rockers (curved runners)
      g.lineCap = 'round'; g.strokeStyle = OUT; g.lineWidth = 3.8; g.beginPath(); g.moveTo(x - 11, y - 3); g.quadraticCurveTo(x, y + 3, x + 11, y - 3); g.stroke();
      g.strokeStyle = dk; g.lineWidth = 2; g.stroke();
      // back posts and slats
      [[-7], [7]].forEach(p => { g.fillStyle = OUT; g.fillRect(x + p[0] - 2, y - 33, 4, 31); g.fillStyle = col; g.fillRect(x + p[0] - 1, y - 32, 2, 29); });
      for (let i = 0; i < 4; i++) { g.fillStyle = OUT; g.fillRect(x - 7, y - 31 + i * 4.4, 14, 3.4); g.fillStyle = i % 2 ? col : lt; g.fillRect(x - 6, y - 30.2 + i * 4.4, 12, 1.8); }
      g.fillStyle = OUT; g.fillRect(x - 9, y - 34.5, 18, 4); g.fillStyle = lt; g.fillRect(x - 8, y - 33.7, 16, 2.2);
      // seat and cushion
      g.fillStyle = OUT; g.fillRect(x - 10, y - 14, 20, 7); g.fillStyle = col; g.fillRect(x - 9, y - 13, 18, 5);
      g.fillStyle = '#c4473a'; g.beginPath(); g.moveTo(x - 8, y - 14); g.lineTo(x + 8, y - 14); g.lineTo(x + 7, y - 17); g.lineTo(x - 7, y - 17); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x - 5, y - 16, 3, 1.4); g.fillRect(x + 1, y - 16, 3, 1.4);
      // front legs and arms
      [[-9], [9]].forEach(p => { g.fillStyle = OUT; g.fillRect(x + p[0] - 1.8, y - 26, 3.6, 21); g.fillStyle = dk; g.fillRect(x + p[0] - .8, y - 25, 1.6, 19); g.fillStyle = OUT; g.fillRect(x + p[0] - 3.4, y - 27, 6.8, 3.6); g.fillStyle = lt; g.fillRect(x + p[0] - 2.4, y - 26.4, 4.8, 1.8); });
      if (snow) { g.fillStyle = '#f8fbff'; g.fillRect(x - 9, y - 36, 18, 2.4); g.fillRect(x - 10, y - 28.4, 6, 1.8); g.fillRect(x + 4, y - 28.4, 6, 1.8); }
    });
  }
  function barrel(c, H, x, y, s, col) {
    H.bbAt(c, x, y, g => {
      s = s || 1; g.fillStyle = 'rgba(30,15,0,.3)'; g.beginPath(); g.ellipse(x + 2, y, 9 * s, 3 * s, 0, 0, H.TAU); g.fill();
      g.beginPath(); g.moveTo(x - 7 * s, y); g.quadraticCurveTo(x - 10 * s, y - 9 * s, x - 7 * s, y - 18 * s); g.lineTo(x + 7 * s, y - 18 * s); g.quadraticCurveTo(x + 10 * s, y - 9 * s, x + 7 * s, y); g.closePath();
      const gr = g.createLinearGradient(x - 9 * s, 0, x + 9 * s, 0); gr.addColorStop(0, lit(col || WOOD, .25)); gr.addColorStop(.5, col || WOOD); gr.addColorStop(1, drk(col || WOOD, .35));
      g.fillStyle = gr; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.3; g.stroke();
      g.strokeStyle = '#3c3a40'; g.lineWidth = 1.6; [4, 9, 14].forEach(h => { g.beginPath(); g.moveTo(x - 8.6 * s, y - h * s); g.quadraticCurveTo(x, y - (h - 1.5) * s, x + 8.6 * s, y - h * s); g.stroke(); });
      g.fillStyle = drk(col || WOOD, .25); g.beginPath(); g.ellipse(x, y - 18 * s, 7 * s, 2.6 * s, 0, 0, H.TAU); g.fill(); g.strokeStyle = OUT; g.stroke();
    });
  }
  function enamelSign(c, H, x, y, z, kind, snow) {
    const R = 'rgba(40,20,10,.9)';
    if (kind === 0) { // round soda-pop disc
      H.bbAt(c, x, y, g => { const sy = y - z * H.HZ; g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(x + 1.5, sy + 2, 12, 0, H.TAU); g.fill(); g.beginPath(); g.arc(x, sy, 12, 0, H.TAU); g.fillStyle = '#d9d3c0'; g.fill(); g.strokeStyle = R; g.lineWidth = 1.5; g.stroke(); g.beginPath(); g.arc(x, sy, 9.8, 0, H.TAU); g.fillStyle = '#c0392b'; g.fill(); g.strokeStyle = '#fff4d6'; g.lineWidth = 1; g.stroke(); g.fillStyle = '#fff4d6'; g.font = '900 6.4px ' + SANS; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ICE COLD', x, sy - 3); g.font = '900 8px ' + SANS; g.fillText('POP', x, sy + 3.5); g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(x - 4, sy - 5, 4, 2, -.6, 0, H.TAU); g.fill(); if (snow) { g.fillStyle = '#f8fbff'; g.fillRect(x - 9, sy - 13, 18, 2); } });
    } else if (kind === 1) {
      H.bbAt(c, x, y, g => { const sy = y - z * H.HZ; g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - 14 + 1.5, sy - 8 + 2, 28, 16); g.fillStyle = '#f2e6bf'; g.fillRect(x - 14, sy - 8, 28, 16); g.strokeStyle = R; g.lineWidth = 1.5; g.strokeRect(x - 14, sy - 8, 28, 16); g.strokeStyle = '#2d6a4f'; g.lineWidth = 1.4; g.strokeRect(x - 12, sy - 6, 24, 12); g.fillStyle = '#2d6a4f'; g.font = '900 6.4px ' + SANS; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FRESH', x, sy - 2.2); g.fillText('EGGS', x, sy + 3.6); g.fillStyle = '#6b4a2b'; [[-12, -6], [12, -6], [-12, 6], [12, 6]].forEach(p => g.fillRect(x + p[0] - .8, sy + p[1] - .8, 1.6, 1.6)); if (snow) { g.fillStyle = '#f8fbff'; g.fillRect(x - 14, sy - 10, 28, 2.4); } });
    } else {
      H.bbAt(c, x, y, g => { const sy = y - z * H.HZ; g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - 11 + 1.5, sy - 10 + 2, 22, 20); g.fillStyle = '#2b5d8a'; g.fillRect(x - 11, sy - 10, 22, 20); g.strokeStyle = R; g.lineWidth = 1.5; g.strokeRect(x - 11, sy - 10, 22, 20); g.fillStyle = '#f7e9a8'; g.font = '900 6px ' + SANS; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SEED', x, sy - 5); g.fillText('& FEED', x, sy + 1); g.font = '10px serif'; g.fillText('🌾', x, sy + 7); if (snow) { g.fillStyle = '#f8fbff'; g.fillRect(x - 11, sy - 12, 22, 2.4); } });
    }
  }

  // ---- display windows
  function winShop(c, H, g, x, w, items, o) { // x = left edge of glass, w = glass width
    const y = g.yf, z0 = 14, z1 = 54, snow = o.snow;
    // frame
    wp(c, H, x - 4, x + w + 4, y, z0 - 4, z1 + 4, TRIM, OUT, 1.5);
    // dark shop interior
    const gr = c.createLinearGradient(0, H.P3(0, y, z1)[1], 0, H.P3(0, y, z0)[1]); gr.addColorStop(0, '#5c3d27'); gr.addColorStop(1, '#a8794a');
    wp(c, H, x, x + w, y, z0, z1, gr, OUT, 1.3);
    // back wallpaper stripes + glow
    for (let xx = x + 3; xx < x + w; xx += 6) ln(c, H, [xx, y, z0], [xx, y, z1], 'rgba(255,220,160,.1)', 2);
    const glow = H.P3(x + w / 2, y, 30), rg = c.createRadialGradient(glow[0], glow[1], 2, glow[0], glow[1], w * .7); rg.addColorStop(0, 'rgba(255,225,150,.5)'); rg.addColorStop(1, 'rgba(255,225,150,0)');
    c.save(); H.poly(c, [[x, y, z0], [x + w, y, z0], [x + w, y, z1], [x, y, z1]]); c.clip(); c.fillStyle = rg; c.fillRect(glow[0] - w, glow[1] - w, w * 2, w * 2); c.restore();
    // shelves
    [z0 + 3, z0 + 22].forEach((zs, k) => {
      wp(c, H, x, x + w, y, zs - 2.4, zs, '#8b5e34', OUT, 1);
      ln(c, H, [x, y, zs], [x + w, y, zs], 'rgba(255,230,190,.55)', 1);
    });
    // items: lower shelf slots then upper
    const slots = [[.2, 0], [.55, 0], [.88, 0], [.4, 1], [.78, 1]];
    const em = items.slice(0, 3);
    const pos = em.length === 1 ? [[.5, 0]] : em.length === 2 ? [[.3, 0], [.72, 1]] : [[.2, 0], [.58, 0], [.42, 1]];
    em.forEach((it, i) => {
      const p = pos[i], ex = x + p[0] * w, zs = p[1] ? z0 + 22 : z0 + 3, sz = 17, pp = H.P3(ex, y, zs);
      H.em(c, it.emoji, ex, pp[1] - (sz * .5 - 1) / H.F, sz, { force: true });
    });
    // gold painted window lettering
    // glass reflections
    c.save(); H.poly(c, [[x, y, z0], [x + w, y, z0], [x + w, y, z1], [x, y, z1]]); c.clip();
    const a = H.P3(x + 4, y, z1), b = H.P3(x + w * .5, y, z1), d1 = H.P3(x + 4, y, z0 + 8), e1 = H.P3(x + w * .22, y, z0 + 4);
    c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(e1[0], e1[1]); c.lineTo(d1[0], d1[1]); c.closePath(); c.fill();
    const a2 = H.P3(x + w * .6, y, z1), b2 = H.P3(x + w * .72, y, z1), c2 = H.P3(x + w * .5, y, z0), d2 = H.P3(x + w * .38, y, z0);
    c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.moveTo(a2[0], a2[1]); c.lineTo(b2[0], b2[1]); c.lineTo(c2[0], c2[1]); c.lineTo(d2[0], d2[1]); c.closePath(); c.fill();
    c.restore();
    // mullion + sill
    ln(c, H, [x + w / 2, y, z0], [x + w / 2, y, z1], TRIM, 2);
    wp(c, H, x - 4, x + w + 4, y, z0 - 4, z0 - 1, '#e8dcc0', OUT, 1);
    H.box(c, x - 6, y, w + 12, 4, 2.4, { top: '#e6d8b6', front: '#b6a584', stroke: OUT, lw: 1, z0: z0 - 6.4 });
    // bulkhead paneling below
    wp(c, H, x - 4, x + w + 4, y, 6, z0 - 6.4, lit(WALL, .02), OUT, 1.2);
    wp(c, H, x + 1, x + w - 1, y, 8, z0 - 8.4, null, 'rgba(255,255,255,.4)', 1);
    // flower box at level 2+
    if (o.lvl >= 2) {
      H.box(c, x - 2, y, w + 4, 5, 7, { top: '#3d6d2a', front: '#8a5a2e', stroke: OUT, lw: 1, z0: 4 });
      if (!snow) { const rn = H.mulberry(Math.round(x)); for (let i = 0; i < 7; i++) { const fx = x + 3 + i * ((w - 6) / 6), p = H.P3(fx, y + 2, 12); c.fillStyle = ['#ff6b8b', '#ffd45e', '#ff9ec7', '#fff'][i % 4]; c.beginPath(); c.arc(p[0], p[1] - 1, 2.2, 0, H.TAU); c.fill(); c.strokeStyle = 'rgba(40,60,20,.6)'; c.lineWidth = .8; c.stroke(); } }
    }
  }

  // ---- neon OPEN sign
  function neonOpen(c, H, g, x, y, z, snow) {
    const w = 38, h = 11;
    wp(c, H, x - w / 2 - 2, x + w / 2 + 2, y, z - 1, z + h + 1, '#1a1220', OUT, 1.2);
    H.bbAt(c, x, y, s => {
      const sy = y - (z + h / 2) * H.HZ;
      s.font = '900 11px ' + SANS; s.textAlign = 'center'; s.textBaseline = 'middle'; s.lineJoin = 'round';
      s.save(); s.shadowColor = '#ff2d55'; s.shadowBlur = 8; s.strokeStyle = '#ff5c7a'; s.lineWidth = 1.6; s.strokeText('OPEN', x, sy); s.restore();
      s.fillStyle = '#fff1f3'; s.fillText('OPEN', x, sy);
      s.save(); s.shadowColor = '#3ad0ff'; s.shadowBlur = 5; s.strokeStyle = '#6fe0ff'; s.lineWidth = 1.2; H.rr(s, x - w / 2 + 1.5, sy - h * .8 + 1, w - 3, h * 1.6 - 2, 3); s.stroke(); s.restore();
    });
    H.light(x, y + 2, z + h / 2, 40, 'rgba(255,70,110,.5)');
    H.light(x, y + 6, z - 4, 30, 'rgba(90,220,255,.28)');
  }

  // ================================================================ THE BUILDING (main body)
  function buildingBody(c, ctx, H, g) {
    const P_ = ctx.P_, snow = !!P_.snow, { x0, x1, xm, yf, yb, S, FT } = g;
    const disp = (ctx.display || []).filter(Boolean);
    const rz = S;                                  // roof plane height
    const top = S + 36;                            // top of the sign band
    // ---------- roof (low gable, ridge east-west) with brick chimney
    const ridgeY = yf - 44, ridgeZ = rz + 18, ov = 6;
    const rcol = ['#8c4b3a', '#7a3f31'];
    const rg = c.createLinearGradient(0, H.P3(0, yb, rz)[1], 0, H.P3(0, ridgeY, ridgeZ)[1]);
    // north slope (far side)
    H.poly(c, [[x0 - ov, yb - 2, rz - 2], [x1 + ov, yb - 2, rz - 2], [x1 + ov, ridgeY, ridgeZ], [x0 - ov, ridgeY, ridgeZ]], gradV(c, H, yb, rz, ridgeZ + 40, '#6a3329', '#9a5642'), OUT, 1.5);
    for (let x = x0 - 2; x < x1 + ov; x += 9) ln(c, H, [x, yb - 2, rz - 2], [x, ridgeY, ridgeZ], 'rgba(30,5,0,.25)', 1);
    // chimney
    const cxm = xm + 52, cyf = ridgeY + 6;
    H.box(c, cxm - 8, cyf - 8, 16, 8, 30, { top: '#6a3226', front: gradV(c, H, cyf, ridgeZ - 4, ridgeZ + 26, '#b8553f', '#8c3d2d'), stroke: OUT, lw: 1.4, z0: ridgeZ - 4 });
    for (let k = 0; k < 4; k++) ln(c, H, [cxm - 8, cyf, ridgeZ + k * 6], [cxm + 8, cyf, ridgeZ + k * 6], 'rgba(40,10,0,.4)', 1);
    H.box(c, cxm - 10, cyf - 10, 20, 11, 3, { top: '#d9cdb5', front: '#b3a68d', stroke: OUT, lw: 1.2, z0: ridgeZ + 26 });
    if (snow) snowStrip(c, H, cxm - 10, cxm + 10, cyf + 1, ridgeZ + 29, 11, 2);
    else { const sp = H.P3(cxm, cyf - 4, ridgeZ + 34); [[0, 0, 3.4], [4, -8, 4.4], [10, -17, 5.4]].forEach((p, i) => { c.fillStyle = 'rgba(235,235,235,' + (.5 - i * .12) + ')'; c.beginPath(); c.arc(sp[0] + p[0], sp[1] + p[1], p[2], 0, H.TAU); c.fill(); }); }
    // south slope (near side, lit)
    H.poly(c, [[x0 - ov, ridgeY, ridgeZ], [x1 + ov, ridgeY, ridgeZ], [x1 + ov, yf - 4, rz - 4], [x0 - ov, yf - 4, rz - 4]], gradV(c, H, ridgeY, rz - 4, ridgeZ + 20, '#b8624d', '#8c4b3a'), OUT, 1.5);
    for (let x = x0 - 2; x < x1 + ov; x += 9) { ln(c, H, [x, ridgeY, ridgeZ], [x, yf - 4, rz - 4], 'rgba(30,5,0,.22)', 1); ln(c, H, [x + 1.3, ridgeY, ridgeZ], [x + 1.3, yf - 4, rz - 4], 'rgba(255,200,170,.14)', 1); }
    ln(c, H, [x0 - ov, ridgeY, ridgeZ + .5], [x1 + ov, ridgeY, ridgeZ + .5], '#d9b8a4', 2.4);
    if (snow) {
      H.poly(c, [[x0 - ov, yb - 2, rz - 2], [x1 + ov, yb - 2, rz - 2], [x1 + ov, ridgeY, ridgeZ + 1], [x0 - ov, ridgeY, ridgeZ + 1]], '#f8fbff', 'rgba(130,160,190,.85)', 1.2);
      const q = [[x0 - ov, ridgeY, ridgeZ + 1], [x1 + ov, ridgeY, ridgeZ + 1], [x1 + ov, lp(ridgeY, yf - 4, .85), lp(ridgeZ, rz - 4, .85)], [x0 - ov, lp(ridgeY, yf - 4, .85), lp(ridgeZ, rz - 4, .85)]];
      H.poly(c, q, '#f8fbff', 'rgba(130,160,190,.85)', 1.2);
      // the chimney sticks out of the snow
      H.box(c, cxm - 8, cyf - 8, 16, 8, 30, { top: '#6a3226', front: gradV(c, H, cyf, ridgeZ - 4, ridgeZ + 26, '#b8553f', '#8c3d2d'), stroke: OUT, lw: 1.4, z0: ridgeZ + 1 });
      H.box(c, cxm - 10, cyf - 10, 20, 11, 3, { top: '#d9cdb5', front: '#b3a68d', stroke: OUT, lw: 1.2, z0: ridgeZ + 27 });
      snowStrip(c, H, cxm - 10, cxm + 10, cyf + 1, ridgeZ + 30, 11, 2);
    }
    // ---------- front wall (clapboard)
    const wallTop = top;
    wp(c, H, x0, x1, yf, 0, wallTop, gradV(c, H, yf, 0, wallTop, lit(WALL, .12), drk(WALL, .22)), OUT, 1.6);
    c.save(); H.poly(c, [[x0, yf, 0], [x1, yf, 0], [x1, yf, wallTop], [x0, yf, wallTop]]); c.clip();
    for (let z = 6; z < wallTop; z += 4.6) { ln(c, H, [x0, yf, z], [x1, yf, z], 'rgba(20,50,70,.26)', 1); ln(c, H, [x0, yf, z + 1.1], [x1, yf, z + 1.1], 'rgba(255,255,255,.12)', 1); }
    // soft ambient occlusion near the ground
    ln(c, H, [x0, yf, 3], [x1, yf, 3], 'rgba(10,20,30,.22)', 7);
    c.restore();
    // stone foundation
    wp(c, H, x0 - 1, x1 + 1, yf, 0, 6, gradV(c, H, yf, 0, 6, '#b7aea0', '#7a7266'), OUT, 1.3);
    for (let x = x0 + 8; x < x1; x += 14) ln(c, H, [x, yf, 0], [x, yf, 6], 'rgba(40,30,20,.35)', 1);
    // corner boards
    [x0, x1].forEach(x => wp(c, H, x - 3.5, x + 3.5, yf, 0, wallTop + 4, TRIM, OUT, 1.2));
    // ---------- upper floor (windows)
    if (g.sec) {
      ln(c, H, [x0, yf, FT + 3], [x1, yf, FT + 3], 'rgba(0,0,0,.2)', 6);
      wp(c, H, x0 - 2, x1 + 2, yf, FT, FT + 6, TRIM, OUT, 1.3);
      const wz0 = FT + 11, wz1 = S - 6;
      [x0 + 30, xm - 11, x1 - 52].forEach((wx, i) => {
        const ww = 22;
        wp(c, H, wx - 3, wx + ww + 3, yf, wz0 - 3, wz1 + 3, TRIM, OUT, 1.4);
        const gr2 = gradV(c, H, yf, wz0, wz1, '#7fb4c9', '#cfe7ee');
        wp(c, H, wx, wx + ww, yf, wz0, wz1, ctx.night ? '#ffd877' : gr2, OUT, 1.2);
        // lit room behind the curtains
        wp(c, H, wx + 1, wx + ww - 1, yf, wz0 + 1, wz1 - 1, 'rgba(255,215,130,.38)', null);
        // curtains
        H.poly(c, [[wx, yf, wz1], [wx + 6, yf, wz1], [wx + 3, yf, wz0 + 5], [wx, yf, wz0 + 3]], '#c4473a', null);
        H.poly(c, [[wx + ww, yf, wz1], [wx + ww - 6, yf, wz1], [wx + ww - 3, yf, wz0 + 5], [wx + ww, yf, wz0 + 3]], '#c4473a', null);
        ln(c, H, [wx + ww / 2, yf, wz0], [wx + ww / 2, yf, wz1], TRIM, 1.6); ln(c, H, [wx, yf, (wz0 + wz1) / 2 + 2], [wx + ww, yf, (wz0 + wz1) / 2 + 2], TRIM, 1.4);
        H.box(c, wx - 4, yf, ww + 8, 3, 2, { top: '#e6d8b6', front: '#b6a584', stroke: OUT, lw: 1, z0: wz0 - 5 });
        H.light(wx + ww / 2, yf, (wz0 + wz1) / 2, 22, 'rgba(255,205,120,.32)');
      });
      wtext(c, H, xm, yf, FT + 3, '', {});
    }
    // ---------- first-floor display windows (shelves + emoji)
    const wl = x0 + 14, ww = 46, wr = x1 - 14 - ww;
    const L = disp.filter((d, i) => i % 2 === 0), R = disp.filter((d, i) => i % 2 === 1);
    // distribute: items 0,2,4 -> left; 1,3,5 -> right
    winShop(c, H, g, wl, ww, L, { snow, lvl: g.lvl });
    winShop(c, H, g, wr, ww, R, { snow, lvl: g.lvl });
    if (g.neon) neonOpen(c, H, g, wr + ww / 2, yf, 45.5, snow);
    else wtext(c, H, wr + ww / 2, yf, 48, 'OPEN', { s: 7, fg: '#6b3a22', w: 900, ls: 1 });
    H.light(wl + ww / 2, yf, 30, 34, 'rgba(255,200,110,.32)');
    H.light(wr + ww / 2, yf, 30, 34, 'rgba(255,200,110,.32)');
    // painted gold window lettering
    wtext(c, H, wl + ww / 2, yf, 51.5, 'CURIOS', { s: 6, fg: '#f2c94c', w: 900, ls: 1.6, shadow: 'rgba(40,20,0,.55)', sx: .6, sy: .8 });
    if (!g.neon) wtext(c, H, wr + ww / 2, yf, 51.5, 'OLD & NEW', { s: 5.8, fg: '#f2c94c', w: 900, ls: 1, shadow: 'rgba(40,20,0,.55)', sx: .6, sy: .8 });
    // ---------- door
    const dw = 32, dz1 = 52;
    wp(c, H, xm - dw / 2 - 4, xm + dw / 2 + 4, yf, 0, dz1 + 6, TRIM, OUT, 1.5);
    wp(c, H, xm - dw / 2, xm + dw / 2, yf, 6, dz1, gradV(c, H, yf, 6, dz1, '#a3412f', '#6f2a1e'), OUT, 1.4);
    wp(c, H, xm - dw / 2 + 4, xm + dw / 2 - 4, yf, 28, dz1 - 5, gradV(c, H, yf, 28, dz1 - 5, '#8fc3d4', '#ffe9b0'), OUT, 1.1);
    wp(c, H, xm - dw / 2 + 4, xm + dw / 2 - 4, yf, 30, 40, 'rgba(244,236,214,.9)', null);       // lace curtain
    for (let k = 0; k < 5; k++) ln(c, H, [xm - dw / 2 + 6 + k * 4.6, yf, 30], [xm - dw / 2 + 6 + k * 4.6, yf, 40], 'rgba(150,120,90,.35)', 1);
    ln(c, H, [xm, yf, 28], [xm, yf, dz1 - 5], TRIM, 1.4);
    wp(c, H, xm - dw / 2 + 4, xm - 1, yf, 10, 24, null, 'rgba(255,230,200,.45)', 1); wp(c, H, xm + 1, xm + dw / 2 - 4, yf, 10, 24, null, 'rgba(255,230,200,.45)', 1);
    const kn = H.P3(xm + dw / 2 - 5, yf, 24); c.fillStyle = '#ffd45e'; c.beginPath(); c.arc(kn[0], kn[1], 1.8, 0, H.TAU); c.fill(); c.strokeStyle = OUT; c.lineWidth = .8; c.stroke();
    // transom over the door
    wp(c, H, xm - dw / 2, xm + dw / 2, yf, dz1 + 1, dz1 + 5, '#ffe9a8', OUT, 1);
    H.light(xm, yf, 30, 26, 'rgba(255,210,130,.25)');
    // ---------- enamel signs on the wall beside the porch roof, plus rail-road style lantern
    enamelSign(c, H, x0 + 36, yf, 70, 0, snow);
    enamelSign(c, H, x1 - 36, yf, 70, 1, snow);
    // ---------- belt cornice under the sign band
    const bz = S - 6;
    wp(c, H, x0 - 4, x1 + 4, yf, bz, S, TRIM, OUT, 1.3);
    H.box(c, x0 - 6, yf, g.bw + 12, 3, 2, { top: '#fff7e0', front: '#cdbf9b', stroke: OUT, lw: 1.1, z0: bz - 2 });
    // ---------- the big hand-painted ANTIQUES sign band
    const sz0 = S, sz1 = S + 36;
    wp(c, H, x0, x1, yf, sz0, sz1, gradV(c, H, yf, sz0, sz1, '#7a2c3a', '#4a1722'), OUT, 1.6);
    wp(c, H, x0 + 5, x1 - 5, yf, sz0 + 4, sz1 - 4, null, '#f2c94c', 1.6);
    wp(c, H, x0 + 8, x1 - 8, yf, sz0 + 6.5, sz1 - 6.5, null, 'rgba(255,230,160,.45)', .8);
    // painted rays of gold at each end
    [x0 + 22, x1 - 22].forEach(xx => wtext(c, H, xx, yf, sz0 + 18, '❖', { s: 15, fg: '#f2c94c', w: 700, f: SANS, shadow: 'rgba(0,0,0,.4)' }));
    wtext(c, H, xm, yf, sz0 + 23, 'ANTIQUES', { s: 20, f: SERIF, w: 900, ls: 3, fg: '#fbe6a2', shadow: '#1d0a10', sx: 1.6, sy: 2, stroke: '#3a0f19', slw: 3.4, maxW: 136 });
    wtext(c, H, xm, yf, sz0 + 8.4, '• ' + String(ctx.name || 'Antiques') + ' •', { s: 7.6, f: SERIF, w: 800, ls: .8, fg: '#f2c94c', maxW: 130 });
    // cornice cap + stepped pediment
    const cz = sz1;
    wp(c, H, x0 - 5, x1 + 5, yf, cz, cz + 6, TRIM, OUT, 1.4);
    H.box(c, x0 - 7, yf, g.bw + 14, 4, 2.4, { top: '#fff7e0', front: '#cdbf9b', stroke: OUT, lw: 1.2, z0: cz + 5.4 });
    // shoulders / finials
    [x0 + 6, x1 - 6].forEach(xx => { post(c, H, xx, yf - 1, 0.1, TRIM); wp(c, H, xx - 3.5, xx + 3.5, yf + 2, cz + 6, cz + 14, TRIM, OUT, 1.2); H.poly(c, [[xx - 4, yf + 2, cz + 14], [xx + 4, yf + 2, cz + 14], [xx, yf + 2, cz + 20]], '#e6d8b6', OUT, 1.1); });
    // center pediment with a painted star medallion
    const px0 = xm - 44, px1 = xm + 44;
    const ped = [[px0 - 4, cz + 6], [px1 + 4, cz + 6], [px1 + 4, cz + 11], [xm + 26, cz + 15], [xm + 12, cz + 22], [xm, cz + 24], [xm - 12, cz + 22], [xm - 26, cz + 15], [px0 - 4, cz + 11]];
    H.poly(c, ped.map(p => [p[0], yf + 2, p[1]]), gradV(c, H, yf, cz + 6, cz + 24, TRIM, '#d8c9a2'), OUT, 1.4);
    H.bbAt(c, xm, yf, s => { const sy = yf - (cz + 14) * H.HZ; s.fillStyle = '#c4473a'; s.beginPath(); s.arc(xm, sy, 5.5, 0, H.TAU); s.fill(); s.strokeStyle = OUT; s.lineWidth = 1.2; s.stroke(); s.fillStyle = '#fbe6a2'; s.font = '900 8px ' + SANS; s.textAlign = 'center'; s.textBaseline = 'middle'; s.fillText('★', xm, sy + .5); });
    if (snow) {
      snowStrip(c, H, x0 - 7, x1 + 7, yf + 4, cz + 7.4, 5, 2.2);
      snowStrip(c, H, x0 - 7, x1 + 7, yf + 3, bz - 0.5, 3, 1.4);
    }
    // wall lanterns at the sides of the door (lights at night)
    [[xm - 30, '#ffd45e'], [xm + 30, '#ffd45e']].forEach(l => {
      const p = H.P3(l[0], yf + 1, 56);
      c.strokeStyle = '#2a1a0a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(p[0], p[1] - 7); c.lineTo(p[0], p[1] - 3); c.stroke();
      c.fillStyle = l[1]; c.strokeStyle = '#2a1a0a'; c.lineWidth = 1.4; H.rr(c, p[0] - 3, p[1] - 3, 6, 8, 2); c.fill(); c.stroke();
      c.fillStyle = '#fff6c8'; c.fillRect(p[0] - 1.2, p[1] - 1, 2.4, 4);
      H.light(l[0], yf + 4, 56, 20, 'rgba(255,205,110,.3)');
    });
  }

  // ================================================================ PORTICO + DECK FURNITURE
  function porchBody(c, ctx, H, g) {
    const P_ = ctx.P_, snow = !!P_.snow, { xm, yf, x0, x1 } = g, disp = (ctx.display || []).filter(Boolean);
    const yfr = yf + 12, dTop = 3;
    const pl = xm - 27, pr = xm + 27;
    // deck-level furniture first (behind posts): wagon wheel, milk cans, barrels
    wagonWheel(c, H, x0 + 6, yf + 6, 14, -.14, snow);
    [[x1 - 3, yf + 7, 1.05], [x1 + 8, yf + 11, 1], [x1 - 13, yf + 6, .95]].forEach(p => milkCan(c, H, p[0], p[1], p[2], snow));
    // portico posts
    [pl + 3, pr - 3].forEach(px => {
      c.fillStyle = 'rgba(30,15,0,.0)';
      H.box(c, px - 3, yfr - 3, 6, 6, 50, { top: lit(TRIM, .2), front: gradV(c, H, yfr + 3, 0, 50, TRIM, '#cdbf9b'), stroke: OUT, lw: 1.2, z0: dTop });
      H.box(c, px - 4.5, yfr - 4.5, 9, 9, 3, { top: '#fff7e0', front: '#cdbf9b', stroke: OUT, lw: 1, z0: dTop });
    });
    // brackets on the posts
    [[pl + 3, 1], [pr - 3, -1]].forEach(([px, s]) => { wp(c, H, Math.min(px, px + s * 10), Math.max(px, px + s * 10), yfr + 3, 50, 58, null); H.poly(c, [[px, yfr + 3, 48], [px + s * 10, yfr + 3, 58], [px, yfr + 3, 58]], '#e6d8b6', OUT, 1); });
    // portico roof (shed roof: low at the front, high against the wall)
    const rf = 64, rb = 74, ov = 5;
    const rcol = '#a4472f';
    // underside shadow on the wall
    H.poly(c, [[pl - 2, yf + .5, 56], [pr + 2, yf + .5, 56], [pr + 2, yf + .5, 82], [pl - 2, yf + .5, 82]], 'rgba(30,10,0,.0)', null);
    H.poly(c, [[pl - ov, yfr + 8, rf], [pr + ov, yfr + 8, rf], [pr + ov, yf, rb], [pl - ov, yf, rb]], gradV(c, H, yf, rf, rb + 8, '#d8664b', '#a4472f'), OUT, 1.5);
    for (let x = pl - ov + 5; x < pr + ov; x += 7) { ln(c, H, [x, yfr + 8, rf], [x, yf, rb], 'rgba(60,10,0,.28)', 1); ln(c, H, [x + 1.2, yfr + 8, rf], [x + 1.2, yf, rb], 'rgba(255,210,190,.2)', 1); }
    ln(c, H, [pl - ov, yf, rb], [pr + ov, yf, rb], '#f2d4c4', 1.6);
    // fascia board carrying the shop name
    wp(c, H, pl - ov, pr + ov, yfr + 8, rf - 12, rf, gradV(c, H, yfr + 8, rf - 14, rf, '#5a3a22', '#3a2314'), OUT, 1.4);
    wp(c, H, pl - ov + 2, pr + ov - 2, yfr + 8, rf - 10.5, rf - 1.5, null, 'rgba(242,201,76,.8)', .9);
    wtext(c, H, xm, yfr + 8, rf - 6, 'BUY • SELL • TRADE', { s: 6.2, f: SERIF, w: 900, fg: '#f9e3a1', shadow: 'rgba(0,0,0,.6)', sx: .6, sy: .9, maxW: pr - pl + 2 * ov - 8, ls: .6 });
    if (snow) { H.poly(c, [[pl - ov - 1, yfr + 9, rf + 1.5], [pr + ov + 1, yfr + 9, rf + 1.5], [pr + ov + 1, yf, rb + 1.5], [pl - ov - 1, yf, rb + 1.5]], '#f8fbff', 'rgba(140,165,195,.85)', 1.2); }
    // hanging lanterns under the portico
    [pl + 8, pr - 8].forEach((lx, i) => {
      const p = H.P3(lx, yfr, 66); c.strokeStyle = '#2a1a0a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(p[0], p[1] - 3); c.lineTo(p[0], p[1] + 2); c.stroke();
      c.fillStyle = '#ffd45e'; H.rr(c, p[0] - 3, p[1] + 1, 6, 8, 2); c.fill(); c.stroke(); c.fillStyle = '#fff6c8'; c.fillRect(p[0] - 1.2, p[1] + 3, 2.4, 4);
      H.light(lx, yfr, 56, 22, 'rgba(255,205,110,.4)');
    });
    // hanging blade sign for hand-lettered curiosities
    // rocking chairs and a display table
    rocker(c, H, x0 - 10, yf + 16, '#4f8a6f', snow);
    rocker(c, H, x1 + 18, yf + 17, '#c98b4a', snow);
    // bigger porch: bench, barrels, potted plants and a rail
    if (g.big) {
      const bx0 = g.deckX0, bx1 = g.deckX1, by = yf + g.deckD - 4;
      // front rail with two gaps for steps
      const rails = [[bx0, xm - 26], [xm + 26, bx1]];
      rails.forEach(([a, b]) => {
        ln(c, H, [a, by, 11], [b, by, 11], OUT, 3.4); ln(c, H, [a, by, 11], [b, by, 11], '#e8dcc0', 1.9);
        for (let x = a + 3; x <= b; x += 12) ln(c, H, [x, by, 3], [x, by, 11], '#e8dcc0', 1.6);
        if (snow) snowStrip(c, H, a, b, by + 1, 11.4, 2, 1.4);
      });
      [bx0 + 1, xm - 26, xm + 26, bx1 - 1].forEach(x => post(c, H, x, by, 15, '#e8dcc0'));
      barrel(c, H, xm - 62, yf + 20, 1, '#8a6a42');
      H.em(c, '🪴', xm + 62, H.P3(xm + 62, yf + 24, 0)[1] - 8, 18, { force: true });
    }
    // level 3: bunting across the roof edge
    if (g.lvl >= 3) {
      const a = [x0 - 4, yfr + 9, rf - 2], b = [x1 + 4, yfr + 9, rf - 2];
      // string of little flags between the posts and the deck corners
      const n = 13;
      for (let i = 0; i <= n; i++) {
        const t = i / n, bx = lp(pl - ov, pr + ov, t), sag = Math.sin(t * Math.PI) * 4, p = H.P3(bx, yfr + 9, rf - 15 - sag);
        c.fillStyle = ['#c4473a', '#f2c94c', '#3a8a6a', '#fff4d6'][i % 4]; c.beginPath(); c.moveTo(p[0] - 2.6, p[1]); c.lineTo(p[0] + 2.6, p[1]); c.lineTo(p[0], p[1] + 5.6); c.closePath(); c.fill(); c.strokeStyle = 'rgba(40,20,0,.7)'; c.lineWidth = .8; c.stroke();
      }
    }
  }

  // ================================================================ WORKSHOP LEAN-TO
  function workshopBody(c, ctx, H, g) {
    const snow = !!ctx.P_.snow, yf = g.yf - 8, xr = g.x0, xl = xr - 50, d = 46, h = 48;
    // back wall interior + side post
    const yb = yf - d;
    // roof top (sloping down toward the front)
    // front wall pieces: left stack of boards, right pier, open bay
    H.box(c, xl, yb, 50, d, 0, { top: '#463628', front: '#463628', stroke: OUT, lw: 1.3, z0: 0 });
    // interior back wall (dark), workbench
    wp(c, H, xl + 2, xr, yf - 14, 0, h, gradV(c, H, yf - 14, 0, h, '#3b2a1e', '#5a4128'), OUT, 1.3);
    // tool board
    wp(c, H, xl + 6, xr - 6, yf - 14, 22, 44, '#6e5033', 'rgba(20,10,0,.6)', 1);
    // workbench
    H.box(c, xl + 7, yf - 24, 38, 14, 4, { top: '#caa06a', front: '#9a7142', stroke: OUT, lw: 1.2, z0: 14 });
    H.box(c, xl + 8, yf - 22, 3, 3, 14, { top: '#7a5530', front: '#7a5530', stroke: OUT, lw: 1 });
    H.box(c, xl + 41, yf - 22, 3, 3, 14, { top: '#7a5530', front: '#7a5530', stroke: OUT, lw: 1 });
    ['🔨', '🪚', '🔧'].forEach((e, i) => H.em(c, e, xl + 14 + i * 12, H.P3(0, yf - 18, 18)[1] - 6, 11, { force: true }));
    // anvil/grinder
    H.bbAt(c, xl + 36, yf - 5, s => {
      s.fillStyle = 'rgba(30,15,0,.3)'; s.beginPath(); s.ellipse(xl + 38, yf - 5, 8, 2.4, 0, 0, H.TAU); s.fill();
      s.fillStyle = OUT; s.fillRect(xl + 31, yf - 11, 10, 6); s.fillStyle = '#6a7078'; s.fillRect(xl + 32, yf - 10, 8, 4);
      s.fillStyle = OUT; s.fillRect(xl + 28, yf - 16, 16, 6); s.fillStyle = '#8c939b'; s.fillRect(xl + 29, yf - 15, 14, 3.4);
    });
    // hanging tools on the board (emoji)
    [['🪚', 12], ['⚙️', 24], ['🪠', 36]].forEach(([e, dx]) => H.em(c, e, xl + dx + 4, H.P3(0, yf - 14, 36)[1] - 1, 11, { force: true }));
    // front posts + beam
    [xl + 1, xr - 2].forEach(px => H.box(c, px - 2, yf - 2, 5, 5, h, { top: '#c9a06b', front: gradV(c, H, yf + 3, 0, h, '#c9a06b', '#8a6038'), stroke: OUT, lw: 1.2 }));
    wp(c, H, xl - 2, xr, yf + 3, h - 7, h, gradV(c, H, yf + 3, h - 7, h, '#a47842', '#7a5530'), OUT, 1.2);
    // shed roof sloping down toward the front
    const rb = h + 16, rf = h + 4, ov = 5;
    H.poly(c, [[xl - ov, yb - 2, rb], [xr + 1, yb - 2, rb], [xr + 1, yf + 6, rf], [xl - ov, yf + 6, rf]], gradV(c, H, yb, rf, rb + 6, '#d8664b', '#9a4129'), OUT, 1.5);
    for (let y = yb + 3; y < yf + 4; y += 5.5) { const z = lp(rb, rf, (y - yb) / (yf - yb + 8)); ln(c, H, [xl - ov, y, z], [xr + 1, y, z], 'rgba(60,10,0,.3)', 1); }
    H.poly(c, [[xl - ov, yf + 6, rf], [xr + 1, yf + 6, rf], [xr + 1, yf + 6, rf - 3], [xl - ov, yf + 6, rf - 3]], '#6e2e1e', OUT, 1.2);
    if (snow) H.poly(c, [[xl - ov, yb - 2, rb + 1], [xr + 1, yb - 2, rb + 1], [xr + 1, yf + 5, rf + 1], [xl - ov, yf + 5, rf + 1]], '#f8fbff', 'rgba(140,165,195,.85)', 1.2);
    // stovepipe
    H.box(c, xl + 10, yb + 8, 5, 5, 20, { top: '#3a3a40', front: '#55555c', stroke: OUT, lw: 1.1, z0: rb - 2 });
    // workshop sign
    wtext(c, H, xl + 25, yf + 6, rf - 6, 'WORKSHOP', { s: 6.4, fg: '#fbe6a2', w: 900, ls: 1, shadow: 'rgba(0,0,0,.6)', sx: .6, sy: .8, maxW: 44 });
    H.light(xl + 25, yf - 12, 24, 40, 'rgba(255,190,100,.55)');
  }

  // ================================================================ PICKUP + GAS PUMP
  function pickup(c, H, cx, yfront, snow) {
    const rn = H.mulberry(5), W = 30, x = cx - W / 2, TURQ = '#66a69c', TD = '#3f736b', RUSTC = '#a5502f';
    // wheels (front pair, visible at the sides) and rear pair peeking out
    H.box(c, x - 4, yfront - 16, 5, 14, 11, { top: '#2a2a2e', front: '#1c1c20', stroke: OUT, lw: 1 });
    H.box(c, x + W - 1, yfront - 16, 5, 14, 11, { top: '#2a2a2e', front: '#1c1c20', stroke: OUT, lw: 1 });
    H.box(c, x - 4, yfront - 50, 5, 14, 11, { top: '#2a2a2e', front: '#1c1c20', stroke: OUT, lw: 1 });
    H.box(c, x + W - 1, yfront - 50, 5, 14, 11, { top: '#2a2a2e', front: '#1c1c20', stroke: OUT, lw: 1 });
    // bed (back)
    H.box(c, x, yfront - 62, W, 24, 12, { top: '#4a3828', front: TURQ, stroke: OUT, lw: 1.3, z0: 6 });
    H.poly(c, [[x + 2, yfront - 60, 18], [x + W - 2, yfront - 60, 18], [x + W - 2, yfront - 40, 18], [x + 2, yfront - 40, 18]], snow ? '#f4f8fc' : '#5a4630', OUT, 1);
    H.em(c, '🪑', cx - 5, H.P3(0, yfront - 50, 24)[1] - 4, 13, { force: true });
    H.em(c, '🪴', cx + 6, H.P3(0, yfront - 46, 20)[1] - 4, 11, { force: true });
    // cab
    H.box(c, x + 1, yfront - 40, W - 2, 22, 20, { top: gradV(c, H, yfront, 0, 40, lit(TURQ, .3), TURQ), front: TURQ, stroke: OUT, lw: 1.3, z0: 10 });
    // windshield on the cab's south face
    wp(c, H, x + 4, x + W - 4, yfront - 18, 18, 28, gradV(c, H, yfront - 18, 18, 28, '#bfe0ea', '#6f98a6'), OUT, 1.2);
    ln(c, H, [cx, yfront - 18, 18], [cx, yfront - 18, 28], OUT, 1);
    wp(c, H, cx - 7, cx + 1, yfront - 18, 19, 25, '#f7f2e0', OUT, .8);
    wtext(c, H, cx - 3, yfront - 18, 22, 'FOR SALE', { s: 3.2, fg: '#a33', w: 900 });
    // hood
    H.box(c, x, yfront - 18, W, 18, 8, { top: gradV(c, H, yfront, 0, 18, lit(TURQ, .25), TURQ), front: TURQ, stroke: OUT, lw: 1.3, z0: 8 });
    // rust patches (hood and bed)
    for (let i = 0; i < 9; i++) { const rx = x + 3 + rn() * (W - 6), ry = yfront - 17 + rn() * 16, p = H.P3(rx, ry, 16); c.fillStyle = 'rgba(150,66,30,' + (.45 + rn() * .3) + ')'; c.beginPath(); c.ellipse(p[0], p[1], 2 + rn() * 3, 1 + rn() * 1.5, 0, 0, H.TAU); c.fill(); }
    for (let i = 0; i < 4; i++) { const rx = x + 2 + rn() * (W - 4), p = H.P3(rx, yfront - 0.2, 8 + rn() * 6); c.fillStyle = 'rgba(160,70,30,.7)'; c.fillRect(p[0], p[1], 2 + rn() * 3, 1.6); }
    // grille, headlights, bumper
    wp(c, H, x + 5, x + W - 5, yfront, 10, 14, '#2c2c30', OUT, 1);
    for (let k = 0; k < 4; k++) ln(c, H, [x + 8 + k * 4.4, yfront, 10], [x + 8 + k * 4.4, yfront, 14], '#c9ccd2', 1);
    [x + 2, x + W - 2].forEach(hx_ => { const p = H.P3(hx_, yfront, 12); c.fillStyle = '#fff2b8'; c.beginPath(); c.arc(p[0], p[1], 2.4, 0, H.TAU); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1; c.stroke(); H.light(hx_, yfront + 2, 12, 22, 'rgba(255,240,170,.28)'); });
    wp(c, H, x - 2, x + W + 2, yfront + 1, 5, 9, gradV(c, H, yfront, 5, 9, '#e8ecf0', '#8a929a'), OUT, 1.1);
    if (snow) { H.poly(c, [[x - .5, yfront, 16.6], [x + W + .5, yfront, 16.6], [x + W + .5, yfront - 18, 16.6], [x - .5, yfront - 18, 16.6]], '#f8fbff', 'rgba(140,165,195,.8)', 1); H.poly(c, [[x + 1, yfront - 22, 30.6], [x + W - 1, yfront - 22, 30.6], [x + W - 1, yfront - 40, 30.6], [x + 1, yfront - 40, 30.6]], '#f8fbff', 'rgba(140,165,195,.8)', 1); }
  }
  function gasPump(c, H, x, y, snow) {
    H.bbAt(c, x, y, g => {
      g.fillStyle = 'rgba(30,15,0,.3)'; g.beginPath(); g.ellipse(x + 3, y, 11, 3, 0, 0, H.TAU); g.fill();
      g.fillStyle = OUT; g.fillRect(x - 8, y - 5, 16, 5); g.fillStyle = '#7a7e86'; g.fillRect(x - 7, y - 4, 14, 3.4);
      const gr = g.createLinearGradient(x - 7, 0, x + 7, 0); gr.addColorStop(0, '#e2685b'); gr.addColorStop(.45, '#c0392b'); gr.addColorStop(1, '#7c2219');
      g.beginPath(); g.moveTo(x - 6.5, y - 5); g.lineTo(x - 6, y - 26); g.lineTo(x + 6, y - 26); g.lineTo(x + 6.5, y - 5); g.closePath(); g.fillStyle = gr; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.4; g.stroke();
      g.fillStyle = '#f4ecd0'; g.fillRect(x - 4.5, y - 22, 9, 6); g.strokeStyle = OUT; g.lineWidth = 1; g.strokeRect(x - 4.5, y - 22, 9, 6);
      g.fillStyle = '#333'; g.font = '800 3.4px ' + SANS; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('0 0 0.0', x, y - 19);
      g.fillStyle = '#fff4d6'; g.fillRect(x - 5, y - 13, 10, 3); g.fillStyle = '#8a2a1a'; g.font = '900 2.8px ' + SANS; g.fillText('GAS', x, y - 11.5);
      g.fillStyle = OUT; g.fillRect(x - 7.5, y - 28.5, 15, 3); g.fillStyle = '#e8ecf0'; g.fillRect(x - 6.5, y - 27.8, 13, 1.8);
      // glass globe
      const gg = g.createRadialGradient(x - 1.5, y - 33, 1, x, y - 32, 6); gg.addColorStop(0, '#fff7c4'); gg.addColorStop(1, '#f2b631');
      g.beginPath(); g.arc(x, y - 32, 5.2, 0, H.TAU); g.fillStyle = gg; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.3; g.stroke();
      g.fillStyle = '#c0392b'; g.font = '900 4px ' + SANS; g.fillText('G', x, y - 32);
      // hose and nozzle
      g.strokeStyle = '#222'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + 6, y - 20); g.quadraticCurveTo(x + 13, y - 14, x + 9, y - 5); g.stroke();
      g.fillStyle = '#9aa2aa'; g.fillRect(x + 7, y - 6, 4, 3);
      if (snow) { g.fillStyle = '#f8fbff'; g.beginPath(); g.ellipse(x, y - 36.4, 4.6, 1.8, 0, 0, H.TAU); g.fill(); }
    });
    H.light(x, y, 32, 36, 'rgba(255,225,130,.45)');
  }
  function shrubAt(c, H, x, y, s, P_, seed) {
    H.bbAt(c, x, y, () => {
      c.fillStyle = 'rgba(30,15,0,.25)'; c.beginPath(); c.ellipse(x + 2, y, 10 * s, 3.4 * s, 0, 0, H.TAU); c.fill();
      const gcol = P_.trees || ['#4a9a38', '#62b247', '#86cf5a'];
      [[-6, -6, 8, 0], [6, -6, 8, 0], [0, -11, 8.5, 1], [-1, -4, 8, 1]].forEach(b => { c.fillStyle = gcol[b[3]]; c.beginPath(); c.arc(x + b[0] * s, y + b[1] * s, b[2] * s, 0, H.TAU); c.fill(); });
      c.fillStyle = gcol[2]; c.beginPath(); c.arc(x - 3 * s, y - 13 * s, 4.5 * s, 0, H.TAU); c.fill();
      if (P_.snow) { c.fillStyle = '#f8fbff'; c.beginPath(); c.ellipse(x, y - 15 * s, 9 * s, 4 * s, 0, 0, H.TAU); c.fill(); }
      else if (P_.flower) { const r = H.mulberry(seed || 3); ['#ff6b8b', '#ffd45e', '#fff', '#ff9ec7'].forEach(col => { c.fillStyle = col; c.beginPath(); c.arc(x + (r() - .5) * 18 * s, y - (4 + r() * 10) * s, 1.8 * s, 0, H.TAU); c.fill(); }); }
      c.strokeStyle = 'rgba(40,60,20,.55)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y - 7 * s, 11.5 * s, Math.PI * .85, Math.PI * .15, true); c.stroke();
    });
  }
  function crateStack(c, H, x, y, snow) {
    H.box(c, x, y, 18, 14, 11, { top: '#7a5530', front: '#c99a5a', stroke: OUT, lw: 1.2 });
    wp(c, H, x + 2, x + 16, y + 14, 3, 8, null, 'rgba(70,40,15,.5)', 1);
    H.box(c, x + 3, y + 2, 13, 11, 9, { top: '#7a5530', front: '#d9ad6c', stroke: OUT, lw: 1.2, z0: 11 });
    H.em(c, '🏺', x + 9, H.P3(0, y + 8, 22)[1] - 4, 13, { force: true });
    if (snow) H.poly(c, [[x + 2, y + 3, 20.8], [x + 15, y + 3, 20.8], [x + 15, y + 13, 20.8], [x + 2, y + 13, 20.8]], '#f8fbff', 'rgba(140,165,195,.8)', 1);
  }

  // ================================================================ HOOK
  A.structures.antiques = {
    ground(c, ctx, H) { if (!ctx.built) groundUnbuilt(c, ctx, H); else groundBuilt(c, ctx, H); },
    props(ctx, H) {
      const out = [], T = H.T, P_ = ctx.P_, r = ctx.rect, snow = !!P_.snow;
      if (!ctx.built) {
        const cx = r.x + r.w / 2, sy = r.y + 100;
        out.push({
          sortY: sy / T, x0: r.x - 20, x1: r.x + r.w + 20, y0: r.y - 30, y1: sy + 10,
          hit: { x0: cx - 92, x1: cx + 92, y0: sy - 80, y1: sy + 6 },
          body(c) {
            // corner stakes with flags
            [[cx - 98, r.y + 36], [cx + 98, r.y + 36], [cx + 98, r.y + 108], [cx - 98, r.y + 108]].forEach((p, i) => {
              H.shadow(c, p[0] + 3, p[1] + 1, 5, .25); post(c, H, p[0], p[1], 20, '#c99a5a');
              H.poly(c, [[p[0], p[1], 20], [p[0] + 9, p[1], 17], [p[0] + 9, p[1], 12], [p[0], p[1], 14]], i % 2 ? '#fff' : '#e24a3a', OUT, 1);
            });
            crateStack(c, H, cx + 70, r.y + 56, snow);
            wagonWheel(c, H, cx - 78, r.y + 86, 15, -.2, snow);
            milkCan(c, H, cx - 56, r.y + 84, 1, snow);
            // upright signboard on two posts
            const w = 150, h = 46, z = 24, y = sy - 20;
            [cx - w / 2 + 8, cx + w / 2 - 8].forEach(px => H.box(c, px - 2.5, y - 2, 5, 5, z + 4, { top: '#c99a5a', front: '#8a5a2b', stroke: OUT, lw: 1.1 }));
            H.bbAt(c, cx, y + 1, s => {
              const hh = h, t = y - z * H.HZ - hh;
              s.fillStyle = 'rgba(0,0,0,.25)'; H.rr(s, cx - w / 2 + 3, t + 4, w, hh, 6); s.fill();
              H.rr(s, cx - w / 2, t, w, hh, 6); s.fillStyle = '#f3e2c0'; s.fill(); s.strokeStyle = '#8a5a2b'; s.lineWidth = 2.6; s.stroke();
              H.rr(s, cx - w / 2 + 4, t + 4, w - 8, hh - 8, 4); s.strokeStyle = '#c4473a'; s.lineWidth = 1.2; s.stroke();
              s.textAlign = 'center'; s.textBaseline = 'middle';
              s.font = '900 11px ' + SERIF; s.fillStyle = '#7a2c3a'; s.fillText('OPEN AN', cx, t + 13); s.font = '900 15px ' + SERIF; s.fillStyle = '#5a1f2a'; s.fillText('ANTIQUE STORE', cx, t + 27, w - 14);
              s.font = '700 8.5px ' + SANS; s.fillStyle = '#8a5a2b'; s.fillText('walk up and tap', cx, t + 39);
              s.font = '16px serif'; s.fillText('🏺', cx - w / 2 + 2, t + 2); s.fillText('🕰️', cx + w / 2 - 2, t + 2);
            });
            if (snow) { H.poly(c, [[cx - w / 2 - 1, y - 1, z + 4.5], [cx + w / 2 + 1, y - 1, z + 4.5], [cx + w / 2 + 1, y + 3, z + 4.5], [cx - w / 2 - 1, y + 3, z + 4.5]], 'rgba(255,255,255,.0)', null); }
            H.light(cx, sy - 16, 34, 40, 'rgba(255,215,130,.35)');
          }
        });
        return out;
      }
      const g = geo(ctx, H), { yf, x0, x1, xm } = g;
      const nctx = ctx;
      const top = g.S + 60;
      // main building
      out.push({
        sortY: yf / T, x0: g.x0 - 30, x1: g.x1 + 30, y0: g.yb - H.lift(top + 40), y1: yf + 6,
        hit: { x0: g.x0, x1: g.x1, y0: yf - H.lift(top), y1: yf + 4 },
        body(c) { buildingBody(c, ctx, H, g); }
      });
      // porch + portico (in front of the facade)
      const fy = yf + g.deckD;
      out.push({
        sortY: (fy - 3) / T, x0: g.deckX0 - 40, x1: g.deckX1 + 40, y0: yf - H.lift(100), y1: fy + 6,
        hit: { x0: g.deckX0, x1: g.deckX1, y0: yf - H.lift(60), y1: fy },
        body(c) { porchBody(c, ctx, H, g); }
      });
      if (g.work) out.push({
        sortY: (yf - 8) / T, x0: g.x0 - 70, x1: g.x0 + 4, y0: yf - 100 - H.lift(70), y1: yf + 12,
        hit: { x0: g.x0 - 50, x1: g.x0, y0: yf - 8 - H.lift(52), y1: yf },
        body(c) { workshopBody(c, ctx, H, g); }
      });
      // pickup (east lot) with crates, and the pump by the front walk
      const tx = 956, tf = yf - 6;
      out.push({
        sortY: tf / T, x0: tx - 30, x1: tx + 30, y0: tf - 68 - H.lift(34), y1: tf + 8,
        hit: { x0: tx - 18, x1: tx + 18, y0: tf - 60 - H.lift(24), y1: tf + 2 },
        body(c) { pickup(c, H, tx, tf, snow); }
      });
      out.push({
        sortY: (yf + 36) / T, x0: 920, x1: 980, y0: yf + 36 - 52, y1: yf + 44,
        hit: { x0: 928, x1: 952, y0: yf + 36 - 44, y1: yf + 38 },
        body(c) { gasPump(c, H, 940, yf + 36, snow); crateStack(c, H, 960, yf + 20, snow); }
      });
      // shrubs and a barrel on the west side
      out.push({
        sortY: (yf + 30) / T, x0: 608, x1: 668, y0: yf - 30, y1: yf + 38,
        body(c) { shrubAt(c, H, 656, yf + 28, 1, P_, 4); barrel(c, H, 642, yf + 16, 1, '#8a6a42'); }
      });
      return out;
    }
  };
})();
