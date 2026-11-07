/* art-terrain.js — 3D three-quarter terrain & nature art: ground, Palouse hills, paths, county road, pond, trees, lamps, hay,
   fence, road sign, reeds, rocks and bushes. Lit from the north-west; shade and cast shadows fall south-east. */
(function () {
  'use strict'; const G = window.G; if (!G) return; const A = G.WorldArt = G.WorldArt || {};
  A.structures = A.structures || {}; A.terrain = A.terrain || {}; A.actors = A.actors || {};
  const TAU = Math.PI * 2;

  // ------------------------------------------------------------------ colour + misc helpers
  const hx = h => h[0] === '#' ? [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] : h.match(/[\d.]+/g).slice(0, 3).map(Number);
  const toS = a => 'rgb(' + Math.round(a[0]) + ',' + Math.round(a[1]) + ',' + Math.round(a[2]) + ')';
  const mix = (a, b, t) => { const p = hx(a), q = hx(b); return toS([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]); };
  const lit = (h, t) => mix(h, '#fffbe0', t), dk = (h, t) => mix(h, '#1b1408', t);
  const hex = s => { // 'rgb(r,g,b)' -> '#rrggbb' so results can be mixed again
    if (s[0] === '#') return s; const m = s.match(/\d+/g).map(Number); return '#' + m.map(v => ('0' + v.toString(16)).slice(-2)).join('');
  };
  const season = () => { try { return G.calendar().season; } catch (e) { return 'spring'; } };
  // visible rectangle (ground px) of the current canvas, so big scatter layers only draw what a tile needs
  function view(c, pad) {
    const m = c.getTransform(), w = c.canvas.width, h = c.canvas.height; pad = pad || 0;
    return { x0: -m.e / m.a - pad, y0: -m.f / m.d - pad, x1: (w - m.e) / m.a + pad, y1: (h - m.f) / m.d + pad };
  }
  const inV = (v, x, y, r) => x + r >= v.x0 && x - r <= v.x1 && y + r >= v.y0 && y - r <= v.y1;
  function rrPath(p, x, y, w, h, r) { p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); }
  // soft elliptical radial gradient fill (ground space)
  function blob(c, x, y, rx, ry, stops, rot) {
    c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.scale(1, ry / rx);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx); stops.forEach(s => g.addColorStop(s[0], s[1]));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
  }
  // upright lit sphere (inside bbAt): radial highlight to the north-west, shade to the south-east
  function ball(c, x, y, r, base, line) {
    const g = c.createRadialGradient(x - r * .4, y - r * .45, r * .06, x, y, r * 1.04);
    g.addColorStop(0, lit(base, .5)); g.addColorStop(.4, base); g.addColorStop(1, dk(base, .42));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    if (line) { c.strokeStyle = 'rgba(15,35,10,.3)'; c.lineWidth = 1; c.stroke(); }
  }
  const SOFT = 'rgba(25,15,0,';

  // ------------------------------------------------------------------ GROUND
  A.terrain.ground = (c, P_, H) => {
    const T = H.T, WT = H.W * T, HT = H.H * T, v = view(c, 30), r = H.mulberry(11), snow = P_.snow;
    c.fillStyle = P_.g1; c.fillRect(0, 0, WT, HT);
    // mottled g2 patches
    for (let i = 0; i < 230; i++) {
      const x = r() * WT, y = r() * HT, rx = 20 + r() * 50, ry = 12 + r() * 30, a = r() * 3; if (!inV(v, x, y, rx)) continue;
      blob(c, x, y, rx, ry, [[0, hex(P_.g2) + '99'], [1, hex(P_.g2) + '00']], a);
    }
    // gently rolling land: lit north-west swells, shaded south-east flanks
    const lightRGB = snow ? '255,255,255' : '255,250,200', darkRGB = snow ? '70,95,150' : '20,45,0';
    for (let i = 0; i < 70; i++) {
      const x = r() * WT, y = r() * HT, rx = 90 + r() * 170, ry = 50 + r() * 90;
      if (!inV(v, x, y, rx * 1.4)) continue;
      blob(c, x + rx * .12, y + ry * .16, rx, ry, [[0, 'rgba(' + darkRGB + ',' + (snow ? .12 : .09) + ')'], [.65, 'rgba(' + darkRGB + ',' + (snow ? .05 : .04) + ')'], [1, 'rgba(' + darkRGB + ',0)']]);
      blob(c, x - rx * .2, y - ry * .26, rx * .85, ry * .85, [[0, 'rgba(' + lightRGB + ',' + (snow ? .38 : .17) + ')'], [.7, 'rgba(' + lightRGB + ',' + (snow ? .12 : .05) + ')'], [1, 'rgba(' + lightRGB + ',0)']]);
    }
    // grass tufts: dark base blades + lit tips
    const bl = [], N = snow ? 520 : 1500;
    for (let i = 0; i < N; i++) { const x = r() * WT, y = r() * HT, k = r(); if (inV(v, x, y, 8)) bl.push([x, y, k]); }
    c.lineCap = 'round';
    c.strokeStyle = P_.tuft; c.lineWidth = 1.7; c.beginPath();
    bl.forEach(b => { const x = b[0], y = b[1]; c.moveTo(x, y); c.lineTo(x - 2.6, y - 5.2); c.moveTo(x, y); c.lineTo(x + .5, y - 6.8); c.moveTo(x, y); c.lineTo(x + 3, y - 4.2); });
    c.stroke();
    c.strokeStyle = snow ? 'rgba(255,255,255,.7)' : lit(P_.g1, .45); c.lineWidth = 1; c.beginPath();
    bl.forEach(b => { const x = b[0] - 1, y = b[1]; c.moveTo(x, y - 1); c.lineTo(x - 2.4, y - 5); c.moveTo(x + 1, y - 1); c.lineTo(x + .4, y - 6.3); });
    c.stroke();
    if (P_.flower) { // spring flowers: little clusters with a cast pip
      const cols = ['#ffffff', '#ffe36a', '#ff9ec7', '#c9a8ff', '#ff8a8a'];
      for (let i = 0; i < 260; i++) {
        const x = r() * WT, y = r() * HT, col = cols[i % 5], n = 1 + Math.floor(r() * 3), ox = [], oy = []; for (let k = 0; k < n; k++) { ox.push(x + (r() - .5) * 9); oy.push(y + (r() - .5) * 5); }
        if (!inV(v, x, y, 8)) continue;
        for (let k = 0; k < n; k++) {
          c.fillStyle = 'rgba(20,50,0,.25)'; c.beginPath(); c.ellipse(ox[k] + 1, oy[k] + 1.4, 2.2, 1.2, 0, 0, TAU); c.fill();
          c.strokeStyle = '#4a8a30'; c.lineWidth = 1; c.beginPath(); c.moveTo(ox[k], oy[k] + 1); c.lineTo(ox[k], oy[k] - 2); c.stroke();
          c.fillStyle = col; for (let q = 0; q < 5; q++) { c.beginPath(); c.arc(ox[k] + Math.cos(q * 1.257) * 1.7, oy[k] - 3 + Math.sin(q * 1.257) * 1.4, 1.1, 0, TAU); c.fill(); }
          c.fillStyle = col === '#ffe36a' ? '#e8a020' : '#ffd23a'; c.beginPath(); c.arc(ox[k], oy[k] - 3, .9, 0, TAU); c.fill();
        }
      }
    }
    if (snow) { // snow drifts: blue shadow SE, bright NW crest
      for (let i = 0; i < 100; i++) {
        const x = r() * WT, y = r() * HT, rx = 16 + r() * 34, ry = 5 + r() * 10; if (!inV(v, x, y, rx + 8)) continue;
        c.fillStyle = 'rgba(120,150,190,.34)'; c.beginPath(); c.ellipse(x + 4, y + 4, rx, ry, 0, 0, TAU); c.fill();
        const g = c.createLinearGradient(0, y - ry, 0, y + ry); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e3edf6');
        c.fillStyle = g; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.ellipse(x - rx * .2, y - ry * .3, rx * .55, ry * .45, 0, 0, TAU); c.fill();
      }
      c.fillStyle = 'rgba(255,255,255,.95)'; for (let i = 0; i < 160; i++) { const x = r() * WT, y = r() * HT; if (inV(v, x, y, 3)) { c.beginPath(); c.arc(x, y, .8 + r() * .8, 0, TAU); c.fill(); } }
    } else { // sprinkled small stones and clover for texture
      for (let i = 0; i < 90; i++) {
        const x = r() * WT, y = r() * HT, s = 1.4 + r() * 1.6; if (!inV(v, x, y, 5)) continue;
        c.fillStyle = 'rgba(20,20,0,.18)'; c.beginPath(); c.ellipse(x + 1, y + 1.2, s, s * .6, 0, 0, TAU); c.fill();
        c.fillStyle = lit('#a8a28c', .1); c.beginPath(); c.ellipse(x, y, s, s * .65, 0, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.ellipse(x - s * .3, y - s * .25, s * .4, s * .25, 0, 0, TAU); c.fill();
      }
    }
  };

  // ------------------------------------------------------------------ FENCE geometry (shared by hills shadows + props)
  function fenceLines(H) {
    const T = H.T, y1 = H.ROAD0 * T - 4;
    return [
      { x1: 2 * T, y1: 2 * T + 6, x2: 2 * T, y2: 7 * T + 2, gateEnd: 'b' }, { x1: 2 * T, y1: 8 * T - 2, x2: 2 * T, y2: y1, gateEnd: 't' },
      { x1: 38 * T, y1: 2 * T + 6, x2: 38 * T, y2: 7 * T + 2, gateEnd: 'b' }, { x1: 38 * T, y1: 8 * T - 2, x2: 38 * T, y2: y1, gateEnd: 't' },
      { x1: 14 * T, y1: 2 * T + 6, x2: 30 * T, y2: 2 * T + 6 }
    ];
  }

  // ------------------------------------------------------------------ HILLS
  A.terrain.hills = (c, P_, H) => {
    const T = H.T, WT = H.W * T, HT = H.H * T, v = view(c, 40), r = H.mulberry(5), sea = season(), snow = P_.snow;
    c.save(); c.beginPath(); c.rect(0, 0, WT, HT); c.rect(2 * T, 2 * T, (H.W - 4) * T, (H.H - 3) * T); c.clip('evenodd');
    c.fillStyle = P_.hill; c.fillRect(0, 0, WT, HT);
    const N = 40, bands = [];
    for (let k = 0; k < N; k++) bands.push({ by: k * 31 - 26 + r() * 8, th: 36 + r() * 10, p1: k * .5 + r() * .5, p2: r() * 6, a1: 11 + r() * 8, a2: 3 + r() * 4, f1: .0085 + r() * .004, tone: r(), fall: r() });
    const cy = (b, x) => b.by + Math.sin(x * b.f1 + b.p1) * b.a1 + Math.sin(x * .027 + b.p2) * b.a2;
    const palA = [P_.hillA, P_.hillB];
    bands.forEach((b, k) => {
      const ymin = b.by - b.a1 - b.a2, ymax = b.by + b.a1 + b.a2 + b.th; if (ymax < v.y0 || ymin > v.y1) return;
      let base = palA[k % 2];
      if (sea === 'spring' && k % 7 === 3) base = '#c4a469';        // fallow brown field
      else if (sea === 'fall' && k % 6 === 2) base = '#93602d';     // plowed
      else if (sea === 'summer' && k % 5 === 1) base = '#e0b552';
      if (sea !== 'winter') base = mix(base, k % 3 ? '#ffffff' : '#000000', .04 + b.tone * .05);
      const xs = Math.floor((v.x0 - 24) / 12) * 12, xe = v.x1 + 24, pth = new Path2D(); let first = true;
      for (let x = xs; x <= xe; x += 12) { const y = cy(b, x); if (first) { pth.moveTo(x, y); first = false; } else pth.lineTo(x, y); }
      pth.lineTo(xe, ymax + 60); pth.lineTo(xs, ymax + 60); pth.closePath();
      c.fillStyle = base; c.fill(pth);
      const gr = c.createLinearGradient(0, ymin, 0, ymin + b.th + 24);
      gr.addColorStop(0, 'rgba(255,252,210,' + (snow ? .55 : .3) + ')'); gr.addColorStop(.3, 'rgba(255,252,210,0)'); gr.addColorStop(.75, 'rgba(40,25,0,' + (snow ? .06 : .05) + ')'); gr.addColorStop(1, snow ? 'rgba(70,95,150,.30)' : 'rgba(50,30,0,.30)');
      c.fillStyle = gr; c.fill(pth);
      // furrow lines follow the contour (the iconic Palouse stripes)
      const fcol = snow ? 'rgba(120,150,190,.22)' : sea === 'summer' ? 'rgba(150,110,30,.2)' : sea === 'fall' ? 'rgba(80,40,10,.22)' : 'rgba(40,90,20,.2)';
      c.strokeStyle = fcol; c.lineWidth = 1.2;
      [8, 15, 22, 29].forEach(o => { c.beginPath(); let f2 = true; for (let x = xs; x <= xe; x += 12) { const y = cy(b, x) + o; if (f2) { c.moveTo(x, y); f2 = false; } else c.lineTo(x, y); } c.stroke(); });
      // lit crest line + dark seam where it meets the band below
      c.strokeStyle = snow ? 'rgba(255,255,255,.95)' : 'rgba(255,255,215,.5)'; c.lineWidth = 2.2; c.beginPath(); first = true;
      for (let x = xs; x <= xe; x += 12) { const y = cy(b, x) - .5; if (first) { c.moveTo(x, y); first = false; } else c.lineTo(x, y); } c.stroke();
      c.strokeStyle = snow ? 'rgba(90,115,165,.3)' : 'rgba(60,35,0,.2)'; c.lineWidth = 3; c.beginPath(); first = true;
      for (let x = xs; x <= xe; x += 12) { const y = cy(b, x) + 2.5; if (first) { c.moveTo(x, y); first = false; } else c.lineTo(x, y); } c.stroke();
    });
    // big rolling mounds: lit north-west faces, shaded south-east
    for (let i = 0; i < 34; i++) {
      const x = r() * WT, y = r() * HT, rx = 70 + r() * 150, ry = 32 + r() * 60; if (!inV(v, x, y, rx)) continue;
      c.save(); c.translate(x, y); c.scale(1, ry / rx);
      const g = c.createRadialGradient(-rx * .3, -rx * .34, rx * .04, 0, 0, rx);
      g.addColorStop(0, 'rgba(255,255,220,' + (snow ? .4 : .24) + ')'); g.addColorStop(.5, 'rgba(255,255,220,0)'); g.addColorStop(.82, snow ? 'rgba(90,115,165,.08)' : 'rgba(50,30,0,.08)'); g.addColorStop(1, snow ? 'rgba(80,105,160,.22)' : 'rgba(40,25,0,.22)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
    }
    // distant round bales + shrubs for scale
    for (let i = 0; i < 30; i++) {
      const x = r() * WT, y = r() * HT, k = r(); if (!inV(v, x, y, 10)) continue;
      if (snow) continue;
      if (k < .45 && (sea === 'summer' || sea === 'fall')) {
        c.fillStyle = 'rgba(40,25,0,.28)'; c.beginPath(); c.ellipse(x + 3, y + 2.5, 6.5, 3, 0, 0, TAU); c.fill();
        c.fillStyle = '#d4ad52'; c.beginPath(); c.arc(x, y - 3, 5, 0, TAU); c.fill(); c.fillStyle = '#efd47c'; c.beginPath(); c.arc(x - 1.3, y - 4.2, 3, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(120,80,10,.4)'; c.lineWidth = .8; c.beginPath(); c.arc(x, y - 3, 2.6, 0, TAU); c.stroke();
      } else if (k < .85) {
        c.fillStyle = 'rgba(30,40,0,.25)'; c.beginPath(); c.ellipse(x + 3, y + 2, 8, 3.2, 0, 0, TAU); c.fill();
        const base = sea === 'fall' ? '#8a6a2a' : '#4d8a38'; [[0, -3, 5], [-5, -1, 4], [5, -1, 4.2]].forEach(b => ball(c, x + b[0], y + b[1], b[2], base));
      }
    }
    c.restore();
    // cast shadows of the outer fence on the hills (fence itself is a set of 3D props)
    fenceLines(H).forEach(f => {
      if (f.x1 === f.x2) H.castShadow(c, f.x1 - 1.5, f.y1, 3, f.y2 - f.y1, 15, snow ? .14 : .2);
      else H.castShadow(c, f.x1, f.y1 - 1.5, f.x2 - f.x1, 3, 15, snow ? .14 : .2);
    });
  };

  // ------------------------------------------------------------------ PATHS
  const PATH_RECTS = [[2, 7, 36, 1], [2, 8, 12, 1], [14, 8, 1, 18], [28, 7, 2, 19], [15, 13, 12, 1], [15, 18, 12, 1], [15, 21, 12, 1], [15, 24, 12, 1], [4, 25, 5, 1], [10, 24, 4, 1], [32, 25, 5, 1], [30, 22, 7, 1]];
  A.terrain.paths = (c, P_, H) => {
    const T = H.T, r = H.mulberry(21), v = view(c, 20), snow = P_.snow;
    const U = (dy) => { const p = new Path2D(); PATH_RECTS.forEach(q => rrPath(p, q[0] * T + 2, q[1] * T + 4 + dy, q[2] * T - 4, q[3] * T - 8, 12)); return p; };
    // bevel: dark lip (south), lit rim (north) and the worn top, as stacked unions so overlaps merge cleanly
    c.fillStyle = 'rgba(40,25,5,.28)'; c.fill(U(6));
    c.fillStyle = dk(P_.pathD, .22); c.fill(U(4.4));
    c.fillStyle = lit(P_.path, .42); c.fill(U(0));
    c.fillStyle = P_.path; c.fill(U(1.7));
    // gentle top shading inside the tops
    const tops = U(1.7); c.save(); c.clip(tops);
    PATH_RECTS.forEach(q => {
      const y = q[1] * T + 4, h = q[3] * T - 8, g = c.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, 'rgba(255,245,200,.22)'); g.addColorStop(.5, 'rgba(255,245,200,0)'); g.addColorStop(1, 'rgba(60,35,5,.16)');
      c.fillStyle = g; c.fillRect(q[0] * T, y - 2, q[2] * T, h + 4);
    });
    // worn centre and speckles
    for (let i = 0; i < 1300; i++) {
      const q = PATH_RECTS[Math.floor(r() * PATH_RECTS.length)], x = q[0] * T + 6 + r() * (q[2] * T - 12), y = q[1] * T + 6 + r() * (q[3] * T - 12), k = r(), s = .7 + r() * 1.5;
      if (!inV(v, x, y, 4)) continue;
      if (k < .55) { c.fillStyle = 'rgba(70,45,10,.5)'; c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill(); }
      else if (k < .85) { c.fillStyle = 'rgba(255,255,235,.55)'; c.beginPath(); c.arc(x, y - .5, s * .8, 0, TAU); c.fill(); }
      else { // pebble with shadow
        c.fillStyle = 'rgba(50,30,5,.35)'; c.beginPath(); c.ellipse(x + 1, y + 1.2, s * 1.5, s, 0, 0, TAU); c.fill();
        c.fillStyle = k < .93 ? '#b7ab95' : '#9c8f78'; c.beginPath(); c.ellipse(x, y, s * 1.5, s, 0, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(x - s * .4, y - s * .3, s * .6, s * .3, 0, 0, TAU); c.fill();
      }
    }
    c.restore();
    // grass blades growing over the south lip
    c.lineCap = 'round'; c.strokeStyle = snow ? 'rgba(210,225,235,.9)' : P_.tuft; c.lineWidth = 1.4; c.beginPath();
    PATH_RECTS.forEach(q => {
      const y = (q[1] + q[3]) * T - 3.5, n = Math.floor(q[2] * T / 15);
      for (let i = 0; i < n; i++) { const x = q[0] * T + 6 + r() * (q[2] * T - 12), k = r(); if (!inV(v, x, y, 6)) continue; c.moveTo(x, y + 2); c.lineTo(x - 1.6, y - 3.6 * (1 + k)); c.moveTo(x + 1, y + 2); c.lineTo(x + 2, y - 3 * (1 + k)); }
    });
    c.stroke();
    if (snow) { // packed snow with footprints-grey lane
      c.fillStyle = 'rgba(255,255,255,.62)'; c.fill(U(0.5)); c.save(); c.clip(U(1)); c.fillStyle = 'rgba(150,170,200,.28)'; PATH_RECTS.forEach(q => c.fillRect(q[0] * T, (q[1] + q[3]) * T - 11, q[2] * T, 4)); c.restore();
      c.fillStyle = 'rgba(255,255,255,.95)'; c.fill(U(-1.5)); c.globalAlpha = .55; c.fillStyle = P_.path; c.save(); c.clip(U(0)); PATH_RECTS.forEach(q => c.fillRect(q[0] * T, q[1] * T + 14, q[2] * T, q[3] * T - 28)); c.restore(); c.globalAlpha = 1;
    }
  };

  // ------------------------------------------------------------------ ROAD
  const SIGN = { x: 22.4 * 40, y: 25.3 * 40 };
  A.terrain.road = (c, P_, H) => {
    const T = H.T, WT = H.W * T, r = H.mulberry(33), y0 = H.ROAD0 * T, h = (H.ROAD1 - H.ROAD0 + 1) * T, v = view(c, 20), snow = P_.snow;
    const xs = Math.max(0, Math.floor(v.x0 / 16) * 16), xe = Math.min(WT, v.x1 + 16);
    // north shoulder: dirt-and-grass slope, lit
    let g = c.createLinearGradient(0, y0 - 11, 0, y0); g.addColorStop(0, hex(P_.g1) + '00'); g.addColorStop(.35, dk(hex(P_.roadD), .0)); g.addColorStop(1, lit(hex(P_.roadD), .1));
    c.fillStyle = g; c.fillRect(0, y0 - 11, WT, 11);
    c.fillStyle = 'rgba(255,255,230,.35)'; c.fillRect(0, y0 - 1.5, WT, 1.5);
    // road surface (raised bed)
    g = c.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, lit(hex(P_.road), .12)); g.addColorStop(.5, P_.road); g.addColorStop(1, dk(hex(P_.road), .1));
    c.fillStyle = g; c.fillRect(0, y0, WT, h);
    // south edge depth: front face of the road bed, then a ditch
    g = c.createLinearGradient(0, y0 + h, 0, y0 + h + 7); g.addColorStop(0, dk(hex(P_.roadD), .1)); g.addColorStop(1, dk(hex(P_.roadD), .5));
    c.fillStyle = g; c.fillRect(0, y0 + h, WT, 7);
    c.fillStyle = 'rgba(255,255,230,.22)'; c.fillRect(0, y0 + h, WT, 1.4);
    g = c.createLinearGradient(0, y0 + h + 7, 0, y0 + h + 17); g.addColorStop(0, 'rgba(30,20,0,.35)'); g.addColorStop(1, 'rgba(30,20,0,0)'); c.fillStyle = g; c.fillRect(0, y0 + h + 7, WT, 10);
    // wheel ruts: dark worn lanes with a lit ridge between pairs
    const wob = (y, amp, ph) => { const out = []; for (let x = xs; x <= xe; x += 24) out.push([x, y + Math.sin(x * .013 + ph) * amp]); return out; };
    const strokeLine = (pts) => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); };
    c.lineCap = 'round'; c.lineJoin = 'round';
    [[y0 + 32, 0], [y0 + 82, 1.7]].forEach(q => {
      c.strokeStyle = 'rgba(255,255,230,.16)'; c.lineWidth = 3; strokeLine(wob(q[0] + 7, 1.6, q[1]));
      c.strokeStyle = 'rgba(50,35,10,.16)'; c.lineWidth = 7; strokeLine(wob(q[0], 1.6, q[1])); strokeLine(wob(q[0] + 14, 1.6, q[1]));
      c.strokeStyle = 'rgba(255,255,230,.18)'; c.lineWidth = 1; strokeLine(wob(q[0] - 3, 1.6, q[1])); strokeLine(wob(q[0] + 11, 1.6, q[1]));
    });
    // gravel
    for (let i = 0; i < 2400; i++) {
      const x = r() * WT, y = y0 + 2 + r() * (h - 4), k = r(), s = .6 + r() * 1.3; if (!inV(v, x, y, 4)) continue;
      if (k < .5) { c.fillStyle = 'rgba(60,50,35,.5)'; c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill(); }
      else if (k < .85) { c.fillStyle = 'rgba(255,255,240,.45)'; c.beginPath(); c.arc(x, y, s * .9, 0, TAU); c.fill(); }
      else { c.fillStyle = 'rgba(40,30,10,.35)'; c.beginPath(); c.ellipse(x + 1, y + 1, s * 1.6, s, 0, 0, TAU); c.fill(); c.fillStyle = k < .93 ? '#c6bfae' : '#8f8878'; c.beginPath(); c.ellipse(x, y, s * 1.6, s * 1.05, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(x - s * .4, y - s * .3, s * .6, s * .3, 0, 0, TAU); c.fill(); }
    }
    // dashed centre line (painted, a bit worn) with a tiny edge
    const cyc = y0 + h / 2 - 1.5;
    for (let i = 0, x = 6; x < WT; i++, x += 40) {
      const wear = .8 + ((i * 37) % 11) / 55; if (!inV(v, x + 11, cyc, 14)) continue;
      c.fillStyle = 'rgba(60,45,0,.3)'; c.fillRect(x, cyc + 1.8, 22, 3);
      c.fillStyle = snow ? '#e8d890' : '#ecc84a'; c.globalAlpha = wear; c.fillRect(x, cyc, 22, 3); c.globalAlpha = 1;
      c.fillStyle = 'rgba(255,255,220,.55)'; c.fillRect(x + 1, cyc, 20, 1);
    }
    // sign cast shadow
    H.castShadow(c, SIGN.x - 22, SIGN.y - 2, 3, 3, 52, .2); H.castShadow(c, SIGN.x + 20, SIGN.y - 2, 3, 3, 52, .2);
    c.save(); c.fillStyle = SOFT + '.14)'; c.beginPath(); c.moveTo(SIGN.x - 46, SIGN.y - 1); c.lineTo(SIGN.x + 46, SIGN.y - 1); c.lineTo(SIGN.x + 46 + 30, SIGN.y + 14); c.lineTo(SIGN.x - 46 + 30, SIGN.y + 14); c.fill(); c.restore();
    if (snow) { // plowed banks
      for (let x = xs - 10; x < xe + 20; x += 20) {
        const k = H.hash('sn' + Math.round(x / 20)); const s1 = 7 + k * 6;
        c.fillStyle = 'rgba(110,140,185,.4)'; c.beginPath(); c.ellipse(x + 3, y0 - 1, 14, s1 * .6, 0, 0, TAU); c.fill();
        c.fillStyle = '#f6fafd'; c.beginPath(); c.ellipse(x, y0 - 3, 13, s1 * .55, 0, 0, TAU); c.fill();
        c.fillStyle = 'rgba(110,140,185,.4)'; c.beginPath(); c.ellipse(x + 3, y0 + h + 6, 14, s1 * .5, 0, 0, TAU); c.fill();
        c.fillStyle = '#f6fafd'; c.beginPath(); c.ellipse(x, y0 + h + 3, 13, s1 * .5, 0, 0, TAU); c.fill();
      }
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(0, y0 + 8, WT, 12); c.fillRect(0, y0 + h - 18, WT, 12);
    }
  };

  // ------------------------------------------------------------------ POND
  function pondGeo(H) { const T = H.T; return { cx: H.POND.cx * T, cy: H.POND.cy * T, rx: H.POND.rx * T, ry: H.POND.ry * T }; }
  A.terrain.pond = (c, P_, H) => {
    const { cx, cy, rx, ry } = pondGeo(H), snow = P_.snow, r = H.mulberry(48);
    const ell = (x, y, a, b) => { c.beginPath(); c.ellipse(x, y, a, b, 0, 0, TAU); };
    // damp grass halo + cast shadow of the bank
    blob(c, cx + 3, cy + 6, rx + 26, ry + 22, [[.55, snow ? 'rgba(150,175,205,.35)' : 'rgba(20,50,10,.28)'], [1, 'rgba(20,50,10,0)']]);
    // bank: sandy mud rim, lit to the north-west, darker to the south-east
    let g = c.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
    g.addColorStop(0, snow ? '#ffffff' : '#d8c68c'); g.addColorStop(1, snow ? '#c3d6e6' : '#8f7a48');
    ell(cx, cy + 3, rx + 11, ry + 10); c.fillStyle = g; c.fill();
    c.strokeStyle = snow ? 'rgba(255,255,255,.9)' : 'rgba(255,250,210,.55)'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(cx, cy + 3, rx + 10.5, ry + 9.5, 0, Math.PI * .95, Math.PI * 1.7); c.stroke();
    c.strokeStyle = snow ? 'rgba(110,140,185,.4)' : 'rgba(50,30,0,.35)'; c.lineWidth = 2; c.beginPath(); c.ellipse(cx, cy + 3, rx + 10.5, ry + 9.5, 0, -.2, Math.PI * .8); c.stroke();
    // pebbles on the bank
    for (let i = 0; i < 70; i++) {
      const a = r() * TAU, k = r(), rr = 1 + r() * 1.6, px = cx + Math.cos(a) * (rx + 3 + k * 6), py = cy + 3 + Math.sin(a) * (ry + 3 + k * 5);
      c.fillStyle = 'rgba(40,25,5,.35)'; c.beginPath(); c.ellipse(px + 1, py + 1, rr * 1.4, rr, 0, 0, TAU); c.fill();
      c.fillStyle = snow ? '#e6eef5' : (i % 3 ? '#b9ab8a' : '#8c8068'); c.beginPath(); c.ellipse(px, py, rr * 1.4, rr * .95, 0, 0, TAU); c.fill();
    }
    // water, sunk below the bank
    ell(cx, cy, rx, ry); c.save(); c.clip();
    g = c.createLinearGradient(0, cy - ry, 0, cy + ry);
    if (snow) { g.addColorStop(0, '#f3fafe'); g.addColorStop(.5, '#d6ebf6'); g.addColorStop(1, '#b9d8ea'); } else { g.addColorStop(0, P_.pond2); g.addColorStop(.55, P_.pond); g.addColorStop(1, dk(hex(P_.pond), .22)); }
    c.fillStyle = g; c.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
    blob(c, cx + rx * .12, cy + ry * .2, rx * .75, ry * .7, [[0, snow ? 'rgba(120,170,205,.3)' : 'rgba(10,50,100,.32)'], [1, 'rgba(10,50,100,0)']]); // deep centre
    // inner north bank wall (faces the camera) + the bank's shadow on the water
    c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, TAU); c.ellipse(cx + 3, cy + 14, rx - 1, ry - 1, 0, 0, TAU);
    const wg = c.createLinearGradient(0, cy - ry, 0, cy - ry + 20); wg.addColorStop(0, snow ? '#9fb8cc' : '#6e5a30'); wg.addColorStop(1, snow ? '#c6d9e8' : '#8d7840');
    c.fillStyle = wg; c.fill('evenodd');
    c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, TAU); c.ellipse(cx + 6, cy + 25, rx - 4, ry - 2, 0, 0, TAU);
    c.fillStyle = snow ? 'rgba(70,105,150,.2)' : 'rgba(0,30,60,.24)'; c.fill('evenodd');
    // lit shallow ring on the south edge
    c.strokeStyle = snow ? 'rgba(255,255,255,.85)' : hex(P_.pond2) + 'cc'; c.lineWidth = 5; c.beginPath(); c.ellipse(cx, cy, rx - 2.5, ry - 2.5, 0, .25, Math.PI - .25); c.stroke();
    if (snow) { // ice: cracks, glint streaks, frosty patches
      c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 6; c.lineCap = 'round'; [[-60, -18, 20], [-20, 6, 34], [38, -12, 24]].forEach(q => { c.beginPath(); c.moveTo(cx + q[0], cy + q[1]); c.lineTo(cx + q[0] + q[2], cy + q[1] - q[2] * .35); c.stroke(); });
      c.strokeStyle = 'rgba(95,140,175,.75)'; c.lineWidth = 1.2; c.beginPath();
      c.moveTo(cx - 52, cy - 8); c.lineTo(cx - 22, cy + 8); c.lineTo(cx + 6, cy - 2); c.lineTo(cx + 34, cy + 14); c.lineTo(cx + 70, cy + 4); c.moveTo(cx - 22, cy + 8); c.lineTo(cx - 14, cy + 30); c.moveTo(cx + 6, cy - 2); c.lineTo(cx + 18, cy - 24); c.moveTo(cx + 34, cy + 14); c.lineTo(cx + 40, cy + 34); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = .8; c.beginPath(); c.moveTo(cx - 51, cy - 9.5); c.lineTo(cx - 21, cy + 6.5); c.lineTo(cx + 7, cy - 3.5); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 40; i++) { c.beginPath(); c.arc(cx + (r() - .5) * rx * 1.7, cy + (r() - .5) * ry * 1.6, .9, 0, TAU); c.fill(); }
      blob(c, cx - rx * .35, cy - ry * .2, 40, 14, [[0, 'rgba(255,255,255,.65)'], [1, 'rgba(255,255,255,0)']], -.25);
    } else {
      // sky reflection streaks + sparkling ripple rings
      c.strokeStyle = 'rgba(255,255,255,.32)'; c.lineWidth = 3; c.lineCap = 'round'; [[-52, -14, 36], [-6, 14, 44], [44, -4, 28]].forEach(q => { c.beginPath(); c.moveTo(cx + q[0], cy + q[1]); c.lineTo(cx + q[0] + q[2], cy + q[1] - 2); c.stroke(); });
      c.strokeStyle = 'rgba(255,255,255,.65)'; c.lineWidth = 1.3;
      for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(cx - 34 + i * 15, cy - 10 + (i % 3) * 14, 15, 4, 0, Math.PI * .1, Math.PI * .9); c.stroke(); }
      c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1; [8, 14, 21].forEach((rr, i) => { c.beginPath(); c.ellipse(cx + 34, cy + 8, rr * 1.5, rr * .55, 0, 0, TAU); c.stroke(); });
      blob(c, cx - rx * .4, cy - ry * .3, 28, 9, [[0, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']], -.22);
      c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.ellipse(cx - rx * .42, cy - ry * .3, 6, 1.8, -.22, 0, TAU); c.fill();
    }
    c.restore();
    // crisp lip around the water
    c.strokeStyle = snow ? 'rgba(90,125,165,.65)' : 'rgba(55,40,10,.55)'; c.lineWidth = 1.4; ell(cx, cy, rx, ry); c.stroke();
    if (!snow) { // lily pads (notched discs with a lit edge) and blossoms
      [[-58, 12, 1], [-34, 28, .8], [34, -14, 1.05], [52, 16, .85], [4, 22, 1], [-8, -22, .75]].forEach((p, i) => {
        const x = cx + p[0], y = cy + p[1], s = p[2], rot = i * 1.3;
        c.fillStyle = 'rgba(0,40,70,.28)'; c.beginPath(); c.ellipse(x + 1.5, y + 2.5, 10 * s, 5 * s, 0, 0, TAU); c.fill();
        c.fillStyle = '#3f8a35'; c.beginPath(); c.moveTo(x, y); c.ellipse(x, y, 10 * s, 5 * s, 0, rot + .25, rot + TAU - .25); c.closePath(); c.fill();
        c.fillStyle = '#62b04a'; c.beginPath(); c.ellipse(x - 1.5 * s, y - 1 * s, 7 * s, 3 * s, 0, 0, TAU); c.fill();
        c.strokeStyle = '#2f6a28'; c.lineWidth = .8; c.beginPath(); c.ellipse(x, y, 10 * s, 5 * s, 0, 0, TAU); c.stroke();
        if (i % 2 === 0) { c.save(); c.translate(x + 2 * s, y - 1 * s); c.scale(1, .85); for (let q = 0; q < 6; q++) { c.fillStyle = q % 2 ? '#ff9ec7' : '#ffc0dc'; c.beginPath(); c.ellipse(Math.cos(q * 1.05) * 2.6 * s, Math.sin(q * 1.05) * 1.7 * s - 1, 2.4 * s, 1.5 * s, q * 1.05, 0, TAU); c.fill(); } c.fillStyle = '#ffe36a'; c.beginPath(); c.arc(0, -1, 1.4 * s, 0, TAU); c.fill(); c.restore(); }
      });
    }
    if (snow) { // snow banks on the rim
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + .1, px = cx + Math.cos(a) * (rx + 9), py = cy + 3 + Math.sin(a) * (ry + 8); c.fillStyle = 'rgba(100,135,180,.3)'; c.beginPath(); c.ellipse(px + 2, py + 2.5, 11, 4.5, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(px, py, 10, 4.2, 0, 0, TAU); c.fill(); }
    }
    // reed shadows
    reedSpots(H).forEach(p => { c.fillStyle = SOFT + '.16)'; c.beginPath(); c.ellipse(p.x + 10, p.y + 4, 14, 3.8, .35, 0, TAU); c.fill(); });
  };

  // reed clusters around the south/east/west bank (leave the far north side open)
  function reedSpots(H) {
    const { cx, cy, rx, ry } = pondGeo(H), r = H.mulberry(61), out = [];
    for (let i = 0; i < 15; i++) {
      const a = i / 15 * TAU + r() * .2 - .1, s = Math.sin(a); if (s < -.55) { r(); r(); continue; }
      const k = rx + 7 + r() * 7, m = ry + 6 + r() * 6;
      out.push({ x: cx + Math.cos(a) * k, y: cy + 3 + Math.sin(a) * m, seed: 700 + i, n: 5 + Math.floor(r() * 5), cat: r() < .6 });
    }
    return out;
  }
  function reedCluster(c, P_, spot) {
    const r = H_().mulberry(spot.seed), snow = P_.snow, sea = season();
    const stalk = snow ? '#b09c5c' : sea === 'fall' ? '#a49a45' : '#4f8f3a', stalkHi = snow ? '#d8c888' : sea === 'fall' ? '#c9bd62' : '#79b855';
    for (let i = 0; i < spot.n; i++) {
      const bx = spot.x + (r() - .5) * 20, by = spot.y + (r() - .5) * 5, hgt = 24 + r() * 20, lean = (r() - .5) * 12;
      const tx = bx + lean, ty = by - hgt, mx = bx + lean * .3, my = by - hgt * .55;
      const g = c.createLinearGradient(bx, by, tx, ty); g.addColorStop(0, dk(hex(stalk), .3)); g.addColorStop(1, stalkHi);
      c.strokeStyle = g; c.lineWidth = 1.9; c.lineCap = 'round'; c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(mx, my, tx, ty); c.stroke();
      if (spot.cat && i % 2 === 0) { // cattail head
        const hy = ty + 3, ang = Math.atan2(ty - my, tx - mx);
        c.save(); c.translate(tx - lean * .08, hy + 6); c.rotate(ang + Math.PI / 2 - .05);
        const cg = c.createLinearGradient(-2.2, 0, 2.2, 0); cg.addColorStop(0, '#9a6a3a'); cg.addColorStop(.4, '#74492a'); cg.addColorStop(1, '#3d2412');
        c.fillStyle = cg; rrP(c, -2.2, -7, 4.4, 12, 2.2); c.fill(); c.fillStyle = 'rgba(255,230,180,.35)'; c.fillRect(-1.6, -6, 1, 9);
        c.strokeStyle = '#d8c070'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -7); c.lineTo(0, -11); c.stroke();
        if (snow) { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(0, -7, 3.2, 1.8, 0, 0, TAU); c.fill(); }
        c.restore();
      } else {
        c.strokeStyle = stalkHi; c.lineWidth = 1.1; c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + lean * .35 + 1.5, ty - 6); c.stroke();
        if (snow) { c.fillStyle = '#fff'; c.beginPath(); c.arc(tx + 1, ty - 1, 1.6, 0, TAU); c.fill(); }
      }
    }
    // broad blades at the foot
    c.strokeStyle = stalk; c.lineWidth = 2.2; c.beginPath();
    for (let i = 0; i < 4; i++) { const bx = spot.x + (i - 1.5) * 6, k = r(); c.moveTo(bx, spot.y + 1); c.quadraticCurveTo(bx + (i - 1.5) * 5, spot.y - 10, bx + (i - 1.5) * 9, spot.y - 14 - k * 5); }
    c.stroke();
  }
  function rrP(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  let KIT = null; const H_ = () => KIT || (KIT = G.WorldArtKit);

  // ------------------------------------------------------------------ TREES
  function treeItems(windbreak, H) {
    const T = H.T, W = H.W, ROAD0 = H.ROAD0, r = H.mulberry(77), items = [], dense = windbreak, step = dense ? 0.55 : 1.35;
    for (let x = 0.4; x < W; x += step * (0.8 + r() * 0.4)) { items.push([x * T, (1.0 + r() * 0.5) * T + 10, (dense ? 1.15 : 0.85) + r() * .25, r() < (dense ? .75 : .5) ? 1 : 0]); }
    if (dense) for (let x = 0.8; x < W; x += 0.8) items.push([x * T, 0.55 * T + 6, 1.2, 1]);
    for (let y = 2.4; y < ROAD0 - 0.5; y += step * 1.6) { items.push([(0.6 + r() * 0.7) * T, y * T, 0.85 + r() * .25, r() < .5 ? 1 : 0]); items.push([(38.7 + r() * 0.7) * T, y * T, 0.85 + r() * .25, r() < .5 ? 1 : 0]); }
    items.sort((a, b) => a[1] - b[1]);
    return items.map((t, i) => ({ x: t[0], y: t[1], s: t[2], kind: t[3], seed: 100 + i }));
  }
  function allTrees(ctx, H) {
    const out = treeItems(!!ctx.windbreak, H);
    (ctx.decor || H.DECOR_TREES).forEach((t, i) => out.push({ x: t[0] * H.T, y: t[1] * H.T + 8, s: .95, kind: t[2], seed: 300 + i }));
    return out;
  }
  const LAMPS = [[14.2, 7.2], [28.2, 7.2], [14.2, 21.3], [28.2, 24.2], [10.2, 24.4]];
  const BALES = [[22.2, 7.6], [22.9, 7.5]];

  function branch(c, x, y, ang, len, w, depth, r, snow) {
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len, mx = (x + x2) / 2 + (r() - .5) * len * .25, my = (y + y2) / 2;
    c.strokeStyle = depth > 1 ? '#5b3a1c' : '#6e4521'; c.lineWidth = Math.max(.8, w); c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(mx, my, x2, y2); c.stroke();
    if (snow && depth < 3) { c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = Math.max(.9, w * .55); c.beginPath(); c.moveTo(x, y - w * .45); c.quadraticCurveTo(mx, my - w * .45, x2, y2 - w * .45); c.stroke(); }
    if (depth > 0) { const n = depth > 1 ? 2 : 3; for (let i = 0; i < n; i++) branch(c, x2, y2, ang + (i - (n - 1) / 2) * (.7 + r() * .3), len * (.62 + r() * .12), w * .62, depth - 1, r, snow); }
  }
  function deciduous(c, x, y, s, P_, seed) {
    const r = H_().mulberry(seed), pal = P_.trees, snow = P_.snow, h = 21 * s, tw = 4.4 * s;
    // trunk
    let g = c.createLinearGradient(x - tw, 0, x + tw, 0); g.addColorStop(0, '#94622f'); g.addColorStop(.45, '#6e4521'); g.addColorStop(1, '#3f2410');
    c.fillStyle = g; c.beginPath(); c.moveTo(x - tw * 1.5, y + 1); c.quadraticCurveTo(x - tw * .8, y - 3 * s, x - tw * .6, y - h); c.lineTo(x + tw * .6, y - h); c.quadraticCurveTo(x + tw * .8, y - 3 * s, x + tw * 1.5, y + 1); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(30,15,5,.35)'; c.lineWidth = .9; c.beginPath(); c.moveTo(x + tw * .1, y); c.lineTo(x + tw * .0, y - h * .7); c.moveTo(x + tw * .5, y - 2); c.lineTo(x + tw * .35, y - h * .5); c.stroke();
    if (snow) { // bare branches with snow on top
      const ty = y - h + 2 * s; branch(c, x, ty + 4 * s, -Math.PI / 2 - .05, 26 * s, 3.2 * s, 3, r, true);
      branch(c, x, ty + 6 * s, -Math.PI / 2 - .9, 22 * s, 2.8 * s, 3, r, true); branch(c, x, ty + 5 * s, -Math.PI / 2 + .85, 22 * s, 2.8 * s, 3, r, true);
      c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, y - h - 1, tw * .9, 1.8 * s, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(120,150,190,.5)'; c.beginPath(); c.ellipse(x + tw * .5, y - h * .6, tw * .3, h * .35, 0, 0, TAU); c.fill();
      return;
    }
    // hollow shade of the canopy on the trunk
    c.fillStyle = 'rgba(10,25,5,.45)'; c.beginPath(); c.ellipse(x + 1, y - h + 1, 10 * s, 4 * s, 0, 0, TAU); c.fill();
    // layered canopy: dark lower balls first, lit crown last
    const L = [[-14, -30, 13.5, 0], [14, -29, 13.5, 0], [0, -27, 15, 0], [-16, -41, 13, 1], [16, -41, 13, 1], [0, -39, 15.5, 1], [-8, -52, 13, 2], [8, -51, 12.5, 2], [0, -58, 11.5, 2]];
    const cols = [pal[0], pal[1], pal[2]], balls = [];
    L.forEach(b => balls.push([x + (b[0] + (r() - .5) * 3) * s, y - 0 + (b[1] + (r() - .5) * 3) * s, b[2] * s * (.95 + r() * .1), b[3]]));
    balls.forEach(b => { ball(c, b[0], b[1], b[2], cols[b[3]], true); });
    // leaf clumps: lit speckles upper-left, shade crescents lower-right
    balls.forEach((b, i) => {
      c.fillStyle = 'rgba(255,255,190,.2)'; for (let k = 0; k < 4; k++) { const a = Math.PI * (1.05 + r() * .55), d = b[2] * (.35 + r() * .45); c.beginPath(); c.arc(b[0] + Math.cos(a) * d, b[1] + Math.sin(a) * d, 1.7 * s + r() * 1.3 * s, 0, TAU); c.fill(); }
      c.fillStyle = 'rgba(10,40,10,.2)'; for (let k = 0; k < 3; k++) { const a = Math.PI * (-.1 + r() * .6), d = b[2] * (.4 + r() * .4); c.beginPath(); c.arc(b[0] + Math.cos(a) * d, b[1] + Math.sin(a) * d, 1.6 * s + r() * 1.2 * s, 0, TAU); c.fill(); }
    });
    if (P_.flower) { // spring blossoms
      for (let k = 0; k < 22; k++) { const b = balls[Math.floor(r() * balls.length)], a = r() * TAU, d = b[2] * Math.sqrt(r()) * .95; c.fillStyle = k % 3 ? '#ffd3e6' : '#ffffff'; c.beginPath(); c.arc(b[0] + Math.cos(a) * d, b[1] + Math.sin(a) * d, 1.8 * s, 0, TAU); c.fill(); c.fillStyle = 'rgba(210,100,150,.5)'; c.beginPath(); c.arc(b[0] + Math.cos(a) * d + .6, b[1] + Math.sin(a) * d + .8, .8 * s, 0, TAU); c.fill(); }
    }
  }
  function conifer(c, x, y, s, P_, seed) {
    const snow = P_.snow, base = mix(hex(P_.trees[0]), '#10301a', .38), n = 4;
    // trunk stub
    let g = c.createLinearGradient(x - 3 * s, 0, x + 3 * s, 0); g.addColorStop(0, '#8a5a2e'); g.addColorStop(1, '#3f2410'); c.fillStyle = g; c.fillRect(x - 2.8 * s, y - 10 * s, 5.6 * s, 11 * s);
    const tiers = [];
    for (let i = 0; i < n; i++) tiers.push({ by: y - 7 * s - i * 14 * s, w: (22 - i * 4.4) * s, hgt: 25 * s });
    tiers.forEach((t, i) => {
      const tone = mix(base, i % 2 ? '#2f7a3c' : '#1a5a2c', .18 * i / (n - 1) + (hex(P_.trees[1]) ? .1 : 0));
      const shape = () => { c.beginPath(); c.moveTo(x, t.by - t.hgt); c.quadraticCurveTo(x - t.w * .55, t.by - t.hgt * .45, x - t.w, t.by); c.quadraticCurveTo(x - t.w * .5, t.by + 5 * s, x, t.by + 2.5 * s); c.quadraticCurveTo(x + t.w * .5, t.by + 5 * s, x + t.w, t.by); c.quadraticCurveTo(x + t.w * .55, t.by - t.hgt * .45, x, t.by - t.hgt); c.closePath(); };
      // cast shade on the lower tier from this one
      if (i > 0) { const q = tiers[i - 1]; c.save(); c.beginPath(); c.moveTo(x, q.by - q.hgt); c.quadraticCurveTo(x - q.w * .55, q.by - q.hgt * .45, x - q.w, q.by); c.lineTo(x + q.w, q.by); c.quadraticCurveTo(x + q.w * .55, q.by - q.hgt * .45, x, q.by - q.hgt); c.clip(); c.fillStyle = 'rgba(0,15,0,.4)'; c.beginPath(); c.ellipse(x + 3 * s, t.by + 1 * s, t.w * 1.05, 6 * s, 0, 0, TAU); c.fill(); c.restore(); }
      const gr = c.createLinearGradient(x - t.w, 0, x + t.w, 0); gr.addColorStop(0, lit(tone, .38)); gr.addColorStop(.42, tone); gr.addColorStop(1, dk(tone, .5));
      shape(); c.fillStyle = gr; c.fill(); c.strokeStyle = 'rgba(5,25,10,.4)'; c.lineWidth = 1; c.stroke();
      // needle texture: scalloped lit edges on the left, dark flicks on the right
      c.strokeStyle = 'rgba(255,255,190,.22)'; c.lineWidth = 1.1; c.beginPath(); for (let k = 0; k < 4; k++) { const yy = t.by - t.hgt * (.18 + k * .2); c.moveTo(x - t.w * (.15 + k * .1), yy + 2 * s); c.lineTo(x - t.w * (.3 + k * .1), yy + 6 * s); } c.stroke();
      c.strokeStyle = 'rgba(0,20,5,.3)'; c.beginPath(); for (let k = 0; k < 4; k++) { const yy = t.by - t.hgt * (.18 + k * .2); c.moveTo(x + t.w * (.1 + k * .08), yy + 2 * s); c.lineTo(x + t.w * (.28 + k * .1), yy + 6 * s); } c.stroke();
      if (snow) {
        c.beginPath(); c.moveTo(x, t.by - t.hgt); c.quadraticCurveTo(x - t.w * .42, t.by - t.hgt * .62, x - t.w * .74, t.by - t.hgt * .22); c.quadraticCurveTo(x - t.w * .5, t.by - t.hgt * .34, x - t.w * .3, t.by - t.hgt * .28); c.quadraticCurveTo(x - t.w * .1, t.by - t.hgt * .2, x, t.by - t.hgt * .3); c.quadraticCurveTo(x + t.w * .2, t.by - t.hgt * .2, x + t.w * .38, t.by - t.hgt * .3); c.quadraticCurveTo(x + t.w * .55, t.by - t.hgt * .4, x + t.w * .72, t.by - t.hgt * .22); c.quadraticCurveTo(x + t.w * .42, t.by - t.hgt * .62, x, t.by - t.hgt); c.closePath();
        const sg = c.createLinearGradient(x - t.w, 0, x + t.w, 0); sg.addColorStop(0, '#ffffff'); sg.addColorStop(.6, '#f2f8fd'); sg.addColorStop(1, '#bcd0e4'); c.fillStyle = sg; c.fill();
      }
    });
    if (!snow) { c.fillStyle = 'rgba(255,255,200,.3)'; const t = tiers[n - 1]; c.beginPath(); c.arc(x - 1.5 * s, t.by - t.hgt + 5 * s, 1.8 * s, 0, TAU); c.fill(); }
  }
  function treeBody(c, t, P_, H) {
    H.bbAt(c, t.x, t.y, () => { if (t.kind === 1) conifer(c, t.x, t.y, t.s, P_, t.seed); else deciduous(c, t.x, t.y, t.s, P_, t.seed); });
  }
  function treeShadow(c, t, P_, H) {
    const s = t.s, snow = P_.snow;
    c.save(); c.translate(t.x, t.y); c.rotate(.5);
    const rx = (t.kind === 1 ? 36 : 30) * s, ry = (t.kind === 1 ? 7 : 12) * s, ox = (t.kind === 1 ? 21 : 15) * s;
    const g = c.createRadialGradient(ox, 0, 0, ox, 0, rx); g.addColorStop(0, snow ? 'rgba(60,85,140,.34)' : SOFT + '.3)'); g.addColorStop(.7, snow ? 'rgba(60,85,140,.2)' : SOFT + '.2)'); g.addColorStop(1, snow ? 'rgba(60,85,140,0)' : SOFT + '0)');
    c.scale(1, ry / rx); c.fillStyle = g; c.beginPath(); c.arc(ox, 0, rx, 0, TAU); c.fill(); c.restore();
    blob(c, t.x + 1, t.y + 1, 11 * s, 4.5 * s, [[0, SOFT + '.4)'], [1, SOFT + '0)']]);
    if (!snow && !P_.flower && season() === 'fall') { const r = H.mulberry(t.seed + 9); c.fillStyle = '#d0652a'; for (let i = 0; i < 7; i++) { c.beginPath(); c.ellipse(t.x + (r() - .5) * 40 * s, t.y + 2 + r() * 8, 1.8, 1, r() * 3, 0, TAU); c.fill(); } }
  }

  function lampBody(c, x, y) {
    const H = H_(); H.bbAt(c, x, y, () => {
      c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x, y, 7, 2.6, 0, 0, TAU); c.fill();
      let g = c.createLinearGradient(x - 5, 0, x + 5, 0); g.addColorStop(0, '#6a6a72'); g.addColorStop(1, '#2a2a30'); c.fillStyle = g; c.beginPath(); c.moveTo(x - 4.5, y); c.lineTo(x - 3.4, y - 6); c.lineTo(x + 3.4, y - 6); c.lineTo(x + 4.5, y); c.closePath(); c.fill();
      g = c.createLinearGradient(x - 2, 0, x + 2, 0); g.addColorStop(0, '#7c7c86'); g.addColorStop(.5, '#4a4a52'); g.addColorStop(1, '#25252b'); c.fillStyle = g; c.fillRect(x - 1.8, y - 36, 3.6, 31);
      c.fillStyle = '#34343a'; c.fillRect(x - 3, y - 36, 6, 3);
      // lantern: lit glass, dark cap
      c.fillStyle = '#34343a'; c.fillRect(x - 6.5, y - 37, 13, 2.4);
      g = c.createLinearGradient(x - 5.5, y - 47, x + 5.5, y - 36); g.addColorStop(0, '#fff6c8'); g.addColorStop(1, '#f5c860'); c.fillStyle = g; rrP(c, x - 5.5, y - 47, 11, 10.5, 2.5); c.fill();
      c.strokeStyle = '#34343a'; c.lineWidth = 1.5; c.stroke(); c.beginPath(); c.moveTo(x, y - 47); c.lineTo(x, y - 36.5); c.stroke();
      c.fillStyle = '#3b3b42'; c.beginPath(); c.moveTo(x - 8, y - 47); c.lineTo(x, y - 54); c.lineTo(x + 8, y - 47); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.moveTo(x - 8, y - 47); c.lineTo(x, y - 54); c.lineTo(x - 1, y - 47); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(x - 4, y - 46, 2, 7);
      if (H.S && 0) { }
      if (curSnow) { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, y - 53.5, 5, 1.8, 0, 0, TAU); c.fill(); }
    });
  }
  let curSnow = 0;
  function baleBody(c, x, y, i, P_) {
    const H = H_(), snow = P_.snow, r = H.mulberry(900 + i), w = 24, d = 15, hh = 14, bx = x - w / 2, by = y - d;
    H.box(c, bx, by, w, d, hh, { top: '#f0d985', front: '#cfa43c', stroke: 'rgba(110,75,10,.55)', lw: 1 });
    // front face straw lines + strap bands
    H.bbAt(c, x, y, () => {
      const top = y - hh * H.HZ;
      c.strokeStyle = 'rgba(120,80,10,.35)'; c.lineWidth = .8; c.beginPath(); for (let k = 0; k < 6; k++) { const yy = top + 2 + k * 2.2, xx = bx + 2 + r() * 8; c.moveTo(xx, yy); c.lineTo(xx + 6 + r() * 10, yy); } c.stroke();
      c.fillStyle = 'rgba(255,240,170,.4)'; c.fillRect(bx + 1, top + 1, w - 2, 1.5);
      c.fillStyle = 'rgba(70,40,5,.4)'; c.fillRect(bx + 7, top, 1.4, hh * H.HZ); c.fillRect(bx + 16, top, 1.4, hh * H.HZ);
      c.fillStyle = 'rgba(60,30,0,.22)'; c.fillRect(bx, y - 3.5, w, 3.5);
    });
    // straw tuft lines on top
    const tp = H.P3(bx, by, hh); c.strokeStyle = 'rgba(150,100,20,.4)'; c.lineWidth = .8; c.beginPath(); for (let k = 0; k < 5; k++) { c.moveTo(tp[0] + 3 + k * 4, tp[1] + 2); c.lineTo(tp[0] + 6 + k * 4, tp[1] + d - 2); } c.stroke();
    c.fillStyle = 'rgba(70,40,5,.35)'; c.fillRect(tp[0] + 7, tp[1], 1.3, d); c.fillRect(tp[0] + 16, tp[1], 1.3, d);
    if (snow) { H.poly(c, [[bx - 1, by - 1, hh + 1.4], [bx + w + 1, by - 1, hh + 1.4], [bx + w + 1, by + d + 1, hh + 1.4], [bx - 1, by + d + 1, hh + 1.4]], '#fff'); }
  }
  A.structures.trees = {
    ground(c, ctx, H) {
      const v = view(c, 60), P_ = ctx.P_, T = H.T;
      allTrees(ctx, H).forEach(t => { if (inV(v, t.x, t.y, 50 * t.s)) treeShadow(c, t, P_, H); });
      LAMPS.forEach(p => { const x = p[0] * T, y = p[1] * T; if (!inV(v, x, y, 40)) return; H.castShadow(c, x - 1.6, y - 1.6, 3.2, 3.2, 52, P_.snow ? .15 : .22); });
      BALES.forEach((p, i) => { const x = p[0] * T, y = p[1] * T; if (!inV(v, x, y, 30)) return; H.castShadow(c, x - 12, y - 15, 24, 15, 14, P_.snow ? .15 : .24); });
    },
    props(ctx, H) {
      const P_ = ctx.P_, out = []; curSnow = P_.snow;
      allTrees(ctx, H).forEach(t => {
        const s = t.s;
        out.push({ sortY: t.y / H.T, x0: t.x - 36 * s, x1: t.x + 36 * s, y0: t.y - 100 * s, y1: t.y + 6, hit: { x0: t.x - 16 * s, x1: t.x + 16 * s, y0: t.y - 70 * s, y1: t.y }, body: c => treeBody(c, t, P_, H) });
      });
      LAMPS.forEach(p => {
        const x = p[0] * H.T, y = p[1] * H.T; H.light(x, y, 54, 66, 'rgba(255,215,130,.55)');
        out.push({ sortY: y / H.T, x0: x - 12, x1: x + 12, y0: y - 75, y1: y + 5, body: c => lampBody(c, x, y) });
      });
      BALES.forEach((p, i) => {
        const x = p[0] * H.T, y = p[1] * H.T;
        out.push({ sortY: y / H.T, x0: x - 16, x1: x + 16, y0: y - 15 - H.lift(16), y1: y + 4, body: c => baleBody(c, x, y, i, P_) });
      });
      return out;
    }
  };

  // ------------------------------------------------------------------ FENCE (3D posts + rails)
  function fenceChunk(c, f, P_, H, a, b, first, last) {
    const snow = P_.snow, vert = f.x1 === f.x2, len = vert ? (b - a) : (b - a), n = Math.max(1, Math.round(len / 20)), cap = snow ? '#fff' : '#c89256';
    const post = (x, y, tall) => {
      c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(x, y + 1.5, 5, 2, 0, 0, TAU); c.fill();
      H.box(c, x - 2.6, y - 2.6, 5.2, 5.2, tall ? 23 : 17, { top: snow ? '#fff' : (tall ? '#e8c070' : '#c89256'), front: tall ? '#6d4220' : '#7a4c24' });
      const t = H.P3(x, y + 2.6, tall ? 23 : 17); // lit west edge of the front face
      c.fillStyle = 'rgba(255,220,160,.35)'; c.fillRect(t[0] - 2.6, t[1], 1.4, H.lift(tall ? 23 : 17));
    };
    if (vert) {
      const x = f.x1;
      [5, 11.5].forEach((z, k) => { // rails seen from the south: a lit-west / dark-east strip, snow on the top rail
        const p0 = H.P3(x, a, z), p1 = H.P3(x, b, z);
        c.fillStyle = '#b57e43'; c.fillRect(x - 1.7, p0[1], 1.7, p1[1] - p0[1]); c.fillStyle = '#6d4220'; c.fillRect(x, p0[1], 1.7, p1[1] - p0[1]);
        if (snow && k) { c.fillStyle = '#fff'; c.fillRect(x - 2, p0[1] - 1, 4, p1[1] - p0[1] + 1); }
      });
      for (let i = first ? 0 : 1; i <= n - (last ? 0 : 1) + (last ? 0 : 0); i++) { const y = a + (b - a) * i / n; if (!last && i === n) continue; post(x, y, (f.gateEnd === 'b' && last && i === n) || (f.gateEnd === 't' && first && i === 0)); }
      if (!last) post(x, b, false);
    } else {
      const y = f.y1;
      for (let i = first ? 0 : 1; i <= n; i++) post(a + (b - a) * i / n, y, false);
      [5, 11.5].forEach((z, k) => H.box(c, a, y - 1.2, b - a, 2.4, 2.8, { z0: z, top: snow ? '#fff' : (k ? '#c89256' : '#bd8749'), front: '#7a4c24' }));
    }
  }
  function fenceProps(H, P_) {
    const out = [], T = H.T;
    fenceLines(H).forEach((f, fi) => {
      const vert = f.x1 === f.x2, A0 = vert ? f.y1 : f.x1, B0 = vert ? f.y2 : f.x2, L = B0 - A0, nch = Math.max(1, Math.round(L / 160));
      for (let k = 0; k < nch; k++) {
        const a = A0 + L * k / nch, b = A0 + L * (k + 1) / nch, first = k === 0, last = k === nch - 1;
        const x0 = vert ? f.x1 - 10 : a - 8, x1 = vert ? f.x1 + 10 : b + 8, yb = vert ? b : f.y1, ya = vert ? a : f.y1;
        out.push({ sortY: yb / T, x0, x1, y0: ya - H.lift(26) - 4, y1: yb + 6, body: c => fenceChunk(c, f, P_, H, a, b, first, last) });
      }
    });
    return out;
  }

  // ------------------------------------------------------------------ road sign, rocks, bushes
  function signBody(c, P_, H) {
    const x = SIGN.x, y = SIGN.y, snow = P_.snow;
    [-22, 21].forEach(o => {
      H.box(c, x + o - 1.8, y - 1.8, 3.6, 3.6, 40, { top: snow ? '#fff' : '#b88a55', front: '#6d4220' });
    });
    H.bbAt(c, x, y, () => {
      c.fillStyle = 'rgba(0,0,0,.25)'; [-22, 21].forEach(o => { c.beginPath(); c.ellipse(x + o, y + 1, 5, 2, 0, 0, TAU); c.fill(); });
      const w = 96, h = 24, bx = x - w / 2, by = y - 41 * H.HZ - h + 8;
      c.fillStyle = 'rgba(0,0,0,.3)'; rrP(c, bx + 2, by + 3, w, h, 4); c.fill();
      const g = c.createLinearGradient(0, by, 0, by + h); g.addColorStop(0, '#3f9a63'); g.addColorStop(1, '#236a42'); c.fillStyle = g; rrP(c, bx, by, w, h, 4); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 1.8; rrP(c, bx + 2, by + 2, w - 4, h - 4, 3); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(bx + 3, by + 3, w - 6, 3);
      c.fillStyle = '#d6d9d6'; [bx + 6, bx + w - 6].forEach(px => { c.beginPath(); c.arc(px, by + h / 2, 1.1, 0, TAU); c.fill(); });
      c.fillStyle = '#fff'; c.font = '800 9.5px system-ui,-apple-system,"Segoe UI",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('COUNTY RD 9', x, by + h / 2 + .5);
      if (snow) { c.fillStyle = '#fff'; rrP(c, bx - 1, by - 3, w + 2, 4.5, 2); c.fill(); }
    });
  }
  function rockBody(c, x, y, s, seed, P_, H) {
    H.bbAt(c, x, y, () => {
      const r = H.mulberry(seed); c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x + 3 * s, y + 1, 13 * s, 4 * s, .2, 0, TAU); c.fill();
      const pts = [[-11, 0], [-12, -6], [-7, -12], [2, -14], [9, -10], [12, -3], [10, 0]].map(p => [x + (p[0] + (r() - .5) * 2) * s, y + (p[1] + (r() - .5) * 2) * s]);
      const g = c.createLinearGradient(x - 12 * s, y - 14 * s, x + 12 * s, y); g.addColorStop(0, '#d2cfc4'); g.addColorStop(.5, '#a29e92'); g.addColorStop(1, '#5e5b52');
      c.fillStyle = g; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill(); c.strokeStyle = 'rgba(30,28,20,.5)'; c.lineWidth = 1; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(pts[1][0] + 1, pts[1][1]); c.lineTo(pts[2][0], pts[2][1] + 1); c.lineTo(pts[3][0] - 2, pts[3][1] + 1); c.lineTo(x - 2 * s, y - 8 * s); c.closePath(); c.fill();
      if (P_.snow) { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(pts[1][0], pts[1][1] + 1); c.lineTo(pts[2][0], pts[2][1]); c.lineTo(pts[3][0], pts[3][1]); c.lineTo(pts[4][0], pts[4][1]); c.lineTo(pts[5][0] - 2, pts[5][1] + 1); c.quadraticCurveTo(x, y - 8 * s, pts[1][0], pts[1][1] + 1); c.fill(); }
    });
  }
  function bushBody(c, x, y, s, seed, P_, H) {
    H.bbAt(c, x, y, () => {
      const r = H.mulberry(seed); c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x + 3 * s, y + 1, 17 * s, 5 * s, .15, 0, TAU); c.fill();
      const base = P_.snow ? '#4d7f5c' : P_.trees[1], cols = [P_.trees[0], base, P_.trees[2]];
      [[-9, -6, 8, 0], [9, -6, 8, 0], [0, -7, 9.5, 1], [-5, -13, 7.5, 2], [6, -12, 7, 2]].forEach((b, i) => ball(c, x + b[0] * s, y + b[1] * s, b[2] * s, cols[b[3]], true));
      if (P_.flower) { for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#ffd3e6' : '#fff'; c.beginPath(); c.arc(x + (r() - .5) * 22 * s, y - 6 * s - r() * 10 * s, 1.5 * s, 0, TAU); c.fill(); } }
      if (P_.snow) { c.fillStyle = '#fff'; [[-5, -17, 5], [6, -16, 4.5], [0, -13, 5.5]].forEach(b => { c.beginPath(); c.ellipse(x + b[0] * s, y + b[1] * s, b[2] * s, b[2] * s * .45, 0, 0, TAU); c.fill(); }); }
    });
  }
  const ROCKS = [[1.0, 5.2, 1.1, 1], [39.0, 14, 1.2, 2], [38.9, 21, .9, 3], [0.9, 18, 1, 4]];
  const BUSHES = [[1.0, 11.2, 1.1, 11], [38.7, 6.4, 1.0, 12], [1.0, 24.1, 1.1, 13], [38.8, 17.4, 1.2, 14]];

  A.extraProps = H => {
    const P_ = H.PAL[season()] || H.PAL.spring, out = [], T = H.T;
    fenceProps(H, P_).forEach(p => out.push(p));
    out.push({ sortY: SIGN.y / T, x0: SIGN.x - 52, x1: SIGN.x + 52, y0: SIGN.y - H.lift(40) - 38, y1: SIGN.y + 5, hit: { x0: SIGN.x - 50, x1: SIGN.x + 50, y0: SIGN.y - 60, y1: SIGN.y }, body: c => signBody(c, P_, H) });
    reedSpots(H).forEach(sp => out.push({ sortY: sp.y / T, x0: sp.x - 18, x1: sp.x + 18, y0: sp.y - 62, y1: sp.y + 5, body: c => reedCluster(c, P_, sp) }));
    ROCKS.forEach(q => { const x = q[0] * T, y = q[1] * T, s = q[2]; out.push({ sortY: y / T, x0: x - 18 * s, x1: x + 22 * s, y0: y - 24 * s, y1: y + 6, body: c => rockBody(c, x, y, s, q[3] * 13, P_, H) }); });
    BUSHES.forEach(q => { const x = q[0] * T, y = q[1] * T, s = q[2]; out.push({ sortY: y / T, x0: x - 26 * s, x1: x + 28 * s, y0: y - 30 * s, y1: y + 6, body: c => bushBody(c, x, y, s, q[3], P_, H) }); });
    return out;
  };
})();
