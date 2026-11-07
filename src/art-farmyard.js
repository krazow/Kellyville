/* Kellyville 3D art: farmyard structures (barn + silo, farmhouse, machine shed, co-op store, order board + mailbox). */
(function () {
  'use strict';
  const G = window.G; const A = G.WorldArt = G.WorldArt || {};
  A.structures = A.structures || {}; A.terrain = A.terrain || {}; A.actors = A.actors || {};

  const OUT = 'rgba(62,34,14,.88)';
  // ---------------------------------------------------------------- tiny helpers
  const hx = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
  const mix = (a, b, t) => { const x = hx(a), y = hx(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const lp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  function ln(c, H, a, b, col, lw) {
    const p = H.P3(a[0], a[1], a[2]), q = H.P3(b[0], b[1], b[2]);
    c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.strokeStyle = col; c.lineWidth = lw || 1; c.lineCap = 'round'; c.stroke();
  }
  function path3(c, H, pts) { c.beginPath(); pts.forEach((p, i) => { const q = H.P3(p[0], p[1], p[2]); if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.closePath(); }
  function gradV(c, H, y, z0, z1, top, bot, mid) {
    const a = H.P3(0, y, z1)[1], b = H.P3(0, y, z0)[1], g = c.createLinearGradient(0, a, 0, b);
    g.addColorStop(0, top); if (mid) g.addColorStop(.55, mid); g.addColorStop(1, bot); return g;
  }
  // filled + outlined panel from 3D points
  function face(c, H, pts, fill, stroke, lw) { H.poly(c, pts, fill, stroke === undefined ? OUT : stroke, lw || 1.3); }
  // contact shadow strip on the ground along a wall base
  function contact(c, x, y, w, a) { c.fillStyle = `rgba(30,15,0,${a || .28})`; c.beginPath(); c.rect(x, y - 1, w, 6); c.fill(); }
  // snow cap on a roof quad [eaveL, eaveR, ridgeR, ridgeL] (3D); f = fraction of the slope covered from the ridge down
  function snowQuad(c, H, q, f, thick) {
    const P = p => H.P3(p[0], p[1], p[2]);
    const bl = lp(q[3], q[0], f), br = lp(q[2], q[1], f);
    const a = P(q[3]), b = P(q[2]), d = P(br), e = P(bl);
    const n = Math.max(3, Math.round(Math.hypot(d[0] - e[0], d[1] - e[1]) / 13));
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]);
    for (let i = 0; i < n; i++) {
      const p0 = P(lp(br, bl, i / n)), p1 = P(lp(br, bl, (i + 1) / n));
      c.quadraticCurveTo((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + 6, p1[0], p1[1]);
    }
    c.closePath();
    c.fillStyle = '#f8fbff'; c.fill(); c.strokeStyle = 'rgba(120,150,185,.85)'; c.lineWidth = 1.1; c.lineJoin = 'round'; c.stroke();
    c.save(); c.clip(); c.fillStyle = 'rgba(150,180,215,.28)'; c.fillRect(Math.min(a[0], e[0]) - 2, Math.min(d[1], e[1]) - 6, Math.abs(b[0] - a[0]) + 40, 10); c.restore();
  }
  function shrub(c, H, x, y, s, P_, seed) {
    H.bbAt(c, x, y, () => {
      const r = H.mulberry(seed || 3);
      c.fillStyle = 'rgba(30,15,0,.25)'; c.beginPath(); c.ellipse(x + 2, y, 10 * s, 3.4 * s, 0, 0, H.TAU); c.fill();
      const g = P_.trees ? P_.trees : ['#4a9a38', '#62b247', '#86cf5a'];
      [[-6, -6, 8, 0], [6, -6, 8, 0], [0, -11, 8.5, 1], [-1, -4, 8, 1]].forEach(b => { c.fillStyle = g[b[3]]; c.beginPath(); c.arc(x + b[0] * s, y + b[1] * s, b[2] * s, 0, H.TAU); c.fill(); });
      c.fillStyle = g[2]; c.beginPath(); c.arc(x - 3 * s, y - 13 * s, 4.5 * s, 0, H.TAU); c.fill();
      if (P_.snow) { c.fillStyle = '#f8fbff'; c.beginPath(); c.ellipse(x, y - 15 * s, 9 * s, 4 * s, 0, 0, H.TAU); c.fill(); }
      else if (P_.flower) { ['#ff6b8b', '#ffd45e', '#fff', '#ff9ec7'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(x + (r() - .5) * 18 * s, y - (4 + r() * 10) * s, 1.8 * s, 0, H.TAU); c.fill(); }); }
      c.strokeStyle = 'rgba(40,60,20,.55)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y - 7 * s, 11.5 * s, Math.PI * .85, Math.PI * .15, true); c.stroke();
    });
  }

  // ================================================================ BARN + SILO
  function barnGeo(ctx, H) {
    const r = ctx.rect, w = 184, x0 = r.x + 10, x1 = x0 + w, d = 70, yf = r.y + r.h - 16, yb = yf - d;
    return { r, w, x0, x1, xm: x0 + w / 2, d, yf, yb, wallH: 78, sr: 19, sx: x1 + 19, sy: yf - 19, sh: 132 };
  }
  A.structures.barn = {
    ground(c, ctx, H) {
      const g = barnGeo(ctx, H), P_ = ctx.P_;
      // trampled dirt apron in front of the big doors
      c.fillStyle = P_.pathD; c.globalAlpha = .55; c.beginPath(); c.ellipse(g.xm, g.yf + 7, 66, 14, 0, 0, H.TAU); c.fill();
      c.fillStyle = P_.path; c.globalAlpha = .75; c.beginPath(); c.ellipse(g.xm, g.yf + 6, 54, 10, 0, 0, H.TAU); c.fill(); c.globalAlpha = 1;
      // cast shadows (sun in the north-west)
      H.castShadow(c, g.x0, g.yb, g.w, g.d, 104, .2);
      // silo shadow: shorter than true length and fading out, so it doesn't lay a hard bar across the path
      const sl = g.sh * 0.5, dx = sl * H.SUN.dx, dy = sl * H.SUN.dy, len = Math.hypot(dx, dy), nx = -dy / len * g.sr, ny = dx / len * g.sr;
      const sg = c.createLinearGradient(g.sx, g.sy, g.sx + dx, g.sy + dy); sg.addColorStop(0, 'rgba(25,15,0,.2)'); sg.addColorStop(1, 'rgba(25,15,0,.03)');
      c.fillStyle = sg; c.beginPath();
      c.moveTo(g.sx + nx, g.sy + ny); c.lineTo(g.sx + dx + nx, g.sy + dy + ny); c.lineTo(g.sx + dx - nx, g.sy + dy - ny); c.lineTo(g.sx - nx, g.sy - ny); c.closePath();
      c.moveTo(g.sx + g.sr, g.sy); c.arc(g.sx, g.sy, g.sr, 0, H.TAU); c.moveTo(g.sx + dx + g.sr, g.sy + dy); c.arc(g.sx + dx, g.sy + dy, g.sr, 0, H.TAU); c.fill();
      contact(c, g.x0 - 3, g.yf, g.w + 6, .3);
      c.fillStyle = 'rgba(30,15,0,.3)'; c.beginPath(); c.ellipse(g.sx, g.sy + 2, g.sr + 3, g.sr * .8, 0, 0, H.TAU); c.fill();
    },
    props(ctx, H) {
      const g = barnGeo(ctx, H), P_ = ctx.P_, { x0, x1, xm, yf, yb, wallH } = g;
      H.light(xm, yf, 100, 44, 'rgba(255,200,110,.5)');
      return [{
        sortY: yf / H.T,
        x0: g.r.x - 10, x1: g.r.x + g.r.w + 12, y0: yb - H.lift(196), y1: yf + 38,
        hit: { x0: x0 - 6, x1: g.sx + g.sr + 2, y0: yb - H.lift(150), y1: yf },
        body(c) {
          const RED = '#b8352b', TR = '#fbf0da';
          const ridgeZ = 152, brkZ = 116, brkDX = 24;
          const gable = [[x0, yf, 0], [x1, yf, 0], [x1, yf, wallH], [x1 - brkDX, yf, brkZ], [xm, yf, ridgeZ], [x0 + brkDX, yf, brkZ], [x0, yf, wallH]];
          // ---- front gable face (planks)
          path3(c, H, gable); c.fillStyle = gradV(c, H, yf, 0, ridgeZ, '#c8453a', '#7f2219', RED); c.fill();
          c.save(); path3(c, H, gable); c.clip();
          for (let x = x0 + 5; x < x1; x += 7) { ln(c, H, [x, yf, 0], [x, yf, ridgeZ], 'rgba(60,8,4,.24)', 1); ln(c, H, [x + 1.2, yf, 0], [x + 1.2, yf, ridgeZ], 'rgba(255,190,170,.09)', 1); }
          // eave shadow under the roof overhang
          [[x0 - 4, wallH - 4], [x0 + brkDX, brkZ], [xm, ridgeZ], [x1 - brkDX, brkZ], [x1 + 4, wallH - 4]].reduce((a, b) => { ln(c, H, [a[0], yf, a[1] - 3], [b[0], yf, b[1] - 3], 'rgba(30,5,0,.32)', 8); return b; });
          c.restore();
          // foundation
          face(c, H, [[x0, yf, 0], [x1, yf, 0], [x1, yf, 7], [x0, yf, 7]], gradV(c, H, yf, 0, 7, '#aaa398', '#6d675e'), OUT, 1);
          // ---- big double doors with white X trim
          const dw = 78, dh = 56, dx0 = xm - dw / 2;
          face(c, H, [[dx0, yf, 7], [dx0 + dw, yf, 7], [dx0 + dw, yf, 7 + dh], [dx0, yf, 7 + dh]], gradV(c, H, yf, 7, 7 + dh, '#8f271f', '#561410'), OUT, 1.2);
          ln(c, H, [xm, yf, 7], [xm, yf, 7 + dh], TR, 3);
          [[dx0, xm], [xm, dx0 + dw]].forEach(([a, b]) => { ln(c, H, [a, yf, 7], [b, yf, 7 + dh], TR, 2.8); ln(c, H, [a, yf, 7 + dh], [b, yf, 7], TR, 2.8); });
          face(c, H, [[dx0, yf, 7], [dx0 + dw, yf, 7], [dx0 + dw, yf, 7 + dh], [dx0, yf, 7 + dh]], null, TR, 3.2);
          face(c, H, [[dx0 - 2, yf, 6], [dx0 + dw + 2, yf, 6], [dx0 + dw + 2, yf, 9 + dh], [dx0 - 2, yf, 9 + dh]], null, OUT, 1);
          // handles
          [[xm - 6], [xm + 6]].forEach(a => { const p = H.P3(a[0], yf, 30); c.fillStyle = '#3a2418'; c.fillRect(p[0] - 1.5, p[1] - 5, 3, 10); });
          // ---- hayloft door with hoist beam and a tuft of hay
          const lz0 = 96, lz1 = 128, lw = 15;
          face(c, H, [[xm - lw, yf, lz0], [xm + lw, yf, lz0], [xm + lw, yf, lz1], [xm - lw, yf, lz1]], gradV(c, H, yf, lz0, lz1, '#4b140f', '#7d2219'), OUT, 1.2);
          ln(c, H, [xm - lw, yf, lz0], [xm + lw, yf, lz1], TR, 2.4); ln(c, H, [xm - lw, yf, lz1], [xm + lw, yf, lz0], TR, 2.4);
          face(c, H, [[xm - lw, yf, lz0], [xm + lw, yf, lz0], [xm + lw, yf, lz1], [xm - lw, yf, lz1]], null, TR, 3);
          ln(c, H, [xm - 3, yf, lz0 - 1], [xm + 4, yf, lz0 + 2], '#e9c455', 3.5);
          ln(c, H, [xm, yf + 4, 144], [xm, yf + 4, 150], '#4a3a30', 3); ln(c, H, [xm - 1, yf + 6, 144], [xm - 1, yf + 6, 138], '#4a3a30', 1.4);
          // ---- white trim: corner boards + rake boards
          [x0, x1].forEach(x => face(c, H, [[x - 3, yf, 0], [x + 3, yf, 0], [x + 3, yf, wallH], [x - 3, yf, wallH]], TR, OUT, 1));
          const rake = [[x0 - 1, wallH], [x0 + brkDX, brkZ], [xm, ridgeZ], [x1 - brkDX, brkZ], [x1 + 1, wallH]];
          // ---- roof panels (gambrel), oversized for a visible overhang
          const prof = [[x0 - 8, wallH - 5], [x0 + brkDX, brkZ], [xm, ridgeZ], [x1 - brkDX, brkZ], [x1 + 8, wallH - 5]];
          const cols = [['#8a7068', '#7a615a'], ['#a88f86', '#97807a'], ['#7f6760', '#6d5750'], ['#6a544e', '#5a4640']];
          const yF = yf + 7, yB = yb - 5;
          for (let i = 0; i < 4; i++) {
            const a = prof[i], b = prof[i + 1], q = [[a[0], yB, a[1]], [b[0], yB, b[1]], [b[0], yF, b[1]], [a[0], yF, a[1]]];
            const gp = H.P3(0, yB, Math.max(a[1], b[1])), gq = H.P3(0, yF, Math.min(a[1], b[1])), gr = c.createLinearGradient(0, gp[1], 0, gq[1]);
            gr.addColorStop(0, cols[i][0]); gr.addColorStop(1, cols[i][1]);
            face(c, H, q, gr, OUT, 1.3);
            const n = Math.max(3, Math.round(Math.abs(b[0] - a[0]) / 8));
            for (let k = 1; k < n; k++) { const t = k / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; ln(c, H, [x, yB, z], [x, yF, z], 'rgba(0,0,0,.2)', 1); ln(c, H, [x + 1.2, yB, z], [x + 1.2, yF, z], 'rgba(255,255,255,.12)', 1); }
          }
          // ridge cap + break highlights
          ln(c, H, [xm, yB, ridgeZ], [xm, yF, ridgeZ], '#f3e6d0', 3); ln(c, H, [xm, yB, ridgeZ + .6], [xm, yF, ridgeZ + .6], 'rgba(255,255,255,.7)', 1.2);
          [x0 + brkDX, x1 - brkDX].forEach(x => ln(c, H, [x, yB, brkZ], [x, yF, brkZ], 'rgba(255,255,255,.28)', 1.4));
          // front rake board (white fascia) along the gable edge
          c.beginPath(); prof.forEach((p, i) => { const q = H.P3(p[0], yF, p[1]); if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); });
          c.lineJoin = 'round'; c.strokeStyle = OUT; c.lineWidth = 5.2; c.stroke(); c.strokeStyle = TR; c.lineWidth = 3; c.stroke();
          // snow on the roof
          if (P_.snow) {
            // upper panels snow from the ridge down (quad = eave edge first, ridge edge last)
            const up = (a, b, f) => snowQuad(c, H, [[a[0], yF - 1, a[1]], [a[0], yB + 1, a[1]], [b[0], yB + 1, b[1]], [b[0], yF - 1, b[1]]], f);
            up(prof[1], prof[2], .97); up(prof[3], prof[2], .97);
            up(prof[0], prof[1], .55); up(prof[4], prof[3], .55);
          }
          // ---- weathervane
          const wy = (yb + yf) / 2 - 4, wz = ridgeZ;
          ln(c, H, [xm, wy, wz], [xm, wy, wz + 30], '#3b3b40', 2.4);
          ln(c, H, [xm - 11, wy, wz + 22], [xm + 11, wy, wz + 22], '#3b3b40', 1.8);
          const tp = H.P3(xm, wy, wz + 31); c.fillStyle = '#2f2f35'; c.beginPath(); c.moveTo(tp[0] - 11, tp[1] + 2); c.lineTo(tp[0] + 7, tp[1] - 1.5); c.lineTo(tp[0] + 7, tp[1] + 5); c.closePath(); c.fill();
          c.beginPath(); c.moveTo(tp[0] + 7, tp[1] + 2); c.lineTo(tp[0] + 14, tp[1] + 2); c.lineTo(tp[0] + 10, tp[1] - 2); c.closePath(); c.fillStyle = '#f0c24a'; c.fill();
          c.beginPath(); c.arc(tp[0] - 11, tp[1] + 2, 2.4, 0, H.TAU); c.fillStyle = '#f0c24a'; c.fill();
          const p0 = H.P3(xm, wy, wz + 22); c.beginPath(); c.arc(p0[0], p0[1], 1.8, 0, H.TAU); c.fillStyle = '#f0c24a'; c.fill();

          // ================= SILO =================
          const { sx, sy, sr, sh } = g;
          const sideC = '#c5cdd3';
          H.cyl(c, sx, sy, sr, sh, { side: sideC, hi: 'rgba(255,255,255,.6)', dark: 'rgba(30,50,75,.42)', top: '#aab4bb' });
          // corrugation rings
          for (let z = 6; z < sh - 2; z += 7.5) {
            const y = H.P3(sx, sy, z)[1];
            c.beginPath(); c.ellipse(sx, y, sr, sr, 0, 0, Math.PI); c.strokeStyle = 'rgba(30,50,70,.2)'; c.lineWidth = 1; c.stroke();
            c.beginPath(); c.ellipse(sx, y + 1.3, sr, sr, 0, .1, Math.PI - .1); c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = 1; c.stroke();
          }
          // hoop bands
          [34, 66, 98].forEach(z => { const y = H.P3(sx, sy, z)[1]; c.beginPath(); c.ellipse(sx, y, sr + .4, sr + .4, 0, 0, Math.PI); c.strokeStyle = 'rgba(60,70,80,.55)'; c.lineWidth = 2; c.stroke(); });
          // concrete base ring
          const bz = H.P3(sx, sy, 8), bb = H.P3(sx, sy, 0);
          c.beginPath(); c.moveTo(bb[0] + sr, bb[1]); c.lineTo(bz[0] + sr, bz[1]); c.ellipse(bz[0], bz[1], sr, sr, 0, 0, Math.PI); c.lineTo(bb[0] - sr, bb[1]); c.ellipse(bb[0], bb[1], sr, sr, 0, Math.PI, 0, true); c.closePath();
          c.fillStyle = '#9d978e'; c.fill();
          // ladder / chute
          const lx = sx + 5;
          ln(c, H, [lx, sy + sr - 1.5, 9], [lx, sy + sr - 1.5, sh - 6], 'rgba(40,40,45,.8)', 1.4); ln(c, H, [lx + 5, sy + sr - 3, 9], [lx + 5, sy + sr - 3, sh - 6], 'rgba(40,40,45,.8)', 1.4);
          for (let z = 14; z < sh - 8; z += 8) ln(c, H, [lx, sy + sr - 1.5, z], [lx + 5, sy + sr - 3, z], 'rgba(40,40,45,.7)', 1.1);
          // outline
          const t = H.P3(sx, sy, sh), b2 = H.P3(sx, sy, 0);
          c.beginPath(); c.moveTo(b2[0] - sr, b2[1]); c.lineTo(t[0] - sr, t[1]); c.moveTo(b2[0] + sr, b2[1]); c.lineTo(t[0] + sr, t[1]);
          c.moveTo(b2[0] + sr, b2[1]); c.ellipse(b2[0], b2[1], sr, sr, 0, 0, Math.PI); c.strokeStyle = OUT; c.lineWidth = 1.4; c.lineCap = 'round'; c.stroke();
          // domed cap
          const dome = (rad, hh) => { c.beginPath(); c.moveTo(t[0] - rad, t[1]); c.bezierCurveTo(t[0] - rad, t[1] - hh * 1.3, t[0] + rad, t[1] - hh * 1.3, t[0] + rad, t[1]); c.ellipse(t[0], t[1], rad, rad, 0, 0, Math.PI); c.closePath(); };
          dome(sr + 1.5, 20);
          const dg = c.createLinearGradient(t[0] - sr, 0, t[0] + sr, 0); dg.addColorStop(0, '#d7dde2'); dg.addColorStop(.4, '#a6b1b9'); dg.addColorStop(1, '#6d7b85');
          c.fillStyle = dg; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke();
          c.beginPath(); c.ellipse(t[0] - 5, t[1] - 13, 6, 3.4, -.25, 0, H.TAU); c.fillStyle = 'rgba(255,255,255,.5)'; c.fill();
          c.beginPath(); c.ellipse(t[0], t[1], sr + 1.5, sr + 1.5, 0, 0, Math.PI); c.strokeStyle = 'rgba(60,70,80,.7)'; c.lineWidth = 2; c.stroke();
          // vent cap
          const vt = [t[0], t[1] - 22]; c.fillStyle = '#6d7b85'; c.beginPath(); c.arc(vt[0], vt[1], 3.2, 0, H.TAU); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
          if (P_.snow) { c.beginPath(); c.ellipse(t[0] - 1, t[1] - 14, 12, 5.5, 0, Math.PI, H.TAU); c.lineTo(t[0] + 11, t[1] - 13); c.closePath(); c.fillStyle = '#f8fbff'; c.fill(); c.strokeStyle = 'rgba(120,150,185,.8)'; c.lineWidth = 1; c.stroke(); }
          // neighbouring: silo meets barn wall
          H.plate(c, xm + 14, yf + 18, 'THE BARN', { size: 9 });
        }
      }];
    }
  };

  // ================================================================ FARMHOUSE
  function houseGeo(ctx, H) {
    const r = ctx.rect, x0 = r.x + 20, x1 = r.x + r.w - 18, yf = r.y + r.h - 40, d = 74;
    return { r, x0, x1, xm: (x0 + x1) / 2, w: x1 - x0, yf, yb: yf - d, d, wallH: 66, ridgeZ: 90 };
  }
  A.structures.house = {
    ground(c, ctx, H) {
      const g = houseGeo(ctx, H), P_ = ctx.P_;
      H.castShadow(c, g.x0, g.yb, g.w, g.d, 82, .2);
      contact(c, g.x0 - 2, g.yf, g.w + 4, .28);
      // doorstep path
      c.fillStyle = P_.pathD; c.globalAlpha = .6; c.beginPath(); c.ellipse(g.xm, g.yf + 34, 20, 8, 0, 0, H.TAU); c.fill(); c.globalAlpha = 1;
      c.fillStyle = 'rgba(30,15,0,.25)'; c.fillRect(g.xm - 48, g.yf + 22, 96, 6);
    },
    props(ctx, H) {
      const g = houseGeo(ctx, H), P_ = ctx.P_, { x0, x1, xm, yf, yb, wallH, ridgeZ } = g;
      const ym = (yb + yf) / 2, eZ = wallH - 4, oh = 9;
      const WALL = '#f6efdc', TRIM = '#ffffff';
      [[x0 + 30], [x1 - 30]].forEach(a => H.light(a[0], yf, 34, 40, 'rgba(255,205,115,.55)'));
      H.light(xm, yf, 22, 26, 'rgba(255,205,115,.5)');
      return [{
        sortY: (yf + 36) / H.T,
        x0: g.r.x - 6, x1: g.r.x + g.r.w + 6, y0: yb - H.lift(160), y1: g.r.y + g.r.h + 20,
        hit: { x0: x0 - 8, x1: x1 + 8, y0: yb - H.lift(130), y1: yf + 30 },
        body(c) {
          // ---- walls
          const wallFace = [[x0, yf, 0], [x1, yf, 0], [x1, yf, wallH], [x0, yf, wallH]];
          path3(c, H, wallFace); c.fillStyle = gradV(c, H, yf, 0, wallH, '#fbf6e8', '#cfc4a8', WALL); c.fill();
          c.save(); path3(c, H, wallFace); c.clip();
          for (let z = 5; z < wallH; z += 6) { ln(c, H, [x0, yf, z], [x1, yf, z], 'rgba(110,85,50,.2)', 1); ln(c, H, [x0, yf, z + 1.1], [x1, yf, z + 1.1], 'rgba(255,255,255,.35)', 1); }
          ln(c, H, [x0, yf, wallH - 2], [x1, yf, wallH - 2], 'rgba(40,25,10,.3)', 14);
          c.restore();
          face(c, H, wallFace, null, OUT, 1.4);
          face(c, H, [[x0, yf, 0], [x1, yf, 0], [x1, yf, 7], [x0, yf, 7]], gradV(c, H, yf, 0, 7, '#aaa398', '#716b62'), OUT, 1);
          [x0, x1].forEach(x => face(c, H, [[x - 3, yf, 0], [x + 3, yf, 0], [x + 3, yf, wallH], [x - 3, yf, wallH]], TRIM, 'rgba(90,70,40,.6)', 1));
          // ---- windows with shutters + flower boxes
          const win = cx => {
            const ww = 26, z0 = 20, z1 = 52;
            face(c, H, [[cx - ww / 2 - 9, yf, z0], [cx - ww / 2 - 1, yf, z0], [cx - ww / 2 - 1, yf, z1], [cx - ww / 2 - 9, yf, z1]], '#4f7f55', OUT, 1);
            face(c, H, [[cx + ww / 2 + 1, yf, z0], [cx + ww / 2 + 9, yf, z0], [cx + ww / 2 + 9, yf, z1], [cx + ww / 2 + 1, yf, z1]], '#3f6c47', OUT, 1);
            [-1, 1].forEach(s => { for (let z = z0 + 4; z < z1; z += 4) ln(c, H, [cx + s * (ww / 2 + 1.5), yf, z], [cx + s * (ww / 2 + 8.5), yf, z], 'rgba(0,0,0,.18)', 1); });
            const gl = [[cx - ww / 2, yf, z0], [cx + ww / 2, yf, z0], [cx + ww / 2, yf, z1], [cx - ww / 2, yf, z1]];
            face(c, H, gl, gradV(c, H, yf, z0, z1, '#bfe3f4', '#6fa7c9'), OUT, 1.2);
            const q = H.P3(cx - ww / 2 + 3, yf, z1 - 3); c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(q[0] + 7, q[1]); c.lineTo(q[0] - 2, q[1] + 13); c.lineTo(q[0] - 3.5, q[1] + 13); c.closePath(); c.fill();
            ln(c, H, [cx, yf, z0], [cx, yf, z1], TRIM, 2.2); ln(c, H, [cx - ww / 2, yf, (z0 + z1) / 2], [cx + ww / 2, yf, (z0 + z1) / 2], TRIM, 2.2);
            face(c, H, gl, null, TRIM, 2.6); face(c, H, gl, null, 'rgba(90,70,40,.5)', .8);
            // flower box
            H.box(c, cx - ww / 2 - 2, yf, ww + 4, 4, 6, { z0: z0 - 6, top: '#9b6a3e', front: '#7a4a25', stroke: OUT, lw: 1 });
            const fc = ['#ff6b8b', '#ffd45e', '#ff9ec7', '#fff', '#ff8a4c', '#c9a8ff'];
            for (let k = 0; k < 6; k++) { const p = H.P3(cx - ww / 2 + 1 + k * 4.8, yf + 3, z0 + 1 + (k % 2) * 1.5); c.fillStyle = P_.snow ? '#f8fbff' : (k % 3 === 1 ? '#4c9a3a' : fc[k]); c.beginPath(); c.arc(p[0], p[1], P_.snow ? 3.1 : 2.8, 0, H.TAU); c.fill(); if (!P_.snow) { c.fillStyle = '#3f8a30'; c.beginPath(); c.arc(p[0] + 1, p[1] + 2.4, 1.8, 0, H.TAU); c.fill(); } }
          };
          win(x0 + 36); win(x1 - 36);
          // ---- door
          const dw = 24, dz = 42;
          face(c, H, [[xm - dw / 2 - 3, yf, 0], [xm + dw / 2 + 3, yf, 0], [xm + dw / 2 + 3, yf, dz + 3], [xm - dw / 2 - 3, yf, dz + 3]], TRIM, 'rgba(90,70,40,.7)', 1);
          face(c, H, [[xm - dw / 2, yf, 0], [xm + dw / 2, yf, 0], [xm + dw / 2, yf, dz], [xm - dw / 2, yf, dz]], gradV(c, H, yf, 0, dz, '#a65d34', '#6b3a1d'), OUT, 1.2);
          face(c, H, [[xm - 7, yf, 24], [xm + 7, yf, 24], [xm + 7, yf, 38], [xm - 7, yf, 38]], '#bfe3f4', OUT, 1);
          [[-8, 8], [-8, 8]].length; ln(c, H, [xm - 8, yf, 10], [xm + 8, yf, 10], 'rgba(0,0,0,.22)', 1); face(c, H, [[xm - 8, yf, 6], [xm + 8, yf, 6], [xm + 8, yf, 18], [xm - 8, yf, 18]], null, 'rgba(0,0,0,.28)', 1);
          const kn = H.P3(xm + 8, yf, 21); c.fillStyle = '#ffd45e'; c.beginPath(); c.arc(kn[0], kn[1], 1.8, 0, H.TAU); c.fill();

          // ---- hip roof (blue-grey shingles)
          const ex0 = x0 - oh, ex1 = x1 + oh, eyF = yf + 10, eyB = yb - oh, rx0 = x0 + 54, rx1 = x1 - 54;
          const front = [[ex0, eyF, eZ], [ex1, eyF, eZ], [rx1, ym, ridgeZ], [rx0, ym, ridgeZ]];
          const west = [[ex0, eyB, eZ], [ex0, eyF, eZ], [rx0, ym, ridgeZ], [rx0, ym, ridgeZ]];
          const east = [[ex1, eyF, eZ], [ex1, eyB, eZ], [rx1, ym, ridgeZ], [rx1, ym, ridgeZ]];
          // back slope hint (so the ridge reads as a solid ridge)
          const back = [[ex0, eyB, eZ], [ex1, eyB, eZ], [rx1, ym, ridgeZ], [rx0, ym, ridgeZ]];
          face(c, H, back, '#556e8a', OUT, 1.2);
          face(c, H, west, mix('#7d97b6', '#b9cde4', .15), OUT, 1.3);
          face(c, H, east, '#52698a', OUT, 1.3);
          face(c, H, front, gradV(c, H, ym, ridgeZ, eZ, '#7f9bbd', '#5a7598'), OUT, 1.4);
          // shingle rows
          c.save(); path3(c, H, front); c.clip();
          for (let k = 1; k < 9; k++) { const t = k / 9, a = lp(front[0], front[3], t), b = lp(front[1], front[2], t); ln(c, H, a, b, 'rgba(20,35,60,.25)', 1.1); ln(c, H, [a[0], a[1], a[2] - .9], [b[0], b[1], b[2] - .9], 'rgba(255,255,255,.14)', 1); }
          for (let k = 0; k < 9; k++) { const t0 = k / 9, t1 = (k + 1) / 9, off = k % 2 ? 6 : 0; for (let x = ex0 + off + 8; x < ex1; x += 12) { const a = lp(front[0], front[3], t0), b = lp(front[0], front[3], t1), fx = (x - ex0) / (ex1 - ex0); const u0 = lp(lp(front[0], front[1], fx), lp(front[3], front[2], fx), t0), u1 = lp(lp(front[0], front[1], fx), lp(front[3], front[2], fx), t1); ln(c, H, u0, u1, 'rgba(20,35,60,.13)', 1); } }
          c.restore();
          c.save(); path3(c, H, west); c.clip(); for (let k = 1; k < 6; k++) { const t = k / 6; ln(c, H, lp(west[0], west[2], t), lp(west[1], west[2], t), 'rgba(255,255,255,.14)', 1); } c.restore();
          // eave overhang shadow on the wall + fascia
          face(c, H, [[ex0, eyF, eZ], [ex1, eyF, eZ], [ex1, eyF, eZ - 5], [ex0, eyF, eZ - 5]], '#3f5876', OUT, 1.1);
          // ridge + hip highlights
          ln(c, H, [rx0, ym, ridgeZ], [rx1, ym, ridgeZ], '#dbe7f5', 3); ln(c, H, [rx0 + 2, ym, ridgeZ + .5], [rx1 - 2, ym, ridgeZ + .5], 'rgba(255,255,255,.8)', 1.1);
          ln(c, H, [ex0, eyF, eZ], [rx0, ym, ridgeZ], 'rgba(235,243,252,.55)', 1.6); ln(c, H, [ex1, eyF, eZ], [rx1, ym, ridgeZ], 'rgba(235,243,252,.35)', 1.6);
          if (P_.snow) { snowQuad(c, H, [front[0], front[1], front[2], front[3]], .62); snowQuad(c, H, [west[1], west[0], west[2], west[3]], .45); snowQuad(c, H, [east[0], east[1], east[2], east[3]], .45); }

          // ---- chimney (brick) on the right
          const cx0 = x1 - 82, cw = 22, cd = 17, cyF = ym + 2, cz0 = 82, cz1 = 126;
          H.box(c, cx0, cyF - cd, cw, cd, cz1 - cz0, { z0: cz0, top: '#c1604a', front: '#a2493a', stroke: OUT, lw: 1.3 });
          c.save(); path3(c, H, [[cx0, cyF, cz0], [cx0 + cw, cyF, cz0], [cx0 + cw, cyF, cz1], [cx0, cyF, cz1]]); c.clip();
          for (let z = cz0 + 4; z < cz1; z += 5) { ln(c, H, [cx0, cyF, z], [cx0 + cw, cyF, z], 'rgba(40,10,5,.35)', 1); for (let x = cx0 + ((z / 5 | 0) % 2 ? 4 : 9); x < cx0 + cw; x += 10) ln(c, H, [x, cyF, z], [x, cyF, z + 5], 'rgba(40,10,5,.25)', 1); }
          ln(c, H, [cx0, cyF, cz0], [cx0 + cw, cyF, cz0], 'rgba(0,0,0,.3)', 6);
          c.restore();
          H.box(c, cx0 - 3, cyF - cd - 3, cw + 6, cd + 6, 6, { z0: cz1, top: '#8f4b3b', front: '#6e382b', stroke: OUT, lw: 1.2 });
          const tp = H.P3(cx0 + cw / 2, cyF - cd / 2, cz1 + 6); c.fillStyle = '#2b1a14'; c.beginPath(); c.ellipse(tp[0], tp[1], 5.5, 3.2, 0, 0, H.TAU); c.fill();
          if (P_.snow) { const s = H.P3(cx0 + cw / 2, cyF - cd / 2, cz1 + 6); c.fillStyle = '#f8fbff'; c.beginPath(); c.ellipse(s[0], s[1], 12, 5, 0, 0, H.TAU); c.fill(); c.strokeStyle = 'rgba(120,150,185,.8)'; c.lineWidth = 1; c.stroke(); c.fillStyle = '#2b1a14'; c.beginPath(); c.ellipse(s[0], s[1], 4.5, 2.3, 0, 0, H.TAU); c.fill(); }
          // smoke puffs
          [[0, 13, 5, .55], [5, 25, 6.5, .42], [12, 38, 8, .3]].forEach(p => { const q = H.P3(cx0 + cw / 2 + p[0], cyF - cd / 2, cz1 + 8 + p[1]); c.fillStyle = `rgba(240,240,244,${p[3]})`; c.beginPath(); c.ellipse(q[0], q[1], p[2], p[2] * .8, 0, 0, H.TAU); c.fill(); });

          // ---- front porch
          const px0 = xm - 48, px1 = xm + 48, pyF = yf + 25;
          H.box(c, px0, yf, px1 - px0, pyF - yf, 7, { top: '#d9b46a', front: '#a9794a', stroke: OUT, lw: 1.2 });
          for (let k = 1; k < 8; k++) ln(c, H, [px0 + k * 12, yf, 7], [px0 + k * 12, pyF, 7], 'rgba(90,55,20,.28)', 1);
          // steps
          H.box(c, xm - 15, pyF, 30, 6, 4.6, { top: '#e4c585', front: '#b98b57', stroke: OUT, lw: 1 });
          H.box(c, xm - 15, pyF + 6, 30, 6, 2.2, { top: '#e4c585', front: '#b98b57', stroke: OUT, lw: 1 });
          // rails
          [[px0, xm - 17], [xm + 17, px1]].forEach(([a, b]) => {
            ln(c, H, [a, pyF - 1, 24], [b, pyF - 1, 24], TRIM, 2.6); ln(c, H, [a, pyF - 1, 24], [b, pyF - 1, 24], 'rgba(90,70,40,.35)', .8);
            for (let x = a + 3; x < b; x += 5) ln(c, H, [x, pyF - 1, 8], [x, pyF - 1, 23], 'rgba(255,255,255,.95)', 1.5);
            ln(c, H, [a, pyF - 1, 9], [b, pyF - 1, 9], TRIM, 1.8);
          });
          // porch roof (lean-to) + posts
          const prF = pyF + 2, prZ0 = 58, prZ1 = 51;
          [px0 + 3, xm - 17, xm + 17, px1 - 3].forEach(x => { face(c, H, [[x - 2.4, pyF - 1, 7], [x + 2.4, pyF - 1, 7], [x + 2.4, pyF - 1, prZ1], [x - 2.4, pyF - 1, prZ1]], gradV(c, H, pyF, 7, prZ1, '#ffffff', '#d9d2c0'), OUT, 1); });
          const proof = [[px0 - 6, yf, prZ0], [px1 + 6, yf, prZ0], [px1 + 6, prF, prZ1 + 2], [px0 - 6, prF, prZ1 + 2]];
          face(c, H, proof, gradV(c, H, yf, prZ1 + 2, prZ0 + 6, '#8aa5c6', '#62809f'), OUT, 1.3);
          ln(c, H, [px0 - 6, prF, prZ1 + 2], [px1 + 6, prF, prZ1 + 2], '#3f5876', 2.4);
          for (let k = 1; k < 4; k++) { const t = k / 4; ln(c, H, lp(proof[0], proof[3], t), lp(proof[1], proof[2], t), 'rgba(20,35,60,.25)', 1); }
          ln(c, H, [px0 - 5, yf + .5, prZ0 - .4], [px1 + 5, yf + .5, prZ0 - .4], 'rgba(255,255,255,.35)', 1);
          if (P_.snow) snowQuad(c, H, [proof[3], proof[2], proof[1], proof[0]], .7);
          // shrubs by the corners
          shrub(c, H, x0 + 6, yf + 8, 1, P_, 5); shrub(c, H, x1 - 6, yf + 8, 1, P_, 9);
          H.plate(c, xm, g.r.y + g.r.h + 8, 'FARMHOUSE', { size: 9 });
        }
      }];
    }
  };

  // ================================================================ MACHINE SHED
  function shedGeo(ctx, H) {
    const r = ctx.rect, x0 = r.x + 12, x1 = r.x + r.w - 12, yf = r.y + r.h - 18, d = 78;
    return { r, x0, x1, xm: (x0 + x1) / 2, w: x1 - x0, yf, yb: yf - d, d, postH: 62, ridgeZ: 92 };
  }
  A.structures.shed = {
    ground(c, ctx, H) {
      const g = shedGeo(ctx, H), P_ = ctx.P_;
      c.fillStyle = P_.pathD; c.globalAlpha = .5; c.beginPath(); c.ellipse(g.xm, g.yf + 8, g.w / 2 - 4, 13, 0, 0, H.TAU); c.fill(); c.globalAlpha = 1;
      H.castShadow(c, g.x0, g.yb, g.w, g.d, 78, .2);
      contact(c, g.x0 - 2, g.yf, g.w + 4, .26);
    },
    props(ctx, H) {
      const g = shedGeo(ctx, H), P_ = ctx.P_, owned = ctx.owned, { x0, x1, xm, yf, yb, postH, ridgeZ } = g;
      const ym = (yb + yf) / 2, oh = 8;
      return [{
        sortY: yf / H.T,
        x0: g.r.x - 6, x1: g.r.x + g.r.w + 6, y0: yb - H.lift(ridgeZ + 8), y1: g.r.y + g.r.h + 20,
        hit: { x0: x0 - 6, x1: x1 + 6, y0: yb - H.lift(ridgeZ), y1: yf },
        body(c) {
          // ---- dark open bay
          const bay = [[x0 + 2, yf, 0], [x1 - 2, yf, 0], [x1 - 2, yf, postH], [x0 + 2, yf, postH]];
          path3(c, H, bay); c.fillStyle = gradV(c, H, yf, 0, postH, '#15100b', '#3b2f22', '#241b13'); c.fill();
          c.save(); path3(c, H, bay); c.clip();
          for (let x = x0 + 8; x < x1; x += 11) ln(c, H, [x, yf, 0], [x, yf, postH], 'rgba(255,255,255,.045)', 1);
          // dirt floor sliver + faint light from the opening
          ln(c, H, [x0, yf - 1, 2.5], [x1, yf - 1, 2.5], 'rgba(150,115,70,.45)', 5);
          const lg = c.createLinearGradient(0, H.P3(0, yf, 0)[1] - 12, 0, H.P3(0, yf, 0)[1]); lg.addColorStop(0, 'rgba(255,230,160,0)'); lg.addColorStop(1, 'rgba(255,230,160,.12)'); c.fillStyle = lg; c.fillRect(x0, H.P3(0, yf, 0)[1] - 12, x1 - x0, 12);
          // eave shadow inside
          ln(c, H, [x0, yf, postH - 1], [x1, yf, postH - 1], 'rgba(0,0,0,.5)', 12);
          c.restore();
          face(c, H, bay, null, OUT, 1.4);
          if (owned) {
            // a few hanging tools and a lantern hint inside the bay
            ln(c, H, [x0 + 14, yf, 22], [x0 + 14, yf, 48], 'rgba(200,200,205,.5)', 1.6); ln(c, H, [x0 + 20, yf, 28], [x0 + 20, yf, 48], 'rgba(200,170,110,.5)', 1.6);
            const lt = H.P3(x1 - 16, yf, 46); c.fillStyle = 'rgba(255,210,110,.9)'; c.beginPath(); c.arc(lt[0], lt[1], 2.4, 0, H.TAU); c.fill();
            H.light(x1 - 16, yf, 46, 46, 'rgba(255,200,110,.5)');
          } else {
            const mp = H.P3(xm, yf, 22); H.bbAt(c, xm, yf, () => { c.font = '700 10px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(255,255,255,.62)'; c.fillText('(empty bay)', xm, yf - 16); });
          }
          // ---- posts + beam + corner braces
          const post = x => { H.box(c, x - 3.5, yf - 7, 7, 7, postH, { top: '#c79a64', front: '#7a5232', stroke: OUT, lw: 1.2 }); ln(c, H, [x - 1.2, yf, 2], [x - 1.2, yf, postH - 2], 'rgba(255,225,170,.28)', 1.2); };
          const pxs = [x0 + 3, x0 + (x1 - x0) / 3, x0 + (x1 - x0) * 2 / 3, x1 - 3];
          pxs.forEach(post);
          H.box(c, x0, yf - 7, x1 - x0, 7, 7, { z0: postH - 8, top: '#c79a64', front: '#8a5d38', stroke: OUT, lw: 1.2 });
          [[x0 + 6, 1], [x1 - 6, -1]].forEach(([x, s]) => { ln(c, H, [x, yf, postH - 8], [x + s * 15, yf, postH - 8], 'rgba(0,0,0,0)', 1); ln(c, H, [x + s * 0, yf, postH - 20], [x + s * 14, yf, postH - 8], '#7a5232', 3.2); });
          // ---- roof (corrugated green metal), low-pitch gable seen from the front
          const eyF = yf + oh + 2, eyB = yb - oh, eZ = postH + 2, ex0 = x0 - oh, ex1 = x1 + oh;
          const frontR = [[ex0, eyF, eZ], [ex1, eyF, eZ], [ex1, ym, ridgeZ], [ex0, ym, ridgeZ]];
          const backR = [[ex0, eyB, eZ], [ex1, eyB, eZ], [ex1, ym, ridgeZ], [ex0, ym, ridgeZ]];
          face(c, H, backR, '#4d8049', OUT, 1.1);
          face(c, H, frontR, gradV(c, H, ym, ridgeZ, eZ, '#93d088', '#4a8447'), OUT, 1.4);
          c.save(); path3(c, H, frontR); c.clip();
          for (let x = ex0 + 5; x < ex1; x += 7) { ln(c, H, [x, eyF, eZ], [x, ym, ridgeZ], 'rgba(15,55,20,.28)', 1.3); ln(c, H, [x + 2, eyF, eZ], [x + 2, ym, ridgeZ], 'rgba(255,255,255,.17)', 1); }
          ln(c, H, [ex0, ym, ridgeZ - 2], [ex1, ym, ridgeZ - 2], 'rgba(255,255,255,.2)', 3);
          c.restore();
          // fascia + eave drip edge
          face(c, H, [[ex0, eyF, eZ], [ex1, eyF, eZ], [ex1, eyF, eZ - 4.5], [ex0, eyF, eZ - 4.5]], '#2f5f33', OUT, 1.1);
          ln(c, H, [ex0, eyF, eZ + .3], [ex1, eyF, eZ + .3], 'rgba(220,255,210,.55)', 1);
          // ridge cap
          ln(c, H, [ex0, ym, ridgeZ], [ex1, ym, ridgeZ], '#d3f0c8', 3.2); ln(c, H, [ex0, ym, ridgeZ + .6], [ex1, ym, ridgeZ + .6], 'rgba(255,255,255,.75)', 1.1);
          if (P_.snow) snowQuad(c, H, [frontR[0], frontR[1], frontR[2], frontR[3]], .6);
          // little hay bales beside the shed
          [[x0 - 4, yf - 14], [x0 - 4, yf - 14]].length;
          const bale = (bx, by, z0) => { H.box(c, bx, by, 18, 11, 9, { z0, top: '#f0d77a', front: '#d3ac45', stroke: OUT, lw: 1 }); ln(c, H, [bx + 5, by + 11, z0 + .5], [bx + 5, by + 11, z0 + 8.5], 'rgba(120,80,20,.6)', 1); ln(c, H, [bx + 13, by + 11, z0 + .5], [bx + 13, by + 11, z0 + 8.5], 'rgba(120,80,20,.6)', 1); };
          bale(x1 + 8 - 20, yf + 12, 0);
          H.plate(c, xm, g.r.y + g.r.h + 9, 'TRACTOR SHED', { size: 9 });
        }
      }];
    }
  };

  // ================================================================ CO-OP STORE
  function shopGeo(ctx, H) {
    const r = ctx.rect, x0 = r.x + 8, x1 = r.x + r.w - 8, yf = r.y + r.h - 8, d = 52;
    return { r, x0, x1, xm: (x0 + x1) / 2, w: x1 - x0, yf, yb: yf - d, d, wallH: 68 };
  }
  A.structures.shop = {
    ground(c, ctx, H) {
      const g = shopGeo(ctx, H);
      H.castShadow(c, g.x0, g.yb, g.w, g.d, 100, .22);
      contact(c, g.x0 - 2, g.yf, g.w + 4, .28);
      c.fillStyle = 'rgba(40,25,5,.22)'; c.beginPath(); c.ellipse(g.xm, g.yf + 10, g.w / 2 + 4, 8, 0, 0, H.TAU); c.fill();
    },
    props(ctx, H) {
      const g = shopGeo(ctx, H), P_ = ctx.P_, { x0, x1, xm, yf, yb, wallH } = g;
      [x0 + 38, x1 - 38].forEach(x => H.light(x, yf + 6, 28, 38, 'rgba(255,205,115,.55)'));
      H.light(xm, yf + 6, 24, 24, 'rgba(255,205,115,.5)');
      return [{
        sortY: (yf + 12) / H.T,
        x0: g.r.x - 8, x1: g.r.x + g.r.w + 8, y0: yb - H.lift(140), y1: g.r.y + g.r.h + 22,
        hit: { x0: x0 - 4, x1: x1 + 4, y0: yb - H.lift(124), y1: yf + 12 },
        body(c) {
          const CREAM = '#efdcae', TRIMG = '#3f7a4c', DARKG = '#2e5c3a';
          const roofZ = wallH + 8;
          // ---- flat metal roof behind the false front
          H.box(c, x0, yb, g.w, g.d, roofZ, { top: '#a7b1b6', front: '#8d979c', stroke: OUT, lw: 1.2 });
          // roof seams, vent, stovepipe
          const rt = z => z;
          for (let x = x0 + 9; x < x1; x += 9) ln(c, H, [x, yb + 1, roofZ], [x, yf - 8, roofZ], 'rgba(60,70,80,.25)', 1);
          ln(c, H, [x0, yb + 1, roofZ], [x1, yb + 1, roofZ], 'rgba(255,255,255,.5)', 2);
          H.box(c, x1 - 40, yb + 14, 11, 10, 20, { z0: roofZ, top: '#8c4a3a', front: '#6e382b', stroke: OUT, lw: 1.1 });
          H.cyl(c, x0 + 42, yb + 22, 4, 16, { z0: roofZ, side: '#5d6469', top: '#2d3033' });
          if (P_.snow) { const s = [[x0 + 2, yf - 6, roofZ], [x1 - 2, yf - 6, roofZ], [x1 - 2, yb + 1, roofZ], [x0 + 2, yb + 1, roofZ]]; snowQuad(c, H, [s[0], s[1], s[2], s[3]], 1); }
          // ---- false-front facade
          const zE = 94, zC = 124, cw = 38;
          const sil = [[x0, 0], [x1, 0], [x1, zE], [x1 - 22, zE], [x1 - 36, zE + 14], [xm + cw, zE + 14], [xm + cw - 10, zC], [xm - cw + 10, zC], [xm - cw, zE + 14], [x0 + 36, zE + 14], [x0 + 22, zE], [x0, zE]];
          const S3 = sil.map(p => [p[0], yf, p[1]]);
          path3(c, H, S3); c.fillStyle = gradV(c, H, yf, 0, zC, '#f5e6bd', '#c4ab74', CREAM); c.fill();
          c.save(); path3(c, H, S3); c.clip();
          for (let z = 4; z < zC; z += 6) { ln(c, H, [x0, yf, z], [x1, yf, z], 'rgba(110,80,30,.2)', 1); ln(c, H, [x0, yf, z + 1.1], [x1, yf, z + 1.1], 'rgba(255,255,255,.35)', 1); }
          c.restore();
          // top cap thickness along the silhouette (visible top faces)
          for (let i = 3; i < sil.length - 1; i++) { const a = sil[i], b = sil[i + 1]; if (i === 3 || true) H.poly(c, [[a[0], yf - 8, a[1]], [b[0], yf - 8, b[1]], [b[0], yf, b[1]], [a[0], yf, a[1]]], '#fbf2d6', OUT, 1.1); }
          H.poly(c, [[sil[11][0], yf - 8, sil[11][1]], [sil[0][0], yf - 8, sil[0][1]], [sil[0][0], yf, sil[0][1]], [sil[11][0], yf, sil[11][1]]], '#fbf2d6', OUT, 1.1);
          H.poly(c, [[sil[1][0], yf - 8, sil[1][1]], [sil[2][0], yf - 8, sil[2][1]], [sil[2][0], yf, sil[2][1]], [sil[1][0], yf, sil[1][1]]], '#fbf2d6', OUT, 1.1);
          path3(c, H, S3); c.strokeStyle = OUT; c.lineWidth = 1.5; c.lineJoin = 'round'; c.stroke();
          if (P_.snow) {
            for (let i = 3; i < sil.length - 1; i++) { const a = sil[i], b = sil[i + 1]; if (Math.abs(a[1] - b[1]) < 1) { H.poly(c, [[a[0] - .5, yf - 8, a[1] + .5], [b[0] + .5, yf - 8, b[1] + .5], [b[0] + .5, yf + .5, b[1] + 1.5], [a[0] - .5, yf + .5, a[1] + 1.5]], '#f8fbff', 'rgba(120,150,185,.8)', 1); } }
          }
          // cornice band
          H.box(c, x0 - 4, yf, g.w + 8, 5, 6, { z0: wallH - 2, top: '#fff6dc', front: '#d9c48d', stroke: OUT, lw: 1.2 });
          // base + corner boards
          face(c, H, [[x0, yf, 0], [x1, yf, 0], [x1, yf, 6], [x0, yf, 6]], gradV(c, H, yf, 0, 6, '#aaa398', '#6d675e'), OUT, 1);
          [x0, x1].forEach(x => face(c, H, [[x - 3.5, yf, 0], [x + 3.5, yf, 0], [x + 3.5, yf, wallH - 2], [x - 3.5, yf, wallH - 2]], TRIMG, OUT, 1));
          // ---- sign board in the pediment
          const sz0 = zE + 2, sz1 = zC - 6, sw = 29;
          face(c, H, [[xm - sw, yf, sz0], [xm + sw, yf, sz0], [xm + sw, yf, sz1 + 4], [xm - sw, yf, sz1 + 4]], gradV(c, H, yf, sz0, sz1 + 4, '#3f8a52', DARKG), OUT, 1.3);
          face(c, H, [[xm - sw + 3, yf, sz0 + 3], [xm + sw - 3, yf, sz0 + 3], [xm + sw - 3, yf, sz1 + 1], [xm - sw + 3, yf, sz1 + 1]], null, '#f6ead0', 1.6);
          // ---- wall elements below the cornice
          const wzTop = 46;
          const showcase = cx => {
            const ww = 46, z0 = 11;
            face(c, H, [[cx - ww / 2 - 3, yf, z0 - 3], [cx + ww / 2 + 3, yf, z0 - 3], [cx + ww / 2 + 3, yf, wzTop + 3], [cx - ww / 2 - 3, yf, wzTop + 3]], TRIMG, OUT, 1.2);
            const gl = [[cx - ww / 2, yf, z0], [cx + ww / 2, yf, z0], [cx + ww / 2, yf, wzTop], [cx - ww / 2, yf, wzTop]];
            face(c, H, gl, gradV(c, H, yf, z0, wzTop, '#c7e8f4', '#79b3d0'), OUT, 1);
            // goods behind the glass
            [[-15, '#d9483b'], [-4, '#f0c040'], [7, '#8bc34a'], [16, '#e6893a']].forEach(([dx, col], i) => { H.box(c, cx + dx - 4.5, yf - 2, 9, 3, 9 + (i % 2) * 3, { z0: z0 + 1, top: mix(col, '#fff', .35), front: col, stroke: 'rgba(60,34,14,.6)', lw: .8 }); });
            ln(c, H, [cx, yf, z0], [cx, yf, wzTop], TRIMG, 2); ln(c, H, [cx - ww / 2, yf, 30], [cx + ww / 2, yf, 30], TRIMG, 1.6);
            const q = H.P3(cx - ww / 2 + 4, yf, wzTop - 2); c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(q[0] + 9, q[1]); c.lineTo(q[0] - 3, q[1] + 22); c.lineTo(q[0] - 6, q[1] + 22); c.closePath(); c.fill();
            face(c, H, gl, null, 'rgba(60,34,14,.7)', 1);
          };
          showcase(x0 + 38); showcase(x1 - 38);
          // door
          const dw = 15;
          face(c, H, [[xm - dw - 3, yf, 0], [xm + dw + 3, yf, 0], [xm + dw + 3, yf, 58], [xm - dw - 3, yf, 58]], TRIMG, OUT, 1.2);
          face(c, H, [[xm - dw, yf, 0], [xm + dw, yf, 0], [xm + dw, yf, 54], [xm - dw, yf, 54]], gradV(c, H, yf, 0, 54, '#7a4a2a', '#4e2d17'), OUT, 1.1);
          face(c, H, [[xm - dw + 4, yf, 16], [xm + dw - 4, yf, 16], [xm + dw - 4, yf, 48], [xm - dw + 4, yf, 48]], gradV(c, H, yf, 16, 48, '#c7e8f4', '#79b3d0'), OUT, 1);
          ln(c, H, [xm, yf, 0], [xm, yf, 54], 'rgba(0,0,0,.35)', 1.1);
          const kn = H.P3(xm + 5, yf, 24); c.fillStyle = '#ffd45e'; c.beginPath(); c.arc(kn[0], kn[1], 1.7, 0, H.TAU); c.fill();
          // ---- striped awning
          const aY = yf + 13, aZ0 = 60, aZ1 = 49, ax0 = x0 - 5, ax1 = x1 + 5, n = 14, sw2 = (ax1 - ax0) / n;
          for (let i = 0; i < n; i++) {
            const a = ax0 + i * sw2, b = a + sw2, col = i % 2 ? '#fff3de' : '#d8453a';
            H.poly(c, [[a, yf, aZ0], [b, yf, aZ0], [b, aY, aZ1], [a, aY, aZ1]], gradV(c, H, yf, aZ1, aZ0 + 4, mix(col, '#000', .12), mix(col, '#fff', .12)), 'rgba(60,34,14,.55)', .8);
            const p = H.P3(a, aY, aZ1), q = H.P3(b, aY, aZ1);
            c.beginPath(); c.moveTo(p[0], p[1]); c.quadraticCurveTo((p[0] + q[0]) / 2, p[1] + 7, q[0], q[1]); c.closePath(); c.fillStyle = col; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
          }
          ln(c, H, [ax0, yf, aZ0 + .3], [ax1, yf, aZ0 + .3], 'rgba(255,255,255,.4)', 1.2);
          // awning posts
          [ax0 + 4, ax1 - 4].forEach(x => { H.box(c, x - 2, aY - 2, 4, 3, 48, { top: '#7ab685', front: '#2e6a40', stroke: OUT, lw: 1 }); });
          if (P_.snow) { const a2 = [[ax0, aY, aZ1], [ax1, aY, aZ1], [ax1, yf, aZ0], [ax0, yf, aZ0]]; snowQuad(c, H, a2, .55); }
          // ---- sign emoji + text (upright)
          H.bbAt(c, xm, yf, () => {
            const cx = xm, cy = yf - ((sz0 + sz1) / 2 + 3) * H.HZ;
            H.emStatic(c, '🏪', cx - 17, cy + 1, 14);
            c.font = '900 10px system-ui,-apple-system,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 2; c.strokeStyle = 'rgba(0,40,10,.55)';
            c.fillStyle = '#fff2c7'; c.strokeText('CO-OP', cx + 9, cy + 1); c.fillText('CO-OP', cx + 9, cy + 1);
          });
          // ---- crates + barrel out front
          const crate = (bx, by, z0, col) => { H.box(c, bx, by, 20, 11, 11, { z0, top: mix(col, '#fff', .3), front: col, stroke: OUT, lw: 1 }); ln(c, H, [bx, by + 11, z0 + 5.5], [bx + 20, by + 11, z0 + 5.5], 'rgba(60,34,14,.35)', 1); };
          crate(x1 - 38, yf + 17, 0, '#c8964f');
          H.emStatic(c, '🍎', x1 - 32, H.P3(0, yf + 22, 12)[1] - 1, 10); H.emStatic(c, '🥕', x1 - 22, H.P3(0, yf + 23, 12)[1] - 2, 10);
          H.cyl(c, x0 + 22, yf + 22, 7, 15, { side: '#9a6a3a', top: '#c79a64', hi: 'rgba(255,230,190,.35)', dark: 'rgba(30,10,0,.4)' });
          ln(c, H, [x0 + 15, yf + 28.5, 5], [x0 + 29, yf + 28.5, 5], 'rgba(40,25,10,.65)', 1.4); ln(c, H, [x0 + 15, yf + 28.5, 11], [x0 + 29, yf + 28.5, 11], 'rgba(40,25,10,.65)', 1.4);
          H.plate(c, xm, g.r.y + g.r.h + 11, 'CO-OP STORE', { size: 9, bg: '#dff3c8' });
        }
      }];
    }
  };

  // ================================================================ ORDERS BOARD + MAILBOX
  function ordGeo(ctx, H) {
    const r = ctx.rect; return { r, yf: r.y + r.h - 8, bx0: r.x + 2, bx1: r.x + 53, mx: r.x + r.w - 12 };
  }
  A.structures.orders = {
    ground(c, ctx, H) {
      const g = ordGeo(ctx, H), P_ = ctx.P_;
      c.fillStyle = P_.pathD; c.globalAlpha = .45; c.beginPath(); c.ellipse(g.r.x + g.r.w / 2, g.yf + 3, g.r.w / 2 + 2, 9, 0, 0, H.TAU); c.fill(); c.globalAlpha = 1;
      H.castShadow(c, g.bx0, g.yf - 5, g.bx1 - g.bx0, 4, 74, .17);
      H.castShadow(c, g.mx - 2, g.yf - 4, 4, 3, 44, .17);
      H.shadow(c, g.bx0 + 6, g.yf, 7, .3); H.shadow(c, g.bx1 - 6, g.yf, 7, .3); H.shadow(c, g.mx, g.yf, 6, .3);
    },
    props(ctx, H) {
      const g = ordGeo(ctx, H), P_ = ctx.P_, { yf, bx0, bx1, mx } = g, wood = '#8a5a30';
      return [{
        sortY: yf / H.T,
        x0: g.r.x - 8, x1: g.r.x + g.r.w + 10, y0: yf - H.lift(106), y1: g.r.y + g.r.h + 22,
        hit: { x0: g.r.x - 2, x1: g.r.x + g.r.w + 4, y0: yf - H.lift(90), y1: yf + 2 },
        body(c) {
          const pz = 62;
          [bx0 + 5, bx1 - 5].forEach(x => { H.box(c, x - 3.5, yf - 6, 7, 6, 76, { top: '#c99358', front: wood, stroke: OUT, lw: 1.2 }); ln(c, H, [x - 1.5, yf, 3], [x - 1.5, yf, 74], 'rgba(255,225,170,.3)', 1.2); });
          // board
          const bz0 = 30, bz1 = 74, by = yf - 8;
          H.box(c, bx0, by - 3, bx1 - bx0, 6, bz1 - bz0, { z0: bz0, top: '#e0b878', front: '#5b3a1e', stroke: OUT, lw: 1.3 });
          H.poly(c, [[bx0 + 4, by + 3, bz0 + 4], [bx1 - 4, by + 3, bz0 + 4], [bx1 - 4, by + 3, bz1 - 4], [bx0 + 4, by + 3, bz1 - 4]], gradV(c, H, by + 3, bz0, bz1, '#d9aa66', '#b98748'), 'rgba(62,34,14,.7)', 1);
          for (let z = bz0 + 10; z < bz1 - 4; z += 8) ln(c, H, [bx0 + 4, by + 3, z], [bx1 - 4, by + 3, z], 'rgba(90,55,20,.22)', 1);
          // little roof
          H.poly(c, [[bx0 - 4, by - 6, bz1 + 7], [bx1 + 4, by - 6, bz1 + 7], [bx1 + 4, by + 6, bz1 + 1], [bx0 - 4, by + 6, bz1 + 1]], gradV(c, H, by, bz1 + 1, bz1 + 9, '#d7513f', '#a53428'), OUT, 1.3);
          ln(c, H, [bx0 - 4, by + 6, bz1 + 1], [bx1 + 4, by + 6, bz1 + 1], '#7e241b', 2);
          if (P_.snow) snowQuad(c, H, [[bx0 - 4, by + 6, bz1 + 1], [bx1 + 4, by + 6, bz1 + 1], [bx1 + 4, by - 6, bz1 + 7], [bx0 - 4, by - 6, bz1 + 7]], .8);
          // pinned notes (upright on the board face)
          H.bbAt(c, (bx0 + bx1) / 2, by + 3, () => {
            const base = by + 3 - bz0 * H.HZ;
            const notes = [[bx0 + 8, 7, 12, 15, -.1, '#ffffff'], [bx0 + 23, 4, 13, 16, .07, '#ffe39a'], [bx0 + 37, 8, 11, 14, -.05, '#ffd0dc'], [bx0 + 15, 25, 12, 13, .05, '#d9efff'], [bx0 + 31, 24, 13, 15, -.08, '#ffffff']];
            notes.forEach(n => {
              c.save(); c.translate(n[0] + n[2] / 2, base - n[1] - n[3] / 2); c.rotate(n[4]);
              c.fillStyle = 'rgba(40,20,0,.28)'; c.fillRect(-n[2] / 2 + 1, -n[3] / 2 + 1.5, n[2], n[3]);
              c.fillStyle = n[5]; c.fillRect(-n[2] / 2, -n[3] / 2, n[2], n[3]); c.strokeStyle = 'rgba(62,34,14,.55)'; c.lineWidth = .8; c.strokeRect(-n[2] / 2, -n[3] / 2, n[2], n[3]);
              c.fillStyle = 'rgba(60,40,20,.5)'; for (let k = 0; k < 3; k++) c.fillRect(-n[2] / 2 + 2, -n[3] / 2 + 5 + k * 3, n[2] - 4 - (k % 2) * 3, 1);
              c.fillStyle = '#d9483b'; c.beginPath(); c.arc(0, -n[3] / 2 + 1.6, 1.7, 0, H.TAU); c.fill(); c.restore();
            });
          });
          // ---- red rural mailbox, flag up
          H.box(c, mx - 2.5, yf - 5, 5, 5, 40, { top: '#c99358', front: wood, stroke: OUT, lw: 1.1 });
          H.bbAt(c, mx, yf - 5, () => {
            const b = yf - 5 - 40 * H.HZ;
            c.fillStyle = '#6b4220'; c.fillRect(mx - 7, b - 1, 14, 3);
            // flag
            c.fillStyle = '#6b4220'; c.fillRect(mx + 9, b - 20, 2, 17);
            c.fillStyle = '#ffd45e'; c.strokeStyle = OUT; c.lineWidth = 1; c.beginPath(); c.rect(mx + 10.5, b - 20, 8, 6); c.fill(); c.stroke();
            // body (arched top)
            const g2 = c.createLinearGradient(0, b - 15, 0, b); g2.addColorStop(0, '#f0675a'); g2.addColorStop(.5, '#d9483b'); g2.addColorStop(1, '#a42d23');
            c.beginPath(); c.moveTo(mx - 12, b); c.lineTo(mx - 12, b - 8); c.quadraticCurveTo(mx - 12, b - 15.5, mx - 3, b - 15.5); c.lineTo(mx + 3, b - 15.5); c.quadraticCurveTo(mx + 12, b - 15.5, mx + 12, b - 8); c.lineTo(mx + 12, b); c.closePath();
            c.fillStyle = g2; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.3; c.stroke();
            c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(mx - 9, b - 13.5, 12, 2);
            c.fillStyle = '#7e241b'; c.fillRect(mx - 10, b - 6, 20, 1.2);
            c.fillStyle = '#e8e8e8'; c.fillRect(mx - 5, b - 11, 10, 3);
            if (P_.snow) { c.fillStyle = '#f8fbff'; c.beginPath(); c.ellipse(mx - 1, b - 15.5, 9, 2.6, 0, Math.PI, 0); c.fill(); }
          });
          H.plate(c, g.r.x + g.r.w / 2, g.r.y + g.r.h + 9, 'ORDERS', { size: 9, bg: '#ffe39a' });
        }
      }];
    }
  };
})();
