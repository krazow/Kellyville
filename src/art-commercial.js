/* art-commercial.js: 3D art for the farm stand, restaurant, production buildings and for-sale lots. */
(function () {
  'use strict';
  const G = window.G; if (!G) return;
  const A = G.WorldArt = G.WorldArt || {};
  A.structures = A.structures || {}; A.terrain = A.terrain || {}; A.actors = A.actors || {};
  const TAU = Math.PI * 2;

  // ---- colour helpers
  const hex = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mix = (a, b, t) => { const p = hex(a), q = hex(b); return 'rgb(' + p.map((v, i) => Math.round(v + (q[i] - v) * t)).join(',') + ')'; };
  const lit = (a, t) => mix(a, '#ffffff', t), drk = (a, t) => mix(a, '#1a0f05', t);
  const OUT = '#3a2410';

  // ---- 3D helpers built on H
  // fp: draw on the south-facing wall plane y. Local coords (x, z): z is height in world px.
  function fp(c, H, y, fn) { c.save(); c.translate(0, y); c.scale(1, -H.HZ / H.F); try { fn(c); } finally { c.restore(); } }
  // front wall with ambient-occlusion gradient and optional vertical boards
  function wall(c, H, x, y, w, d, h, o) {
    o = o || {}; const z0 = o.z0 || 0;
    H.box(c, x, y, w, d, h, { top: o.top || lit(o.front || '#c8a070', .25), front: o.front || '#c8a070', stroke: o.stroke === undefined ? OUT : o.stroke, lw: 1.6, z0 });
    const a = H.P3(x, y + d, z0 + h), b = H.P3(x, y + d, z0);
    const g = c.createLinearGradient(0, a[1], 0, b[1]); g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(30,15,0,.28)');
    c.fillStyle = g; c.fillRect(x, a[1], w, b[1] - a[1]);
    // sunlit west edge
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x, a[1], 3, b[1] - a[1]);
    c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(x + w - 4, a[1], 4, b[1] - a[1]);
    if (o.boards) { c.strokeStyle = o.boardCol || 'rgba(60,30,10,.28)'; c.lineWidth = 1; c.beginPath(); for (let bx = x + o.boards; bx < x + w - 1; bx += o.boards) { c.moveTo(bx, a[1] + 1); c.lineTo(bx, b[1]); } c.stroke(); }
    if (o.rows) { c.strokeStyle = o.rowCol || 'rgba(60,30,10,.22)'; c.lineWidth = 1; c.beginPath(); const n = Math.floor(h / o.rows); for (let i = 1; i <= n; i++) { const yy = H.P3(0, y + d, z0 + i * o.rows)[1]; c.moveTo(x + 1, yy); c.lineTo(x + w - 1, yy); } c.stroke(); }
  }
  // gable roof, ridge east-west. Base eave at height z0 over footprint (x, y, w, d), rise above, overhang o.
  function gable(c, H, x, y, w, d, z0, rise, o) {
    o = o || {}; const ov = o.ov == null ? 5 : o.ov, col = o.col || '#a33', snow = !!o.snow;
    const xl = x - ov, xr = x + w + ov, yf = y + d + ov, ym = y + d / 2;
    // north slope (peeks above the ridge when the roof is shallow)
    H.poly(c, [[xl, y - ov, z0], [xr, y - ov, z0], [xr, ym, z0 + rise], [xl, ym, z0 + rise]], lit(col, .32), OUT, 1.6);
    if (snow) H.poly(c, [[xl, y - ov, z0], [xr, y - ov, z0], [xr, ym, z0 + rise], [xl, ym, z0 + rise]], 'rgba(255,255,255,.9)', null);
    // fascia (thickness) under the front eave
    H.poly(c, [[xl, yf, z0], [xr, yf, z0], [xr, yf, z0 - 4], [xl, yf, z0 - 4]], drk(col, .5), OUT, 1.4);
    const pts = [[xl, yf, z0], [xr, yf, z0], [xr, ym, z0 + rise], [xl, ym, z0 + rise]];
    H.poly(c, pts, col, OUT, 1.8);
    const p0 = H.P3(xl, yf, z0), p1 = H.P3(xl, ym, z0 + rise);
    const g = c.createLinearGradient(0, p1[1], 0, p0[1]); g.addColorStop(0, 'rgba(0,0,0,.10)'); g.addColorStop(1, 'rgba(0,0,0,.30)');
    c.save(); c.beginPath(); pts.forEach((p, i) => { const q = H.P3(p[0], p[1], p[2]); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.closePath(); c.clip();
    c.fillStyle = g; c.fillRect(xl, p1[1], xr - xl, p0[1] - p1[1]);
    c.strokeStyle = o.line || 'rgba(0,0,0,.2)'; c.lineWidth = 1;
    c.beginPath();
    if (o.seams) { for (let sx = xl + o.seams; sx < xr; sx += o.seams) { c.moveTo(sx, p0[1]); c.lineTo(sx, p1[1]); } }
    else { const rows = o.rows || 5; for (let i = 1; i < rows; i++) { const yy = p0[1] + (p1[1] - p0[1]) * i / rows; c.moveTo(xl, yy); c.lineTo(xr, yy); } }
    c.stroke();
    if (snow) { c.fillStyle = 'rgba(255,255,255,.95)'; c.fillRect(xl, p1[1], xr - xl, (p0[1] - p1[1]) * .55); c.fillStyle = 'rgba(150,175,200,.5)'; c.fillRect(xl, p1[1] + (p0[1] - p1[1]) * .55, xr - xl, 2); }
    c.restore();
    // ridge cap
    c.strokeStyle = lit(col, .6); c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(xl, p1[1]); c.lineTo(xr, p1[1]); c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 1.2; c.beginPath(); c.moveTo(xl, p1[1] - 1.2); c.lineTo(xr, p1[1] - 1.2); c.stroke();
    if (snow) { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(xl, p1[1]); c.lineTo(xr, p1[1]); c.lineTo(xr - 1, p1[1] - 3); c.lineTo(xl + 1, p1[1] - 3); c.fill(); }
  }
  // pyramid/hip roof on a square footprint
  function hip(c, H, x, y, w, d, z0, rise, o) {
    o = o || {}; const ov = o.ov == null ? 4 : o.ov, col = o.col || '#a33', cx = x + w / 2, cy = y + d / 2;
    const xl = x - ov, xr = x + w + ov, yf = y + d + ov, yb = y - ov;
    const apex = [cx, cy, z0 + rise];
    H.poly(c, [[xl, yf, z0], [xr, yf, z0], [xr, yf, z0 - 4], [xl, yf, z0 - 4]], drk(col, .5), OUT, 1.4);
    // west side (lit, thin), east side (dark), then south (main)
    H.poly(c, [[xl, yf, z0], [xl, yb, z0], apex], lit(col, .12), OUT, 1.5);
    H.poly(c, [[xr, yf, z0], [xr, yb, z0], apex], drk(col, .2), OUT, 1.5);
    H.poly(c, [[xl, yf, z0], [xr, yf, z0], apex], col, OUT, 1.8);
    if (o.snow) { const a = H.P3(cx, cy, z0 + rise), l = H.P3(xl, yf, z0), r = H.P3(xr, yf, z0); c.fillStyle = 'rgba(255,255,255,.93)'; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(lerp(a[0], l[0], .6), lerp(a[1], l[1], .6)); c.lineTo(lerp(a[0], r[0], .6), lerp(a[1], r[1], .6)); c.closePath(); c.fill(); }
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  // window on front wall, with frame, mullion and optional glow
  function win(c, H, y, x, z, w, h, o) {
    o = o || {};
    fp(c, H, y, g => {
      g.fillStyle = o.frame || '#fff4d6'; g.fillRect(x - 2, z - 2, w + 4, h + 4);
      const gr = g.createLinearGradient(0, z + h, 0, z); gr.addColorStop(0, o.a || '#ffe9a8'); gr.addColorStop(1, o.b || '#ffc860');
      g.fillStyle = o.night ? '#ffe28a' : gr; g.fillRect(x, z, w, h);
      g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.moveTo(x + 1, z + 1); g.lineTo(x + w * .45, z + 1); g.lineTo(x + 1, z + h * .55); g.fill();
      g.strokeStyle = o.frame || '#fff4d6'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + w / 2, z); g.lineTo(x + w / 2, z + h); if (h > 14) { g.moveTo(x, z + h / 2); g.lineTo(x + w, z + h / 2); } g.stroke();
      g.strokeStyle = OUT; g.lineWidth = 1.2; g.strokeRect(x - 2, z - 2, w + 4, h + 4);
    });
    if (o.sill) H.box(c, x - 3, y + 0, w + 6, 3, 2.5, { top: '#d9c9a8', front: '#a89478', stroke: OUT, lw: 1, z0: z - 2.5 });
  }
  function door(c, H, y, cx, w, h, col, arched) {
    fp(c, H, y, g => {
      g.beginPath(); g.moveTo(cx - w / 2, 0);
      if (arched) { g.lineTo(cx - w / 2, h - w / 2); g.ellipse(cx, h - w / 2, w / 2, w / 2 / (H.HZ / H.F), 0, Math.PI, 0); } else { g.lineTo(cx - w / 2, h); g.lineTo(cx + w / 2, h); }
      g.lineTo(cx + w / 2, 0); g.closePath();
      g.fillStyle = col; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, h - (arched ? 0 : 0)); g.stroke();
      g.fillStyle = '#ffd45e'; g.beginPath(); g.arc(cx + w / 4, h * .42, 1.5, 0, TAU); g.fill();
      // trim
      g.strokeStyle = 'rgba(255,244,214,.6)'; g.lineWidth = 1.6; g.stroke();
    });
  }
  // screen-true sprite stuff standing at ground point (x,y): fn(c, hy) where hy(z) gives screen y for height z
  function stand(c, H, x, y, fn) { H.bbAt(c, x, y, g => fn(g, z => y - z * H.HZ)); }
  function sign(c, H, x, y, z, w, h, lines, o) {
    o = o || {};
    // posts
    [x - w / 2 + 6, x + w / 2 - 6].forEach(px => H.box(c, px - 2, y - 2, 4, 4, z, { top: '#a67846', front: '#7a5226', stroke: OUT, lw: 1 }));
    stand(c, H, x, y + 1, (g, hy) => {
      const top = hy(z + h * .5), bot = hy(z - h * .5 + 0), hh = h * H.HZ;
      const t = hy(z) - hh / 2;
      g.fillStyle = 'rgba(0,0,0,.25)'; H_rr(g, H, x - w / 2 + 2, t + 3, w, hh, 5); g.fill();
      g.fillStyle = o.bg || '#fff8e6'; H_rr(g, H, x - w / 2, t, w, hh, 5); g.fill(); g.lineWidth = 2.4; g.strokeStyle = o.bd || '#8a5a2b'; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x - w / 2 + 3, t + 2, w - 6, 2);
      g.fillStyle = o.fg || '#5a3418'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const n = lines.length; lines.forEach((ln, i) => { g.font = (ln.w || 800) + ' ' + (ln.s || 9) + 'px system-ui,-apple-system,sans-serif'; g.fillStyle = ln.c || o.fg || '#5a3418'; g.fillText(ln.t, x, t + hh * (i + .5) / n + .5); });
    });
  }
  function H_rr(g, H, x, y, w, h, r) { H.rr(g, x, y, w, h, r); }
  function label(c, H, cx, cy, text, o) { H.plate(c, cx, cy, text, o); }
  const snowy = P_ => !!P_.snow;
  // snow cap on top face of a box
  function snowTop(c, H, x, y, w, d, z, inset) { inset = inset || 0; H.poly(c, [[x - 1, y - 1, z + 1.5], [x + w + 1, y - 1, z + 1.5], [x + w + 1, y + d + 1, z + 1.5], [x - 1, y + d + 1, z + 1.5]], 'rgba(255,255,255,.95)', 'rgba(150,175,200,.7)', 1); }
  function post(c, H, x, y, h, col) { H.box(c, x - 2, y - 2, 4, 4, h, { top: lit(col || '#8a5a2b', .3), front: col || '#8a5a2b', stroke: OUT, lw: 1 }); }
  function lantern(c, H, x, y, z) {
    const p = H.P3(x, y, z);
    c.strokeStyle = '#2a1a0a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(p[0], p[1] - 5); c.lineTo(p[0], p[1] - 2); c.stroke();
    c.fillStyle = '#ffd45e'; c.strokeStyle = '#2a1a0a'; c.lineWidth = 1.4; H.rr(c, p[0] - 3, p[1] - 3, 6, 7, 2); c.fill(); c.stroke();
    c.fillStyle = '#fff6c8'; c.fillRect(p[0] - 1.2, p[1] - 1.5, 2.4, 4);
  }

  // =============================================================== FARM STAND
  const STAND_EM = ['🍎', '🥕', '🌽', '🥚', '🍞', '🍯'];
  function crate(c, H, x, y, w, d, h, em, size) {
    H.box(c, x, y, w, d, h, { top: '#5a3a1c', front: '#c99a5a', stroke: OUT, lw: 1.3 });
    fp(c, H, y + d, g => { g.strokeStyle = 'rgba(70,40,15,.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 1, h * .5); g.lineTo(x + w - 1, h * .5); g.stroke(); });
    // produce heaped in the crate
    for (let i = 0; i < 3; i++) H.em(c, em, x + w * (.2 + .3 * i), y + d * .5 - H.lift(h) + 1 - (i === 1 ? 3 : 0), size, { force: true });
  }
  A.structures.stand = {
    ground(c, ctx, H) {
      const r = ctx.rect, P_ = ctx.P_;
      if (!ctx.built) {
        // trodden, staked-out plot
        c.fillStyle = P_.snow ? 'rgba(220,228,236,.7)' : 'rgba(160,120,60,.26)'; H.rr(c, r.x + 6, r.y + 8, r.w - 12, r.h - 14, 10); c.fill();
        c.setLineDash([8, 6]); c.lineWidth = 2.2; c.strokeStyle = 'rgba(255,255,255,.9)'; H.rr(c, r.x + 6, r.y + 8, r.w - 12, r.h - 14, 10); c.stroke(); c.setLineDash([]);
        // string between stakes
        c.strokeStyle = '#e24a3a'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(r.x + 14, r.y + 14); c.lineTo(r.x + r.w - 14, r.y + 14); c.lineTo(r.x + r.w - 14, r.y + r.h - 8); c.lineTo(r.x + 14, r.y + r.h - 8); c.closePath(); c.stroke();
        return;
      }
      // gravel apron + shadows
      c.fillStyle = P_.snow ? 'rgba(235,240,245,.8)' : 'rgba(196,160,104,.55)'; H.rr(c, r.x + 2, r.y + 30, r.w - 4, r.h - 28, 12); c.fill();
      H.castShadow(c, r.x + 28, r.y + 38, 144, 28, 26, .26);
      H.castShadow(c, r.x + 16, r.y + 36, 168, 40, 78, .13);
      [[r.x + 20, r.y + 74], [r.x + 180, r.y + 74], [r.x + 20, r.y + 38], [r.x + 180, r.y + 38]].forEach(p => H.shadow(c, p[0], p[1], 5, .3));
    },
    props(ctx, H) {
      const r = ctx.rect, P_ = ctx.P_, out = [];
      if (!ctx.built) {
        const cx = r.x + r.w / 2;
        out.push({
          sortY: (r.y + r.h - 20) / H.T, x0: r.x - 8, x1: r.x + r.w + 8, y0: r.y - 70, y1: r.y + r.h + 4,
          hit: { x0: r.x, x1: r.x + r.w, y0: r.y - 40, y1: r.y + r.h },
          body(c) {
            // corner stakes with flags
            [[r.x + 14, r.y + 14], [r.x + r.w - 14, r.y + 14], [r.x + r.w - 14, r.y + r.h - 8], [r.x + 14, r.y + r.h - 8]].forEach((p, i) => {
              H.shadow(c, p[0] + 3, p[1] + 1, 5, .25);
              post(c, H, p[0], p[1], 20, '#c99a5a');
              H.poly(c, [[p[0], p[1], 20], [p[0] + 9, p[1], 17], [p[0] + 9, p[1], 12], [p[0], p[1], 14]], i % 2 ? '#fff' : '#e24a3a', OUT, 1);
              if (P_.snow) snowTop(c, H, p[0] - 2, p[1] - 2, 4, 4, 20);
            });
            // basket + crate sitting on the plot
            // upright sign
            H.castShadow(c, cx - 20, r.y + 54, 46, 4, 30, .2);
            sign(c, H, cx, r.y + 58, 22, 128, 38, [{ t: 'BUILD A FARM STAND', s: 10, w: 900 }, { t: 'walk up and tap', s: 8.5, w: 700, c: '#8a5a2b' }], { bg: '#ffe39a' });
            if (P_.snow) snowTop(c, H, cx - 64, r.y + 56, 128, 4, 22 + 19 + 1);
          }
        });
        return out;
      }
      const X = r.x, Y = r.y, cx = X + r.w / 2, snow = P_.snow;
      const cxl = X + 26, cw = 120, cy = Y + 38, cd = 28, ch = 26;   // counter
      const baseY = Y + r.h - 4;
      H.light(cx, cy + cd, 62, 70, 'rgba(255,205,120,.55)');
      H.light(X + 26, Y + r.h - 8, 40, 26, 'rgba(255,210,130,.7)');
      out.push({
        sortY: (Y + r.h - 6) / H.T, x0: X - 6, x1: X + r.w + 14, y0: Y - 70, y1: Y + r.h + 20,
        hit: { x0: X, x1: X + r.w, y0: Y - 30, y1: Y + r.h },
        body(c) {
          // back posts, then counter, then crates, front posts, awning
          post(c, H, X + 22, cy + 6, 94, '#7a5226'); post(c, H, X + r.w - 22, cy + 6, 94, '#7a5226');
          // back panel
          H.box(c, X + 24, cy + 2, r.w - 48, 4, 50, { top: '#8a5a2b', front: '#6b4220', stroke: OUT, lw: 1.2 });
          // shelf with jars/produce behind
          H.box(c, X + 30, cy + 6, r.w - 60, 6, 3, { top: '#d8ac6c', front: '#a67846', stroke: OUT, lw: 1, z0: 40 });
          ['🍯', '🥫', '🍯', '🥒', '🥫', '🍯'].forEach((e, i) => H.em(c, e, X + 40 + i * 24, cy + 8 - H.lift(40) - 4, 11, { force: true }));
          // counter box
          wall(c, H, cxl, cy, cw, cd, ch, { front: '#c99a5a', top: '#e6c088', boards: 12, boardCol: 'rgba(70,40,15,.3)' });
          H.box(c, cxl - 3, cy - 2, cw + 6, cd + 5, 3, { top: '#f0cf98', front: '#8a5a2b', stroke: OUT, lw: 1.3, z0: ch });
          // produce crates on the counter
          for (let i = 0; i < 4; i++) crate(c, H, cxl + 4 + i * 29, cy + 5, 26, 17, 8, STAND_EM[i], 11);
          // hanging chalk strip on the counter front
          fp(c, H, cy + cd, g => { g.fillStyle = '#2d3b36'; g.fillRect(cxl + 14, 4, 92, 15); g.strokeStyle = '#e8d6a8'; g.lineWidth = 1.2; g.strokeRect(cxl + 14, 4, 92, 15); });
          stand(c, H, cx, cy + cd, (g, hy) => { g.font = '800 7.5px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f5ecd2'; g.fillText('FRESH · LOCAL · DAILY', cxl + 60, hy(11.5) + 0.5); });
          // floor crates (front left / right)
          crate(c, H, X + 6, baseY - 22, 26, 18, 12, '🥔', 12);
          crate(c, H, X + 160, baseY - 30, 24, 16, 10, '🎃', 11);
          // front posts
          post(c, H, X + 16, baseY, 74, '#8a5a2b'); post(c, H, X + r.w - 16, baseY, 74, '#8a5a2b');
          // awning: back edge high at y=Y+32, front edge low at y=baseY+2
          const yb = Y + 52, yf = baseY + 2, zb = 94, zf = 74, xl = X + 6, xr = X + r.w - 6, n = 10, aw = (xr - xl) / n;
          for (let i = 0; i < n; i++) {
            const a = xl + i * aw, b = a + aw, col = i % 2 ? '#fff6e6' : '#d9483b';
            H.poly(c, [[a, yb, zb], [b, yb, zb], [b, yf, zf], [a, yf, zf]], col, null);
            // valance scallop
            const p = H.P3(a, yf, zf), q = H.P3(b, yf, zf), dz = 9 * H.HZ / H.F;
            c.fillStyle = col; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.lineTo(q[0], q[1] + dz * .5); c.arc((p[0] + q[0]) / 2, q[1] + dz * .5, aw / 2, 0, Math.PI); c.closePath(); c.fill();
            c.strokeStyle = OUT; c.lineWidth = 1.2; c.beginPath(); c.moveTo(q[0], q[1] + dz * .5); c.arc((p[0] + q[0]) / 2, q[1] + dz * .5, aw / 2, 0, Math.PI); c.stroke();
          }
          // awning shading + outline
          const aq = [[xl, yb, zb], [xr, yb, zb], [xr, yf, zf], [xl, yf, zf]];
          const t0 = H.P3(0, yb, zb)[1], t1 = H.P3(0, yf, zf)[1], gg = c.createLinearGradient(0, t0, 0, t1); gg.addColorStop(0, 'rgba(255,255,255,.28)'); gg.addColorStop(1, 'rgba(0,0,0,.14)');
          H.poly(c, aq, gg, OUT, 1.8);
          c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(xr - 5, t0, 5, t1 - t0 + 2);
          if (snow) { H.poly(c, [[xl, yb, zb], [xr, yb, zb], [xr, yb + (yf - yb) * .7, zb - (zb - zf) * .7], [xl, yb + (yf - yb) * .7, zb - (zb - zf) * .7]], 'rgba(255,255,255,.93)', null); }
          // lantern hanging at front-left post + a second one right
          lantern(c, H, X + 30, yf - 4, zf - 4); lantern(c, H, X + r.w - 30, yf - 4, zf - 4);
          // chalkboard price easel
          const ex = X + r.w + 6, ey = baseY + 1;
          stand(c, H, ex - 38, ey, (g, hy) => {
            g.strokeStyle = '#6b4220'; g.lineWidth = 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(ex - 52, ey); g.lineTo(ex - 47, hy(22)); g.moveTo(ex - 24, ey); g.lineTo(ex - 29, hy(22)); g.stroke();
            g.fillStyle = 'rgba(0,0,0,.25)'; H.rr(g, ex - 53, hy(26) + 2, 30, 24, 3); g.fill();
            g.fillStyle = '#2d3b36'; H.rr(g, ex - 55, hy(26), 30, 24, 3); g.fill(); g.lineWidth = 2.4; g.strokeStyle = '#a67846'; g.stroke();
            g.font = '800 6.5px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f5ecd2'; g.fillText('TODAY', ex - 40, hy(26) + 5); g.fillStyle = '#ffd98a'; g.fillText('🍎 $2 · 🥕 $1', ex - 40, hy(26) + 12); g.fillStyle = '#f5ecd2'; g.fillText('🥚 $3 doz', ex - 40, hy(26) + 19);
          });
          label(c, H, cx, Y + r.h + 9, 'FARM STAND');
        }
      });
      return out;
    }
  };

  // =============================================================== RESTAURANT
  function rLayout(r) { const X = r.x, Y = r.y; return { X, Y, bx: X + 10, bw: r.w - 20, yF: Y + r.h - 12, d: 100, wallH: 76, rise: 36 }; }
  function umbrella(c, H, cx, cy, i, snow) {
    const zr = 80, za = 98, R = 27, cols = i % 4 === 0 ? ['#d9483b', '#fff4e0'] : ['#2f7d6f', '#fff4e0'], N = 12, pts = [];
    for (let k = 0; k < N; k++) pts.push(k / N * TAU + .3);
    const apex = [cx, cy, za];
    H.poly(c, [[cx, cy, 16], [cx + 1.2, cy, 16], [cx + 1.2, cy, zr], [cx, cy, zr]], '#6b4220', OUT, 1);
    pts.map((a, k) => ({ a, k })).sort((p, q) => Math.sin(p.a) - Math.sin(q.a)).forEach(({ a, k }) => {
      const a2 = a + TAU / N;
      H.poly(c, [apex, [cx + Math.cos(a) * R, cy + Math.sin(a) * R, zr], [cx + Math.cos(a2) * R, cy + Math.sin(a2) * R, zr]], k % 2 ? cols[1] : cols[0], 'rgba(60,30,10,.55)', 1);
    });
    if (snow) H.poly(c, [apex, [cx - R * .5, cy + R * .3, zr + 4], [cx + R * .5, cy + R * .3, zr + 4]], 'rgba(255,255,255,.95)', null);
  }
  function chair(c, H, x, y, side) {
    H.box(c, x - 5.5, y - 5, 11, 10, 9, { top: '#c99a5a', front: '#8a5a2b', stroke: OUT, lw: 1.1 });
    H.box(c, x - 5.5, y - 6, 11, 2.5, 18, { top: '#d8aa6c', front: '#7a4a25', stroke: OUT, lw: 1.1, z0: 9 });
  }
  function restTable(c, H, tx, ty, i, snow) {
    H.shadow(c, tx, ty + 6, 24, .26);
    H.castShadow(c, tx - 10, ty - 6, 20, 12, 26, .1);
    chair(c, H, tx - 29, ty - 1, -1); chair(c, H, tx + 29, ty - 1, 1);
    // pedestal + cloth top
    H.cyl(c, tx, ty, 2.6, 18, { side: '#6b4220', top: '#6b4220' });
    H.cyl(c, tx, ty, 16.5, 4, { side: i % 2 ? '#b8342a' : '#e8dcc0', top: i % 2 ? '#d9483b' : '#fff8e8', z0: 17, shade: true });
    const tp = H.P3(tx, ty, 21);
    c.strokeStyle = 'rgba(60,30,10,.35)'; c.lineWidth = 1; c.beginPath(); c.ellipse(tp[0], tp[1], 16.5, 16.5, 0, 0, TAU); c.stroke();
    // candle jar
    const cp = H.P3(tx, ty, 21);
    c.fillStyle = 'rgba(255,255,255,.8)'; c.strokeStyle = OUT; c.lineWidth = 1; H.rr(c, cp[0] - 2.5, cp[1] - 6, 5, 6, 2); c.fill(); c.stroke();
    c.fillStyle = '#ffb030'; c.beginPath(); c.ellipse(cp[0], cp[1] - 8.5, 1.6, 2.6, 0, 0, TAU); c.fill(); c.fillStyle = '#fff2a0'; c.beginPath(); c.ellipse(cp[0], cp[1] - 8, .8, 1.5, 0, 0, TAU); c.fill();
    H.light(tx, ty, 26, 36, 'rgba(255,200,110,.5)');
    if (i % 2 === 0) { umbrella(c, H, tx, ty, i, snow); H.light(tx, ty, 80, 30, 'rgba(255,190,100,.28)'); }
  }
  function stringLights(c, H, a, b, sag, seed, nlights) {
    const N = 40, pts = [];
    for (let k = 0; k <= N; k++) { const t = k / N; pts.push(H.P3(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t) - Math.sin(t * Math.PI) * sag)); }
    c.strokeStyle = 'rgba(40,28,18,.8)'; c.lineWidth = 1.2; c.beginPath(); pts.forEach((p, k) => k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
    const n = Math.max(3, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 15));
    for (let k = 1; k < n; k++) {
      const t = k / n, p = H.P3(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t) - Math.sin(t * Math.PI) * sag);
      c.fillStyle = 'rgba(255,220,120,.28)'; c.beginPath(); c.arc(p[0], p[1] + 3, 5, 0, TAU); c.fill();
      c.fillStyle = ['#ffd45e', '#ffb86b', '#fff2b0'][k % 3]; c.strokeStyle = 'rgba(60,30,0,.6)'; c.lineWidth = .8; c.beginPath(); c.arc(p[0], p[1] + 3, 2.5, 0, TAU); c.fill(); c.stroke();
      if (k % 3 === 1 && nlights) H.light(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t) - Math.sin(t * Math.PI) * sag - 3, 26, 'rgba(255,200,110,.5)');
    }
  }
  A.structures.restaurant = {
    ground(c, ctx, H) {
      const r = ctx.rect, P_ = ctx.P_, st = ctx.stage, L = rLayout(r);
      if (st === 'open' || st === 'building') {
        // patio deck
        const dx = r.x + 4, dy = L.yF - 4, dw = r.w - 8, dh = 4.4 * H.T + 8;
        c.fillStyle = 'rgba(30,15,0,.25)'; H.rr(c, dx + 2, dy + 5, dw, dh, 10); c.fill();
        c.fillStyle = drk(P_.deck, .25); H.rr(c, dx, dy, dw, dh, 10); c.fill();
        c.save(); H.rr(c, dx + 2, dy + 2, dw - 4, dh - 5, 8); c.clip();
        c.fillStyle = P_.deck; c.fillRect(dx, dy, dw, dh);
        for (let i = 0; i < 18; i++) { const yy = dy + 4 + i * (dh / 18); c.fillStyle = i % 2 ? 'rgba(255,230,180,.10)' : 'rgba(60,30,0,.08)'; c.fillRect(dx, yy, dw, dh / 18); c.fillStyle = 'rgba(60,30,0,.32)'; c.fillRect(dx, yy, dw, 1); }
        const rn = H.mulberry(42); c.strokeStyle = 'rgba(60,30,0,.22)'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 18; i++) { const yy = dy + 4 + i * (dh / 18), x1 = dx + 20 + rn() * (dw - 40); c.moveTo(x1, yy); c.lineTo(x1, yy + dh / 18); } c.stroke();
        if (P_.snow) { c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(dx, dy, dw, dh); c.fillStyle = 'rgba(170,190,210,.25)'; for (let i = 0; i < 8; i++) c.fillRect(dx, dy + 6 + i * 22, dw, 2); }
        c.restore();
        c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(dx + 3, dy + 2, dw - 6, 2);
      }
      if (st === 'open') {
        H.castShadow(c, L.bx, L.yF - L.d, L.bw, L.d, 100, .25);
      } else if (st === 'building') {
        c.fillStyle = P_.snow ? '#e6ecf1' : '#b9a27a'; H.rr(c, L.bx - 4, L.yF - L.d - 4, L.bw + 8, L.d + 10, 6); c.fill();
        c.fillStyle = '#c9c3b6'; c.fillRect(L.bx, L.yF - L.d, L.bw, L.d); c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 1; for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(L.bx + i * L.bw / 6, L.yF - L.d); c.lineTo(L.bx + i * L.bw / 6, L.yF); c.stroke(); }
        H.castShadow(c, L.bx, L.yF - L.d, L.bw, L.d, 70, .14);
      } else {
        const x = r.x + 10, y = r.y + 20, w = r.w - 20, h = r.h - 10;
        c.fillStyle = P_.snow ? 'rgba(220,228,236,.65)' : 'rgba(170,130,70,.22)'; H.rr(c, x, y, w, h, 12); c.fill();
        c.setLineDash([9, 7]); c.lineWidth = 2.5; c.strokeStyle = 'rgba(255,255,255,.85)'; H.rr(c, x, y, w, h, 12); c.stroke(); c.setLineDash([]);
        c.strokeStyle = 'rgba(226,74,58,.9)'; c.lineWidth = 1.5; c.beginPath(); c.rect(x + 14, y + 14, w - 28, h - 30); c.stroke();
      }
    },
    props(ctx, H) {
      const r = ctx.rect, P_ = ctx.P_, st = ctx.stage, L = rLayout(r), out = [], snow = P_.snow, T = H.T;
      const cx = r.x + r.w / 2;
      if (st === 'open') {
        const yF = L.yF, yB = yF - L.d, bx = L.bx, bw = L.bw, wh = L.wallH;
        // night-time window glows
        const winX = [bx + 22, bx + 66, bx + bw - 22 - 32 - 44, bx + bw - 22 - 32];
        winX.forEach(wx => H.light(wx + 16, yF, 38, 48, 'rgba(255,215,130,.6)'));
        H.light(cx, yF, 24, 40, 'rgba(255,210,120,.55)');
        out.push({
          sortY: yF / T, x0: r.x - 6, x1: r.x + r.w + 6, y0: yB - 130, y1: yF + 28,
          hit: { x0: r.x, x1: r.x + r.w, y0: yB - 100, y1: yF + 24 },
          body(c) {
            H.shadow(c, bx + bw / 2, yF + 1, bw / 2 + 4, .28);
            // stone footing
            H.box(c, bx - 2, yB - 2, bw + 4, L.d + 4, 5, { top: '#a8a39a', front: '#8c877e', stroke: OUT, lw: 1.3 });
            wall(c, H, bx, yB, bw, L.d, wh, { front: '#b9473a', z0: 5, boards: 11, boardCol: 'rgba(60,15,10,.32)' });
            // batten highlight
            c.strokeStyle = 'rgba(255,255,255,.10)'; c.lineWidth = 1; c.beginPath(); for (let bx2 = bx + 12; bx2 < bx + bw; bx2 += 11) { c.moveTo(bx2 + 1.5, H.P3(0, yF, wh + 4)[1]); c.lineTo(bx2 + 1.5, H.P3(0, yF, 6)[1]); } c.stroke();
            // corner trim + base trim
            fp(c, H, yF, g => { g.fillStyle = '#f2e6c8'; g.fillRect(bx, 5, 5, wh); g.fillRect(bx + bw - 5, 5, 5, wh); g.fillRect(bx, wh + 1, bw, 4); g.strokeStyle = OUT; g.lineWidth = 1; g.strokeRect(bx, wh + 1, bw, 4); });
            // windows with sills + flower boxes
            winX.forEach((wx, i) => { win(c, H, yF, wx, 22, 32, 36, { night: true }); fp(c, H, yF, g => { g.fillStyle = '#6b4220'; g.fillRect(wx - 3, 17, 38, 5); g.strokeStyle = OUT; g.lineWidth = 1; g.strokeRect(wx - 3, 17, 38, 5); }); [0, 1, 2, 3].forEach(k => { c.fillStyle = ['#ff9ec7', '#ffe36a', '#fff', '#c9a8ff'][k]; const q = H.P3(wx + 3 + k * 9, yF + 1, 25); c.beginPath(); c.arc(q[0], q[1], 2.4, 0, TAU); c.fill(); }); });
            // arched door
            door(c, H, yF, cx, 40, 54, '#5a3418', true);
            fp(c, H, yF, g => { g.strokeStyle = '#f2e6c8'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 22, 5); g.lineTo(cx - 22, 54 - 20); g.ellipse(cx, 54 - 20, 22, 22 / (H.HZ / H.F), 0, Math.PI, 0); g.lineTo(cx + 22, 5); g.stroke(); });
            // lit door glass
            fp(c, H, yF, g => { g.fillStyle = '#ffe28a'; g.beginPath(); g.moveTo(cx - 12, 22); g.lineTo(cx - 12, 36); g.ellipse(cx, 36, 12, 12 / (H.HZ / H.F), 0, Math.PI, 0); g.lineTo(cx + 12, 22); g.fill(); });
            // step
            H.box(c, cx - 28, yF, 56, 8, 3, { top: '#cdbfa0', front: '#9c8e72', stroke: OUT, lw: 1.1 });
            // roof
            gable(c, H, bx, yB, bw, L.d, wh + 5, L.rise, { col: '#7d8590', seams: 11, ov: 8, snow, line: 'rgba(255,255,255,.28)' });
            // roof sign dormer: plate on roof face
            const sp = H.P3(cx, yF, wh + 5 + 16);
            H.plate(c, sp[0], sp[1] + 2, 'THE LAMBING BARN', { size: 11, bg: '#fff0c8', bd: '#5a3418' });
            H.em(c, '🐑', sp[0] - 74, sp[1] + 3, 14, { force: true });
            H.em(c, '🍽️', sp[0] + 74, sp[1] + 3, 14, { force: true });
            // lamps either side of door
            [cx - 34, cx + 34].forEach(lx => { const p = H.P3(lx, yF + 1, 46); c.fillStyle = '#ffd45e'; c.strokeStyle = OUT; c.lineWidth = 1.2; H.rr(c, p[0] - 2.5, p[1] - 3, 5, 7, 2); c.fill(); c.stroke(); });
            // eave string lights
            stringLights(c, H, [bx - 2, yF + 8, wh + 2], [bx + bw / 2 - 20, yF + 8, wh + 2], 7, 1, true);
            stringLights(c, H, [bx + bw / 2 + 20, yF + 8, wh + 2], [bx + bw + 2, yF + 8, wh + 2], 7, 2, true);
            // planters
            [bx + 14, bx + bw - 14].forEach(px => { H.box(c, px - 9, yF + 4, 18, 9, 9, { top: '#4a3020', front: '#8a5a2b', stroke: OUT, lw: 1.1 }); H.em(c, '🌼', px, yF + 3 - H.lift(9) - 1, 14, { force: true }); });
          }
        });
        // patio tables (one prop each)
        (ctx.tablePos || []).slice(0, ctx.tables).forEach((tp, i) => {
          const tx = tp.x * T, ty = tp.y * T;
          out.push({ sortY: tp.y + 0.03, x0: tx - 40, x1: tx + 40, y0: ty - 120, y1: ty + 16, hit: { x0: tx - 36, x1: tx + 36, y0: ty - 30, y1: ty + 10 }, body(c) { restTable(c, H, tx, ty, i, snow); } });
        });
        // patio string-light posts
        const py = r.y + r.h - 12 + 4.4 * T - 8, lx = r.x + 10, rx = r.x + r.w - 10;
        out.push({
          sortY: py / T + 0.05, x0: r.x, x1: r.x + r.w, y0: yF - 120, y1: py + 10, hit: { x0: 0, x1: 0, y0: 0, y1: 0 },
          body(c) {
            stringLights(c, H, [lx, yF + 10, wh + 2], [lx, py, 76], 4, 3, false);
            stringLights(c, H, [rx, yF + 10, wh + 2], [rx, py, 76], 4, 4, false);
            [lx, rx].forEach(px => { H.shadow(c, px, py + 1, 6, .3); post(c, H, px, py, 76, '#6b4220'); if (snow) snowTop(c, H, px - 2, py - 2, 4, 4, 76); });
            stringLights(c, H, [lx, py, 76], [rx, py, 76], 12, 5, true);
            H.em(c, '🪴', lx + 18, py - 4, 17, { force: true }); H.em(c, '🪴', rx - 18, py - 4, 17, { force: true });
          }
        });
      } else if (st === 'building') {
        const yF = L.yF, yB = yF - L.d, bx = L.bx, bw = L.bw, wh = 74;
        out.push({
          sortY: yF / T, x0: r.x - 10, x1: r.x + r.w + 10, y0: yB - 130, y1: yF + 40, hit: { x0: r.x, x1: r.x + r.w, y0: yB - 90, y1: yF + 24 },
          body(c) {
            const beam = '#d8a864', beamD = '#a8783c', n = 6, sp = bw / n;
            // back posts + plate
            for (let i = 0; i <= n; i++) H.box(c, bx + i * sp - 3, yB - 3, 6, 6, wh, { top: lit(beam, .2), front: beamD, stroke: OUT, lw: 1.1 });
            H.box(c, bx - 3, yB - 3, bw + 6, 6, 6, { top: lit(beam, .25), front: beamD, stroke: OUT, lw: 1.1, z0: wh });
            // sheathed bays (plywood) on left two
            for (let i = 0; i < 2; i++) H.poly(c, [[bx + i * sp + 3, yF, 4], [bx + (i + 1) * sp - 3, yF, 4], [bx + (i + 1) * sp - 3, yF, wh - 4], [bx + i * sp + 3, yF, wh - 4]], i ? '#e2c48a' : '#ebd09a', OUT, 1.2);
            // front posts + plate
            for (let i = 0; i <= n; i++) H.box(c, bx + i * sp - 3, yF - 6, 6, 6, wh, { top: lit(beam, .25), front: beamD, stroke: OUT, lw: 1.2 });
            H.box(c, bx - 3, yF - 6, bw + 6, 6, 7, { top: lit(beam, .25), front: beam, stroke: OUT, lw: 1.2, z0: wh });
            // diagonal braces
            for (let i = 2; i < n; i++) H.poly(c, [[bx + i * sp, yF, 4], [bx + i * sp + 3, yF, 4], [bx + (i + 1) * sp, yF, 36], [bx + (i + 1) * sp - 3, yF, 36]], beamD, OUT, 1);
            // rafters to a ridge beam
            const ym = (yF + yB) / 2, rz = wh + 7 + 34;
            for (let i = 0; i <= n; i++) { const x = bx + i * sp; H.poly(c, [[x - 2, yF - 3, wh + 7], [x + 2, yF - 3, wh + 7], [x + 2, ym, rz], [x - 2, ym, rz]], beam, OUT, 1.1); }
            H.poly(c, [[bx - 3, ym, rz], [bx + bw + 3, ym, rz], [bx + bw + 3, ym, rz - 5], [bx - 3, ym, rz - 5]], beamD, OUT, 1.2);
            // roof deck on left third
            H.poly(c, [[bx - 4, yF, wh + 7], [bx + 2 * sp, yF, wh + 7], [bx + 2 * sp, ym, rz], [bx - 4, ym, rz]], '#e6c88e', OUT, 1.3);
            H.poly(c, [[bx - 4, yF, wh + 7], [bx + 2 * sp, yF, wh + 7], [bx + 2 * sp, yF, wh + 3], [bx - 4, yF, wh + 3]], beamD, OUT, 1);
            if (snow) { H.poly(c, [[bx - 4, yF, wh + 7], [bx + 2 * sp, yF, wh + 7], [bx + 2 * sp, ym, rz], [bx - 4, ym, rz]], 'rgba(255,255,255,.9)', null); }
            // scaffolding on the right
            const sx0 = bx + bw - 96, sx1 = bx + bw - 6, sy = yF + 12;
            [sx0, (sx0 + sx1) / 2, sx1].forEach(px => H.poly(c, [[px - 1.5, sy, 0], [px + 1.5, sy, 0], [px + 1.5, sy, 92], [px - 1.5, sy, 92]], '#aeb4ba', OUT, 1));
            [32, 62, 90].forEach(z => { H.box(c, sx0 - 4, sy - 12, sx1 - sx0 + 8, 14, 3, { top: '#d6b57c', front: '#9c7a46', stroke: OUT, lw: 1, z0: z - 3 }); });
            for (let k = 0; k < 2; k++) { const a = k ? (sx0 + sx1) / 2 : sx0, b = k ? sx1 : (sx0 + sx1) / 2; c.strokeStyle = '#8c9298'; c.lineWidth = 1.4; const p1 = H.P3(a, sy, 30), p2 = H.P3(b, sy, 62), p3 = H.P3(a, sy, 62), p4 = H.P3(b, sy, 30); c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.moveTo(p3[0], p3[1]); c.lineTo(p4[0], p4[1]); c.stroke(); }
            // materials: plank stack + sawhorse + cones
            H.box(c, bx + 6, yF + 8, 44, 14, 8, { top: '#e0be86', front: '#b8924e', stroke: OUT, lw: 1.1 });
            fp(c, H, yF + 22, g => { g.strokeStyle = 'rgba(70,40,15,.5)'; g.lineWidth = 1; for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(bx + 6, 8 * k / 3); g.lineTo(bx + 50, 8 * k / 3); g.stroke(); } });
            H.em(c, '🚧', bx + 70, yF + 26, 26, { force: true }); H.em(c, '🚧', bx + bw - 120, yF + 30, 26, { force: true });
            H.em(c, '🏗️', cx, H.P3(0, yB, 90)[1], 34, { force: true });
            H.plate(c, cx - 20, yF + 46, 'UNDER CONSTRUCTION', { size: 10, bg: '#ffe39a' });
          }
        });
      } else {
        const permit = st === 'permit', X = r.x, Y = r.y;
        out.push({
          sortY: (Y + r.h - 6) / T, x0: X, x1: X + r.w, y0: Y - 40, y1: Y + r.h + 10, hit: { x0: X + 10, x1: X + r.w - 10, y0: Y - 20, y1: Y + r.h },
          body(c) {
            const x = X + 10, y = Y + 20, w = r.w - 20, h = r.h - 10;
            [[x + 14, y + 14], [x + w - 14, y + 14], [x + w - 14, y + h - 16], [x + 14, y + h - 16]].forEach((p, i) => {
              H.shadow(c, p[0] + 3, p[1] + 1, 5, .25); post(c, H, p[0], p[1], 24, '#d9483b');
              H.poly(c, [[p[0], p[1], 24], [p[0] + 10, p[1], 21], [p[0] + 10, p[1], 15], [p[0], p[1], 17]], '#fff', OUT, 1);
              if (snow) snowTop(c, H, p[0] - 2, p[1] - 2, 4, 4, 24);
            });
            H.em(c, '🍽️', cx, Y + 74, 38, { alpha: .5, force: true });
            // sandbags / pallet pile for charm
            H.box(c, x + 40, y + h - 40, 34, 16, 7, { top: '#e0be86', front: '#b8924e', stroke: OUT, lw: 1.1 });
            H.box(c, x + w - 80, y + h - 38, 26, 14, 14, { top: '#c9ccd0', front: '#9fa4aa', stroke: OUT, lw: 1.1 });
            H.castShadow(c, cx - 62, Y + 116, 124, 4, 62, .2);
            sign(c, H, cx, Y + 118, 36, 130, 50, [{ t: permit ? 'PLANNING PERMIT' : 'FUTURE SITE OF', s: 10, w: 900 }, { t: permit ? 'PENDING' : 'A FARM-TO-TABLE', s: 10, w: 900 }, { t: permit ? '📜 Hearing soon' : 'RESTAURANT', s: 8.5, w: 700, c: '#8a5a2b' }], { bg: '#fff8e6' });
            if (snow) snowTop(c, H, cx - 65, Y + 116, 130, 4, 36 + 40 + 1);
          }
        });
      }
      return out;
    }
  };

  // =============================================================== PRODUCTION BUILDINGS
  function geom(r) { return { X: r.x, Y: r.y, bx: r.x + 10, bw: 60, yF: r.y + 70, d: 34, yB: r.y + 36, cx: r.x + 40 }; }
  function bricks(c, H, g, wh, col) {
    fp(c, H, g.yF, q => { q.strokeStyle = col || 'rgba(60,20,10,.28)'; q.lineWidth = .9; q.beginPath();
      for (let z = 0, row = 0; z < wh; z += 4.5, row++) { q.moveTo(g.bx, z); q.lineTo(g.bx + g.bw, z); for (let x = g.bx + (row % 2 ? 4 : 0); x < g.bx + g.bw; x += 8) { q.moveTo(x, z); q.lineTo(x, z + 4.5); } }
      q.stroke(); });
  }
  function stones(c, H, g, wh) {
    fp(c, H, g.yF, q => { q.strokeStyle = 'rgba(50,40,30,.3)'; q.lineWidth = 1; q.beginPath();
      for (let z = 6, row = 0; z < wh; z += 9, row++) { q.moveTo(g.bx, z); q.lineTo(g.bx + g.bw, z); for (let x = g.bx + (row % 2 ? 7 : 0); x < g.bx + g.bw; x += 14) { q.moveTo(x, z - 9 < 0 ? 0 : z - 9); q.lineTo(x, z); } }
      q.stroke(); });
  }
  function puffs(c, H, x, y, z, k) {
    const p = H.P3(x, y, z);
    [[0, 0, 4], [3, -8, 5.5], [-1, -17, 7], [4, -28, 8.5]].forEach((q, i) => { c.fillStyle = 'rgba(255,255,255,' + (.85 - i * .15) + ')'; c.strokeStyle = 'rgba(120,130,140,.35)'; c.lineWidth = 1; c.beginPath(); c.arc(p[0] + q[0] + 2 * (k || 0), p[1] + q[1], q[2], 0, TAU); c.fill(); c.stroke(); });
  }
  function chimney(c, H, x, y, z0, h, col, snow) {
    H.box(c, x - 5, y - 4, 10, 8, h, { top: '#3a2a22', front: col, stroke: OUT, lw: 1.2, z0 });
    H.box(c, x - 6.5, y - 5.5, 13, 11, 3, { top: lit(col, .3), front: drk(col, .15), stroke: OUT, lw: 1, z0: z0 + h });
    if (snow) snowTop(c, H, x - 6.5, y - 5.5, 13, 11, z0 + h + 3);
  }
  function barrel(c, H, x, y, s) {
    s = s || 1; H.shadow(c, x + 2, y + 1, 9 * s, .28);
    H.cyl(c, x, y, 7 * s, 15 * s, { side: '#a06a30', top: '#c8935a', hi: 'rgba(255,230,180,.25)' });
    [4, 11].forEach(z => { const p = H.P3(x, y, z * s); c.strokeStyle = '#4a3320'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(p[0], p[1], 7 * s, 7 * s, 0, 0, Math.PI); c.stroke(); });
  }
  function sailsAt(c, H, x, y, z, len, rot) {
    const p = H.P3(x, y, z);
    H.bbAt(c, x, y, g => {
      const hy = y - z * H.HZ; g.save(); g.translate(x, hy); g.rotate(rot);
      for (let k = 0; k < 4; k++) {
        g.save(); g.rotate(k * Math.PI / 2); g.fillStyle = '#6b4220'; g.fillRect(-1.6, 0, 3.2, len);
        g.fillStyle = '#f4ecd8'; g.strokeStyle = OUT; g.lineWidth = 1.1; g.beginPath(); g.rect(1.6, 6, 9, len - 8); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(90,60,30,.55)'; g.lineWidth = .8; g.beginPath(); for (let l = 10; l < len - 2; l += 5) { g.moveTo(1.6, l); g.lineTo(10.6, l); } g.moveTo(6, 6); g.lineTo(6, len - 2); g.stroke();
        g.restore();
      }
      g.fillStyle = '#4a2f18'; g.beginPath(); g.arc(0, 0, 3.6, 0, TAU); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1; g.stroke();
      g.restore();
    });
  }
  function awningSmall(c, H, x0, x1, y, z, depth, a, b, n) {
    const aw = (x1 - x0) / n;
    for (let i = 0; i < n; i++) { const p = x0 + i * aw, q = p + aw; H.poly(c, [[p, y - 3, z + 4], [q, y - 3, z + 4], [q, y + depth, z - 5], [p, y + depth, z - 5]], i % 2 ? b : a, null); const u = H.P3(p, y + depth, z - 5), v = H.P3(q, y + depth, z - 5); c.fillStyle = i % 2 ? b : a; c.beginPath(); c.moveTo(u[0], u[1]); c.lineTo(v[0], v[1]); c.lineTo((u[0] + v[0]) / 2, v[1] + 4); c.closePath(); c.fill(); }
    H.poly(c, [[x0, y - 3, z + 4], [x1, y - 3, z + 4], [x1, y + depth, z - 5], [x0, y + depth, z - 5]], null, OUT, 1.4);
  }
  const BTYPES = {
    feed_mill: { wall: '#b5693a', boards: 6, wh: 66, rise: 26, roof: '#6f8a62', seams: 6, door: ['#5a3418'], tall: 1,
      wins: [[14, 36, 12, 12]],
      back(c, H, g, s) { // silo
        const sx = g.bx + g.bw - 6, sy = g.yF - 8; H.shadow(c, sx + 3, sy + 2, 16, .3);
        H.cyl(c, sx, sy, 11, 84, { side: '#cdd5da', top: '#9aa6ae', hi: 'rgba(255,255,255,.4)' });
        for (let z = 12; z < 84; z += 12) { const p = H.P3(sx, sy, z); c.strokeStyle = 'rgba(70,80,90,.45)'; c.lineWidth = 1; c.beginPath(); c.ellipse(p[0], p[1], 11, 11, 0, 0, Math.PI); c.stroke(); }
        const t = H.P3(sx, sy, 84), a = H.P3(sx, sy, 100); c.fillStyle = s.snow ? '#fff' : '#7e8c96'; c.strokeStyle = OUT; c.lineWidth = 1.4; c.beginPath(); c.moveTo(t[0] - 12, t[1]); c.lineTo(a[0], a[1]); c.lineTo(t[0] + 12, t[1]); c.arc(t[0], t[1], 12, 0, Math.PI, false); c.closePath(); c.fill(); c.stroke();
      },
      front(c, H, g, s) { // hopper on the roof
        const z0 = s.wh + s.rise - 2, cx = g.bx + 22;
        H.poly(c, [[cx - 11, g.yB + 22, z0 + 22], [cx + 11, g.yB + 22, z0 + 22], [cx + 4, g.yB + 22, z0 + 6], [cx - 4, g.yB + 22, z0 + 6]], '#9a6a34', OUT, 1.4);
        H.poly(c, [[cx - 11, g.yB + 22, z0 + 22], [cx + 11, g.yB + 22, z0 + 22], [cx + 11, g.yB + 12, z0 + 22], [cx - 11, g.yB + 12, z0 + 22]], '#2a1c10', OUT, 1.2);
        H.poly(c, [[cx - 3, g.yB + 22, z0 + 6], [cx + 3, g.yB + 22, z0 + 6], [cx + 3, g.yB + 22, z0 - 4], [cx - 3, g.yB + 22, z0 - 4]], '#5a4a3a', OUT, 1);
        H.em(c, '🌾', cx, H.P3(0, g.yB + 22, z0 + 28)[1], 13, { force: true });
      } },
    grain_mill: { tower: 1 },
    bakery: { wall: '#b24f36', brick: 1, wh: 56, rise: 28, roof: '#9a6a3c', rows: 5, door: ['#6b3a1e'], wins: [[10, 18, 18, 20], [44, 18, 18, 20]],
      front(c, H, g, s) { chimney(c, H, g.bx + g.bw - 14, g.yB + 12, s.wh + s.rise * .55, 26, '#9c4430', s.snow); awningSmall(c, H, g.bx + 6, g.bx + 28, g.yF, 42, 7, '#fff4e0', '#d9483b', 4); awningSmall(c, H, g.bx + 40, g.bx + 62, g.yF, 42, 7, '#fff4e0', '#d9483b', 4); if (!s.snow) puffs(c, H, g.bx + g.bw - 14, g.yB + 12, s.wh + s.rise * .55 + 30, 1); } },
    creamery: { wall: '#f1efe6', boards: 7, boardCol: 'rgba(80,100,130,.22)', wh: 56, rise: 28, roof: '#3d78c4', rows: 5, door: ['#3d78c4'], wins: [[10, 20, 16, 18], [48, 20, 16, 18]], plaque: '🐄',
      front(c, H, g, s) { [g.bx + g.bw + 2, g.bx + g.bw + 12].forEach((x, i) => { H.shadow(c, x + 1, g.yF + 8, 6, .26); H.cyl(c, x - 1, g.yF + 6, 5, 11 + i, { side: '#d6dde2', top: '#eef3f6', hi: 'rgba(255,255,255,.5)' }); const p = H.P3(x - 1, g.yF + 6, 8); c.strokeStyle = '#6a7a86'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(p[0], p[1], 5, 5, 0, 0, Math.PI); c.stroke(); }); } },
    cider_press: { wall: '#b7382c', boards: 6, boardCol: 'rgba(50,10,8,.3)', wh: 54, rise: 28, roof: '#8a4a34', rows: 5, door: ['#f2e6c8', 1], wins: [[10, 22, 16, 16]], plaque: '🍎',
      front(c, H, g, s) { H.box(c, g.bx + 36, g.yF + 4, 26, 14, 8, { top: '#5a3a1c', front: '#c99a5a', stroke: OUT, lw: 1.1 }); [0, 1, 2].forEach(i => H.em(c, '🍎', g.bx + 41 + i * 8, g.yF + 11 - H.lift(8) - (i === 1 ? 2 : 0), 10, { force: true })); barrel(c, H, g.bx + 4, g.yF + 10, .9); } },
    winery: { wall: '#bdb29c', stone: 1, wh: 54, rise: 28, roof: '#c4623a', hip: 1, door: ['#5a3418', 1], wins: [[10, 24, 14, 18], [46, 24, 14, 18]], plaque: '🍇',
      front(c, H, g, s) { barrel(c, H, g.bx + g.bw + 6, g.yF + 4, 1.1); barrel(c, H, g.bx + g.bw + 6, g.yF + 17, 1.1); barrel(c, H, g.bx - 4, g.yF + 6, 1); } },
    hop_brewery: { wall: '#d8b878', rows: 6, rowCol: 'rgba(80,50,20,.22)', wh: 74, rise: 22, roof: '#8a6a4a', hip: 1, narrow: 40, door: ['#5a3418'], wins: [[10, 36, 10, 16]], tall: 1,
      back(c, H, g, s) { // lean-to brewhouse
        const x = g.bx - 4, w = 24; wall(c, H, x, g.yF - 30, w, 28, 30, { front: '#c4a468', rows: 6 }); H.poly(c, [[x - 3, g.yF + 2, 32], [x + w + 3, g.yF + 2, 32], [x + w + 3, g.yF - 30, 42], [x - 3, g.yF - 30, 42]], s.snow ? '#fff' : '#7a5a3a', OUT, 1.4);
        win(c, H, g.yF - 2, x + 6, 8, 12, 14, {});
      },
      front(c, H, g, s) {
        const w = 14, x = g.cx + 6 - w / 2 + 8, y = g.yB + 14, z0 = s.wh + s.rise - 2;
        H.box(c, x, y, w, 12, 10, { top: '#d8c8a0', front: '#8a6a3a', stroke: OUT, lw: 1.2, z0 });
        fp(c, H, y + 12, q => { q.strokeStyle = 'rgba(40,25,10,.8)'; q.lineWidth = 1.2; q.beginPath(); for (let k = 0; k < 4; k++) { q.moveTo(x + 2, z0 + 2 + k * 2.2); q.lineTo(x + w - 2, z0 + 2 + k * 2.2); } q.stroke(); });
        hip(c, H, x, y, w, 12, z0 + 10, 9, { col: '#4a3a2a', ov: 2, snow: s.snow });
        H.em(c, '🌿', g.bx + 8, g.yF + 4 - H.lift(18), 16, { force: true }); H.em(c, '🌿', g.bx + g.bw - 6, g.yF + 4 - H.lift(34), 16, { force: true });
      } },
    fry_shack: { wall: '#fff2d6', stripes: ['#d9483b', '#fff6e6'], wh: 38, rise: 0, flat: 1, roof: '#7a4a2a', door: null, wins: [], tall: 0,
      front(c, H, g, s) {
        // service window + striped awning
        win(c, H, g.yF, g.bx + 14, 12, 32, 14, { frame: '#d9483b', a: '#3a2a20', b: '#5a3a28' });
        H.box(c, g.bx + 10, g.yF - 2, 40, 6, 3, { top: '#e0b878', front: '#a67846', stroke: OUT, lw: 1.1, z0: 10 });
        awningSmall(c, H, g.bx + 6, g.bx + 54, g.yF + 2, 36, 8, '#d9483b', '#fff6e6', 8);
        door(c, H, g.yF, g.bx + 56, 8, 24, '#8a5a2b', false);
        // roof sign on posts
        [g.bx + 8, g.bx + 52].forEach(x => post(c, H, x, g.yF - 6, 52, '#6b4220'));
        H.castShadow(c, g.bx + 4, g.yF - 8, 52, 3, 70, 0);
        H.em(c, '🍟', g.cx - 12, H.P3(0, g.yF - 6, 66)[1], 22, { force: true }); H.em(c, '🍔', g.cx + 12, H.P3(0, g.yF - 6, 66)[1], 22, { force: true });
        H.plate(c, g.cx, H.P3(0, g.yF - 6, 52)[1], 'EAT', { size: 8, bg: '#ffd45e', bd: '#d9483b' });
      } },
    kitchen: { wall: '#f6efe0', boards: 8, boardCol: 'rgba(120,90,50,.2)', wh: 54, rise: 30, roof: '#3d8a86', rows: 5, door: ['#3d8a86'], wins: [[8, 20, 16, 18], [46, 20, 16, 18]], plaque: '🍳',
      front(c, H, g, s) { chimney(c, H, g.bx + 14, g.yB + 12, s.wh + s.rise * .5, 26, '#b86a4a', s.snow); if (!s.snow) puffs(c, H, g.bx + 14, g.yB + 12, s.wh + s.rise * .5 + 30, 0); [g.bx + 8, g.bx + 46].forEach((x, i) => { H.box(c, x - 2, g.yF + 1, 20, 5, 4, { top: '#4a3020', front: '#8a5a2b', stroke: OUT, lw: 1, z0: 12 }); [0, 1, 2].forEach(k => { const p = H.P3(x + 2 + k * 7, g.yF + 3, 18); c.fillStyle = ['#ff9ec7', '#ffe36a', '#fff'][(k + i) % 3]; c.beginPath(); c.arc(p[0], p[1], 2.4, 0, TAU); c.fill(); }); }); } },
    distillery: { wall: '#7e4e3e', brick: 1, wh: 58, rise: 24, roof: '#6a7582', rows: 5, door: ['#3a2a22'], wins: [[10, 24, 12, 16]], tall: 1,
      front(c, H, g, s) {
        const sx = g.bx + g.bw - 8, sy = g.yF - 6; H.shadow(c, sx + 2, sy + 2, 14, .3);
        H.cyl(c, sx, sy, 11, 28, { side: '#c8783a', top: '#e09a5a', hi: 'rgba(255,230,180,.5)' });
        const t = H.P3(sx, sy, 28), a = H.P3(sx, sy, 44), b = H.P3(sx - 12, sy, 62);
        c.fillStyle = '#c8783a'; c.strokeStyle = OUT; c.lineWidth = 1.4; c.beginPath(); c.moveTo(t[0] - 11, t[1]); c.quadraticCurveTo(t[0] - 8, a[1], a[0] - 3, a[1] - 2); c.lineTo(a[0] + 3, a[1] - 2); c.quadraticCurveTo(t[0] + 8, a[1], t[0] + 11, t[1]); c.arc(t[0], t[1], 11, 0, Math.PI, false); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = '#b8682e'; c.lineWidth = 3.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(a[0], a[1] - 2); c.quadraticCurveTo(a[0] - 3, b[1] - 6, b[0], b[1]); c.stroke(); c.strokeStyle = OUT; c.lineWidth = .8; c.stroke();
        if (!s.snow) puffs(c, H, sx - 12, sy, 66, 0);
        H.em(c, '🌿', g.bx + 6, g.yF + 6 - H.lift(8), 13, { force: true });
      } },
    loom: { wall: '#c8925a', boards: 6, boardCol: 'rgba(70,40,10,.3)', wh: 56, rise: 28, roof: '#8a5fa8', rows: 5, door: null, wins: [], plaque: '🧵',
      front(c, H, g, s) {
        // open loom frame in the front bay
        fp(c, H, g.yF, q => {
          q.fillStyle = '#2e1e12'; q.fillRect(g.bx + 8, 4, 44, 36);
          const cols = ['#d9483b', '#f2d27a', '#fff', '#6f9ad4', '#8a5fa8', '#f2d27a'];
          for (let i = 0; i < 12; i++) { q.fillStyle = cols[i % 6]; q.fillRect(g.bx + 10 + i * 3.5, 6, 2.2, 32 - (i % 3) * 4); }
          q.strokeStyle = '#6b4220'; q.lineWidth = 3; q.strokeRect(g.bx + 8, 4, 44, 36); q.strokeStyle = OUT; q.lineWidth = .9; q.strokeRect(g.bx + 6.5, 2.5, 47, 39);
        });
        [0, 1].forEach(i => H.em(c, '🐑', g.bx + g.bw + 4, g.yF + 12 - H.lift(0) - i * 0, 12, { force: true }));
      } },
  };
  function drawBuilding(c, H, ctx) {
    const g = geom(ctx.rect), P_ = ctx.P_, snow = !!P_.snow, type = ctx.type, def = ctx.def || {};
    let s = BTYPES[type];
    if (!s) { const h = Math.floor(H.hash(type) * 5); s = { wall: ['#f0d9b5', '#e3d6c5', '#f3e1c1', '#e8dfc9', '#f0dcc0'][h], boards: 8, wh: 54, rise: 28, roof: ['#a65f3a', '#6f8aa6', '#b8574a', '#5f8f5a', '#8a6a9a'][h], rows: 5, door: ['#8a4b2a'], wins: [[10, 20, 16, 18], [46, 20, 16, 18]], plaque: def.emoji || '🏭' }; }
    s = Object.assign({}, s, { snow, wh: s.wh + 8, rise: Math.min(s.rise, s.tall ? 26 : 22) });
    H.shadow(c, g.bx + g.bw / 2 + 2, g.yF + 1, g.bw / 2 + 6, .28);
    if (s.tower) return drawMill(c, H, g, snow, def);
    const bw = s.narrow || g.bw, bx = g.bx + (g.bw - bw) / 2; const gg = Object.assign({}, g, { bx, bw, cx: bx + bw / 2 });
    if (s.back) s.back(c, H, gg, s);
    // foundation
    H.box(c, bx - 1.5, g.yB - 1.5, bw + 3, g.d + 3, 4, { top: '#b0aaa0', front: '#8c867c', stroke: OUT, lw: 1.1 });
    if (s.stripes) {
      H.box(c, bx, g.yB, bw, g.d, s.wh, { top: '#e0d0b0', front: s.stripes[1], stroke: OUT, lw: 1.6, z0: 4 });
      fp(c, H, g.yF, q => { for (let x = bx, i = 0; x < bx + bw; x += 6, i++) { q.fillStyle = i % 2 ? s.stripes[1] : s.stripes[0]; q.fillRect(x, 4, Math.min(6, bx + bw - x), s.wh); } q.fillStyle = 'rgba(0,0,0,.14)'; q.fillRect(bx, 4, bw, 8); q.strokeStyle = OUT; q.lineWidth = 1.2; q.strokeRect(bx, 4, bw, s.wh); });
    } else wall(c, H, bx, g.yB, bw, g.d, s.wh, { front: s.wall, z0: 4, boards: s.boards, boardCol: s.boardCol, rows: s.rows && !s.hip ? undefined : s.rows, rowCol: s.rowCol });
    if (s.brick) bricks(c, H, gg, s.wh + 4); if (s.stone) stones(c, H, gg, s.wh + 4);
    if (s.rows && s.hip) { /* course lines already drawn by wall */ }
    fp(c, H, g.yF, q => { q.fillStyle = 'rgba(255,255,255,.35)'; q.fillRect(bx, s.wh + 1, bw, 2.5); });
    (s.wins || []).forEach(w => win(c, H, g.yF, bx + w[0], w[1], w[2], w[3], { sill: true }));
    if (s.door) { door(c, H, g.yF, gg.cx, 15, 28, s.door[0], !!s.door[1]); }
    if (s.plaque) { const p = H.P3(gg.cx, g.yF, s.wh - 6); c.fillStyle = 'rgba(255,248,230,.95)'; c.strokeStyle = '#8a5a2b'; c.lineWidth = 1.4; c.beginPath(); c.arc(p[0], p[1], 9.5, 0, TAU); c.fill(); c.stroke(); H.em(c, s.plaque, p[0], p[1] + .5, 13, { force: true }); }
    // roof
    if (s.flat) {
      H.box(c, bx - 3, g.yB - 3, bw + 6, g.d + 6, 4, { top: s.snow ? '#fff' : s.roof, front: drk(s.roof, .3), stroke: OUT, lw: 1.5, z0: s.wh + 4 });
    } else if (s.hip) hip(c, H, bx, g.yB, bw, g.d, s.wh + 4, s.rise, { col: s.roof, ov: 5, snow });
    else gable(c, H, bx, g.yB, bw, g.d, s.wh + 4, s.rise, { col: s.roof, ov: 5, rows: s.rows, snow, line: 'rgba(0,0,0,.22)' });
    if (s.front) s.front(c, H, gg, s);
    if (!s.plaque && !s.front && def.emoji) { /* generic emoji sign handled by plaque */ }
  }
  function drawMill(c, H, g, snow, def) {
    const cx = g.cx, cy = g.yF - 18, rb = 24, rt = 16, h = 66, b = H.P3(cx, cy, 0), t = H.P3(cx, cy, h), top = H.P3(cx, cy, h + 26);
    // plinth
    H.box(c, cx - 28, cy - 24, 56, 50, 6, { top: '#a8a39a', front: '#8c877e', stroke: OUT, lw: 1.3 });
    const b0 = H.P3(cx, cy, 6), t0 = H.P3(cx, cy, 6 + h);
    c.beginPath(); c.moveTo(b0[0] - rb, b0[1]); c.ellipse(b0[0], b0[1], rb, rb, 0, Math.PI, 0, true); c.lineTo(t0[0] + rt, t0[1]); c.ellipse(t0[0], t0[1], rt, rt, 0, 0, Math.PI, false); c.closePath();
    const gr = c.createLinearGradient(cx - rb, 0, cx + rb, 0); gr.addColorStop(0, '#f3e8cc'); gr.addColorStop(.4, '#e8dab6'); gr.addColorStop(1, '#b8a47c'); c.fillStyle = gr; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.7; c.stroke();
    c.save(); c.clip(); c.strokeStyle = 'rgba(80,60,30,.28)'; c.lineWidth = 1; for (let z = 14; z < h; z += 8) { const p = H.P3(cx, cy, 6 + z), r = lerp(rb, rt, z / h); c.beginPath(); c.ellipse(p[0], p[1], r, r, 0, 0, Math.PI); c.stroke(); } c.restore();
    // door + window
    fp(c, H, cy + rb - 2, q => { q.fillStyle = '#5a3418'; q.beginPath(); q.moveTo(cx - 6, 6); q.lineTo(cx - 6, 20); q.ellipse(cx, 20, 6, 6 / (H.HZ / H.F), 0, Math.PI, 0); q.lineTo(cx + 6, 6); q.fill(); q.strokeStyle = OUT; q.lineWidth = 1.2; q.stroke(); });
    const wp = H.P3(cx, cy + rb - 4, 46); c.fillStyle = '#ffe9a8'; c.strokeStyle = '#fff4d6'; c.lineWidth = 2; c.beginPath(); c.rect(wp[0] - 4, wp[1] - 5, 8, 10); c.fill(); c.stroke(); c.strokeStyle = OUT; c.lineWidth = .8; c.stroke();
    // cap
    const tc = H.P3(cx, cy, h + 6);
    c.fillStyle = snow ? '#fff' : '#8a4a2e'; c.beginPath(); c.moveTo(tc[0] - rt - 3, tc[1]); c.lineTo(tc[0], tc[1] - 24 * 1.0); c.lineTo(tc[0] + rt + 3, tc[1]); c.arc(tc[0], tc[1], rt + 3, 0, Math.PI, false); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke();
    if (snow) { c.strokeStyle = '#8a4a2e'; c.lineWidth = 2; c.beginPath(); c.arc(tc[0], tc[1], rt + 2.5, .2, Math.PI - .2); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.2)'; c.beginPath(); c.moveTo(tc[0] - rt - 3, tc[1]); c.lineTo(tc[0], tc[1] - 24); c.lineTo(tc[0] - 3, tc[1]); c.fill();
    // sails
    sailsAt(c, H, cx, cy + rb - 3, h - 4, 34, .5);
    // grain sacks
    H.em(c, '🌾', g.bx + g.bw + 2, g.yF + 2, 14, { force: true });
  }
  const BLD_H = { feed_mill: 100, grain_mill: 100, hop_brewery: 108, distillery: 84, fry_shack: 70 };
  A.structures.building = {
    ground(c, ctx, H) {
      const r = ctx.rect, P_ = ctx.P_, g = geom(r), z = BLD_H[ctx.type] || 86;
      c.fillStyle = P_.snow ? 'rgba(225,232,238,.85)' : 'rgba(184,152,100,.5)'; H.rr(c, r.x + 2, r.y + 18, r.w - 4, r.h - 14, 12); c.fill();
      c.strokeStyle = P_.snow ? 'rgba(160,180,200,.5)' : 'rgba(110,80,40,.35)'; c.lineWidth = 1.4; H.rr(c, r.x + 2, r.y + 18, r.w - 4, r.h - 14, 12); c.stroke();
      c.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 10; i++) { const rn = H.hash(ctx.type + i); c.beginPath(); c.arc(r.x + 8 + rn * (r.w - 16), r.y + 30 + H.hash('y' + ctx.type + i) * (r.h - 44), 1.6, 0, TAU); c.fill(); }
      H.castShadow(c, g.bx, g.yB, g.bw, g.d, z * .75, .24);
    },
    props(ctx, H) {
      const r = ctx.rect, g = geom(r), z = BLD_H[ctx.type] || 90, nm = String(ctx.def.name || ctx.type).toUpperCase();
      H.light(g.cx, g.yF, 30, 36, 'rgba(255,215,130,.55)');
      return [{
        sortY: (r.y + r.h - 8) / H.T, x0: r.x - 10, x1: r.x + r.w + 24, y0: g.yB - H.lift(z) - 40, y1: r.y + r.h + 22,
        hit: { x0: r.x + 4, x1: r.x + r.w - 4, y0: g.yB - H.lift(z * .8), y1: r.y + r.h },
        body(c) { drawBuilding(c, H, ctx); }
      }, { sortY: (r.y + r.h) / H.T + 3.2, x0: r.x - 20, x1: r.x + r.w + 20, y0: r.y + r.h - 4, y1: r.y + r.h + 22, hit: { x0: 0, x1: 0, y0: 0, y1: 0 }, body(c) { H.plate(c, g.X + 40, g.Y + 89, nm, { size: 8, bg: '#fff4d6' }); } }];
    }
  };

  // =============================================================== FOR-SALE LOTS
  A.structures.lot = {
    ground(c, ctx, H) {
      const r = ctx.rect, P_ = ctx.P_;
      c.fillStyle = P_.snow ? 'rgba(225,232,238,.7)' : 'rgba(170,135,80,.26)'; H.rr(c, r.x + 4, r.y + 14, r.w - 8, r.h - 14, 10); c.fill();
      c.setLineDash([6, 5]); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.9)'; H.rr(c, r.x + 4, r.y + 14, r.w - 8, r.h - 14, 10); c.stroke(); c.setLineDash([]);
      c.strokeStyle = 'rgba(226,74,58,.8)'; c.lineWidth = 1.2; c.beginPath(); c.rect(r.x + 12, r.y + 22, r.w - 24, r.h - 30); c.stroke();
    },
    props(ctx, H) {
      const r = ctx.rect, d = ctx.def || {}, P_ = ctx.P_, cx = r.x + r.w / 2, nm = String(d.name || ctx.type).toUpperCase();
      return [{
        sortY: (r.y + r.h - 6) / H.T, x0: r.x - 4, x1: r.x + r.w + 4, y0: r.y - 20, y1: r.y + r.h + 24,
        hit: { x0: r.x, x1: r.x + r.w, y0: r.y, y1: r.y + r.h },
        body(c) {
          [[r.x + 12, r.y + 22], [r.x + r.w - 12, r.y + 22], [r.x + r.w - 12, r.y + r.h - 8], [r.x + 12, r.y + r.h - 8]].forEach(p => { H.shadow(c, p[0] + 2, p[1] + 1, 4, .25); post(c, H, p[0], p[1], 14, '#c99a5a'); if (P_.snow) snowTop(c, H, p[0] - 2, p[1] - 2, 4, 4, 14); });
          H.em(c, d.emoji || '🏭', cx, r.y + 30, 30, { alpha: .35, force: true });
          H.castShadow(c, cx - 26, r.y + 54, 52, 3, 24, .18);
          sign(c, H, cx, r.y + 56, 12, 56, 22, [{ t: 'FOR SALE', s: 10, w: 900, c: '#c8392b' }, { t: '🪙 ' + (d.cost || ''), s: 8, w: 800 }], { bg: '#fff8e6' });
          c.save(); c.globalAlpha = .8; H.plate(c, cx, r.y + r.h + 9, nm, { size: 8, bg: '#f4ecd8', bd: '#a8987c', fg: '#7a6a50' }); c.restore();
        }
      }];
    }
  };
})();
