/* machines.js — Kellyville tractor shed (G.Machines). Buy, equip, fuel and repair tractors that boost yield.
   State: G.state.machines = { owned:[], equipped:null, driving:false, fuel:0..100, condition:{key:0..100}, discount, spike } */
(function () {
  'use strict';
  const G = window.G; if (!G) return;
  const U = G.util || {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => (U.now ? U.now() : Date.now());
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

  const DEFS = [
    { key: 'rusty72', name: "Rusty '72 Utility Tractor", emoji: '🚜', cost: 300, level: 3, yieldBonus: 0.05, speed: 1.4, radius: 0, seeder: false, fuelPerMin: 3, color: '#b5651d',
      desc: 'Runs on diesel, duct tape and stubbornness.' },
    { key: 'pacer90', name: 'Palouse Pacer 90', emoji: '🚜', cost: 1200, level: 5, yieldBonus: 0.10, speed: 1.6, radius: 0, seeder: false, fuelPerMin: 4, color: '#3f8f4a',
      desc: 'Smooth as a wheat field in a light breeze.' },
    { key: 'rowcrop160', name: 'Columbia Basin Row-Crop 160', emoji: '🚜', cost: 3500, level: 8, yieldBonus: 0.16, speed: 1.8, radius: 1, seeder: false, fuelPerMin: 5, color: '#c0392b',
      desc: 'Straight rows from here to the Columbia, no GPS needed.' },
    { key: 'bigyellow', name: 'Big Yellow Articulated 4WD', emoji: '🚜', cost: 8000, level: 11, yieldBonus: 0.24, speed: 2.0, radius: 1, seeder: true, fuelPerMin: 6, color: '#f2b631',
      desc: 'Bends in the middle so your back does not have to.' },
    { key: 'harvestqueen', name: 'Combine: The Harvest Queen', emoji: '🌾', cost: 15000, level: 14, yieldBonus: 0.32, speed: 2.2, radius: 2, seeder: true, fuelPerMin: 8, color: '#d9533b',
      desc: 'Reigns over every field. Please curtsy when she passes.' },
    { key: 'supercar', name: 'Italian-Inspired Supercar Tractor', emoji: '🏎️', cost: 25000, level: 18, yieldBonus: 0.40, speed: 2.6, radius: 2, seeder: true, fuelPerMin: 9, color: '#e0242b',
      desc: 'Zero to plowed in 2.9 seconds. The cows file complaints.' }
  ];
  const DEF = {}; DEFS.forEach(d => { DEF[d.key] = d; });

  const BASE_FUEL_PRICE = 0.6;   // coins per fuel unit
  const COND_PER_MIN = 1.2;      // condition lost per minute driving
  const LOW_COND = 25;
  let lastT = 0, warnedLow = false;

  // ---------- state ----------
  function ensure() {
    const s = G.state; if (!s) return null;
    let m = s.machines;
    if (!m || typeof m !== 'object') m = s.machines = {};
    if (!Array.isArray(m.owned)) m.owned = [];
    m.owned = m.owned.filter((k, i) => DEF[k] && m.owned.indexOf(k) === i);
    if (!m.condition || typeof m.condition !== 'object') m.condition = {};
    m.owned.forEach(k => { m.condition[k] = clamp(num(m.condition[k], 100), 0, 100); });
    if (typeof m.fuel !== 'number' || !isFinite(m.fuel)) m.fuel = 50;
    m.fuel = clamp(m.fuel, 0, 100);
    if (m.equipped && (!DEF[m.equipped] || m.owned.indexOf(m.equipped) < 0)) m.equipped = null;
    if (!m.equipped) m.equipped = null;
    m.driving = !!m.driving && !!m.equipped;
    if (m.discount && (typeof m.discount !== 'object' || !(m.discount.pct > 0))) m.discount = null;
    if (!m.discount) m.discount = null;
    if (m.spike && (typeof m.spike !== 'object' || !(m.spike.until > 0))) m.spike = null;
    if (!m.spike) m.spike = null;
    return m;
  }
  const M = () => ensure() || { owned: [], equipped: null, driving: false, fuel: 0, condition: {}, discount: null, spike: null };
  const toast = (msg, kind) => { try { G.toast && G.toast(msg, kind); } catch (e) { /* ignore */ } };
  const emit = (n, p) => { try { G.bus.emit(n, p); } catch (e) { /* ignore */ } };
  const fmt = n => { try { return (G.uikit && G.uikit.fmt) ? G.uikit.fmt(n) : String(Math.round(n)); } catch (e) { return String(Math.round(n)); } };
  const esc = s => { try { if (G.uikit && G.uikit.esc) return G.uikit.esc(s); } catch (e) { /* ignore */ } return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); };

  // ---------- derived ----------
  function curDef() { const m = M(); return m.equipped ? DEF[m.equipped] || null : null; }
  function cond(key) { const m = M(); return num(m.condition[key], 0); }
  function isBroken(key) { return cond(key) <= 0; }
  function isWorn(key) { return cond(key) < LOW_COND; }
  function effBonus(def) { if (!def) return 0; return def.yieldBonus * (isWorn(def.key) ? 0.5 : 1); }
  function fuelMult() { const m = M(); return (m.spike && m.spike.until > now()) ? num(m.spike.mult, 1) : 1; }
  function dayFactor() {
    let day = 1; try { day = G.calendar().day; } catch (e) { /* ignore */ }
    const x = Math.sin(day * 12.9898) * 43758.5453;
    return 0.85 + 0.35 * (x - Math.floor(x));
  }
  const fuelUnitPrice = () => BASE_FUEL_PRICE * dayFactor() * fuelMult();
  const refuelCost = () => { const m = M(); return Math.ceil((100 - m.fuel) * fuelUnitPrice() - 1e-9); };
  const repairRate = def => 1 + def.cost * 0.0006;
  const repairCost = key => { const d = DEF[key]; if (!d) return 0; return Math.ceil((100 - cond(key)) * repairRate(d)); };
  function price(key) {
    const d = DEF[key]; if (!d) return 0;
    const m = M(); let c = d.cost;
    if (m.discount && m.discount.pct > 0 && (!m.discount.until || m.discount.until > now())) c = Math.round(c * (1 - m.discount.pct));
    return c;
  }
  function discountActive() { const m = M(); return !!(m.discount && m.discount.pct > 0 && (!m.discount.until || m.discount.until > now())); }

  // ---------- celebration ----------
  function modal(def, title, text) {
    try {
      if (G.showModal) G.showModal({ emoji: def.emoji, title, text, kind: 'good', confetti: true, buttons: [{ label: 'Vroom!', cls: 'btn-gold' }] });
      else toast(title, 'good');
    } catch (e) { /* ignore */ }
  }

  // ---------- actions ----------
  function equip(key, quiet) {
    const m = ensure(); const d = DEF[key]; if (!m || !d) return false;
    if (m.owned.indexOf(key) < 0) { toast('You do not own the ' + d.name, 'bad'); return false; }
    if (m.equipped === key) return true;
    if (m.driving) setDriving(false);
    m.equipped = key; warnedLow = false;
    emit('machine:equip', { key, def: d });
    emit('change');
    if (!quiet) modal(d, d.name + ' equipped!', 'Now +' + Math.round(d.yieldBonus * 100) + '% harvest yield. ' + d.desc);
    return true;
  }
  function buy(key) {
    const m = ensure(); const d = DEF[key]; if (!m || !d) return false;
    if (m.owned.indexOf(key) >= 0) { toast('You already own the ' + d.name, 'bad'); return false; }
    if ((G.state.level || 1) < d.level) { toast(d.name + ' unlocks at level ' + d.level, 'bad'); return false; }
    const c = price(key);
    if (!G.spend(c)) return false;
    if (m.discount) m.discount = null;
    m.owned.push(key); m.condition[key] = key === 'rusty72' ? 70 : 100;
    const first = !m.equipped;
    emit('machine:bought', { key, def: d, cost: c });
    try { G.addXP(Math.max(10, Math.round(d.cost / 60))); } catch (e) { /* ignore */ }
    if (first) { equip(key, true); }
    modal(d, 'New ride: ' + d.name + '!', d.desc + ' +' + Math.round(d.yieldBonus * 100) + '% yield' + (first ? ' and it is already parked at your barn.' : '. Equip it from the shed.'));
    emit('change');
    return true;
  }
  function setDriving(on) {
    const m = ensure(); if (!m) return false;
    on = !!on;
    if (!on) {
      if (m.driving) { m.driving = false; const k = m.equipped; emit('drive:stop', { key: k }); emit('change'); }
      return true;
    }
    const d = curDef();
    if (!d) { toast('Buy and equip a tractor first', 'bad'); return false; }
    if (m.fuel <= 0.01) { toast('The tank is bone dry. Refuel at the shed!', 'bad'); return false; }
    if (isBroken(d.key)) { toast('The ' + d.name + ' is broken down. Repair it first!', 'bad'); return false; }
    if (m.driving) return true;
    m.driving = true; lastT = now();
    emit('drive:start', { key: d.key, def: d });
    emit('change');
    return true;
  }
  function refuel() {
    const m = ensure(); if (!m) return false;
    if (m.fuel >= 99.5) { toast('Tank is already full', 'info'); return false; }
    const c = refuelCost();
    if (c > 0 && !G.spend(c)) return false;
    m.fuel = 100; toast('⛽ Tank topped off for ' + c + ' coins', 'good'); emit('change');
    return true;
  }
  function repair() {
    const m = ensure(); const d = curDef(); if (!m || !d) { toast('No tractor equipped', 'bad'); return false; }
    if (cond(d.key) >= 99.5) { toast('Already in mint shape', 'info'); return false; }
    const c = repairCost(d.key);
    if (c > 0 && !G.spend(c)) return false;
    m.condition[d.key] = 100; warnedLow = false; toast('🔧 ' + d.name + ' is good as new (' + c + ' coins)', 'good'); emit('change');
    return true;
  }

  // ---------- tick: fuel + wear ----------
  function onTick(p) {
    const m = ensure(); if (!m) return;
    const t = (p && p.now) || now();
    const dt = lastT ? clamp(t - lastT, 0, 5000) : 0; lastT = t;
    if (m.discount && m.discount.until && m.discount.until <= t) { m.discount = null; }
    if (m.spike && m.spike.until <= t) { m.spike = null; }
    if (!m.driving) return;
    const d = curDef();
    if (!d) { m.driving = false; emit('drive:stop', {}); return; }
    const min = dt / 60000;
    m.fuel = clamp(m.fuel - num(d.fuelPerMin, 5) * min, 0, 100);
    m.condition[d.key] = clamp(cond(d.key) - COND_PER_MIN * min, 0, 100);
    if (!warnedLow && isWorn(d.key) && !isBroken(d.key)) { warnedLow = true; toast('🔧 ' + d.name + ' is worn out: yield bonus halved. Time for repairs.', 'bad'); }
    if (m.fuel <= 0) { m.driving = false; toast('⛽ Out of diesel! The tractor coughs to a stop.', 'bad'); emit('drive:stop', { key: d.key, reason: 'fuel' }); }
    else if (isBroken(d.key)) { m.driving = false; toast('💥 The ' + d.name + ' broke down!', 'bad'); emit('drive:stop', { key: d.key, reason: 'broken' }); }
    emit('change');
  }

  // ---------- public API ----------
  G.Machines = {
    list: () => DEFS,
    owned: () => M().owned.slice(),
    equipped: () => curDef(),
    equip: k => { try { return equip(k); } catch (e) { console.error('[machines] equip', e); return false; } },
    buy: k => { try { return buy(k); } catch (e) { console.error('[machines] buy', e); return false; } },
    isDriving: () => !!M().driving,
    setDriving: on => { try { return setDriving(on); } catch (e) { console.error('[machines] drive', e); return false; } },
    yieldBonus: () => { try { return effBonus(curDef()); } catch (e) { return 0; } },
    refuel: () => { try { return refuel(); } catch (e) { console.error(e); return false; } },
    repair: () => { try { return repair(); } catch (e) { console.error(e); return false; } },
    fuel: () => M().fuel,
    condition: k => cond(k || M().equipped),
    fuelPrice: fuelUnitPrice,
    refuelCost, repairCost, price, ensure
  };

  G.addModHook('yield', () => { try { return 1 + effBonus(curDef()); } catch (e) { return 1; } });
  G.bus.on('init', () => { try { ensure(); lastT = now(); } catch (e) { console.error(e); } });
  G.bus.on('state:reset', () => { try { ensure(); lastT = now(); warnedLow = false; } catch (e) { console.error(e); } });
  G.bus.on('tick', p => { try { onTick(p); } catch (e) { console.error('[machines] tick', e); } });

  // ---------- panel ----------
  const bar = (pct, cls) => `<div class="mc-bar ${cls || ''}"><i style="width:${clamp(pct, 0, 100).toFixed(1)}%"></i></div>`;
  function stat(label, val, pct, cls) {
    return `<div class="mc-stat"><span class="mc-sl">${label}</span>${bar(pct, cls)}<b class="mc-sv">${val}</b></div>`;
  }
  function hero() {
    const m = M(), d = curDef();
    if (!d) {
      return `<div class="mc-hero mc-empty"><div class="mc-big">🚜</div><h4>Your barn is tractor-less</h4>
        <p>Pick a ride from the showroom below. Even a rusty one boosts every harvest.</p></div>`;
    }
    const worn = isWorn(d.key), broken = isBroken(d.key), c = cond(d.key), eb = effBonus(d);
    const fuelCls = m.fuel < 15 ? 'low' : m.fuel < 35 ? 'mid' : '';
    const condCls = broken || c < LOW_COND ? 'low' : c < 55 ? 'mid' : '';
    const full = m.fuel >= 99.5, rc = refuelCost(), pc = repairCost(d.key), perfect = c >= 99.5;
    const rcb = full ? `<button class="btn btn-gray sm off" data-act="pact" data-pa="refuel" aria-disabled="true" data-why="Tank is already full">⛽ Full</button>`
      : `<button class="btn btn-gold sm ${G.state.coins < rc ? 'off' : ''}" data-act="pact" data-pa="refuel" ${G.state.coins < rc ? `aria-disabled="true" data-why="Need ${rc} coins for diesel"` : ''}>⛽ Refuel 🪙${rc}</button>`;
    const rpb = perfect ? `<button class="btn btn-gray sm off" data-act="pact" data-pa="repair" aria-disabled="true" data-why="Already in mint shape">🔧 Mint</button>`
      : `<button class="btn btn-blue sm ${G.state.coins < pc ? 'off' : ''}" data-act="pact" data-pa="repair" ${G.state.coins < pc ? `aria-disabled="true" data-why="Need ${pc} coins for repairs"` : ''}>🔧 Repair 🪙${pc}</button>`;
    const blocked = (m.fuel <= 0.01 || broken) && !m.driving;
    const why = broken ? 'Repair the tractor first' : 'Refuel the tractor first';
    const drive = m.driving
      ? `<button class="btn btn-red mc-drive" data-act="pact" data-pa="walk">🚶 Park it: walk</button>`
      : `<button class="btn btn-green mc-drive ${blocked ? 'off' : ''}" data-act="pact" data-pa="drive" ${blocked ? `aria-disabled="true" data-why="${why}"` : ''}>🚜 Drive!</button>`;
    return `<div class="mc-hero ${m.driving ? 'driving' : ''}" style="--mc:${esc(d.color)}">
      <div class="mc-badge">${m.driving ? '🟢 DRIVING' : 'PARKED'}</div>
      <div class="mc-big ${m.driving ? 'rumble' : ''}">${d.emoji}</div>
      <h4>${esc(d.name)}</h4><p class="mc-desc">${esc(d.desc)}</p>
      <div class="mc-stats">
        ${stat('🌾 Yield', '+' + Math.round(eb * 100) + '%' + (worn ? ' ⚠' : ''), eb / 0.4 * 100)}
        ${stat('💨 Speed', '×' + d.speed.toFixed(1), (d.speed - 1) / 1.6 * 100)}
        ${stat('⭕ Reach', d.radius ? d.radius + ' tile' + (d.radius > 1 ? 's' : '') : 'Solo', d.radius / 2 * 100)}
        <div class="mc-stat"><span class="mc-sl">🌱 Seeder</span><span class="mc-chip ${d.seeder ? 'yes' : ''}">${d.seeder ? 'Auto-plants!' : 'None'}</span></div>
      </div>
      <div class="mc-gauges">
        <div class="mc-g"><span>⛽ Fuel <b>${Math.round(m.fuel)}%</b></span>${bar(m.fuel, 'fuel ' + fuelCls)}<small>${d.fuelPerMin}/min when driving</small></div>
        <div class="mc-g"><span>🔧 Condition <b>${Math.round(c)}%</b></span>${bar(c, 'cond ' + condCls)}<small>${broken ? 'BROKEN DOWN' : worn ? 'Worn: bonus halved' : 'Running sweet'}</small></div>
      </div>
      <div class="mc-btns">${rcb}${rpb}</div>${drive}</div>`;
  }
  function showroom() {
    const m = M(), lvl = G.state.level || 1;
    return DEFS.map(d => {
      const own = m.owned.indexOf(d.key) >= 0, eq = m.equipped === d.key, locked = !own && lvl < d.level;
      const c = price(d.key), disc = discountActive() && !own;
      let act;
      if (eq) act = `<div class="mc-state eq">✅ Equipped</div>`;
      else if (own) act = `<button class="btn btn-green sm" data-act="pact" data-pa="equip" data-key="${d.key}">Equip</button>`;
      else if (locked) act = `<div class="lockpill">🔒 Level ${d.level}</div>`;
      else { const poor = G.state.coins < c; act = `<button class="btn btn-gold sm ${poor ? 'off' : ''}" data-act="pact" data-pa="buy" data-key="${d.key}" ${poor ? `aria-disabled="true" data-why="Need ${fmt(c)} coins"` : ''}>Buy ${disc ? `<s>${fmt(d.cost)}</s> ` : ''}🪙${fmt(c)}</button>`; }
      return `<div class="mc-car ${own ? 'own' : ''} ${eq ? 'eq' : ''} ${locked ? 'locked' : ''}" style="--mc:${esc(d.color)}">
        ${disc ? '<div class="mc-sale">SALE</div>' : ''}<div class="mc-ce">${d.emoji}</div><h5>${esc(d.name)}</h5>
        <div class="mc-cs"><span>🌾 +${Math.round(d.yieldBonus * 100)}%</span><span>💨 ×${d.speed.toFixed(1)}</span><span>⭕ ${d.radius || '–'}</span><span>${d.seeder ? '🌱 Seeder' : '·'}</span></div>
        <p>${esc(d.desc)}</p>${act}</div>`;
    }).join('');
  }
  G.panels = G.panels || {};
  G.panels.machines = {
    live: true,
    title: () => '🚜 Tractor Shed',
    sub: () => { const sp = fuelMult() > 1; return 'Diesel today 🪙' + fuelUnitPrice().toFixed(2) + '/unit' + (sp ? ' 📈 price spike!' : ''); },
    render() {
      ensure();
      return `<div class="mc-wrap">${hero()}<div class="sub">🏪 Dealership showroom</div>
        <div class="hscroll mc-show">${showroom()}</div></div>`;
    },
    onAction(a, el) {
      try {
        const k = el && el.dataset && el.dataset.key;
        if (a === 'buy') buy(k); else if (a === 'equip') equip(k);
        else if (a === 'refuel') refuel(); else if (a === 'repair') repair();
        else if (a === 'drive') setDriving(true); else if (a === 'walk') setDriving(false);
      } catch (e) { console.error('[machines] action', e); }
    }
  };

  G.injectCSS('machines', `
.mc-hero{position:relative;border-radius:22px;padding:14px 14px 14px;text-align:center;background:linear-gradient(180deg,#fffdf5,#ffeec2);border:3px solid var(--mc,#e0bd72);box-shadow:var(--card-sh);overflow:hidden}
.mc-hero:before{content:"";position:absolute;inset:0 0 auto 0;height:70px;background:linear-gradient(var(--mc,#e0bd72),transparent);opacity:.28;pointer-events:none}
.mc-hero.driving{box-shadow:var(--card-sh),0 0 0 3px rgba(111,174,58,.45)}
.mc-badge{position:absolute;top:10px;left:10px;font-size:10px;font-weight:900;letter-spacing:.6px;padding:3px 8px;border-radius:99px;background:#f1e6c8;color:var(--ink2)}
.mc-hero.driving .mc-badge{background:#d6f2b8;color:#2e5a14}
.mc-big{font-size:64px;line-height:1.1;filter:drop-shadow(0 5px 3px rgba(60,35,5,.3))}
.mc-big.rumble{animation:mcrum .35s infinite}
@keyframes mcrum{0%,100%{transform:translate(0,0)}25%{transform:translate(1px,-2px)}75%{transform:translate(-1px,1px)}}
.mc-hero h4{margin:2px 0 0;font-size:17px;font-weight:900}
.mc-desc{margin:2px 0 8px;font-size:12px;color:var(--ink2);font-style:italic}
.mc-hero.mc-empty p{font-size:13px;color:var(--ink2);margin:4px 0 0}
.mc-stats{display:flex;flex-direction:column;gap:5px;text-align:left}
.mc-stat{display:grid;grid-template-columns:78px 1fr 70px;align-items:center;gap:8px;font-size:12px}
.mc-sl{font-weight:900;color:var(--ink2)}.mc-sv{text-align:right;font-size:12px}
.mc-bar{height:10px;border-radius:6px;background:rgba(90,60,20,.22);overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.2)}
.mc-bar i{display:block;height:100%;border-radius:6px;background:linear-gradient(#ffd45e,#f2a91c);transition:width .4s}
.mc-bar.fuel i{background:linear-gradient(#6cbcf0,#3b8fd0)}.mc-bar.cond i{background:linear-gradient(#9be86b,#56b02f)}
.mc-bar.mid i{background:linear-gradient(#ffd45e,#f2a91c)}.mc-bar.low i{background:linear-gradient(#f2705f,#d2402f)}
.mc-chip{grid-column:2/4;justify-self:start;font-size:11px;font-weight:900;padding:3px 9px;border-radius:99px;background:#eadfc4;color:var(--ink2)}
.mc-chip.yes{background:#d6f2b8;color:#2e5a14}
.mc-gauges{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;text-align:left}
.mc-g span{display:flex;justify-content:space-between;font-size:12px;font-weight:900;margin-bottom:3px}
.mc-g .mc-bar{height:14px}.mc-g small{display:block;font-size:10.5px;color:var(--ink2);margin-top:3px}
.mc-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
.mc-btns .btn{padding:0 6px;font-size:13px}
.mc-drive{width:100%;margin-top:9px}
.mc-show{padding-top:6px}
.mc-car{position:relative;flex:none;width:158px;scroll-snap-align:start;border-radius:20px;padding:10px;display:flex;flex-direction:column;gap:5px;text-align:center;background:linear-gradient(180deg,#fffdf5,#ffeec2);border:3px solid #e0bd72;box-shadow:var(--card-sh)}
.mc-car.own{border-color:var(--mc,#6fae3a)}.mc-car.eq{box-shadow:var(--card-sh),0 0 0 3px rgba(111,174,58,.45)}
.mc-car.locked{filter:grayscale(.7);opacity:.8}
.mc-ce{font-size:42px;line-height:1.1}.mc-car h5{margin:0;font-size:12.5px;font-weight:900;min-height:32px;display:flex;align-items:center;justify-content:center}
.mc-cs{display:grid;grid-template-columns:1fr 1fr;gap:2px 4px;font-size:10.5px;font-weight:900;color:var(--ink2)}
.mc-car p{margin:0;font-size:10.5px;color:var(--ink2);font-style:italic;flex:1;font-weight:700}
.mc-car .btn,.mc-car .lockpill,.mc-state{width:100%;padding:0 4px}
.mc-state{min-height:44px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;color:#2e5a14;background:#d6f2b8;border-radius:14px}
.mc-sale{position:absolute;top:-6px;right:-6px;background:var(--red,#d9533b);color:#fff;font-size:10px;font-weight:900;padding:3px 8px;border-radius:99px;transform:rotate(8deg);box-shadow:0 2px 0 rgba(0,0,0,.25)}
.mc-car s{opacity:.6;font-size:11px;margin-right:2px}
`);

  // ---------- events ----------
  function regEvents() {
    if (!G.Events || !G.Events.register) return;
    const owns = () => { const m = ensure(); return !!(m && m.equipped && m.owned.length); };
    G.Events.register({
      key: 'tractor_breakdown', name: 'Tractor Breakdown', emoji: '💥', kind: 'bad', seasons: ['summer', 'fall'], minLevel: 3, weight: 0.9, durationSec: 0,
      desc: 'Mid-harvest, your tractor sputters and dies.',
      requires: owns,
      onStart: () => {
        const m = ensure(), d = curDef(); if (!m || !d) return {};
        m.preBreak = { key: d.key, cond: cond(d.key) };
        m.condition[d.key] = 0;
        if (m.driving) setDriving(false);
        return {};
      },
      text: () => { const d = curDef(); return 'Right in the middle of harvest, your ' + (d ? d.name : 'tractor') + ' coughs black smoke and dies. Call the mobile mechanic, or grab a wrench and wing it?'; },
      choices: [
        {
          label: 'Call the mobile mechanic', cost: c => Math.round(U.clamp ? U.clamp(40 + (c.level || 1) * 12, 50, 260) : 100),
          desc: 'Pricey but guaranteed. Back to 60+% condition.',
          apply: c => {
            const m = ensure(), pb = m && m.preBreak, d = curDef(); if (!m || !d) return 'The mechanic shrugs and leaves.';
            m.condition[d.key] = Math.max(60, pb && pb.key === d.key ? pb.cond : 0); m.preBreak = null;
            try { G.addXP(4); } catch (e) { /* ignore */ }
            return 'The mechanic had it humming in ten minutes. Harvest rolls on.';
          }
        },
        {
          label: 'DIY with duct tape', cost: 0,
          desc: '50% chance you fix it for free, but it will be rougher. A flop delays your crops.',
          apply: c => {
            const m = ensure(), pb = m && m.preBreak, d = curDef(); if (!m || !d) return 'You fiddle with nothing.';
            const prev = pb && pb.key === d.key ? pb.cond : 50; m.preBreak = null;
            if (Math.random() < 0.5) { m.condition[d.key] = Math.max(25, prev - 15); try { G.addXP(8); } catch (e) { /* ignore */ } return 'Duct tape and prayer worked! It runs, but it is rattier than before.'; }
            try { G.affectPlots({ crops: 'all', fraction: 0.5, mode: 'delay', amount: 20 }); } catch (e) { /* ignore */ }
            return 'Wrong wrench, wrong bolt. The tractor stays dead and the harvest slips. Use Repair in the shed.';
          }
        }
      ]
    });
    G.Events.register({
      key: 'tractor_auction', name: "Neighbor's Farm Auction", emoji: '🔨', kind: 'good', seasons: ['spring', 'summer', 'fall', 'winter'], minLevel: 3, weight: 0.8, durationSec: 0,
      desc: 'A retiring neighbor is selling equipment cheap.',
      requires: () => { const m = ensure(); return !!m && !discountActive() && DEFS.some(d => m.owned.indexOf(d.key) < 0); },
      text: () => 'Old Gus down the road is retiring and auctioning his equipment. Bidders are thin. Show up and you could land a tractor at a bargain.',
      choices: [
        {
          label: 'Go bid on a tractor', cost: 40,
          desc: 'Pay a 40 coin bidder fee for 35% off your next tractor (10 minutes).',
          apply: c => { const m = ensure(); if (m) m.discount = { pct: 0.35, until: now() + 600000 }; return 'Paddle up! You won a 35% off voucher on your next tractor for 10 minutes.'; }
        },
        { label: 'Stay home', cost: 0, desc: 'Skip the auction.', apply: c => 'You stayed home. Gus sold the lot to a guy from Spokane.' }
      ]
    });
    G.Events.register({
      key: 'diesel_spike', name: 'Diesel Price Spike', emoji: '⛽', kind: 'bad', seasons: ['spring', 'summer', 'fall', 'winter'], minLevel: 3, weight: 0.8, durationSec: 180,
      desc: 'Pump prices jump across the Basin.',
      requires: () => { const m = ensure(); return !!m && m.owned.length > 0; },
      mods: {},
      onStart: c => {
        const m = ensure(); if (!m) return {};
        m.spike = { mult: Math.round((1.5 + Math.random() * 0.7) * 100) / 100, until: now() + 180000 };
        return {};
      },
      text: () => { const m = ensure(); return 'Diesel jumped to ' + (m && m.spike ? 'x' + m.spike.mult : 'sky-high') + ' normal at the Tri-Cities pumps. Refuel costs more for the next three minutes.'; }
    });
  }
  try { regEvents(); } catch (e) { console.error('[machines] events', e); }
  try { ensure(); } catch (e) { /* ignore */ }
})();
