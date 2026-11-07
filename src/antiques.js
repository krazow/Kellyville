/* antiques.js — Kellyville antique store: buy low, restore, sell high (G.Antiques, panel 'antiques').
   Roadside strip across County Rd 9. Costs real coins to build and run; smart play is clearly profitable. */
(function () {
  'use strict';
  const G = window.G;
  const U = G.util;

  const UNLOCK_LEVEL = 6, BUILD_COST = 1500, CAP = 4, OFFER_SEC = 75;
  const COND = ['poor', 'fair', 'good', 'mint'];
  const COND_MULT = [0.5, 1, 1.6, 2.5];
  const COND_EMOJI = ['🩹', '🔧', '✨', '💎'];
  const RESTORE_FEE = [0.10, 0.18, 0.30];     // fraction of baseValue to lift condition one step
  const RESTORE_SEC = [60, 120, 240];
  const TIERS = [
    { key: 'bargain', name: 'Bargain', emoji: '🏷️', mult: 0.9 },
    { key: 'fair', name: 'Fair', emoji: '⚖️', mult: 1.2 },
    { key: 'collector', name: 'Collector', emoji: '💎', mult: 1.6 }
  ];
  const PICKER_RATE = 0.6;
  const RARITY_W = { common: 1, uncommon: 2, rare: 3, legendary: 4 };
  const SEASON_TRAFFIC = { summer: 1.35, fall: 1.1, spring: 1.0, winter: 0.65 };

  // ---------- data ----------
  const A = (name, emoji, category, era, baseValue, rarity, desc, find) => ({ name, emoji, category, era, baseValue, rarity, desc, find: !!find });
  const ITEMS = {
    old_horseshoe: A('Old Iron Horseshoe', '🐴', 'farm', '1900s', 18, 'common', 'Turned up in a Palouse wheat field. Lucky side up.', 1),
    glass_bottle: A('Aqua Glass Bottle', '🍾', 'kitchen', '1890s', 22, 'common', 'Hand-blown, with bubbles in the glass and a lip from a Spokane bottling works.', 1),
    hand_plane: A('Carpenter\'s Hand Plane', '🛠️', 'farm', '1920s', 30, 'common', 'Beech body, iron blade. Built a thousand barn doors.', 1),
    mason_jars: A('Blue Mason Jar Collection', '🥫', 'kitchen', '1910s', 45, 'common', 'A dozen sky-blue canning jars from a Walla Walla pantry.', 1),
    washboard: A('Wooden Washboard', '🧺', 'farm', '1920s', 38, 'common', 'Scrubbed many a harvest shirt.'),
    skillet: A('Cast-Iron Skillet', '🍳', 'kitchen', '1930s', 55, 'common', 'Seasoned by three generations of Ritzville cooks.'),
    brass_cowbell: A('Brass Cowbell', '🔔', 'farm', '1930s', 60, 'common', 'Still rings clear across the pasture.'),
    milk_cans: A('Galvanized Milk Cans', '🥛', 'farm', '1940s', 70, 'common', 'A pair of dairy cans, dented in all the right places.'),
    apple_labels: A('Apple-Crate Label Set', '🍎', 'decor', '1940s', 55, 'common', 'Colorful Wenatchee orchard crate labels, never used.'),
    candy_dish: A('Depression-Glass Candy Dish', '🍬', 'kitchen', '1930s', 65, 'common', 'Pink glass that catches the afternoon sun.'),
    kerosene_lamp: A('Kerosene Lamp', '🪔', 'light', '1900s', 75, 'common', 'Hurricane glass, brass burner. Lit the farmhouse before the power lines came.'),
    tin_sign: A('Grain-Elevator Tin Sign', '🪧', 'decor', '1940s', 90, 'uncommon', 'Embossed tin from a Palouse grain elevator.'),
    tractor_seat: A('Cast-Iron Tractor Seat', '🚜', 'farm', '1930s', 95, 'uncommon', 'Perforated seat, perfectly pitted. Makes a fine bar stool.'),
    expo_souvenir: A('Expo \'74 World\'s Fair Souvenir', '🎡', 'souvenir', '1974', 100, 'uncommon', 'A Spokane World\'s Fair keepsake from the riverfront fair.'),
    butter_churn: A('Hand-Crank Butter Churn', '🧈', 'farm', '1910s', 110, 'uncommon', 'Glass jar, wooden paddles, a story in every turn.'),
    feed_sack_dress: A('Feed-Sack Dress', '👗', 'textile', '1940s', 120, 'uncommon', 'Sewn from printed flour sacking by a thrifty rancher\'s wife.'),
    railroad_lantern: A('Railroad Lantern', '🏮', 'light', '1920s', 130, 'uncommon', 'Swung from the caboose on the old Palouse line.'),
    wagon_wheel: A('Palouse Barn-Find Wagon Wheel', '⚙️', 'western', '1890s', 140, 'uncommon', 'Iron-rimmed oak, found leaning in a barn loft.'),
    camp_blanket: A('Wool Camp Blanket', '🧣', 'textile', '1930s', 140, 'uncommon', 'Heavy striped wool that has outlasted six winters on the Palouse.'),
    rotary_phone: A('Rotary Telephone', '☎️', 'tech', '1950s', 150, 'uncommon', 'Heavy black bakelite. Still has the party-line sticker.'),
    quilt: A('Hand-Stitched Quilt', '🛏️', 'textile', '1930s', 160, 'uncommon', 'Wedding-ring pattern, a thousand tiny stitches.'),
    typewriter: A('Manual Typewriter', '⌨️', 'tech', '1940s', 170, 'uncommon', 'Round glass keys, satisfying clack.'),
    film_camera: A('Folding Film Camera', '📷', 'tech', '1930s', 210, 'rare', 'Bellows camera with a leather case, from a small-town portrait studio.'),
    pocket_watch: A('Railroad Pocket Watch', '⏱️', 'tech', '1910s', 240, 'rare', 'Gold-filled case, runs a minute a week fast.'),
    cream_separator: A('Hand-Crank Cream Separator', '⚗️', 'farm', '1920s', 260, 'rare', 'Spinning discs and a bright red crank. A true dairy-farm relic.'),
    steamer_trunk: A('Steamer Trunk', '🧳', 'furniture', '1900s', 280, 'rare', 'Brass corners and a Seattle shipping label.'),
    oak_icebox: A('Oak Icebox', '🧊', 'furniture', '1910s', 320, 'rare', 'Quarter-sawn oak with zinc lining and original hardware.'),
    gramophone: A('Crank Gramophone', '📯', 'music', '1910s', 350, 'rare', 'Brass horn, hand crank, a stack of shellac records.'),
    cowboy_saddle: A('Cowboy Saddle', '🤠', 'western', '1920s', 420, 'rare', 'Hand-tooled leather, worn smooth by an Okanogan wrangler.'),
    rodeo_buckle: A('Silver Rodeo Buckle', '🏆', 'western', '1950s', 700, 'legendary', 'Engraved with the winner\'s name at the Ellensburg rodeo.'),
    carousel_horse: A('Painted Carousel Horse', '🎠', 'decor', '1920s', 800, 'legendary', 'Carved from basswood, rescued from a Spokane park carousel.'),
    strongbox: A('Gold-Rush Strongbox', '🔐', 'western', '1880s', 900, 'legendary', 'Riveted iron, a stagecoach company stencil, and the key still works.'),
    reed_organ: A('Parlor Reed Organ', '🎹', 'music', '1890s', 1100, 'legendary', 'Pump pedals, carved walnut, and still plays hymns.')
  };
  G.DATA = G.DATA || {};
  G.DATA.antiques = ITEMS;
  const KEYS = Object.keys(ITEMS);

  // category fondness by shopper type
  const TYPES = [
    { id: 'collector', emoji: '🧐', name: 'Collector', w: 2, max: [1.5, 1.95], aff: { _: 0.7 }, rar: { common: 0.4, uncommon: 1, rare: 2.2, legendary: 3 },
      lines: ['Now THAT is a provenance.', 'I have been hunting one of these for years.', 'Condition is everything.'] },
    { id: 'picker', emoji: '🚐', name: 'Picker', w: 2, max: [0.85, 1.15], aff: { _: 1 }, cheap: true,
      lines: ['I can flip this in Seattle.', 'Cash, no haggling games.', 'Margins are thin, friend.'] },
    { id: 'designer', emoji: '🎨', name: 'Interior designer', w: 1.5, max: [1.4, 1.9], aff: { decor: 2, furniture: 2, light: 1.6, textile: 1.5, music: 1.2, _: 0.4 },
      lines: ['This will anchor the whole room.', 'My client in Medina will adore it.', 'Rustic is very in right now.'] },
    { id: 'tourist', emoji: '📸', name: 'Seattle tourist', w: 2, max: [1.3, 1.8], aff: { souvenir: 2, decor: 1.5, kitchen: 1.4, western: 1.4, textile: 1.1, _: 0.6 },
      lines: ['We do NOT have this in Seattle.', 'Wine country gets better and better.', 'Will it fit in the Subaru?'] },
    { id: 'rancher', emoji: '🤠', name: 'Local rancher', w: 1.8, max: [1.1, 1.5], aff: { farm: 2, western: 2, light: 1.4, kitchen: 1.2, _: 0.4 },
      lines: ['My granddad had one just like it.', 'Fair price for a fair piece.', 'This belongs on a working farm.'] }
  ];
  const TYPE_BY = {}; TYPES.forEach(t => { TYPE_BY[t.id] = t; });

  const SOURCES = [
    { id: 'estate', emoji: '🏡', name: 'Walla Walla estate sale', n: [3, 4], disc: [0.72, 1.2], cond: [0.1, 0.35, 0.4, 0.15], rar: { common: 1, uncommon: 2, rare: 2.5, legendary: 0.3 }, cats: { furniture: 2, decor: 2, textile: 1.6, music: 2, kitchen: 1 }, blurb: 'Fine furniture and tidy estates' },
    { id: 'auction', emoji: '🔨', name: 'Ritzville farm auction', n: [3, 4], disc: [0.55, 1.25], cond: [0.35, 0.4, 0.2, 0.05], rar: { common: 1.5, uncommon: 2, rare: 1.2, legendary: 0.1 }, cats: { farm: 2.5, western: 2, light: 1.5 }, blurb: 'Wild prices on farm iron' },
    { id: 'flea', emoji: '🛍️', name: 'Spokane flea market', n: [4, 5], disc: [0.75, 1.25], cond: [0.2, 0.4, 0.3, 0.1], rar: { common: 2, uncommon: 2, rare: 1, legendary: 0.12 }, cats: {}, blurb: 'A bit of everything' },
    { id: 'yard', emoji: '🏷️', name: 'Moscow-Pullman yard sale', n: [3, 4], disc: [0.4, 0.95], cond: [0.5, 0.35, 0.13, 0.02], rar: { common: 3, uncommon: 1, rare: 0.15, legendary: 0 }, cats: {}, blurb: 'Cheap finds, rough shape' }
  ];
  const BARN = { id: 'barn', emoji: '🏚️', name: 'Barn find tip', disc: [0.2, 0.5], cond: [0.55, 0.45, 0, 0], rar: { common: 0, uncommon: 2, rare: 2, legendary: 0.35 }, blurb: 'A neighbor\'s tip, one day only' };
  const SRC_BY = {}; SOURCES.concat([BARN]).forEach(s => { SRC_BY[s.id] = s; });

  const UPGRADES = {
    shelves: { name: 'Window shelving', emoji: '🪟', cost: 350, desc: '+2 display slots and 6 more storage spots.' },
    workshop: { name: 'Restoration workshop', emoji: '🔧', cost: 600, desc: 'Restore items one condition step at a time. Doubles an item\'s value over two steps.' },
    appraiser: { name: 'Appraiser\'s loupe', emoji: '🔍', cost: 750, desc: 'Reveals true value ranges, spots deals and overpriced junk, and reads buyers\' budgets.' },
    porch: { name: 'Front porch', emoji: '🪑', cost: 500, desc: '+1 display slot and +25% foot traffic.' },
    neonSign: { name: 'Neon OPEN sign', emoji: '💡', cost: 450, desc: 'Evening shoppers keep coming after sunset.' },
    secondFloor: { name: 'Second floor gallery', emoji: '🏛️', cost: 2200, requires: ['shelves', 'porch'], desc: '+1 display slot, a second workbench, +10 storage and more serious buyers.' }
  };
  const UP_ORDER = ['shelves', 'workshop', 'appraiser', 'porch', 'neonSign', 'secondFloor'];

  // ---------- state ----------
  let customers = [], feed = [], lastT = 0;
  let ui = { tab: 'floor', editName: false, armed: null, pickSlot: false, filter: 'all' };
  const feedPush = (emoji, text, kind) => { feed.unshift({ id: U.uid(), emoji, text, kind: kind || '', t: U.now() }); if (feed.length > 8) feed.length = 8; };
  const clean = n => String(n == null ? '' : n).replace(/[<>&"`\\\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 28);
  const defaultName = () => (G.playerName ? G.playerName() : 'Farmer') + "'s Antiques";
  const calOf = () => { try { return G.calendar(); } catch (e) { return { day: 1, season: 'spring', dayProgress: 0.3 }; } };
  const isDay = cal => cal.dayProgress >= 0.05 && cal.dayProgress <= 0.8;
  const isEve = cal => cal.dayProgress > 0.8 && cal.dayProgress <= 0.95;

  function ensure() {
    const gs = G.state; if (!gs) return null;
    let s = gs.antiques;
    if (!s || typeof s !== 'object') s = gs.antiques = {};
    if (typeof s.built !== 'boolean') s.built = false;
    s.name = clean(s.name);
    if (!s.up || typeof s.up !== 'object') s.up = {};
    UP_ORDER.forEach(k => { s.up[k] = !!s.up[k]; });
    if (!Array.isArray(s.inv)) s.inv = [];
    s.inv = s.inv.filter(x => x && ITEMS[x.key]);
    s.inv.forEach(x => {
      x.id = x.id || U.uid(); x.cond = U.clamp(Math.floor(+x.cond) || 0, 0, 3); x.paid = Math.max(0, +x.paid || 0);
      x.invested = Math.max(0, +x.invested || x.paid || 0); x.disp = !!x.disp;
      if (x.rest && !(+x.rest.endAt > 0)) x.rest = null;
    });
    if (!Array.isArray(s.offers)) s.offers = [];
    if (!s.listings || typeof s.listings !== 'object') s.listings = { day: 0, list: [] };
    if (!Array.isArray(s.listings.list)) s.listings.list = [];
    s.tier = U.clamp(Math.floor(s.tier == null ? 1 : s.tier) || 0, 0, 2);
    s.rep = isFinite(+s.rep) && +s.rep > 0 ? U.clamp(+s.rep, 1, 5) : 2.5;
    if (!s.stats || typeof s.stats !== 'object') s.stats = {};
    ['spent', 'restoreSpent', 'upgradeSpent', 'revenue', 'sales', 'profit', 'finds', 'picker'].forEach(k => { s.stats[k] = +s.stats[k] || 0; });
    if (!s.daily || typeof s.daily !== 'object') s.daily = { day: 0, coins: 0, sales: 0 };
    ['day', 'coins', 'sales'].forEach(k => { s.daily[k] = +s.daily[k] || 0; });
    ['boostUntil', 'slumpUntil', 'buzzUntil'].forEach(k => { s[k] = +s[k] || 0; });
    return s;
  }
  const S = () => ensure() || { built: false, up: {}, inv: [], offers: [], listings: { day: 0, list: [] }, tier: 1, rep: 2.5, stats: {}, daily: {} };
  const isBuilt = () => !!S().built;
  const nameOf = s => s.name || defaultName();

  const slotCount = () => { const u = S().up; return U.clamp(2 + (u.shelves ? 2 : 0) + (u.porch ? 1 : 0) + (u.secondFloor ? 1 : 0), 2, 6); };
  const storeLevel = () => { const u = S().up; return u.secondFloor ? 3 : (u.shelves || u.porch ? 2 : 1); };
  const invCap = () => { const u = S().up; return 14 + (u.shelves ? 6 : 0) + (u.secondFloor ? 10 : 0); };
  const benches = () => 1 + (S().up.secondFloor ? 1 : 0);

  function emitStructural() {
    try { G.bus.emit('antiques:change'); G.bus.emit('change'); G.save(); } catch (e) { console.error('[antiques] emit', e); }
  }

  // ---------- values ----------
  function hash01(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10007) / 10007; }
  function drift(key) { return 1 + 0.09 * Math.sin(calOf().day * 0.8 + hash01(key) * 6.28); }
  function boost() { const s = S(); return U.now() < s.boostUntil ? 1.2 : 1; }
  const baseOf = key => (ITEMS[key] || {}).baseValue || 1;
  function valueAt(key, cond) { return Math.max(1, Math.round(baseOf(key) * COND_MULT[U.clamp(cond, 0, 3)] * drift(key))); }
  function valueOf(it) { return Math.max(1, Math.round(valueAt(it.key, it.cond) * boost())); }
  const askOf = it => Math.max(1, Math.round(valueOf(it) * TIERS[S().tier].mult));
  function estimate(it, noise) {
    const v = valueOf(it), appr = S().up.appraiser;
    const c = appr ? 1 : 1 + (noise || 0), w = appr ? 0.07 : 0.3;
    return [Math.max(1, Math.round(v * c * (1 - w))), Math.max(1, Math.round(v * c * (1 + w)))];
  }
  const noiseOf = id => (hash01(String(id)) - 0.5) * 0.4;
  const restoreFee = it => Math.round(baseOf(it.key) * RESTORE_FEE[it.cond]);
  const restoreTime = it => RESTORE_SEC[it.cond];

  // ---------- listings ----------
  function wpick(obj) { const ks = Object.keys(obj); return U.weightedPick(ks, k => obj[k]); }
  function genListings(day) {
    const s = S(), list = [];
    const mk = (src, cond) => {
      const pool = KEYS.filter(k => (src.rar[ITEMS[k].rarity] || 0) > 0);
      const key = U.weightedPick(pool, k => (src.rar[ITEMS[k].rarity] || 0) * ((src.cats && src.cats[ITEMS[k].category]) || (src.cats && Object.keys(src.cats).length ? 0.5 : 1)));
      if (!key) return null;
      const c = cond != null ? cond : U.weightedPick([0, 1, 2, 3], i => src.cond[i]);
      const disc = U.rand(src.disc[0], src.disc[1]);
      const id = U.uid();
      return { id, src: src.id, key, cond: c, price: Math.max(1, Math.round(valueAt(key, c) * disc)), noise: noiseOf(id), sold: false };
    };
    SOURCES.forEach(src => { const n = U.randInt(src.n[0], src.n[1]); for (let i = 0; i < n; i++) { const l = mk(src); if (l) list.push(l); } });
    if (Math.random() < 0.45) { const l = mk(BARN); if (l) list.push(l); }
    s.listings = { day, list };
  }
  function ensureListings() { const s = S(), d = calOf().day; if (s.built && s.listings.day !== d) genListings(d); }
  function listings() { ensureListings(); return S().listings.list.filter(l => !l.sold).map(l => Object.assign({}, l)); }
  const dealRatio = l => l.price / Math.max(1, valueAt(l.key, l.cond) * boost());

  function buyListing(id) {
    const s = S(); if (!s.built) return false; ensureListings();
    const l = s.listings.list.find(x => x.id === id && !x.sold); if (!l) { G.toast('Sold already', 'bad'); return false; }
    if (s.inv.length >= invCap()) { G.toast('Storage full. Sell or display something first.', 'bad'); return false; }
    if (!G.spend(l.price)) return false;
    l.sold = true;
    s.inv.push({ id: U.uid(), key: l.key, cond: l.cond, paid: l.price, invested: l.price, disp: false, rest: null });
    s.stats.spent += l.price;
    const it = ITEMS[l.key];
    G.toast(`${it.emoji} Bought ${it.name} (${COND[l.cond]}) for 🪙 ${l.price}`, 'good');
    G.bus.emit('antiques:bought', { key: l.key, price: l.price });
    G.bus.emit('change'); G.save();
    return true;
  }

  // ---------- inventory / display ----------
  const find = id => S().inv.find(x => x.id === id);
  const displayed = () => S().inv.filter(x => x.disp && !x.rest);
  function setDisplay(id, on) {
    const s = S(), it = find(id); if (!it) return false;
    if (on) {
      if (it.rest) { G.toast('That piece is in the workshop', 'bad'); return false; }
      if (it.disp) return true;
      if (displayed().length >= slotCount()) { G.toast('Display is full. Remove something first.', 'bad'); return false; }
      it.disp = true;
    } else {
      if (!it.disp) return true;
      it.disp = false;
      s.offers = s.offers.filter(o => o.invId !== id);
    }
    emitStructural(); return true;
  }
  function removeItem(it) {
    const s = S(); const was = it.disp;
    s.inv = s.inv.filter(x => x !== it);
    s.offers = s.offers.filter(o => o.invId !== it.id);
    customers.forEach(c => { if (c.target === it.id && !c.decided) c.target = null; });
    return was;
  }
  function recordSale(it, price, label) {
    const s = S(), cal = calOf();
    const profit = price - it.invested;
    s.stats.revenue += price; s.stats.sales++; s.stats.profit += profit;
    if (s.daily.day !== cal.day) s.daily = { day: cal.day, coins: 0, sales: 0 };
    s.daily.coins += price; s.daily.sales++;
    G.addCoins(price, 'antiques');
    G.bus.emit('antiques:sale', { key: it.key, coins: price, profit, who: label });
    return profit;
  }
  function quickSell(id) {
    const s = S(); const it = find(id); if (!it || !s.built) return false;
    if (it.rest) { G.toast('That piece is in the workshop', 'bad'); return false; }
    const price = Math.max(1, Math.round(valueOf(it) * PICKER_RATE));
    const wasDisp = removeItem(it);
    s.stats.picker++; recordSale(it, price, 'picker');
    G.toast(`🚐 The picker paid 🪙 ${price} for your ${ITEMS[it.key].name}`, 'good');
    if (wasDisp) emitStructural(); else G.bus.emit('change');
    return true;
  }

  // ---------- workshop ----------
  function restore(id) {
    const s = S(), it = find(id); if (!it || !s.built) return false;
    if (!s.up.workshop) { G.toast('Build the restoration workshop first', 'bad'); return false; }
    if (it.rest) return false;
    if (it.cond >= 3) { G.toast('Already in mint condition', 'bad'); return false; }
    if (s.inv.filter(x => x.rest).length >= benches()) { G.toast('All workbenches are busy', 'bad'); return false; }
    const fee = restoreFee(it);
    if (!G.spend(fee)) return false;
    const now = U.now(), sec = restoreTime(it);
    it.rest = { startAt: now, endAt: now + sec * 1000 };
    it.invested += fee; s.stats.restoreSpent += fee;
    if (it.disp) { it.disp = false; s.offers = s.offers.filter(o => o.invId !== id); emitStructural(); } else G.bus.emit('change');
    G.toast(`🔧 Restoring ${ITEMS[it.key].name} (${fee} coins, ${Math.round(sec / 60 * 10) / 10} min)`, 'info');
    return true;
  }
  function finishRestores(now) {
    const s = S(); let done = false;
    s.inv.forEach(it => {
      if (it.rest && now >= it.rest.endAt) {
        it.rest = null; it.cond = Math.min(3, it.cond + 1); done = true;
        G.toast(`✨ ${ITEMS[it.key].name} restored to ${COND[it.cond]}!`, 'good');
        feedPush('🔧', `${ITEMS[it.key].name} is now ${COND[it.cond]}.`, 'coin');
      }
    });
    if (done) G.bus.emit('change');
  }

  // ---------- upgrades / build ----------
  function build(name) {
    const s = ensure();
    if (!s || s.built) return false;
    if ((G.state.level || 1) < UNLOCK_LEVEL) { G.toast(`Antique store unlocks at level ${UNLOCK_LEVEL}`, 'bad'); return false; }
    if (!G.spend(BUILD_COST)) return false;
    s.built = true; s.name = clean(name); s.rep = 2.5; s.listings = { day: 0, list: [] };
    customers = []; feed = []; ui.tab = 'floor';
    genListings(calOf().day);
    G.bus.emit('antiques:built');
    emitStructural();
    try {
      G.showModal({ emoji: '🏺', title: 'Grand opening!', text: `${nameOf(s)} is open on County Rd 9. Buy low at the sales, restore the good ones, and watch the collectors roll in.`, kind: 'good', confetti: true, buttons: [{ label: 'Let\'s go treasure hunting', cls: 'btn-gold' }] });
    } catch (e) { }
    return true;
  }
  function setName(n) { const c = clean(n); if (!c) return false; S().name = c; emitStructural(); return true; }
  function upgrade(key) {
    const s = S(), u = UPGRADES[key]; if (!u || !s.built) return false;
    if (s.up[key]) return false;
    const miss = (u.requires || []).filter(r => !s.up[r]);
    if (miss.length) { G.toast('Buy the ' + miss.map(m => UPGRADES[m].name).join(' & ') + ' first', 'bad'); return false; }
    if (!G.spend(u.cost)) return false;
    s.up[key] = true; s.stats.upgradeSpent += u.cost;
    G.toast(`${u.emoji} ${u.name} added!`, 'good');
    G.bus.emit('antiques:upgrade', { key }); emitStructural(); return true;
  }
  function setTier(i) { const s = S(); i = U.clamp(Math.floor(+i) || 0, 0, 2); if (s.tier === i) return true; s.tier = i; G.bus.emit('change'); return true; }

  // ---------- offers ----------
  function acceptOffer(id) {
    const s = S(); const o = s.offers.find(x => x.id === id); if (!o) return false;
    const it = find(o.invId); s.offers = s.offers.filter(x => x !== o);
    if (!it) return false;
    const wasDisp = removeItem(it);
    const profit = recordSale(it, o.amount, o.type);
    s.rep = U.clamp(s.rep + 0.04, 1, 5);
    const nm = ITEMS[it.key].name;
    feedPush('💰', `Sold ${nm} for ${o.amount} (${profit >= 0 ? '+' : ''}${profit} profit)`, 'coin');
    G.toast(`💰 Sold ${nm} for 🪙 ${o.amount}`, 'good');
    if (wasDisp) emitStructural(); else G.bus.emit('change');
    return true;
  }
  function declineOffer(id) {
    const s = S(); const o = s.offers.find(x => x.id === id); if (!o) return false;
    s.offers = s.offers.filter(x => x !== o); feedPush(o.emoji, 'Maybe next time then.', 'sad'); G.bus.emit('change'); return true;
  }
  // x = how much more than their offer you ask for (0.1, 0.25, 0.5)
  function counterChance(o, x) {
    const slack = o.max / Math.max(1, o.amount) - 1;
    let p = x <= slack * 0.6 ? 0.95 : 0.95 - (x - slack * 0.6) * 2.6;
    p *= 0.9 + 0.04 * S().rep;
    return U.clamp(p, 0.03, 0.97);
  }
  function counterOffer(id, x) {
    const s = S(); const o = s.offers.find(y => y.id === id); if (!o) return false;
    x = +x; if (!(x > 0)) return acceptOffer(id);
    const it = find(o.invId);
    s.offers = s.offers.filter(y => y !== o);
    if (!it) return false;
    if (Math.random() < counterChance(o, x)) {
      const amt = Math.round(o.amount * (1 + x));
      const wasDisp = removeItem(it);
      const profit = recordSale(it, amt, o.type);
      s.rep = U.clamp(s.rep + 0.05, 1, 5);
      feedPush('🤝', `Haggled ${ITEMS[it.key].name} up to ${amt} (${profit >= 0 ? '+' : ''}${profit})`, 'coin');
      G.toast(`🤝 Counter accepted: 🪙 ${amt}!`, 'good');
      if (wasDisp) emitStructural(); else G.bus.emit('change');
      return true;
    }
    s.rep = U.clamp(s.rep - 0.04, 1, 5);
    feedPush(o.emoji, 'Too rich for me. Forget it.', 'sad');
    G.toast('😬 The buyer walked off', 'bad');
    G.bus.emit('change'); return false;
  }

  // ---------- shoppers ----------
  function trafficRate(now, cal, withEvents) {
    const s = S(), u = s.up, dn = displayed().length;
    let r = (1 / 15) * (0.5 + 0.22 * s.rep);
    if (u.porch) r *= 1.25;
    if (u.secondFloor) r *= 1.15;
    r *= SEASON_TRAFFIC[cal.season] || 1;
    r *= 0.6 + 0.2 * Math.min(dn, 6);
    if (withEvents) {
      let ev = []; try { ev = (G.Events && G.Events.active) ? G.Events.active() : []; } catch (e) { }
      if (ev.some(e => e && e.key === 'appraisal_fair')) r *= 1.4;
      if (now < s.buzzUntil) r *= 1.6;
      if (now < s.slumpUntil) r *= 0.6;
    }
    return r;
  }
  function spawn(now) {
    const type = U.weightedPick(TYPES, t => t.w + (t.id === 'collector' && S().up.secondFloor ? 1 : 0));
    const c = { id: U.uid(), type, emoji: type.emoji, phase: 'arriving', start: now, dur: U.rand(4, 7) * 1000, mood: undefined, target: null, decided: false };
    customers.push(c); return c;
  }
  function affinity(type, it) {
    const d = ITEMS[it.key];
    let a = type.aff[d.category] != null ? type.aff[d.category] : (type.aff._ != null ? type.aff._ : 0.6);
    if (type.rar) a *= type.rar[d.rarity] || 1;
    if (type.cheap) a *= 1 / Math.sqrt(Math.max(1, valueOf(it)) / 60);
    return a;
  }
  function decide(c) {
    const s = S(), type = c.type;
    const pool = displayed();
    if (!pool.length) { c.mood = 'sad'; return; }
    const it = U.weightedPick(pool, x => affinity(type, x));
    if (!it) { c.mood = 'sad'; return; }
    c.target = it.id;
    const aff = affinity(type, it);
    const nm = ITEMS[it.key].name;
    if (Math.random() > U.clamp(0.4 + 0.45 * Math.min(aff, 1.6), 0.2, 0.95)) { c.mood = 'meh'; feedPush(c.emoji, U.pick(['Nothing here is calling to me.', 'Just browsing today.', 'Not quite my thing.']), 'meh'); return; }
    const willing = U.rand(type.max[0], type.max[1]) * (0.85 + 0.06 * s.rep) * U.clamp(0.85 + 0.15 * aff, 0.8, 1.15);
    const P = TIERS[s.tier].mult, val = valueOf(it);
    if (P <= willing * 0.9) {
      if (Math.random() < 0.88) {
        const price = askOf(it);
        const wasDisp = removeItem(it); const profit = recordSale(it, price, type.id);
        s.rep = U.clamp(s.rep + (s.tier === 0 ? 0.03 : 0.05), 1, 5);
        c.mood = 'happy'; c.coins = price;
        feedPush(c.emoji, `${U.pick(type.lines)} Bought ${nm} for ${price} (${profit >= 0 ? '+' : ''}${profit}).`, 'coin');
        if (wasDisp) emitStructural();
      } else { c.mood = 'meh'; feedPush(c.emoji, 'Let me think about it...', 'meh'); }
    } else if (P <= willing * 1.5) {
      if (Math.random() < 0.85 && s.offers.length < 4 && !s.offers.some(o => o.invId === it.id)) {
        const max = Math.round(val * willing), amt = Math.max(1, Math.round(val * willing * U.rand(0.82, 0.93)));
        if (amt >= askOf(it)) { c.mood = 'meh'; return; }
        const now = U.now();
        s.offers.push({ id: U.uid(), invId: it.id, type: type.id, emoji: c.emoji, who: type.name, amount: amt, max, startAt: now, endAt: now + OFFER_SEC * 1000 });
        c.mood = 'happy';
        feedPush(c.emoji, `${U.pick(type.lines)} Offering ${amt} for ${nm}.`, 'offer');
        try { G.toast(`💰 ${type.name} offers 🪙 ${amt} for ${nm}`, 'info'); } catch (e) { }
      } else { c.mood = 'meh'; }
    } else {
      c.mood = 'sad'; s.rep = U.clamp(s.rep - 0.01, 1, 5);
      feedPush(c.emoji, U.pick(['Whoa, that price tag!', 'Way beyond my budget.', 'I can get it cheaper in Spokane.']), 'sad');
    }
  }
  function advance(c, now) {
    let guard = 0;
    while (now - c.start >= c.dur && guard++ < 4) {
      const at = c.start + c.dur;
      if (c.phase === 'arriving') c.phase = 'browsing';
      else if (c.phase === 'browsing') { c.phase = 'leaving'; if (!c.decided) { c.decided = true; decide(c); } }
      else { c.phase = 'gone'; return; }
      c.start = at; c.dur = U.rand(3, 6) * 1000;
    }
  }
  function expireOffers(now) {
    const s = S(), n = s.offers.length;
    s.offers = s.offers.filter(o => {
      if (!find(o.invId) || !find(o.invId).disp) return false;
      if (now >= o.endAt) { feedPush(o.emoji, 'Gave up waiting and left.', 'sad'); return false; }
      return true;
    });
    return n !== s.offers.length;
  }
  function onTick(p) {
    const s = ensure(); if (!s || !s.built) { lastT = 0; return; }
    const now = (p && p.now) || U.now(), cal = (p && p.cal) || calOf();
    const dt = lastT ? Math.min(2, Math.max(0, (now - lastT) / 1000)) : 0.5;
    lastT = now;
    ensureListings();
    finishRestores(now);
    if (expireOffers(now)) G.bus.emit('change');
    customers.forEach(c => advance(c, now));
    customers = customers.filter(c => c.phase !== 'gone');
    const open = isDay(cal) || (s.up.neonSign && isEve(cal));
    if (open && displayed().length && customers.length < CAP) {
      let r = trafficRate(now, cal, true);
      if (!isDay(cal)) r *= 0.5;
      if (Math.random() < r * dt) spawn(now);
    }
  }

  // ---------- farm finds ----------
  function onHarvest() {
    const s = ensure(); if (!s || !s.built) return;
    if (Math.random() > 0.04) return;
    if (s.inv.length >= invCap()) return;
    const key = U.pick(KEYS.filter(k => ITEMS[k].find));
    const cond = Math.random() < 0.6 ? 0 : 1;
    s.inv.push({ id: U.uid(), key, cond, paid: 0, invested: 0, disp: false, rest: null });
    s.stats.finds++;
    G.toast(`${ITEMS[key].emoji} Dug up an ${ITEMS[key].name.toLowerCase()} while harvesting! Added to your antique collection.`, 'good');
    G.bus.emit('antiques:find', { key });
    G.bus.emit('change');
  }

  // ---------- events ----------
  function reg() {
    if (!G.Events || !G.Events.register) return;
    const built = () => { try { return isBuilt(); } catch (e) { return false; } };
    const ALL = ['spring', 'summer', 'fall', 'winter'];
    G.Events.register({
      key: 'appraisal_fair', name: 'Appraisal fair in Spokane', emoji: '🏛️', kind: 'good', seasons: ALL, minLevel: UNLOCK_LEVEL, weight: 0.8, durationSec: 150, requires: built,
      desc: 'Antique values and foot traffic are up for a couple of minutes.',
      onStart() { const s = ensure(); s.boostUntil = U.now() + 150000; s.rep = U.clamp(s.rep + 0.15, 1, 5); return {}; },
      text: () => 'A big appraisal fair in Spokane has everyone hunting for treasure. Antique values are up 20% and extra shoppers are heading your way.'
    });
    G.Events.register({
      key: 'tv_pickers', name: 'TV picker crew stops by', emoji: '📺', kind: 'good', seasons: ALL, minLevel: UNLOCK_LEVEL, weight: 0.7, durationSec: 0, requires: () => built() && S().inv.length > 0,
      desc: 'A TV picking crew wants your best piece.',
      text: () => 'A TV picker crew rolled up in a vintage van and wants to film a segment. They have their eye on your finest piece.',
      choices: [
        { label: 'Sell them the best piece', cost: 0, desc: 'They pay 1.8x value for your most valuable item.', apply: () => tvSale(1.8, 1.8) },
        { label: 'Haggle on camera', cost: 0, desc: 'Gamble: 50% they pay 2.6x, otherwise a lowball 1.2x.', apply: () => { const win = Math.random() < 0.5; return tvSale(win ? 2.6 : 1.2, 1); } },
        { label: 'Just a shout-out', cost: 0, desc: 'No sale. Free publicity brings crowds.', apply: () => { const s = ensure(); s.buzzUntil = U.now() + 120000; s.rep = U.clamp(s.rep + 0.2, 1, 5); return 'Your shop got a big on-camera shout-out. Shoppers are streaming in.'; } }
      ]
    });
    G.Events.register({
      key: 'repro_scare', name: 'Reproduction scare', emoji: '🔎', kind: 'bad', seasons: ALL, minLevel: UNLOCK_LEVEL, weight: 0.7, durationSec: 0, requires: built,
      desc: 'A reproduction slipped into the market.',
      text: () => 'A shopper discovered that a piece sold in the region is a modern reproduction. Word is spreading. Do you make it right?',
      choices: [
        { label: 'Refund the buyer', cost: c => Math.round(U.clamp(80 + 6 * c.level + (S().stats.sales || 0) * 4, 90, 300)), desc: 'Costs coins but your reputation for honesty grows.', apply: () => { const s = ensure(); s.rep = U.clamp(s.rep + 0.3, 1, 5); s.buzzUntil = U.now() + 60000; return 'You refunded the buyer on the spot. The shop earned a reputation for honesty.'; } },
        { label: 'Shrug it off', cost: 0, desc: 'Keep the coins. Reputation drops and traffic slumps.', apply: () => { const s = ensure(); s.rep = U.clamp(s.rep - 0.8, 1, 5); s.slumpUntil = U.now() + 150000; return 'Word got around that you would not stand behind your sales. Shoppers are steering clear.'; } }
      ]
    });
  }
  function tvSale(mult, seg) {
    const s = ensure(); const cand = s.inv.filter(x => !x.rest);
    if (!cand.length) return 'The crew left with nothing to film.';
    cand.sort((a, b) => valueOf(b) - valueOf(a));
    const it = cand[0], price = Math.round(valueOf(it) * mult);
    const wasDisp = removeItem(it); recordSale(it, price, 'tv');
    s.rep = U.clamp(s.rep + 0.15, 1, 5); s.buzzUntil = U.now() + 60000 * seg;
    if (wasDisp) emitStructural(); else G.bus.emit('change');
    return `The crew paid 🪙 ${price} for your ${ITEMS[it.key].name}. You will be on TV!`;
  }

  // ---------- panel ----------
  const esc = s => (G.uikit && G.uikit.esc) ? G.uikit.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tmAttr = (type, a, b) => (G.uikit && G.uikit.tm) ? G.uikit.tm(type, a, b) : '';
  const stars = r => { const f = Math.round(r); return '★'.repeat(f) + '☆'.repeat(5 - f); };
  const coins = n => '🪙 ' + Math.round(n).toLocaleString('en-US');

  function css() {
    return `
.an-wrap{display:flex;flex-direction:column;gap:10px;padding-bottom:8px}
.an-head{background:linear-gradient(#fdf1d3,#f3d493);border:3px solid #8a5a2b;border-radius:20px;padding:12px;box-shadow:var(--card-sh)}
.an-sign{width:100%;min-height:46px;font-weight:900;font-size:17px;color:#f6e3b4;background:linear-gradient(#2f5d3a,#244a2e);border:3px solid #6b4423;border-radius:12px;padding:6px 10px;text-align:center;box-shadow:inset 0 2px 0 rgba(255,255,255,.18),0 3px 0 #4a2f14;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:inherit;letter-spacing:.3px;cursor:pointer}
.an-stats{display:flex;gap:6px;margin-top:9px}
.an-stat{flex:1;min-width:0;background:#fffaf0;border-radius:12px;padding:5px 3px;text-align:center;border:2px solid #ecd49a}
.an-stat b{display:block;font-size:15px;color:var(--ink);white-space:nowrap}.an-stat small{font-size:10px;font-weight:800;color:var(--ink2);text-transform:uppercase}
.an-star{color:#d98c0c}
.an-pill{display:inline-block;border-radius:10px;padding:2px 9px;font-size:12px;font-weight:900;color:#fff}
.an-pill.open{background:var(--green)}.an-pill.closed{background:#9a8a70}.an-pill.eve{background:#3b8fd0}
.an-nameedit{display:flex;gap:6px;margin-top:8px}
.an-nameedit input,.an-build input{flex:1;min-width:0;min-height:44px;border-radius:12px;border:3px solid #8a5a2b;padding:0 10px;font-size:16px;font-weight:800;color:var(--ink);background:#fffdf5;font-family:inherit}
.an-tabs{display:flex;gap:4px;background:#e9d6aa;border-radius:16px;padding:4px}
.an-tab{flex:1;min-width:0;min-height:44px;border-radius:12px;border:0;background:transparent;font-family:inherit;font-weight:900;font-size:11px;color:var(--ink2);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;line-height:1.15;position:relative}
.an-tab .e{font-size:18px}
.an-tab.sel{background:#fffaf0;color:var(--ink);box-shadow:0 2px 0 #b58a42}
.an-tab i{position:absolute;top:1px;right:3px;background:var(--red);color:#fff;font-style:normal;font-size:10px;min-width:16px;height:16px;border-radius:8px;display:grid;place-items:center;padding:0 3px}
.an-tiers{display:flex;gap:6px}
.an-tier{flex:1;min-height:52px;border-radius:14px;border:3px solid #e2c98d;background:#fff8e7;font-family:inherit;font-weight:900;font-size:12px;color:var(--ink);cursor:pointer;line-height:1.3}
.an-tier.sel{border-color:var(--green);background:#eaf8d9;box-shadow:0 3px 0 var(--green-d)}
.an-slots{background:#6a4020;border:3px solid #4a2c12;border-radius:18px;padding:8px;display:grid;grid-template-columns:1fr 1fr;gap:8px;box-shadow:inset 0 3px 8px rgba(0,0,0,.4),var(--card-sh);background-image:repeating-linear-gradient(90deg,rgba(0,0,0,.07) 0 2px,transparent 2px 24px)}
.an-slot{position:relative;min-height:112px;border-radius:12px;background:linear-gradient(#f5e0b0,#e8c27f);border:0;border-bottom:7px solid #9c6630;box-shadow:0 3px 0 #4a2c12;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:6px 4px 4px;color:var(--ink);font-family:inherit;cursor:pointer;text-align:center}
.an-slot:active{transform:translateY(2px)}
.an-slot .e{font-size:34px;line-height:1.1}.an-slot .n{font-size:11px;font-weight:800;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.an-slot .p{font-size:12px;font-weight:900;background:#fffdf0;border:2px solid #8a5a2b;border-radius:8px;padding:0 7px;transform:rotate(-1.5deg)}
.an-slot .cd{position:absolute;top:4px;left:5px;font-size:12px}
.an-slot.empty{background:rgba(255,236,190,.3);border:2px dashed #e6bf79;border-bottom:2px dashed #e6bf79;box-shadow:none;color:#f7e1b0}
.an-slot.empty .e{font-size:26px;opacity:.9}.an-slot.empty .n{font-size:12px}
.an-slot.lock{opacity:.5;border-style:dotted}
.an-card{background:#fffaf0;border:3px solid #e2c98d;border-radius:16px;padding:9px 10px;display:flex;flex-direction:column;gap:7px}
.an-card.offer{border-color:#f2b631;background:#fff6d4}
.an-row{display:flex;align-items:center;gap:9px}
.an-row .e{font-size:30px;flex:none}.an-row .t{flex:1;min-width:0}
.an-row b{display:block;font-size:14px;color:var(--ink);line-height:1.2}.an-row small{display:block;font-size:11px;font-weight:700;color:var(--ink2);line-height:1.3}
.an-price{font-size:15px;font-weight:900;color:var(--ink);white-space:nowrap}
.an-btns{display:flex;gap:6px}.an-btns .btn{flex:1;padding:0 6px;font-size:13px;min-width:0}
.an-chip{display:inline-block;font-size:10px;font-weight:900;border-radius:8px;padding:1px 6px;margin-right:3px;color:#fff;vertical-align:middle}
.an-chip.c0{background:#a65a3a}.an-chip.c1{background:#a08a5a}.an-chip.c2{background:#4a9a3a}.an-chip.c3{background:#3b8fd0}
.an-chip.r-common{background:#9a8a70}.an-chip.r-uncommon{background:#4a9a3a}.an-chip.r-rare{background:#8e44ad}.an-chip.r-legendary{background:#d98c0c}
.an-chip.deal{background:var(--green)}.an-chip.over{background:var(--red)}.an-chip.fair{background:#9a8a70}
.an-src{display:flex;align-items:center;gap:8px;background:linear-gradient(#e9d6aa,#dcc088);border-radius:14px;padding:6px 10px;margin-top:4px}
.an-src .e{font-size:24px}.an-src b{font-size:14px;color:var(--ink);display:block;line-height:1.1}.an-src small{font-size:11px;font-weight:700;color:var(--ink2)}
.an-feed{background:#fffaf0;border:3px solid #e2c98d;border-radius:18px;padding:8px;display:flex;flex-direction:column;gap:5px}
.an-ln{display:flex;gap:7px;align-items:flex-start}.an-ln .e{font-size:20px;flex:none}
.an-ln .b{background:#fff;border:2px solid #f0dcaa;border-radius:4px 14px 14px 14px;padding:3px 9px;font-size:12.5px;font-weight:700;color:var(--ink)}
.an-ln.coin .b{background:#fff3c8;border-color:#f2b631;font-weight:900}.an-ln.sad .b{background:#ffe3dc;border-color:#f0b0a0}.an-ln.offer .b{background:#e4f1ff;border-color:#8ec3ee}
.an-cust{display:flex;gap:6px;min-height:54px}
.an-c{flex:1 1 0;min-width:0;background:#fff;border:2px solid #f0dcaa;border-radius:12px;padding:4px 2px;text-align:center}
.an-c .e{font-size:24px;display:block;line-height:1.2}.an-c small{display:block;font-size:10px;font-weight:900;color:var(--ink2);text-transform:capitalize}
.an-c.sad{background:#ffe3dc}.an-c.happy{background:#eaf8d9}
.an-bar{height:8px;border-radius:5px;background:rgba(90,60,20,.2);overflow:hidden}.an-bar i{display:block;height:100%;width:0;background:linear-gradient(#ffd45e,#f2a91c);border-radius:5px}
.an-build{text-align:center;background:linear-gradient(#fdf1d3,#f3d493);border:3px solid #8a5a2b;border-radius:20px;padding:16px;box-shadow:var(--card-sh);display:flex;flex-direction:column;gap:10px}
.an-build .big{font-size:56px}.an-build h3{margin:0;font-size:20px}.an-build p{margin:0;font-size:13px;color:var(--ink2);font-weight:700;line-height:1.4}
.an-steps{display:flex;gap:6px}.an-steps div{flex:1;background:#fffaf0;border:2px solid #ecd49a;border-radius:12px;padding:6px 3px;font-size:11px;font-weight:800;color:var(--ink)}.an-steps .e{display:block;font-size:24px}
.an-filter{display:flex;gap:5px;overflow-x:auto;padding:2px 0}
.an-ledger{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.an-ledger div{background:#fffaf0;border:2px solid #ecd49a;border-radius:12px;padding:5px 8px;font-size:12px;font-weight:800;color:var(--ink2)}.an-ledger b{display:block;font-size:15px;color:var(--ink)}
.an-pos{color:var(--green-d)!important}.an-neg{color:var(--red-d)!important}
`;
  }
  if (typeof document !== 'undefined') G.injectCSS('antiques', css());

  const btn = (act, label, cls, extra) => `<button class="btn ${cls || 'btn-gold'} sm" data-act="pact" data-pa="${act}" ${extra || ''}>${label}</button>`;
  const dis = why => `aria-disabled="true" data-why="${esc(why)}"`;
  const condChip = c => `<span class="an-chip c${c}">${COND_EMOJI[c]} ${COND[c]}</span>`;
  const rarChip = k => `<span class="an-chip r-${ITEMS[k].rarity}">${ITEMS[k].rarity}</span>`;

  function renderBuild() {
    const lvl = G.state.level || 1, lock = lvl < UNLOCK_LEVEL;
    const intro = `<div class="an-steps"><div><span class="e">🏷️</span>Buy low at sales</div><div><span class="e">🔧</span>Restore to shine</div><div><span class="e">💰</span>Sell high</div></div>`;
    if (lock) return `<div class="an-build"><div class="big">🏺</div><h3>Antique Store</h3>${intro}<p>Hunt estate sales and farm auctions, polish up the finds, and sell to collectors. Unlocks at level ${UNLOCK_LEVEL}.</p><div><span class="lockpill">🔒 Level ${UNLOCK_LEVEL}</span></div></div>`;
    const poor = G.state.coins < BUILD_COST;
    return `<div class="an-build"><div class="big">🏺</div><h3>Open an antique store</h3>${intro}
<p>Buy rusty treasures at estate sales and farm auctions, restore them in your workshop, then sell to collectors, tourists and ranchers. Haggle for big profits. Smart buyers roughly double their money.</p>
<input class="an-name-in" type="text" maxlength="28" value="${esc(nameOf(ensure()))}" aria-label="Store name">
${btn('build', `Build the store ${coins(BUILD_COST)}`, 'btn-green', poor ? dis('You need ' + BUILD_COST + ' coins') : '')}</div>`;
  }

  function statusInfo() {
    const cal = calOf(), s = S();
    if (isDay(cal)) return { cls: 'open', txt: 'Open' };
    if (s.up.neonSign && isEve(cal)) return { cls: 'eve', txt: 'Neon open' };
    return { cls: 'closed', txt: 'Closed' };
  }

  function valueLine(it, noise) {
    const [lo, hi] = estimate(it, noise);
    return `Worth ${lo}-${hi}`;
  }

  function renderHead(s) {
    const st = statusInfo(), cal = calOf();
    return `<div class="an-head"><button class="an-sign" data-act="pact" data-pa="editname" aria-label="Rename store">🏺 ${esc(nameOf(s))} ✏️</button>
${ui.editName ? `<div class="an-nameedit"><input class="an-name-in" type="text" maxlength="28" value="${esc(nameOf(s))}" aria-label="Store name">${btn('savename', 'Save', 'btn-green')}</div>` : ''}
<div class="an-stats"><div class="an-stat"><b class="an-star">⭐ ${s.rep.toFixed(1)}</b><small>${stars(s.rep)}</small></div>
<div class="an-stat"><b>${coins(s.daily.day === cal.day ? s.daily.coins : 0)}</b><small>Today</small></div>
<div class="an-stat"><b><span class="an-pill ${st.cls}">${st.txt}</span></b><small>Status</small></div></div></div>`;
  }

  function renderTabs(s) {
    const tabs = [['floor', '🏺', 'Floor'], ['buy', '🛒', 'Buy'], ['work', '🔧', 'Shop'], ['coll', '📦', 'Items'], ['up', '⬆️', 'Upgrades']];
    return `<div class="an-tabs">${tabs.map(([k, e, n]) => `<button class="an-tab ${ui.tab === k ? 'sel' : ''}" data-act="pact" data-pa="tab" data-k="${k}"><span class="e">${e}</span>${n}${k === 'floor' && s.offers.length ? `<i>${s.offers.length}</i>` : ''}</button>`).join('')}</div>`;
  }

  function renderOffer(o, s) {
    const it = find(o.invId); if (!it) return '';
    const d = ITEMS[it.key], val = valueOf(it), appr = s.up.appraiser;
    const slack = o.max / Math.max(1, o.amount) - 1;
    const hint = appr ? (slack < 0.1 ? 'Looks firm' : slack < 0.22 ? 'Some give' : 'Eager buyer') : '';
    const vs = o.amount >= val ? `${Math.round((o.amount / val - 1) * 100)}% over value` : `${Math.round((1 - o.amount / val) * 100)}% under value`;
    const profit = o.amount - it.invested;
    return `<div class="an-card offer"><div class="an-row"><span class="e">${o.emoji}</span><div class="t"><b>${esc(o.who)} offers ${coins(o.amount)}</b><small>${esc(d.emoji)} ${esc(d.name)} · ${vs} · ${profit >= 0 ? '+' : ''}${profit} profit${hint ? ' · ' + hint : ''}</small></div></div>
<div class="an-bar"><i ${tmAttr('bar', o.startAt, o.endAt)}></i></div>
<div class="an-btns">${btn('accept', 'Accept', 'btn-green', `data-id="${o.id}"`)}${btn('decline', 'Decline', 'btn-gray', `data-id="${o.id}"`)}</div>
<div class="an-btns">${[0.1, 0.25, 0.5].map(x => {
      const pr = appr ? ` · ${Math.round(counterChance(o, x) * 100)}%` : '';
      return btn('counter', `+${x * 100}%${pr}`, 'btn-gold', `data-id="${o.id}" data-x="${x}"`);
    }).join('')}</div></div>`;
  }

  function renderFloor(s) {
    const n = slotCount(), disp = displayed();
    const tiers = TIERS.map((t, k) => `<button class="an-tier ${s.tier === k ? 'sel' : ''}" data-act="pact" data-pa="tier" data-t="${k}">${t.emoji} ${t.name}<br>${t.mult}x value</button>`).join('');
    const cells = [];
    for (let i = 0; i < 6; i++) {
      if (i >= n) { cells.push(`<div class="an-slot empty lock"><span class="e">🔒</span><span class="n">Needs upgrade</span></div>`); continue; }
      const it = disp[i];
      if (!it) { cells.push(`<button class="an-slot empty" data-act="pact" data-pa="addslot" aria-label="Add an item to display"><span class="e">＋</span><span class="n">Add from collection</span></button>`); continue; }
      const d = ITEMS[it.key];
      cells.push(`<button class="an-slot" data-act="pact" data-pa="undisp" data-id="${it.id}" aria-label="Take ${esc(d.name)} off display"><span class="cd">${COND_EMOJI[it.cond]}</span><span class="e">${esc(d.emoji)}</span><span class="n">${esc(d.name)}</span><span class="p">${coins(askOf(it))}</span></button>`);
    }
    const custs = customers.slice(0, CAP);
    const custHtml = custs.length ? custs.map(c => `<div class="an-c ${c.mood || ''}"><span class="e">${c.emoji}</span><small>${c.phase === 'arriving' ? 'arriving' : c.phase === 'browsing' ? 'browsing' : (c.mood === 'sad' ? 'unhappy' : c.mood === 'happy' ? 'happy' : 'leaving')}</small></div>`).join('') : `<div class="empty-note" style="padding:10px">${disp.length ? (isDay(calOf()) ? 'Waiting for shoppers...' : 'Closed for the night.') : 'Put something on display to attract shoppers.'}</div>`;
    const feedHtml = feed.slice(0, 6).map(f => `<div class="an-ln ${f.kind}"><span class="e">${esc(f.emoji)}</span><div class="b">${esc(f.text)}</div></div>`).join('');
    return `<div class="sub" style="margin:0 2px">Price tier (sets what shoppers see)</div><div class="an-tiers">${tiers}</div>
<div class="an-slots">${cells.join('')}</div>
${s.offers.length ? `<div class="sub" style="margin:2px 2px 0">Offers (${s.offers.length})</div>${s.offers.map(o => renderOffer(o, s)).join('')}` : ''}
<div class="sub" style="margin:2px 2px 0">Shoppers</div><div class="an-cust">${custHtml}</div>
${feedHtml ? `<div class="an-feed">${feedHtml}</div>` : ''}`;
  }

  function renderBuy(s) {
    ensureListings();
    const all = s.listings.list;
    const full = s.inv.length >= invCap();
    let html = `<div class="empty-note" style="padding:8px;font-size:12px">Stock refreshes every morning. Storage ${s.inv.length}/${invCap()}. ${s.up.appraiser ? 'Your loupe flags the deals.' : 'Tip: buy the appraiser\'s loupe to spot bargains.'}</div>`;
    SOURCES.concat([BARN]).forEach(src => {
      const rows = all.filter(l => l.src === src.id);
      if (src.id === 'barn' && !rows.length) return;
      html += `<div class="an-src"><span class="e">${src.emoji}</span><div><b>${esc(src.name)}</b><small>${esc(src.blurb)}</small></div></div>`;
      const live = rows.filter(l => !l.sold);
      if (!live.length) { html += `<div class="empty-note" style="padding:8px;font-size:12px">Picked clean. Check back tomorrow.</div>`; return; }
      html += live.map(l => {
        const d = ITEMS[l.key], ratio = dealRatio(l), can = G.state.coins >= l.price && !full;
        const why = full ? 'Storage full' : 'You need ' + l.price + ' coins';
        const tag = s.up.appraiser ? (ratio <= 0.78 ? '<span class="an-chip deal">Deal!</span>' : ratio >= 1.12 ? '<span class="an-chip over">Overpriced</span>' : '<span class="an-chip fair">Fair</span>') : '';
        const fake = { key: l.key, cond: l.cond };
        return `<div class="an-card"><div class="an-row"><span class="e">${esc(d.emoji)}</span><div class="t"><b>${esc(d.name)}</b><small>${condChip(l.cond)}${rarChip(l.key)}${tag}<br>${valueLine(fake, l.noise)}</small></div><div style="text-align:right"><div class="an-price">${coins(l.price)}</div>${btn('buy', 'Buy', 'btn-green', `data-id="${l.id}" ${can ? '' : dis(why)}`)}</div></div></div>`;
      }).join('');
    });
    return html;
  }

  function renderWork(s) {
    if (!s.up.workshop) return `<div class="an-build" style="padding:14px"><div class="big" style="font-size:44px">🔧</div><h3>No workshop yet</h3><p>A workshop lets you restore pieces one condition step at a time: poor to fair to good to mint. Restored antiques can sell for several times what you paid.</p>${btn('tab', 'See upgrades', 'btn-gold', 'data-k="up"')}</div>`;
    const now = U.now(), active = s.inv.filter(x => x.rest), nb = benches();
    let html = `<div class="empty-note" style="padding:8px;font-size:12px">Workbenches in use: ${active.length}/${nb}. Each step costs coins and 1 to 4 minutes.</div>`;
    active.forEach(it => {
      const d = ITEMS[it.key];
      html += `<div class="an-card"><div class="an-row"><span class="e">${esc(d.emoji)}</span><div class="t"><b>${esc(d.name)}</b><small>${condChip(it.cond)} → ${condChip(it.cond + 1)} <span ${tmAttr('txt', it.rest.startAt, it.rest.endAt)}></span></small></div></div><div class="an-bar"><i ${tmAttr('bar', it.rest.startAt, it.rest.endAt)}></i></div></div>`;
    });
    const list = s.inv.filter(x => !x.rest && x.cond < 3).sort((a, b) => (valueAt(b.key, b.cond + 1) - valueAt(b.key, b.cond)) - (valueAt(a.key, a.cond + 1) - valueAt(a.key, a.cond)));
    if (!list.length && !active.length) html += `<div class="empty-note">Nothing to restore. Buy something rusty!</div>`;
    list.forEach(it => {
      const d = ITEMS[it.key], fee = restoreFee(it), gain = valueAt(it.key, it.cond + 1) - valueAt(it.key, it.cond);
      const busy = active.length >= nb, poor = G.state.coins < fee;
      html += `<div class="an-card"><div class="an-row"><span class="e">${esc(d.emoji)}</span><div class="t"><b>${esc(d.name)}</b><small>${condChip(it.cond)} → ${condChip(it.cond + 1)}<br>Adds about ${coins(gain)} · ${Math.round(restoreTime(it) / 60 * 10) / 10} min</small></div>${btn('restore', `Restore ${coins(fee)}`, 'btn-gold', `data-id="${it.id}" ${busy ? dis('All workbenches are busy') : poor ? dis('You need ' + fee + ' coins') : ''}`)}</div></div>`;
    });
    return html;
  }

  function renderColl(s) {
    if (!s.inv.length) return `<div class="empty-note">Your collection is empty. Visit the Buy tab for estate sale treasures!</div>`;
    const full = displayed().length >= slotCount();
    let html = `<div class="empty-note" style="padding:8px;font-size:12px">${s.inv.length}/${invCap()} stored · ${displayed().length}/${slotCount()} on display${ui.pickSlot ? '. Tap Display on a piece.' : ''}</div>`;
    const list = s.inv.slice().sort((a, b) => valueOf(b) - valueOf(a));
    html += list.map(it => {
      const d = ITEMS[it.key], v = valueOf(it), pr = Math.round(v * PICKER_RATE), armed = ui.armed === it.id;
      const net = v - it.invested;
      const act = it.rest ? `<span class="lockpill" style="min-width:0;flex:1">🔧 In workshop</span>`
        : it.disp ? btn('undisp', 'Remove display', 'btn-gray', `data-id="${it.id}"`)
          : btn('disp', 'Display', 'btn-green', `data-id="${it.id}" ${full ? dis('Display is full') : ''}`);
      return `<div class="an-card"><div class="an-row"><span class="e">${esc(d.emoji)}</span><div class="t"><b>${esc(d.name)}</b><small>${condChip(it.cond)}${rarChip(it.key)}${it.disp ? '<span class="an-chip c2">on display</span>' : ''}<br>${valueLine(it)} · cost ${it.paid ? it.invested : 'free find'}</small></div><div class="an-price ${net >= 0 ? 'an-pos' : 'an-neg'}" style="font-size:12px">${net >= 0 ? '+' : ''}${net}</div></div>
<div class="an-btns">${act}${it.rest ? '' : btn('picker', armed ? `Sure? ${coins(pr)}` : `Picker ${coins(pr)}`, armed ? 'btn-red' : 'btn-gray', `data-id="${it.id}"`)}</div></div>`;
    }).join('');
    return html;
  }

  function renderUp(s) {
    const st = s.stats, net = st.revenue - st.spent - st.restoreSpent;
    let html = `<div class="an-ledger"><div>Sales<b>${st.sales}</b></div><div>Revenue<b>${coins(st.revenue)}</b></div><div>Bought + restored<b>${coins(st.spent + st.restoreSpent)}</b></div><div>Trading profit<b class="${net >= 0 ? 'an-pos' : 'an-neg'}">${net >= 0 ? '+' : ''}${net.toLocaleString('en-US')}</b></div></div>`;
    html += UP_ORDER.map(k => {
      const u = UPGRADES[k], own = s.up[k], miss = (u.requires || []).filter(r => !s.up[r]);
      const poor = G.state.coins < u.cost;
      const b = own ? `<span class="lockpill" style="background:#cfe8b8;color:#2f6a1c;min-width:84px">Owned</span>` : btn('up', coins(u.cost), 'btn-gold', `data-k="${k}" ${miss.length ? dis('Buy the ' + miss.map(m => UPGRADES[m].name).join(' & ') + ' first') : poor ? dis('You need ' + u.cost + ' coins') : ''}`);
      return `<div class="an-card" style="${own ? 'background:#eaf8d9;border-color:#a6d68a' : ''}"><div class="an-row"><span class="e">${u.emoji}</span><div class="t"><b>${esc(u.name)}</b><small>${esc(u.desc)}${miss.length ? ' Needs: ' + miss.map(m => UPGRADES[m].name).join(', ') + '.' : ''}</small></div>${b}</div></div>`;
    }).join('');
    return html;
  }

  function onAction(a, el) {
    try {
      const s = ensure(), id = el.dataset.id;
      switch (a) {
        case 'build': { const inp = el.closest('.panel-body') && el.closest('.panel-body').querySelector('.an-name-in'); build(inp ? inp.value : ''); break; }
        case 'editname': ui.editName = !ui.editName; break;
        case 'savename': { const inp = el.closest('.panel-body').querySelector('.an-name-in'); if (inp) setName(inp.value); ui.editName = false; break; }
        case 'tab': ui.tab = el.dataset.k; ui.armed = null; ui.pickSlot = false; break;
        case 'tier': setTier(el.dataset.t); break;
        case 'addslot': ui.tab = 'coll'; ui.pickSlot = true; break;
        case 'disp': if (setDisplay(id, true) && ui.pickSlot) { ui.pickSlot = false; ui.tab = 'floor'; } break;
        case 'undisp': setDisplay(id, false); break;
        case 'buy': buyListing(id); break;
        case 'restore': restore(id); break;
        case 'picker': if (ui.armed === id) { ui.armed = null; quickSell(id); } else ui.armed = id; break;
        case 'accept': acceptOffer(id); break;
        case 'decline': declineOffer(id); break;
        case 'counter': counterOffer(id, +el.dataset.x); break;
        case 'up': upgrade(el.dataset.k); break;
      }
    } catch (e) { console.error('[antiques] action', e); }
  }

  G.panels.antiques = {
    live: true,
    title() { return 'Antique Store'; },
    sub() { const s = S(); return s.built ? esc(nameOf(s)) : ''; },
    render() {
      try {
        const s = ensure();
        if (!s.built) return renderBuild();
        let body = '';
        switch (ui.tab) {
          case 'buy': body = renderBuy(s); break;
          case 'work': body = renderWork(s); break;
          case 'coll': body = renderColl(s); break;
          case 'up': body = renderUp(s); break;
          default: body = renderFloor(s);
        }
        return `<div class="an-wrap">${renderHead(s)}${renderTabs(s)}${body}</div>`;
      } catch (e) { console.error('[antiques] render', e); return '<div class="empty-note">Antique store unavailable.</div>'; }
    },
    onAction
  };

  // ---------- public API ----------
  G.Antiques = {
    isBuilt, build,
    name: () => nameOf(S()), setName,
    level: storeLevel,
    upgrades: () => { const o = {}; Object.keys(S().up).forEach(k => { if (S().up[k]) o[k] = true; }); return o; },
    display: () => displayed().slice(0, slotCount()).map(x => ({ key: x.key, emoji: ITEMS[x.key].emoji, name: ITEMS[x.key].name })),
    customers: () => customers.filter(c => c.phase !== 'gone').slice(0, CAP).map(c => ({ id: c.id, emoji: c.emoji, phase: c.phase, t: U.clamp((U.now() - c.start) / c.dur, 0, 1), mood: c.mood })),
    offerCount: () => S().offers.length,
    // extras
    ensure, listings, buyListing, inventory: () => S().inv.map(x => Object.assign({}, x)), setDisplay, restore, quickSell,
    acceptOffer, declineOffer, counterOffer, counterChance, offers: () => S().offers.map(o => Object.assign({}, o)),
    upgrade, setTier, value: valueOf, valueAt, ask: askOf, restoreFee, slotCount, invCap, benches, feed: () => feed.slice(),
    stats: () => Object.assign({}, S().stats), reputation: () => S().rep, todaySales: () => (S().daily.day === calOf().day ? S().daily.coins : 0),
    trafficRate: () => trafficRate(U.now(), calOf(), true), farmFind: onHarvest, genListings,
    unlockLevel: UNLOCK_LEVEL, buildCost: BUILD_COST, upgradeDefs: UPGRADES, items: ITEMS, tiers: TIERS
  };

  // ---------- wiring ----------
  const safe = (n, f) => G.bus.on(n, p => { try { f(p); } catch (e) { console.error('[antiques]', n, e); } });
  safe('init', () => { ensure(); customers = []; feed = []; lastT = 0; });
  safe('state:reset', () => { customers = []; feed = []; lastT = 0; ui = { tab: 'floor', editName: false, armed: null, pickSlot: false, filter: 'all' }; ensure(); });
  safe('tick', onTick);
  safe('harvested', onHarvest);
  reg();
})();
