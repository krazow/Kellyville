/* Kellyville 3D art: ACTORS (player, tractor, npc, animal, cattle, duck, vehicle).
   All actors are drawn every frame, so complex vector parts are baked once into small offscreen canvases
   (keyed by kind/colour and the quantised device scale) and blitted. Emoji people get a baked outline + rim light. */
(function () {
  'use strict';
  const G = window.G; const A = G.WorldArt = G.WorldArt || {};
  A.structures = A.structures || {}; A.terrain = A.terrain || {}; A.actors = A.actors || {};

  const TAU = Math.PI * 2;
  const EMF = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

  // ------------------------------------------------------------------ cache of baked sprites
  const cache = new Map();
  function devScale() {
    const v = G.World && G.World._v; const s = v ? Math.max(0.5, v.zoom * v.dpr) : 2;
    return Math.pow(2, Math.round(Math.log2(s) * 8) / 8);       // quantised so pinch-zooming does not rebake every frame
  }
  // bake a sprite covering units [x0,x1]x[y0,y1] (origin = ground contact point). fn(g, s) draws in unit coordinates.
  function spr(key, x0, y0, x1, y1, fn) {
    const s = devScale(), k = key + '|' + s.toFixed(3);
    let e = cache.get(k); if (e) return e;
    if (cache.size > 220) cache.clear();
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.ceil((x1 - x0) * s)); cv.height = Math.max(1, Math.ceil((y1 - y0) * s));
    const g = cv.getContext('2d'); g.setTransform(s, 0, 0, s, -x0 * s, -y0 * s); g.lineJoin = 'round'; g.lineCap = 'round';
    fn(g, s);
    e = { cv, x0, y0, w: cv.width / s, h: cv.height / s }; cache.set(k, e); return e;
  }
  function blit(c, e, x, y, flip) {
    if (flip) { c.save(); c.translate(x, y); c.scale(-1, 1); c.drawImage(e.cv, e.x0, e.y0, e.w, e.h); c.restore(); }
    else c.drawImage(e.cv, x + e.x0, y + e.y0, e.w, e.h);
  }

  // ------------------------------------------------------------------ colour helpers
  function parse(h) {
    if (!h || h[0] !== '#') return [200, 120, 60];
    if (h.length === 4) return [parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), parseInt(h[3] + h[3], 16)];
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  const shadeC = (h, f) => { const p = parse(h).map(v => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))); return `rgb(${p[0]},${p[1]},${p[2]})`; };
  function vg(g, y0, y1, a, b) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; }
  function rrp(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  const OUT = 'rgba(30,18,6,.55)';

  // lit block seen from the south-ish: side face (gradient, AO at the bottom) with a lit top strip above it.
  // (x, yTop) = top-left of the SIDE face; w wide, h tall; topH = visible depth of the top face.
  function blk(g, x, yTop, w, h, topH, col, o) {
    o = o || {};
    const r = o.r == null ? 1.6 : o.r;
    rrp(g, x, yTop, w, h, r); g.fillStyle = vg(g, yTop, yTop + h, shadeC(col, .04), shadeC(col, -.3)); g.fill();
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 0.8, yTop + 0.8, 1.6, h - 2);          // west edge catches the sun
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + w - 2.4, yTop + 1, 1.6, h - 2);               // east edge turns away
    if (topH > 0) {
      rrp(g, x, yTop - topH, w, topH + r, r); g.fillStyle = vg(g, yTop - topH, yTop, shadeC(col, .5), shadeC(col, .3)); g.fill();
      g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(x + 1, yTop - topH + 0.8, w - 2, 1.2);
    }
    if (!o.noStroke) {
      g.strokeStyle = OUT; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(x, yTop + h - r); g.lineTo(x, yTop - topH + r); g.quadraticCurveTo(x, yTop - topH, x + r, yTop - topH); g.lineTo(x + w - r, yTop - topH); g.quadraticCurveTo(x + w, yTop - topH, x + w, yTop - topH + r); g.lineTo(x + w, yTop + h - r); g.quadraticCurveTo(x + w, yTop + h, x + w - r, yTop + h); g.lineTo(x + r, yTop + h); g.quadraticCurveTo(x, yTop + h, x, yTop + h - r); g.stroke();
    }
  }
  // tyre seen from the side. Origin = wheel centre.
  function tyre(g, r, o) {
    o = o || {};
    const hub = o.hub || '#e6c04a';
    g.fillStyle = '#1b1b1f'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    // tread lugs
    const n = Math.max(10, Math.round(r * 1.5));
    g.fillStyle = '#34343a';
    for (let i = 0; i < n; i++) { const a = i / n * TAU; g.save(); g.rotate(a); g.fillRect(r - Math.max(1.6, r * .16), -0.9, Math.max(1.6, r * .16), 1.8); g.restore(); }
    g.strokeStyle = '#4a4a52'; g.lineWidth = 0.7; g.beginPath(); g.arc(0, 0, r * .84, 0, TAU); g.stroke();
    // sidewall sheen
    const sg = g.createRadialGradient(-r * .35, -r * .4, 1, 0, 0, r); sg.addColorStop(0, 'rgba(255,255,255,.2)'); sg.addColorStop(.6, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(0,0,0,.25)');
    g.fillStyle = sg; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    // rim + cap
    g.fillStyle = o.rim || shadeC(hub, -.15); g.beginPath(); g.arc(0, 0, r * .6, 0, TAU); g.fill();
    g.fillStyle = hub; g.beginPath(); g.arc(0, 0, r * .46, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(-r * .12, -r * .14, r * .22, 0, TAU); g.fill();
    g.fillStyle = shadeC(hub, -.45);
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; g.beginPath(); g.arc(Math.cos(a) * r * .3, Math.sin(a) * r * .3, Math.max(.7, r * .055), 0, TAU); g.fill(); }
    g.fillStyle = shadeC(hub, -.3); g.beginPath(); g.arc(0, 0, r * .1, 0, TAU); g.fill();
    if (o.dark) { g.fillStyle = 'rgba(10,8,20,' + o.dark + ')'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); }
  }
  const tyreSpr = (r, hub, dark) => spr('ty' + r + hub + (dark || 0), -r - 1, -r - 1, r + 1, r + 1, g => tyre(g, r, { hub, dark }));

  function glassFill(g, x, y, w, h, r) {
    rrp(g, x, y, w, h, r); g.fillStyle = vg(g, y, y + h, '#cfeefb', '#7fb6d2'); g.fill();
  }
  function glint(g, x, y, w, h) { g.save(); g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(x + w * .15, y + h); g.lineTo(x + w * .45, y); g.lineTo(x + w * .65, y); g.lineTo(x + w * .35, y + h); g.closePath(); g.fill(); g.restore(); }

  // ------------------------------------------------------------------ ground shadows
  function contact(c, x, y, rx, ry, a) { c.fillStyle = `rgba(20,10,0,${a})`; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); }
  // cast shadow to the south-east: a skewed ellipse leaning away from the sun. h = object height, w = footprint width.
  function cast(c, x, y, h, w, a) {
    c.save(); c.translate(x + h * 0.2, y + h * 0.15); c.rotate(0.62);
    c.fillStyle = `rgba(25,15,0,${a})`; c.beginPath(); c.ellipse(h * 0.22, 0, h * 0.42, w * 0.34, 0, 0, TAU); c.fill(); c.restore();
  }

  // ------------------------------------------------------------------ emoji people / animals with baked outline + rim light
  function emoSpr(ch, size) {
    const full = size * 1.18, pad = 3, half = full / 2 + pad;
    return spr('em' + ch + '|' + size, -half, -half, half, half, (g, s) => {
      const W = Math.ceil(2 * half * s);
      const mk = () => { const c = document.createElement('canvas'); c.width = c.height = W; return c; };
      const t = mk(), tg = t.getContext('2d'); tg.font = Math.round(full * s * 0.75) + 'px ' + EMF; tg.textAlign = 'center'; tg.textBaseline = 'middle'; tg.fillText(ch, W / 2, W / 2 + full * s * (0.536 - 0.5));
      const sil = mk(), sg = sil.getContext('2d'); sg.drawImage(t, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = 'rgba(40,22,6,.7)'; sg.fillRect(0, 0, W, W);
      g.setTransform(1, 0, 0, 1, 0, 0);
      const d = Math.max(1, 1.15 * s * 0.8);
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.drawImage(sil, Math.cos(a) * d, Math.sin(a) * d); }
      g.drawImage(t, 0, 0);
      // rim light: the top-left edge band of the silhouette
      const rim = mk(), rg = rim.getContext('2d'); rg.drawImage(t, 0, 0); rg.globalCompositeOperation = 'destination-out'; rg.drawImage(t, 1.6 * s * 0.8, 1.9 * s * 0.8);
      rg.globalCompositeOperation = 'source-in'; rg.fillStyle = 'rgba(255,248,215,.55)'; rg.fillRect(0, 0, W, W);
      g.drawImage(rim, 0, 0);
    });
  }
  // stand an emoji on the ground at (x, gy) inside an upright context.
  // o: lean (rad), sx, sy (squash), flip, lift (px), tilt about the feet.
  function body(c, ch, x, gy, size, o) {
    o = o || {};
    const e = emoSpr(ch, size);
    c.save(); c.translate(x, gy - (o.lift || 0));
    if (o.lean) c.rotate(o.lean);
    if (o.sx != null || o.sy != null) c.scale(o.sx == null ? 1 : o.sx, o.sy == null ? 1 : o.sy);
    if (o.flip) c.scale(-1, 1);
    if (o.alpha != null) c.globalAlpha = o.alpha;
    c.drawImage(e.cv, e.x0, e.y0 - size * (0.5 - 0.02), e.w, e.h);
    c.restore();
  }
  // shared ground shadow for upright things
  function groundShadows(c, x, gy, w, h, a) {
    contact(c, x, gy, w * .5, w * .5 * 0.42, a == null ? .3 : a);
    cast(c, x, gy, h, w, (a == null ? .3 : a) * .62);
  }
  const nameW = new Map();

  // ====================================================================== PLAYER
  A.actors.player = function (c, o, H) {
    const x = o.x, gy = o.y + 11;
    if (o.driving && o.def) {
      if (o.def.radius > 0) { c.save(); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.setLineDash([6, 6]); c.beginPath(); c.arc(x, o.y, o.def.radius * H.T + H.T / 2, 0, TAU); c.stroke(); c.restore(); }
      if (o.def.color || !o.def.emoji) {
        A.actors.tractor(c, { x, y: o.y, dir: o.dir, def: o.def, t: o.t, moving: o.moving, withDriver: true, avatar: o.avatar }, H);
      } else {
        groundShadows(c, x, o.y + 12, 40, 34, .3);
        H.bbAt(c, x, o.y + 12, () => H.em(c, o.def.emoji, x, o.y - 4, 44, { flip: o.dir > 0, force: true }));
      }
      tag(c, o, x, o.y + 14 - (o.def.key ? look(o.def.key, o.def.color || '#2e8b3a').ht : 60) - 8, H); return;
    }
    const s = o.moving ? Math.abs(Math.sin(o.walk)) : 0;
    const bob = o.moving ? s * 4 : 0;
    groundShadows(c, x, gy, 24 - bob * .8, 32, .3 - bob * .012);
    H.bbAt(c, x, gy, () => {
      let sx = 1, sy = 1, lean = 0;
      if (o.moving) { sy = 0.93 + 0.11 * s; sx = 1.07 - 0.09 * s; lean = (o.dir > 0 ? 1 : -1) * 0.13 + Math.sin(o.walk) * 0.05; }
      else { sy = 1 + Math.sin(o.t * 2) * 0.016; sx = 2 - sy; }
      body(c, o.avatar, x, gy, 32, { lift: bob, lean, sx, sy });
    });
    tag(c, o, x, gy - 34, H);
  };
  function tag(c, o, x, ty, H) {
    H.bbAt(c, x, ty + 8, () => {
      c.save(); c.font = '800 10px system-ui,-apple-system,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const nm = o.name || 'Farmer'; let w = nameW.get(nm); if (!w) { w = c.measureText(nm).width + 12; if (nameW.size > 20) nameW.clear(); nameW.set(nm, w); }
      H.rr(c, x - w / 2, ty - 8, w, 16, 8); c.fillStyle = 'rgba(40,24,8,.78)'; c.fill(); c.lineWidth = 1; c.strokeStyle = 'rgba(255,240,200,.25)'; c.stroke();
      c.fillStyle = '#fff6dc'; c.fillText(nm, x, ty + .5); c.restore();
    });
  }

  // ====================================================================== TRACTORS
  // Every look is drawn facing +x (right), origin = ground contact below the middle. Returns a spec for the live parts.
  const LOOKS = {};
  function look(key, col) {
    const f = key === 'harvestqueen' ? combine : key === 'supercar' ? supercar : key === 'bigyellow' ? bigyellow : standard;
    return f(key, col);   // spr() caches the baked layers, so rebuilding the small spec each frame is cheap
  }

  function glassCab(g, x, y, w, h, pillar) { // cab window opening: interior drawn in the back layer
    rrp(g, x, y, w, h, 2); g.fillStyle = vg(g, y, y + h, '#35586a', '#1d2f3a'); g.fill();
  }
  function exhaustStack(g, x, yb, h) {
    g.fillStyle = vg(g, yb - h, yb, '#555', '#222'); g.fillRect(x - 1.8, yb - h, 3.6, h);
    g.fillStyle = '#777'; g.beginPath(); g.ellipse(x, yb - h, 2.8, 1.3, 0, 0, TAU); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.ellipse(x, yb - h, 1.7, .7, 0, 0, TAU); g.fill();
  }

  function standard(key, col) {
    const rusty = key === 'rusty72', row = key === 'rowcrop160';
    const R = row ? 16.5 : 15, rx = -14, fr = 8.5, fx = 24;
    const sp = { wheels: [{ x: rx, y: -R, r: R, hub: '#e6c04a', live: 1 }, { x: fx, y: -fr, r: fr, hub: '#e6c04a', live: 1 }], exhaust: { x: 20, y: -45 }, driver: { x: -13, y: -32, size: 17 }, len: 36, ht: 60, w: 20,
      shadow: [[-24, 4, 20, 26], [4, 28, 14, 30]], light: { x: 31, y: -20 } };
    const hy = -R + 0;                                                                     // hood bottom
    sp.back = spr('trB' + key + col, -50, -62, 50, 6, g => {
      // far tyres (peek out behind the body)
      g.save(); g.translate(rx - 1, -R - 7); g.drawImage(tyreSpr(R, '#e6c04a', .5).cv, -R - 1, -R - 1, 2 * R + 2, 2 * R + 2); g.restore();
      g.save(); g.translate(fx - 1, -fr - 6); g.drawImage(tyreSpr(fr, '#e6c04a', .5).cv, -fr - 1, -fr - 1, 2 * fr + 2, 2 * fr + 2); g.restore();
      // chassis + axle housing
      g.fillStyle = vg(g, -17, -8, '#4a4d55', '#23252a'); rrp(g, -20, -17, 52, 8, 2); g.fill();
      g.fillStyle = '#2b2d33'; g.fillRect(fx - 2, -fr - 2, 3, 6);
      exhaustStack(g, 20, -31, 14);
      // hood (boxy, lit top) + grille
      blk(g, 4, -27, 28, 14, 7, col);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(6, -22, 22, 1.4);                  // pinstripe
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(5, -16, 26, 2);
      g.fillStyle = '#26272c'; rrp(g, 30.2, -26, 3.2, 12, 1); g.fill(); g.strokeStyle = '#6b6e75'; g.lineWidth = .6; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(30.4, -24.5 + i * 3); g.lineTo(33.2, -24.5 + i * 3); g.stroke(); }
      g.fillStyle = '#fff3a8'; g.beginPath(); g.arc(31.6, -19.5, 2.1, 0, TAU); g.fill(); g.strokeStyle = '#7a6a20'; g.lineWidth = .6; g.stroke();
      // cab block
      blk(g, -27, -44, 27, 28, 0, col);
      glassCab(g, -23.5, -40.5, 20, 17);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(-23, -16.5, 22, 1.5);
      if (rusty) { g.fillStyle = 'rgba(96,40,10,.4)'; [[-24, -30, 5, 3], [6, -24, 6, 4], [-8, -19, 5, 2]].forEach(p => { g.beginPath(); g.ellipse(p[0] + p[2] / 2, p[1], p[2], p[3] / 2, .3, 0, TAU); g.fill(); }); g.fillStyle = 'rgba(190,160,110,.25)'; g.fillRect(8, -25, 8, 1.2); }
      if (key === 'pacer90') { g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(-26, -20, 26, 1.6); }
      if (row) { g.fillStyle = '#d7d7d7'; g.fillRect(31, -13, 5, 4); g.fillStyle = '#555'; g.fillRect(31, -13, 5, 1); }
      // steps / seat bracket
      g.fillStyle = '#2b2d33'; g.fillRect(-26, -12, 6, 1.6);
    });
    sp.front = spr('trF' + key + col, -50, -62, 50, 6, g => {
      // rear fender over the big tyre
      g.beginPath(); g.arc(rx, -R, R + 2.6, Math.PI * 1.08, Math.PI * 1.92); g.arc(rx, -R, R + .4, Math.PI * 1.92, Math.PI * 1.08, true); g.closePath();
      g.fillStyle = vg(g, -R * 2 - 3, -R, shadeC(col, .3), shadeC(col, -.1)); g.fill(); g.strokeStyle = OUT; g.lineWidth = .8; g.stroke();
      // glass over the driver
      glassFill(g, -23.5, -40.5, 20, 17, 2); g.globalAlpha = .42; g.fillStyle = '#9fd4ee'; rrp(g, -23.5, -40.5, 20, 17, 2); g.fill(); g.globalAlpha = 1;
      glint(g, -22, -39.5, 15, 15);
      g.strokeStyle = shadeC(col, -.35); g.lineWidth = 1.6; rrp(g, -23.5, -40.5, 20, 17, 2); g.stroke();
      // windscreen sliver at the front edge (3/4 view) + glass roof
      g.fillStyle = 'rgba(140,200,225,.75)'; g.beginPath(); g.moveTo(-3.5, -40.5); g.lineTo(1.4, -37.5); g.lineTo(1.4, -22.5); g.lineTo(-3.5, -23.5); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = .7; g.stroke();
      // roof: lit top + slim side + glass skylight
      g.fillStyle = shadeC(col, -.28); rrp(g, -30, -47.5, 33, 4, 1.2); g.fill();
      rrp(g, -30, -55, 33, 8.5, 2); g.fillStyle = vg(g, -55, -46.5, shadeC(col, .62), shadeC(col, .3)); g.fill(); g.strokeStyle = OUT; g.lineWidth = .9; g.stroke();
      glassFill(g, -26, -53.4, 25, 5, 1.5); g.globalAlpha = .85; g.fillStyle = '#b9e4f4'; rrp(g, -26, -53.4, 25, 5, 1.5); g.fill(); g.globalAlpha = 1;
      g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(-23, -53, 7, 1.2);
    });
    return sp;
  }

  function bigyellow(key, col) {
    const R = 15, wx1 = -31, wx2 = 24;
    const sp = { wheels: [{ x: wx1, y: -R, r: R, hub: '#cfd3d8', live: 1 }, { x: wx2, y: -R, r: R, hub: '#cfd3d8', live: 1 }], exhaust: { x: 26, y: -56 }, driver: { x: -30, y: -44, size: 18 }, len: 46, ht: 74, w: 22,
      shadow: [[-48, 10, 16, 28], [-6, 46, 14, 30]], light: { x: 40, y: -22 }, dual: 1 };
    sp.back = spr('byB' + col, -62, -72, 62, 6, g => {
      [[wx1, 0], [wx2, 0]].forEach(([wx]) => {
        g.drawImage(tyreSpr(R, '#cfd3d8', .55).cv, wx - R - 1 - 1, -R - 9 - R - 1, 2 * R + 2, 2 * R + 2);     // far outer
        g.drawImage(tyreSpr(R, '#cfd3d8', .4).cv, wx - R - 1 - 1, -R - 5 - R - 1, 2 * R + 2, 2 * R + 2);      // far inner dual
        g.drawImage(tyreSpr(R, '#cfd3d8', .25).cv, wx - R - 1 + 2, -R - 3 - R - 1, 2 * R + 2, 2 * R + 2);      // near inner dual
      });
      // frame + articulation
      g.fillStyle = vg(g, -22, -8, '#4a4d55', '#1f2024'); rrp(g, -52, -22, 104, 9, 2); g.fill();
      g.fillStyle = '#17181b'; rrp(g, -8, -26, 14, 18, 3); g.fill(); g.strokeStyle = '#66696f'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-1, -26); g.lineTo(-1, -8); g.stroke();
      g.fillStyle = '#e8c93a'; g.fillRect(-5, -20, 8, 2);
      exhaustStack(g, 26, -40, 18);
      // front engine section
      blk(g, 4, -38, 40, 18, 9, col);
      g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(8, -30, 30, 1.6); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(5, -23, 38, 2);
      g.fillStyle = '#1f2024'; rrp(g, 42, -37, 4, 15, 1.2); g.fill(); g.strokeStyle = '#8a8e96'; g.lineWidth = .6; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(42.2, -35.5 + i * 3); g.lineTo(45.8, -35.5 + i * 3); g.stroke(); }
      [[-34, 1], [-27, 1]].forEach(() => { });
      g.fillStyle = '#fff3a8'; g.beginPath(); g.arc(43.8, -39.8, 2.2, 0, TAU); g.fill(); g.strokeStyle = '#7a6a20'; g.lineWidth = .6; g.stroke();
      // rear section with cab
      blk(g, -52, -34, 44, 14, 6, col);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-49, -28, 38, 1.4);
      blk(g, -44, -56, 28, 24, 0, col);
      glassCab(g, -41, -53, 22, 16);
      g.fillStyle = '#d0d4d8'; g.fillRect(-12, -33, 3, 2);
    });
    sp.front = spr('byF' + col, -62, -72, 62, 6, g => {
      glassFill(g, -41, -53, 22, 16, 2); g.globalAlpha = .4; g.fillStyle = '#9fd4ee'; rrp(g, -41, -53, 22, 16, 2); g.fill(); g.globalAlpha = 1;
      glint(g, -39, -52, 16, 14);
      g.strokeStyle = shadeC(col, -.35); g.lineWidth = 1.6; rrp(g, -41, -53, 22, 16, 2); g.stroke();
      g.fillStyle = 'rgba(140,200,225,.75)'; g.beginPath(); g.moveTo(-19.5, -53); g.lineTo(-15, -50); g.lineTo(-15, -36); g.lineTo(-19.5, -37); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = .7; g.stroke();
      g.fillStyle = shadeC(col, -.28); rrp(g, -47, -59.5, 36, 4, 1.2); g.fill();
      rrp(g, -47, -67, 36, 8.6, 2); g.fillStyle = vg(g, -67, -58, shadeC(col, .62), shadeC(col, .3)); g.fill(); g.strokeStyle = OUT; g.lineWidth = .9; g.stroke();
      glassFill(g, -43, -65.5, 28, 5, 1.5); g.globalAlpha = .85; g.fillStyle = '#b9e4f4'; rrp(g, -43, -65.5, 28, 5, 1.5); g.fill(); g.globalAlpha = 1;
      // beacon
      g.fillStyle = '#ff9a1f'; rrp(g, -34, -71, 6, 4.5, 2); g.fill();
      // fenders
      [[wx1], [wx2]].forEach(([wx]) => { g.beginPath(); g.arc(wx, -R, R + 3, Math.PI * 1.1, Math.PI * 1.9); g.arc(wx, -R, R + .6, Math.PI * 1.9, Math.PI * 1.1, true); g.closePath(); g.fillStyle = vg(g, -2 * R - 3, -R, shadeC(col, .35), shadeC(col, -.1)); g.fill(); g.strokeStyle = OUT; g.lineWidth = .8; g.stroke(); });
    });
    return sp;
  }

  function combine(key, col) {
    const R = 14, rx = -30, rr_ = 8, fx = 12;
    const sp = { wheels: [{ x: fx, y: -R, r: R, hub: '#e6c04a', live: 1 }, { x: rx, y: -rr_, r: rr_, hub: '#e6c04a', live: 1 }], exhaust: { x: -4, y: -62 }, driver: { x: 17, y: -41, size: 17 }, len: 44, ht: 72, w: 26, reel: { x: 47, y: -21, r: 10 },
      shadow: [[-40, 8, 20, 36], [30, 60, 10, 30]], light: { x: 62, y: -14 } };
    sp.back = spr('cmB' + col, -62, -76, 70, 6, g => {
      g.drawImage(tyreSpr(R, '#e6c04a', .5).cv, fx - R - 2, -R - 7 - R - 1, 2 * R + 2, 2 * R + 2);
      g.drawImage(tyreSpr(rr_, '#e6c04a', .5).cv, rx - rr_ - 2, -rr_ - 6 - rr_ - 1, 2 * rr_ + 2, 2 * rr_ + 2);
      // chassis / engine deck
      blk(g, -40, -30, 60, 15, 5, col);
      g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(-37, -23, 54, 1.4);
      // grain tank (big, lit lid)
      blk(g, -40, -50, 36, 21, 8, shadeC(col, .05));
      g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(-37, -44, 30, 1.2);
      g.fillStyle = '#e7c75a'; rrp(g, -30, -62.5, 14, 4, 2); g.fill();                         // grain heaped under the lid
      // unloading auger
      g.strokeStyle = shadeC(col, -.3); g.lineWidth = 5; g.beginPath(); g.moveTo(-8, -56); g.lineTo(8, -70); g.stroke();
      g.strokeStyle = shadeC(col, .45); g.lineWidth = 2.6; g.beginPath(); g.moveTo(-8, -56.8); g.lineTo(8, -70.8); g.stroke();
      g.fillStyle = '#333'; g.fillRect(6.5, -70, 4, 5);
      // exhaust
      exhaustStack(g, -4, -57, 8);
      // feeder house to header
      g.fillStyle = vg(g, -28, -10, shadeC(col, -.2), shadeC(col, -.5)); g.beginPath(); g.moveTo(19, -28); g.lineTo(32, -17); g.lineTo(32, -9); g.lineTo(19, -15); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = .8; g.stroke();
      // cab at the front-top
      blk(g, 3, -54, 29, 25, 0, col);
      glassCab(g, 6, -51, 23, 18);
      // header (trough + dividers)
      blk(g, 30, -17, 34, 11, 5, '#e3b93a');
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(31, -7.5, 32, 1.5);
      g.fillStyle = '#c9a029'; g.beginPath(); g.moveTo(63, -9); g.lineTo(70, -6.5); g.lineTo(63, -6.5); g.closePath(); g.fill();
      g.fillStyle = '#9a7a1c'; for (let i = 0; i < 7; i++) g.fillRect(32 + i * 4.8, -9.5, 2, 3);
    });
    sp.front = spr('cmF' + col, -62, -76, 70, 6, g => {
      glassFill(g, 6, -51, 23, 18, 2); g.globalAlpha = .4; g.fillStyle = '#9fd4ee'; rrp(g, 6, -51, 23, 18, 2); g.fill(); g.globalAlpha = 1;
      glint(g, 8, -50, 16, 16);
      g.strokeStyle = shadeC(col, -.35); g.lineWidth = 1.6; rrp(g, 6, -51, 23, 18, 2); g.stroke();
      g.fillStyle = 'rgba(140,200,225,.75)'; g.beginPath(); g.moveTo(29.5, -51); g.lineTo(34, -47.5); g.lineTo(34, -33); g.lineTo(29.5, -34); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = .7; g.stroke();
      g.fillStyle = shadeC(col, -.28); rrp(g, 0, -58, 37, 4, 1.2); g.fill();
      rrp(g, 0, -66, 37, 8.6, 2); g.fillStyle = vg(g, -66, -57, shadeC(col, .62), shadeC(col, .3)); g.fill(); g.strokeStyle = OUT; g.lineWidth = .9; g.stroke();
      g.fillStyle = '#ff9a1f'; rrp(g, 16, -70, 6, 4.5, 2); g.fill();
      g.beginPath(); g.arc(fx, -R, R + 2.6, Math.PI * 1.1, Math.PI * 1.9); g.arc(fx, -R, R + .5, Math.PI * 1.9, Math.PI * 1.1, true); g.closePath(); g.fillStyle = shadeC(col, .1); g.fill(); g.strokeStyle = OUT; g.lineWidth = .8; g.stroke();
      // reel supports in front of the trough
      g.strokeStyle = '#555'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(34, -17); g.lineTo(47, -21); g.lineTo(60, -17); g.stroke();
    });
    return sp;
  }

  function supercar(key, col) {
    const sp = { wheels: [{ x: -21, y: -9.5, r: 9.5, hub: '#d8dce2', live: 1 }, { x: 22, y: -9, r: 9, hub: '#d8dce2', live: 1 }], exhaust: null, driver: { x: -8, y: -28, size: 13 }, len: 36, ht: 34, w: 18,
      shadow: [[-36, 38, 12, 22]], light: { x: 35, y: -13 }, flame: { x: -37, y: -13 } };
    sp.back = spr('scB' + col, -50, -42, 50, 6, g => {
      g.drawImage(tyreSpr(9.5, '#d8dce2', .55).cv, -21 - 10.5 - 1, -9.5 - 5 - 10.5, 21, 21);
      g.drawImage(tyreSpr(9, '#d8dce2', .55).cv, 22 - 10, -9 - 5 - 10, 20, 20);
      // silhouette: tail -> spoiler -> roof -> windscreen -> bonnet -> nose
      const body = new Path2D(); const pts = [[-36, -10], [-36.5, -20], [-30, -23], [-22, -24], [-15, -30], [-5, -31], [5, -22.5], [18, -19], [33, -15.5], [36, -12.5], [35.5, -10]];
      body.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) body.lineTo(pts[i][0], pts[i][1]); body.closePath();
      // lit upper surfaces (top face), offset above the side silhouette
      const top = new Path2D(); top.moveTo(-36.5, -20); top.lineTo(-33, -25); top.lineTo(-22, -26.5); top.lineTo(-15, -33); top.lineTo(-5, -34); top.lineTo(5, -26); top.lineTo(18, -22.5); top.lineTo(33, -19); top.lineTo(36, -15.5); top.lineTo(33, -15.5); top.lineTo(18, -19); top.lineTo(5, -22.5); top.lineTo(-5, -31); top.lineTo(-15, -30); top.lineTo(-22, -24); top.lineTo(-30, -23); top.closePath();
      g.fillStyle = vg(g, -34, -10, shadeC(col, .12), shadeC(col, -.42)); g.fill(body);
      g.fillStyle = vg(g, -34, -15, shadeC(col, .62), shadeC(col, .3)); g.fill(top);
      g.strokeStyle = 'rgba(40,0,0,.65)'; g.lineWidth = .9; g.stroke(body); g.stroke(top);
      // wheel arches
      [[-21, -9.5, 9.5], [22, -9, 9]].forEach(p => { g.fillStyle = '#17080a'; g.beginPath(); g.arc(p[0], p[1], p[2] + 1.8, Math.PI, 0); g.lineTo(p[0] + p[2] + 1.8, p[1] + 4); g.lineTo(p[0] - p[2] - 1.8, p[1] + 4); g.closePath(); g.fill(); });
      // racing stripe on the lit surfaces
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(-4, -33); g.lineTo(-1, -33); g.lineTo(10, -24.5); g.lineTo(34, -17.5); g.lineTo(34, -16.5); g.lineTo(10, -22); g.closePath(); g.fill();
      // rocker + door line
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(-12, -11, 24, 2); g.strokeStyle = 'rgba(60,0,0,.5)'; g.lineWidth = .7; g.beginPath(); g.moveTo(-3, -22); g.lineTo(-3, -11.5); g.moveTo(10, -19); g.lineTo(10, -11.5); g.stroke();
      // cockpit interior (dark), glass overlay is on the front layer
      g.fillStyle = '#2a1c22'; g.beginPath(); g.moveTo(-18, -25.5); g.lineTo(-14, -30.5); g.lineTo(-6, -30.5); g.lineTo(2, -23.5); g.lineTo(-18, -23.5); g.closePath(); g.fill();
      // rear wing
      g.fillStyle = '#17080a'; g.fillRect(-33, -27, 1.8, 6); g.fillRect(-27, -26, 1.8, 5);
      blk(g, -38, -29, 15, 3, 3, shadeC(col, -.1), { r: 1 });
      // lights
      g.fillStyle = '#fff6b0'; g.beginPath(); g.moveTo(31, -17); g.lineTo(35, -15); g.lineTo(31, -14.5); g.closePath(); g.fill();
      g.fillStyle = '#ff2a2a'; g.fillRect(-36.6, -18, 1.6, 3);
      g.fillStyle = '#555'; g.fillRect(-37.5, -12.5, 2.5, 1.8);
    });
    sp.front = spr('scF' + col, -50, -42, 50, 6, g => {
      const win = new Path2D(); win.moveTo(-19, -25.5); win.lineTo(-14.5, -30.2); win.lineTo(-6, -30.2); win.lineTo(3, -22.8); win.lineTo(-19, -23.2); win.closePath();
      g.save(); g.clip(win);
      g.fillStyle = vg(g, -31, -23, 'rgba(190,225,245,.85)', 'rgba(70,110,135,.8)'); g.fillRect(-20, -32, 25, 10);
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(-12, -23); g.lineTo(-8, -31); g.lineTo(-5, -31); g.lineTo(-9, -23); g.closePath(); g.fill();
      g.restore(); g.strokeStyle = 'rgba(30,0,0,.7)'; g.lineWidth = 1; g.stroke(win);
      // gloss streak along the shoulder
      g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(32, -16); g.lineTo(14, -18.6); g.lineTo(2, -23); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = .8; g.beginPath(); g.moveTo(-34, -19); g.quadraticCurveTo(-26, -22, -16, -22.5); g.stroke();
    });
    return sp;
  }

  const wheelOf = (w, a) => { const e = tyreSpr(w.r, w.hub); return e; };

  A.actors.tractor = function (c, o, H) {
    const def = o.def || {}, key = def.key || '', col = def.color || '#2e8b3a';
    const sp = look(key, col), dir = o.dir < 0 ? -1 : 1;
    const x = o.x, gy = o.y + 14, t = o.t, mv = !!o.moving;
    // ground shadows first (ground space)
    const bw = sp.w;
    contact(c, x, gy, sp.len + 8, bw * .42, .26);
    for (const s of sp.shadow) { // [x0,x1,height,... ] footprints in unit x with heights -> skewed blocks to the SE
      const a = dir > 0 ? s[0] : -s[1], w = (s[1] - s[0]); // x range after flip
      const hh = s[2] + (s[3] || 0) * .3;
      castShadow2(c, x + (dir > 0 ? s[0] : -s[1]), gy - bw * .32, w, bw * .64, hh, H);
    }
    H.bbAt(c, x, gy, () => {
      const bounce = mv ? Math.sin(t * 28) * 0.7 : 0;
      c.save(); c.translate(x, gy + bounce); if (dir < 0) c.scale(-1, 1);
      c.drawImage(sp.back.cv, sp.back.x0, sp.back.y0, sp.back.w, sp.back.h);
      // near wheels (rotating)
      const rot = mv ? t * 11 : 0;
      for (const w of sp.wheels) {
        const e = tyreSpr(w.r, w.hub);
        c.save(); c.translate(w.x, w.y); c.rotate(rot * (10 / w.r)); c.drawImage(e.cv, e.x0, e.y0, e.w, e.h); c.restore();
      }
      if (sp.reel) { // combine reel
        const r = sp.reel; c.save(); c.translate(r.x, r.y); c.rotate(mv ? -t * 5 : 0);
        c.strokeStyle = '#7a5a12'; c.lineWidth = 1.4; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * r.r, Math.sin(a) * r.r); c.stroke(); }
        c.fillStyle = '#f2d34a'; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c.beginPath(); c.arc(Math.cos(a) * r.r, Math.sin(a) * r.r, 2.1, 0, TAU); c.fill(); }
        c.fillStyle = '#6b4a10'; c.beginPath(); c.arc(0, 0, 2, 0, TAU); c.fill(); c.restore();
      }
      if (sp.flame && mv) { const f = 4 + Math.abs(Math.sin(t * 40)) * 5; c.fillStyle = 'rgba(255,170,40,.85)'; c.beginPath(); c.moveTo(sp.flame.x, sp.flame.y - 1.4); c.lineTo(sp.flame.x - f, sp.flame.y); c.lineTo(sp.flame.x, sp.flame.y + 1.4); c.fill(); c.fillStyle = 'rgba(255,240,150,.9)'; c.beginPath(); c.moveTo(sp.flame.x, sp.flame.y - .7); c.lineTo(sp.flame.x - f * .5, sp.flame.y); c.lineTo(sp.flame.x, sp.flame.y + .7); c.fill(); }
      if (o.withDriver) body(c, o.avatar || H.avatarEm(), sp.driver.x, sp.driver.y + sp.driver.size * .45, sp.driver.size, { flip: false });
      c.drawImage(sp.front.cv, sp.front.x0, sp.front.y0, sp.front.w, sp.front.h);
      if (sp.exhaust && mv) { // puffs rise behind the stack
        c.fillStyle = 'rgba(205,205,205,.55)';
        for (let i = 0; i < 3; i++) { const ph = (t * 1.6 + i / 3) % 1; c.globalAlpha = (1 - ph) * .6; c.beginPath(); c.arc(sp.exhaust.x - ph * 10, sp.exhaust.y - ph * 16, 2.4 + ph * 4, 0, TAU); c.fill(); }
        c.globalAlpha = 1;
      }
      // headlight glow at night
      if (night()) { const g2 = glow(); c.globalCompositeOperation = 'lighter'; c.drawImage(g2.cv, sp.light.x - 18, sp.light.y - 18, 36, 36); c.globalCompositeOperation = 'source-over'; }
      c.restore();
    });
    if (night()) { // light pool on the ground ahead
      c.fillStyle = 'rgba(255,235,160,.10)'; c.beginPath(); c.ellipse(x + dir * (sp.len + 26), gy, 24, 11, 0, 0, TAU); c.fill();
    }
  };
  function castShadow2(c, x, y, w, d, h, H) { H.castShadow(c, x, y, w, d, h, .14); }
  let calAt = -1, calNight = false;
  function night() { const n = performance.now(); if (n - calAt > 400) { calAt = n; try { const p = G.calendar().dayProgress; calNight = p > 0.8 || p < 0.05; } catch (e) { calNight = false; } } return calNight; }
  function glow() { return spr('glow', -18, -18, 18, 18, g => { const gr = g.createRadialGradient(0, 0, 1, 0, 0, 18); gr.addColorStop(0, 'rgba(255,240,170,.95)'); gr.addColorStop(.35, 'rgba(255,215,120,.4)'); gr.addColorStop(1, 'rgba(255,200,100,0)'); g.fillStyle = gr; g.fillRect(-18, -18, 36, 36); }); }

  // ====================================================================== NPCs
  A.actors.npc = function (c, o, H) {
    const cu = o.cu || {}, x = o.x, gy = o.y + 10, t = o.t, i = o.i || 0;
    const sit = !!o.sit, walk = !!o.walk;
    const s = walk ? Math.abs(Math.sin(t * 9 + i * 2)) : 0, bob = walk ? s * 3 : 0;
    groundShadows(c, x, gy, sit ? 20 : 20 - bob, sit ? 22 : 28, .28);
    H.bbAt(c, x, gy, () => {
      let sx = 1, sy = 1, lean = 0;
      if (walk) { sy = 0.94 + 0.1 * s; sx = 1.06 - 0.08 * s; lean = (Math.cos(t * 3 + i) > 0 ? 1 : -1) * 0.1 + Math.sin(t * 9 + i * 2) * 0.04; }
      else { sy = 1 + Math.sin(t * 2 + i) * 0.014; sx = 2 - sy; }
      if (sit) sy *= 0.93;
      body(c, cu.emoji || '🧑', x, gy - (sit ? -4 : 0) + 0, 27, { lift: bob - (sit ? 0 : 0), lean, sx, sy });
      if (cu.phase === 'paying' || (cu.phase === 'leaving' && cu.mood === 'happy' && cu.t < .3)) H.bubble(c, x, gy - 33, cu.mood === 'sad' ? '💢' : cu.mood === 'meh' ? '💬' : '❤️', t + i, 12);
      else if (cu.phase === 'eating') H.em(c, '🍽️', x + (H.hash(cu.id) < .5 ? 14 : -14), gy - 2, 12, {});
    });
  };

  // ====================================================================== ANIMALS
  const peck = (t, i) => Math.pow(Math.max(0, Math.sin(t * 2.6 + i * 1.9)), 6);
  A.actors.animal = function (c, o, H) {
    const size = o.size || 20, x = o.x, t = o.t, i = o.i || 0, bees = !!o.bees;
    const flip = o.dir > 0;
    if (bees) {
      const hov = Math.sin(t * 6 + i) * 1.5;
      const gy = o.y + 18;
      contact(c, x, gy, 3.6 + hov * .1, 1.5, .16);
      H.bbAt(c, x, o.y + 6, () => {
        body(c, o.emoji, x, o.y + 6, size, { flip, lift: 0, lean: Math.sin(t * 3 + i) * 0.14 });
        bubbles(c, o, x, o.y - size * .85, H);
      });
      return;
    }
    const gy = o.y + size * .4, hop = o.moving ? Math.abs(Math.sin(t * 9 + i)) : 0;
    groundShadows(c, x, gy, size * (.95 - hop * .08), size * 1.15, .26);
    H.bbAt(c, x, gy, () => {
      let lean = 0, sy = 1, sx = 1;
      if (o.moving) { sy = 0.94 + 0.08 * hop; sx = 1.04 - 0.05 * hop; lean = (flip ? 1 : -1) * 0.08; }
      else { const p = peck(t, i), dip = o.type === 'chickens' ? 0.42 : 0.2; lean = (flip ? 1 : -1) * p * dip; }
      body(c, o.emoji, x, gy, size, { flip, lift: hop * 3.5, lean, sx, sy });
      bubbles(c, o, x, gy - size * 1.3, H);
    });
  };
  function bubbles(c, o, x, y, H) {
    if (o.status === 'ready') H.bubble(c, x, y, o.productEmoji, o.t + (o.i || 0), 14);
    else if (o.status === 'hungry') H.bubble(c, x, y, '🍽️', o.t + (o.i || 0), 13);
  }

  A.actors.cattle = function (c, o, H) {
    const size = o.size || 26, x = o.x, t = o.t, i = o.i || 0, gy = o.y + size * .38, flip = o.dir > 0;
    const hop = o.moving ? Math.abs(Math.sin(t * 5 + i)) : 0;
    groundShadows(c, x, gy, size * 1.05, size * 1.2, .3);
    H.bbAt(c, x, gy, () => {
      let lean = 0, sx = 1, sy = 1;
      const dir = flip ? 1 : -1;
      if (o.night) { sy = 1 + Math.sin(t * 1.2 + i) * 0.02; sx = 2 - sy; lean = dir * 0.05; }
      else if (o.moving) { sy = 0.96 + 0.05 * hop; sx = 1.03 - 0.03 * hop; lean = dir * 0.05; }
      else { const g = (Math.sin(t * 1.4 + i * 2.1) * .5 + .5); lean = dir * (0.1 + g * 0.2); sy = 1 - g * 0.025; }
      body(c, o.h.emoji || '🐄', x, gy, size, { flip, lift: hop * 1.6, lean, sx, sy });
      if (o.hungry) H.bubble(c, x, gy - size * 1.28, o.night ? '💤' : '🍽️', t + i, 13);
      else if (o.night) { c.save(); c.font = '800 11px system-ui'; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 2; c.textAlign = 'center'; const ph = (t * 8 + i * 5) % 14, zy = gy - size * 1.1 - ph; c.globalAlpha = 1 - ph / 16; c.strokeText('z', x + 8, zy); c.fillText('z', x + 8, zy); c.restore(); }
    });
  };

  // ====================================================================== DUCK
  A.actors.duck = function (c, o, H) {
    const x = o.x, y = o.y, t = o.t, i = o.i || 0;
    // ripple rings on the water (ground space; circles get squashed by the camera)
    for (let k = 0; k < 2; k++) {
      const ph = (t * 0.55 + k * .5 + i * .23) % 1;
      c.strokeStyle = `rgba(255,255,255,${(1 - ph) * .5})`; c.lineWidth = 1.3; c.beginPath(); c.arc(x, y + 3, 6 + ph * 11, 0, TAU); c.stroke();
    }
    contact(c, x + 2, y + 2, 9, 4.2, .16);
    const bob = Math.sin(t * 2.2 + i * 1.7) * 1.1;
    H.bbAt(c, x, y + 4, () => {
      body(c, '🦆', x, y + 6, 18, { flip: Math.sin(o.a) < 0, lift: 1.2 + bob, lean: Math.sin(t * 1.6 + i) * 0.05 });
    });
    // water laps over the bottom of the duck
    c.strokeStyle = 'rgba(255,255,255,.65)'; c.lineWidth = 1.6; c.beginPath(); c.arc(x, y + 3.5, 7, 0.1, Math.PI - 0.1); c.stroke();
    c.strokeStyle = 'rgba(90,150,200,.4)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y + 4.5, 8.5, 0.2, Math.PI - 0.2); c.stroke();
  };

  // ====================================================================== ROAD VEHICLES
  const PAINT = ['#d94b3a', '#2f6fb8', '#e8e2d4', '#3b8f55', '#f0b73a', '#6b4aa8', '#e07a2a', '#2b2f38'];
  function vcol(o) { return PAINT[Math.floor(G.WorldArt.actors._hash(o.kind + '|' + (o.dir > 0 ? 'e' : 'w') + '|' + Math.round(o.y)) * PAINT.length) % PAINT.length]; }
  A.actors._hash = (s) => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };

  function veh(kind, col) {
    const k = kind === '🚚' ? 'truck' : kind === '🚐' ? 'van' : kind === '🚗' ? 'car' : 'pickup';
    const sp = { kind: k };
    const R = k === 'car' ? 6.5 : 7.5;
    let L = k === 'truck' ? 74 : k === 'van' ? 58 : k === 'car' ? 54 : 62, ht = k === 'truck' ? 38 : k === 'van' ? 32 : k === 'car' ? 24 : 30;
    sp.len = L / 2; sp.ht = ht; sp.w = 24; sp.wheels = k === 'truck' ? [[-L / 2 + 17, R], [L / 2 - 12, R]] : [[-L / 2 + 13, R], [L / 2 - 12, R]]; sp.R = R;
    sp.light = { x: L / 2 - 1, y: -R - 4 };
    sp.back = spr('veB' + k + col, -L / 2 - 6, -ht - 14, L / 2 + 6, 6, g => {
      const hx = L / 2, lx = -L / 2;
      // far wheels
      sp.wheels.forEach(w => { g.drawImage(tyreSpr(R, '#aeb3ba', .55).cv, w[0] - R - 1, -R - 5 - R - 1, 2 * R + 2, 2 * R + 2); });
      const glassOpen = (x, y, w, h, r) => { rrp(g, x, y, w, h, r || 1.5); g.fillStyle = vg(g, y, y + h, '#cfeaf6', '#6fa6c4'); g.fill(); g.strokeStyle = OUT; g.lineWidth = .7; g.stroke(); };
      const bumper = () => { g.fillStyle = '#9ca2aa'; rrp(g, lx - 1.5, -R - 3, 4, 5, 1.5); g.fill(); rrp(g, hx - 2.5, -R - 3, 4, 5, 1.5); g.fill(); };
      if (k === 'pickup') {
        blk(g, lx + 1, -17, 24, 10, 0, col, { r: 1.2 });                                         // bed side
        g.fillStyle = shadeC(col, -.5); rrp(g, lx + 2, -22, 22, 5, 1); g.fill();                  // bed floor in shadow
        blk(g, lx + 1, -19, 24, 3, 4, col, { r: 1 });
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(lx + 4, -24.5, 18, 3.5);
        g.fillStyle = '#b08a4f'; rrp(g, lx + 6, -24.8, 9, 5, 1.2); g.fill();                        // hay bale in the bed
        g.strokeStyle = '#7d5f2c'; g.lineWidth = .6; g.beginPath(); g.moveTo(lx + 8, -24.8); g.lineTo(lx + 8, -19.8); g.moveTo(lx + 12, -24.8); g.lineTo(lx + 12, -19.8); g.stroke();
        blk(g, lx + 24, -17, hx - lx - 24, 10, 0, col, { r: 1.2 });                              // hood/body
        blk(g, -3, -24, 21, 8, 5, col, { r: 1.5 });                                               // cab
        glassOpen(-1, -29, 13, 8, 1.5); glassOpen(12.5, -29, 4.5, 7.5, 1);
        g.fillStyle = shadeC(col, -.1); rrp(g, 19, -19, hx - 19, 5, 1.5); g.fill();
        g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(lx + 2, -17.5, hx - lx - 4, 1);
      } else if (k === 'truck') {
        blk(g, lx + 1, -33, 46, 25, 7, '#e9e6de', { r: 1.5 });                                    // box
        g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(lx + 4, -20, 40, 1); g.fillStyle = col; g.fillRect(lx + 2, -14, 44, 3);
        blk(g, lx + 47, -24, hx - lx - 47, 16, 4, col, { r: 1.5 });                               // cab
        glassOpen(hx - 20, -22, 15, 9, 1.5); glass2(g, hx - 6, -21, 4);
        g.fillStyle = '#2a2d33'; g.fillRect(lx + 1, -9, hx - lx - 2, 3);
      } else if (k === 'van') {
        blk(g, lx + 1, -26, hx - lx - 2, 19, 6, col, { r: 3 });
        glassOpen(hx - 24, -23, 14, 9, 1.5); glassOpen(hx - 9, -22, 6, 8, 1.2); glassOpen(-6, -23, 10, 7, 1.2);
        g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(lx + 3, -12, hx - lx - 6, 1);
      } else {
        blk(g, lx + 1, -13, hx - lx - 2, 9, 0, col, { r: 2 });
        blk(g, -12, -22, 24, 9.5, 4, col, { r: 3 });
        glassOpen(-9.5, -21.5, 10, 7, 1.5); glassOpen(1.5, -21.5, 9, 7, 1.5);
        g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(lx + 4, -12.4, hx - lx - 8, 1);
      }
      bumper();
      g.fillStyle = '#fff2a8'; g.beginPath(); g.ellipse(hx - 1.5, -R - 5.8, 1.6, 2, 0, 0, TAU); g.fill(); g.strokeStyle = '#7a6a20'; g.lineWidth = .5; g.stroke();
      g.fillStyle = '#e03030'; g.fillRect(lx + 1, -R - 7, 1.4, 3);
      void ht;
    });
    sp.front = spr('veF' + k + col, -L / 2 - 6, -ht - 14, L / 2 + 6, 6, g => {
      sp.wheels.forEach(w => { // wheel arches over the tyre
        g.beginPath(); g.arc(w[0], -R, R + 2, Math.PI * 1.1, Math.PI * 1.9); g.arc(w[0], -R, R + .3, Math.PI * 1.9, Math.PI * 1.1, true); g.closePath(); g.fillStyle = shadeC(col, -.35); g.fill();
      });
    });
    return sp;
  }
  function glass2(g, x, y, w) { }
  A.actors.vehicle = function (c, o, H) {
    const col = vcol(o), E = veh(o.kind, col);
    const x = o.x, gy = o.y + 12, dir = o.dir > 0 ? 1 : -1;
    contact(c, x, gy, E.len + 6, 9, .26);
    c.save(); c.translate(x, gy); if (dir < 0) c.scale(-1, 1);
    H.castShadow(c, -E.len, -6, E.len * 2 - 8, 12, E.ht * .55, .16);
    c.restore();
    H.bbAt(c, x, gy, () => {
      c.save(); c.translate(x, gy + Math.sin(o.t * 22 + x) * 0.3); if (dir < 0) c.scale(-1, 1);
      c.drawImage(E.back.cv, E.back.x0, E.back.y0, E.back.w, E.back.h);
      const rot = (x * dir) / E.R;
      for (const w of E.wheels) { const e = tyreSpr(E.R, '#aeb3ba'); c.save(); c.translate(w[0], -E.R); c.rotate(rot); c.drawImage(e.cv, e.x0, e.y0, e.w, e.h); c.restore(); }
      c.drawImage(E.front.cv, E.front.x0, E.front.y0, E.front.w, E.front.h);
      if (night()) { c.globalCompositeOperation = 'lighter'; const g2 = glow(); c.drawImage(g2.cv, E.light.x - 14, E.light.y - 14, 28, 28); c.globalCompositeOperation = 'source-over'; }
      c.restore();
    });
    if (night()) { c.fillStyle = 'rgba(255,235,160,.10)'; c.beginPath(); c.ellipse(x + dir * (E.len + 30), gy, 32, 9, 0, 0, TAU); c.fill(); }
  };
})();
