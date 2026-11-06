/* events.js — Kellyville random farm events (G.Events).
   Weather, pests, markets, festivals and neighbors that hurt or help the farm.
   Instant events (durationSec 0, no choices) are logged + announced via 'event:start' but never enter
   G.state.activeEvents, so they get no 'event:end'. Timed and pending-choice events live in activeEvents. */
(function () {
  'use strict';
  const G = window.G;
  const U = G.util;

  const CHOICE_SEC = 30;
  const MAX_ACTIVE = 2;
  const TAG_NAMES = { irrigation: 'irrigation', windbreak: 'windbreak', frost_fans: 'frost fans', firebreak: 'firebreak', cold_storage: 'cold storage', beehives: 'beehives' };
  const CLAMP = { growth: [0.5, 2], yield: [0.4, 2.5], animal: [0.5, 2], price: [0.6, 2.0] };

  // ---------- crop groups ----------
  const GRAIN = ['wheat', 'lentils', 'chickpeas', 'peas', 'alfalfa', 'canola'];
  const ORCHARD = ['apples', 'cherries', 'grapes'];
  const FROSTY = ['apples', 'cherries', 'grapes', 'asparagus', 'peas', 'potatoes'];
  const TENDER = ['corn', 'pumpkins', 'potatoes', 'sweet_onions', 'grapes', 'hops', 'asparagus', 'mint'];
  const THIRSTY = ['corn', 'potatoes', 'sweet_onions', 'asparagus', 'mint', 'hops', 'apples', 'cherries', 'grapes', 'pumpkins', 'alfalfa'];
  const FRESH = ['potatoes', 'sweet_onions', 'apples', 'cherries', 'grapes', 'asparagus', 'pumpkins', 'corn', 'mint'];
  const HOPPER = GRAIN.concat(['corn', 'pumpkins']);

  // ---------- helpers ----------
  const S = () => G.state;
  function ensure() {
    const s = G.state;
    if (!Array.isArray(s.activeEvents)) s.activeEvents = [];
    if (!Array.isArray(s.eventLog)) s.eventLog = [];
    if (!s.flags || typeof s.flags !== 'object') s.flags = {};
    if (!s.stats || typeof s.stats !== 'object') s.stats = {};
    if (typeof s.stats.eventsSeen !== 'number') s.stats.eventsSeen = 0;
    if (!Array.isArray(s.ownedExpansions)) s.ownedExpansions = [];
    return s;
  }
  function hasTag(tag) {
    const exp = (G.DATA && G.DATA.expansions) || {};
    return (S().ownedExpansions || []).some(k => exp[k] && exp[k].tag === tag);
  }
  function hasAnimal(type) { return (S().animals || []).some(a => a && a.type === type); }
  function plotCount(list) {
    return (S().plots || []).filter(p => p && (p.status === 'growing' || p.status === 'ready') && (list === 'all' || list.indexOf(p.crop) >= 0)).length;
  }
  const needPlots = list => () => plotCount(list) > 0;
  const pl = n => n + ' plot' + (n === 1 ? '' : 's');
  const pretty = k => String(k).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  const scaleMult = (m, k) => 1 + (m - 1) * (k == null ? 1 : k);

  // Targeted plot damage/boost. Like G.affectPlots but picks an exact count (so destroy can be capped at ~40% of all plots)
  // and adds mode 'delayPct' (amount = fraction of remaining grow time; negative = faster).
  function strike(o) {
    o = o || {};
    const plots = S().plots || [], crops = o.crops || 'all', mode = o.mode || 'reduce';
    const frac = U.clamp(o.fraction == null ? 1 : o.fraction, 0, 1), now = U.now();
    const amt = typeof o.amount === 'number' ? o.amount : 0.5;
    const cand = [];
    plots.forEach((p, i) => {
      if (!p) return;
      const wide = mode === 'destroy' || mode === 'reduce' || mode === 'boost';
      const okStatus = p.status === 'growing' || (wide && o.includeReady !== false && p.status === 'ready');
      if (!okStatus) return;
      if (crops !== 'all' && crops.indexOf(p.crop) < 0) return;
      cand.push(i);
    });
    shuffle(cand);
    let n = Math.round(cand.length * frac);
    if (n === 0 && cand.length && frac >= 0.15) n = 1;
    if (mode === 'destroy') n = Math.min(n, Math.max(1, Math.floor(plots.length * 0.4)));
    const hit = cand.slice(0, n);
    hit.forEach(i => {
      const p = plots[i];
      if (mode === 'destroy') p.status = 'withered';
      else if (mode === 'reduce') p.yieldMult = Math.max(0.25, (p.yieldMult || 1) * amt);
      else if (mode === 'boost') p.yieldMult = Math.min(3, (p.yieldMult || 1) * amt);
      else if (mode === 'ripen') p.readyAt = now;
      else if (mode === 'delay') p.readyAt += amt * 1000;
      else if (mode === 'delayPct') p.readyAt += Math.max(0, p.readyAt - now) * amt;
    });
    G.bus.emit('change');
    return hit;
  }

  // ---------- definitions ----------
  // Pest choice builder (spray vs organic vs ignore)
  function pestEvent(o) {
    return {
      key: o.key, name: o.name, emoji: o.emoji, kind: 'bad', seasons: o.seasons, minLevel: o.minLevel, weight: o.weight || 1, durationSec: 0,
      desc: o.desc, requires: needPlots(o.targets),
      text: c => o.text,
      choices: [
        {
          label: 'Spray insecticide', cost: c => Math.round(U.clamp(50 + c.level * 8, 50, 160)),
          desc: 'Fast and effective. Your crops are protected.',
          apply: c => { c.G.addXP(5); return 'Spray rigs knocked the ' + o.pest + ' back before they could do real harm.'; }
        },
        {
          label: 'Go organic', cost: c => Math.round(U.clamp(20 + c.level * 4, 20, 80)),
          desc: 'Traps, predators and neem oil. Halves the damage and earns an organic premium for a while.',
          durationSec: 120,
          mods: { price: { products: o.targets, mult: 1.12, fixed: true, label: o.premiumLabel } },
          apply: c => {
            const h = strike({ crops: o.targets, fraction: 0.5, mode: 'reduce', amount: 0.85 });
            return 'Organic controls held the ' + o.pest + ' in check' + (h.length ? ' (' + pl(h.length) + ' lightly nibbled)' : '') + '. Buyers pay a premium for clean fruit and grain.';
          }
        },
        {
          label: 'Ignore it', cost: 0,
          desc: 'Save your coins and hope for the best.',
          apply: c => {
            const d = strike({ crops: o.targets, fraction: 0.2 * c.k, mode: 'destroy' });
            const r = strike({ crops: o.targets, fraction: 0.6, mode: 'reduce', amount: 1 - 0.35 * c.k });
            return 'The ' + o.pest + ' feasted: ' + pl(d.length) + ' lost and ' + pl(r.length) + ' badly damaged.';
          }
        }
      ]
    };
  }

  const defs = [
    // ================= BAD =================
    {
      key: 'dust_storm', name: 'Palouse Dust Storm', emoji: '🌪️', kind: 'bad', seasons: ['spring', 'summer', 'fall'], minLevel: 1, weight: 1, durationSec: 0,
      mitigatedBy: 'windbreak', requires: needPlots('all'),
      desc: 'Hot dry winds strip topsoil off the rolling hills.',
      onStart(c) {
        const hit = strike({ crops: 'all', fraction: 0.6, mode: 'reduce', amount: 1 - 0.25 * c.k });
        const slow = strike({ crops: 'all', fraction: 1, mode: 'delayPct', amount: 0.15 * c.k });
        return { hit: hit.length, slowed: slow.length };
      },
      text: c => c.result.hit ? 'A wall of dust rolled off the Palouse hills, scouring ' + pl(c.result.hit) + ' and slowing growth.' : 'A wall of dust rolled across the hills but found little to harm.'
    },
    {
      key: 'wildfire_smoke', name: 'Wildfire Smoke', emoji: '😶‍🌫️', kind: 'bad', seasons: ['summer', 'fall'], minLevel: 1, weight: 1, durationSec: 150,
      desc: 'Smoke from Cascade fires blankets the valley.',
      mods: {
        growth: { crops: 'all', mult: 1.2 }, yield: { crops: 'all', mult: 0.92 },
        animal: { animals: 'all', mult: 1.15 }
      },
      text: () => 'Smoke from Cascade wildfires blankets the basin. The sun turns orange, crops sulk and animals are listless.'
    },
    {
      key: 'wildfire_nearby', name: 'Fire Near the Fields', emoji: '🔥', kind: 'bad', seasons: ['summer', 'fall'], minLevel: 3, weight: 0.8, durationSec: 0,
      mitigatedBy: 'firebreak', requires: needPlots('all'),
      desc: 'A grass fire is racing toward your land.',
      text: () => 'A grass fire jumped the highway and is racing toward your fields! Hire a crew to cut a firebreak, or gamble that the wind shifts.',
      choices: [
        {
          label: 'Hire firebreak crew', cost: c => Math.round(U.clamp(70 + c.level * 12, 70, 260) * (c.mitigated ? 0.5 : 1)),
          desc: 'Dozers cut a fireline around your fields. Crops safe.',
          apply: c => { c.G.addXP(8); return 'The crew cut a fireline just in time. Your fields were spared.'; }
        },
        {
          label: 'Risk it', cost: 0,
          desc: 'About a 65% chance embers reach your crops.' + ' (A firebreak halves the damage.)',
          apply: c => {
            if (Math.random() < 0.65) {
              const d = strike({ crops: 'all', fraction: 0.4 * c.k, mode: 'destroy' });
              return d.length ? 'Embers leapt the road! ' + pl(d.length) + ' burned' + (c.mitigated ? ' (your firebreak saved the rest).' : '.') : 'Embers fell short of your crops.';
            }
            return 'The wind shifted and the fire turned away. Lucky!';
          }
        }
      ]
    },
    {
      key: 'heat_dome', name: 'Heat Dome', emoji: '🥵', kind: 'bad', seasons: ['summer'], minLevel: 1, weight: 1, durationSec: 120,
      mitigatedBy: 'irrigation',
      desc: 'Triple-digit temperatures bake the Columbia Basin.',
      mods: {
        growth: { crops: 'all', mult: 1.3 }, yield: { crops: 'all', mult: 0.82 },
        animal: { animals: 'all', mult: 1.25 }
      },
      onStart(c) { return { slowed: strike({ crops: 'all', fraction: 1, mode: 'delayPct', amount: 0.12 * c.k }).length }; },
      text: () => 'A heat dome parks over the Columbia Basin with triple-digit highs. Crops wilt and animals pant in the shade.'
    },
    {
      key: 'drought', name: 'Irrigation Curtailment', emoji: '🏜️', kind: 'bad', seasons: ['summer'], minLevel: 2, weight: 0.9, durationSec: 180,
      mitigatedBy: 'irrigation',
      desc: 'Junior water rights in the Yakima Basin are cut off.',
      mods: {
        growth: { crops: THIRSTY, mult: 1.25, label: '💧 Thirsty crops' },
        yield: { crops: THIRSTY, mult: 0.8, label: '💧 Thirsty crops' }
      },
      text: () => 'Low snowmelt means the Bureau of Reclamation curtails junior water rights in the Yakima Basin. Corn, hops and orchards are going thirsty.'
    },
    {
      key: 'late_frost', name: 'Late Spring Frost', emoji: '🥶', kind: 'bad', seasons: ['spring'], minLevel: 3, weight: 1, durationSec: 0,
      mitigatedBy: 'frost_fans', requires: needPlots(FROSTY),
      desc: 'A hard freeze nips the blossoms.',
      onStart(c) { return { lost: strike({ crops: FROSTY, fraction: 0.4 * c.k, mode: 'destroy' }).length }; },
      text: c => c.result.lost ? 'A clear, still night dropped to 26°F during bloom. ' + pl(c.result.lost) + ' of tender crops and blossoms froze.' : 'A cold snap threatened the blossoms but passed without lasting damage.'
    },
    {
      key: 'early_freeze', name: 'Early Fall Freeze', emoji: '❄️', kind: 'bad', seasons: ['fall'], minLevel: 2, weight: 1, durationSec: 0,
      mitigatedBy: 'frost_fans', requires: needPlots(TENDER),
      desc: 'Winter arrives weeks early.',
      onStart(c) {
        const lost = strike({ crops: TENDER, fraction: 0.35 * c.k, mode: 'destroy' });
        const slow = strike({ crops: 'all', fraction: 1, mode: 'delayPct', amount: 0.1 * c.k });
        return { lost: lost.length, slowed: slow.length };
      },
      text: c => c.result.lost ? 'An early killing freeze hit before harvest: ' + pl(c.result.lost) + ' of tender crops blackened.' : 'An early freeze nipped the fields but your crops held on, only slowed by the cold.'
    },
    {
      key: 'hailstorm', name: 'Hailstorm', emoji: '🧊', kind: 'bad', seasons: ['spring', 'summer', 'fall'], minLevel: 2, weight: 0.8, durationSec: 0,
      requires: needPlots('all'),
      desc: 'Marble-sized hail shreds leaves and fruit.',
      onStart(c) {
        const d = strike({ crops: 'all', fraction: 0.25 * c.k, mode: 'destroy' });
        const r = strike({ crops: 'all', fraction: 0.5, mode: 'reduce', amount: 1 - 0.2 * c.k });
        return { lost: d.length, bruised: r.length };
      },
      text: c => (c.result.lost || c.result.bruised) ? 'A summer thunderstorm pounded the farm with hail: ' + pl(c.result.lost) + ' flattened and ' + pl(c.result.bruised) + ' bruised.' : 'Hail rattled the barn roof but nothing was growing to damage.'
    },
    {
      key: 'cherry_rain', name: 'Rain at Cherry Harvest', emoji: '🌧️', kind: 'bad', seasons: ['spring', 'summer'], minLevel: 3, weight: 0.9, durationSec: 0,
      requires: needPlots(['cherries']),
      desc: 'Rain makes ripe cherries swell and split.',
      text: () => 'A surprise rainstorm is about to hit your ripening cherries, and wet fruit splits. Hire helicopters to blow the trees dry, or take your chances.',
      choices: [
        {
          label: 'Hire helicopters', cost: c => Math.round(U.clamp(90 + c.level * 10, 90, 240)),
          desc: 'Rotor wash dries the trees. No splitting.',
          apply: c => { c.G.addXP(6); return 'Helicopters hovered over the orchard and dried the trees. The cherries are fine.'; }
        },
        {
          label: 'Let it rain', cost: 0,
          desc: 'Split fruit means lost yield and softer cherry prices.',
          durationSec: 100,
          mods: { price: { products: ['cherries', 'cherry_pie'], mult: 0.85 } },
          apply: c => {
            const h = strike({ crops: ['cherries'], fraction: 1, mode: 'reduce', amount: 1 - 0.4 * c.k });
            return 'The rain split the fruit on ' + pl(h.length) + ' of cherries. Yield is down and buyers are wary.';
          }
        }
      ]
    },
    pestEvent({
      key: 'codling_moth', name: 'Codling Moth Outbreak', emoji: '🐛', seasons: ['spring', 'summer'], minLevel: 3, weight: 0.9,
      targets: ['apples', 'cherries', 'grapes'], pest: 'moths', premiumLabel: '🍎 Organic fruit',
      desc: 'Wormy apples threaten the orchard.',
      text: 'Codling moth traps are overflowing! Larvae are boring into your orchard fruit. Spray, go organic, or ignore it?'
    }),
    pestEvent({
      key: 'grasshoppers', name: 'Grasshopper Swarm', emoji: '🦗', seasons: ['spring', 'summer'], minLevel: 2, weight: 0.9,
      targets: HOPPER, pest: 'hoppers', premiumLabel: '🌾 Organic grain',
      desc: 'A dry year breeds hungry grasshoppers.',
      text: 'A dry year has bred a plague of grasshoppers, and they are marching across the stubble toward your crops. Spray, go organic, or ignore it?'
    }),
    {
      key: 'bird_flu', name: 'Avian Flu Scare', emoji: '🦠', kind: 'bad', seasons: ['fall', 'winter', 'spring'], minLevel: 2, weight: 0.9, durationSec: 150,
      requires: () => hasAnimal('chickens'),
      desc: 'HPAI is detected in a nearby flock.',
      mods: {
        animal: { animals: ['chickens'], mult: 1.5 },
        price: { products: ['eggs'], mult: 0.7 }
      },
      text: () => 'Avian flu was found in a flock a county over. Your hens are on lockdown and stressed, and shoppers are shunning eggs.'
    },
    {
      key: 'price_crash', name: 'Fresh Produce Glut', emoji: '📉', kind: 'bad', seasons: ['spring', 'summer', 'fall', 'winter'], minLevel: 2, weight: 0.9, durationSec: 150,
      mitigatedBy: 'cold_storage',
      desc: 'Too much fruit and veg floods the market.',
      mods: { price: { products: FRESH, mult: 0.65, label: '🥔 Fresh produce' } },
      text: () => 'A glut of Northwest fruit and vegetables crashed wholesale prices. Fresh produce is selling cheap.'
    },

    // ================= GOOD =================
    {
      key: 'palouse_rain', name: 'Perfect Palouse Rain', emoji: '🌧️', kind: 'good', seasons: ['spring', 'fall'], minLevel: 1, weight: 1.2, durationSec: 150,
      desc: 'Soft, steady rain: just what the wheat ordered.',
      mods: {
        growth: { crops: GRAIN, mult: 0.8, label: '🌾 Grains & pulses' },
        yield: { crops: GRAIN, mult: 1.25, label: '🌾 Grains & pulses' }
      },
      onStart(c) { return { sped: strike({ crops: GRAIN, fraction: 1, mode: 'delayPct', amount: -0.15 * c.k }).length }; },
      text: () => 'A gentle two-day Palouse rain soaked the hills. Wheat, lentils and peas are thriving.'
    },
    {
      key: 'bumper_crop', name: 'Bumper Crop', emoji: '🌾', kind: 'good', seasons: ['summer', 'fall'], minLevel: 1, weight: 1, durationSec: 100,
      requires: needPlots('all'),
      desc: 'Everything is coming in heavy.',
      mods: { yield: { crops: 'all', mult: 1.1 } },
      onStart(c) { return { boosted: strike({ crops: 'all', fraction: 0.5, mode: 'boost', amount: 1.4 }).length }; },
      text: c => 'Perfect growing weather means a bumper crop' + (c.result.boosted ? ': ' + pl(c.result.boosted) + ' are loaded with extra yield!' : '!')
    },
    {
      key: 'pollinator_boom', name: 'Pollinator Boom', emoji: '🐝', kind: 'good', seasons: ['spring', 'summer'], minLevel: 2, weight: 1, durationSec: 150,
      amplifiedBy: 'beehives',
      desc: 'Bees and native pollinators are everywhere.',
      mods: {
        yield: { crops: ['apples', 'cherries', 'grapes', 'canola', 'pumpkins'], mult: 1.25, label: '🍎 Pollinated crops' },
        animal: { animals: ['bees'], mult: 0.75 }
      },
      text: () => 'A mild bloom brought a boom of bees and native pollinators. Orchards, canola and pumpkins are setting heavy fruit.'
    },
    {
      key: 'onion_festival', name: 'Sweet Onion Festival', emoji: '🧅', kind: 'good', seasons: ['summer'], minLevel: 2, weight: 1, durationSec: 150,
      desc: 'Walla Walla celebrates its famous sweets.',
      mods: { price: { products: ['sweet_onions', 'onion_rings'], mult: 1.6 } },
      text: () => 'The Walla Walla Sweet Onion Festival is in town! Crowds are paying top dollar for sweet onions and onion rings.'
    },
    {
      key: 'hop_demand', name: 'Yakima Hop Harvest Rush', emoji: '🍺', kind: 'good', seasons: ['fall'], minLevel: 3, weight: 1, durationSec: 150,
      desc: 'Craft brewers are hunting for fresh hops.',
      mods: { price: { products: ['hops', 'ipa'], mult: 1.5 } },
      text: () => 'Craft brewers from Seattle to Portland are racing to buy fresh Yakima hops. Hops and IPA prices are way up.'
    },
    {
      key: 'blossom_festival', name: 'Apple Blossom Festival', emoji: '🌸', kind: 'good', seasons: ['spring'], minLevel: 2, weight: 1, durationSec: 140,
      desc: 'Tourists flood Wenatchee.',
      mods: { price: { products: ['apples', 'cherries', 'apple_cider', 'apple_pie', 'cherry_pie', 'honey', 'honey_cake'], mult: 1.35, label: '🍎 Orchard treats' } },
      onStart(c) { const tips = Math.round(15 + c.level * 6); G.addCoins(tips, 'event'); return { tips }; },
      text: c => 'The Wenatchee Apple Blossom Festival brought crowds of tourists. They left ' + c.result.tips + ' coins in tips and want pies and cider.'
    },
    {
      key: 'rodeo', name: 'Ellensburg Rodeo', emoji: '🤠', kind: 'good', seasons: ['summer', 'fall'], minLevel: 2, weight: 1, durationSec: 150,
      desc: 'Hungry cowboys and cowgirls roll into town.',
      mods: { price: { products: ['eggs', 'milk', 'wool', 'butter', 'cheese', 'honey', 'bread', 'wool_sweater'], mult: 1.3, label: '🐄 Farm goods' } },
      text: () => 'Labor Day weekend at the Ellensburg Rodeo! Visitors are snapping up eggs, milk, cheese, bread and wool.'
    },
    {
      key: 'kalama_export', name: 'Port of Kalama Export Surge', emoji: '🚢', kind: 'good', seasons: ['spring', 'summer', 'fall', 'winter'], minLevel: 1, weight: 1, durationSec: 150,
      desc: 'Overseas buyers want Northwest grain.',
      mods: {
        price: [
          { products: ['wheat'], mult: 1.7 },
          { products: ['lentils', 'chickpeas', 'peas', 'canola'], mult: 1.3, label: '🫘 Pulses & canola' },
          { products: ['flour', 'bread'], mult: 1.2, label: '🍞 Flour & bread' }
        ]
      },
      text: () => 'Export ships are lining up at the Port of Kalama. Wheat prices are surging, and pulses and flour are up too.'
    },
    {
      key: 'helpers_4h', name: '4-H Kids Lend a Hand', emoji: '🧑‍🌾', kind: 'good', seasons: ['spring', 'summer', 'fall', 'winter'], minLevel: 1, weight: 1.1, durationSec: 0,
      requires: needPlots('all'),
      desc: 'Neighbors and 4-H members pitch in.',
      onStart(c) {
        const ripe = strike({ crops: 'all', fraction: 0.5, mode: 'ripen' });
        c.G.addXP(5);
        return { ripe: ripe.length };
      },
      text: c => 'Neighbors and the local 4-H club showed up with gloves and pickup trucks. ' + pl(c.result.ripe) + ' ripened right away, and you earned a little XP.'
    },
    {
      key: 'state_fair', name: 'Blue Ribbon at the State Fair', emoji: '🏆', kind: 'good', seasons: ['fall'], minLevel: 2, weight: 0.9, durationSec: 0,
      desc: 'Your produce wins at the Washington State Fair.',
      onStart(c) {
        const prize = Math.round(80 + c.level * 30 + U.rand(0, 40));
        G.addCoins(prize, 'event'); c.G.addXP(10);
        return { prize };
      },
      text: c => 'Your entry won a blue ribbon at the Washington State Fair in Puyallup! Prize money: ' + c.result.prize + ' coins.'
    },
    {
      key: 'mild_winter', name: 'Mild Winter', emoji: '🌤️', kind: 'good', seasons: ['winter'], minLevel: 1, weight: 1.2, durationSec: 180,
      desc: 'Gentle weather eases the cold season.',
      mods: { growth: { crops: 'all', mult: 0.82 }, animal: { animals: 'all', mult: 0.85 } },
      text: () => 'A mild winter has the animals comfortable and crops growing faster than they should.'
    },
    {
      key: 'snowpack', name: 'Great Snowpack', emoji: '🏔️', kind: 'good', seasons: ['winter', 'spring'], minLevel: 2, weight: 1, durationSec: 200,
      amplifiedBy: 'irrigation',
      desc: 'Cascade snow means a full water year.',
      mods: { growth: { crops: 'all', mult: 0.8 }, yield: { crops: 'all', mult: 1.1 } },
      text: () => 'The Cascade snowpack is far above average. Reservoirs will be full and crops will flourish.'
    },
    {
      key: 'chinook', name: 'Chinook Wind Thaw', emoji: '🌬️', kind: 'good', seasons: ['winter'], minLevel: 1, weight: 1, durationSec: 120,
      desc: 'A warm wind melts the snow overnight.',
      mods: { growth: { crops: 'all', mult: 0.88 }, animal: { animals: 'all', mult: 0.88 } },
      onStart() { return { sped: strike({ crops: 'all', fraction: 1, mode: 'delayPct', amount: -0.12 }).length }; },
      text: () => 'A warm Chinook wind swept down from the Cascades and melted the snow overnight. Everything perks up.'
    },
    {
      key: 'crush_season', name: 'Wine Country Crush', emoji: '🍷', kind: 'good', seasons: ['fall'], minLevel: 3, weight: 1, durationSec: 150,
      desc: 'Wine tourists flock to Walla Walla and Red Mountain.',
      mods: { price: { products: ['grapes', 'wine', 'apple_cider'], mult: 1.45 } },
      text: () => 'Harvest crush is on and wine tourists are everywhere. Grapes, wine and cider fetch premium prices.'
    }
  ];

  const DEF = {};
  defs.forEach(d => { DEF[d.key] = d; });

  // ---------- mods ----------
  function specsOf(rec, def, type) {
    const out = [];
    const add = m => { if (m && m[type]) [].concat(m[type]).forEach(s => s && out.push(s)); };
    add(def.mods);
    if (rec.ci != null && def.choices && def.choices[rec.ci]) add(def.choices[rec.ci].mods);
    return out;
  }
  const listOf = (type, s) => (type === 'growth' || type === 'yield') ? s.crops : type === 'animal' ? s.animals : s.products;
  const matches = (list, key) => !list || list === 'all' || [].concat(list).indexOf(key) >= 0;
  function combined(type, key) {
    const now = U.now(); let m = 1;
    (S().activeEvents || []).forEach(rec => {
      if (!rec || rec.pending || !(rec.endAt > now)) return;
      const def = DEF[rec.key]; if (!def) return;
      specsOf(rec, def, type).forEach(s => {
        if (!matches(listOf(type, s), key)) return;
        const v = s.fixed ? s.mult : scaleMult(s.mult, rec.k);
        if (isFinite(v)) m *= v;
      });
    });
    const c = CLAMP[type];
    return isFinite(m) ? U.clamp(m, c[0], c[1]) : 1;
  }

  // ---------- describe ----------
  function lookup(type, k) {
    const D = G.DATA || {};
    return type === 'animal' ? (D.animals || {})[k] : ((D.products || {})[k] || (D.crops || {})[k]);
  }
  function labelFor(type, s) {
    if (s.label) return s.label;
    const list = listOf(type, s);
    if (!list || list === 'all') return type === 'animal' ? '🐾 All animals' : type === 'price' ? '💰 All goods' : '🌱 All crops';
    const arr = [].concat(list);
    const nm = k => { const i = lookup(type, k); return (i && i.emoji ? i.emoji + ' ' : '') + ((i && i.name) || pretty(k)); };
    if (arr.length <= 2) return arr.map(nm).join(' & ');
    return nm(arr[0]) + ' +' + (arr.length - 1) + ' more';
  }
  function describeMods(rec) {
    const out = [];
    try {
      const def = rec && DEF[rec.key]; if (!def || rec.pending) return out;
      ['growth', 'yield', 'animal', 'price'].forEach(type => {
        specsOf(rec, def, type).forEach(s => {
          const m = s.fixed ? s.mult : scaleMult(s.mult, rec.k);
          if (!isFinite(m) || Math.abs(m - 1) < 0.005) return;
          const label = labelFor(type, s);
          if (type === 'growth' || type === 'animal') {
            const p = Math.round((1 - m) * 100), what = type === 'growth' ? 'growth' : 'production';
            out.push(label + ' ' + what + ' ' + Math.abs(p) + '% ' + (p >= 0 ? 'faster' : 'slower'));
          } else {
            const p = Math.round((m - 1) * 100);
            out.push(label + ' ' + type + ' ' + (p >= 0 ? '+' : '') + p + '%');
          }
        });
      });
    } catch (e) { /* ignore */ }
    return out;
  }
  const timeLeft = rec => rec ? Math.max(0, Math.ceil((rec.endAt - U.now()) / 1000)) : 0;

  // ---------- event lifecycle ----------
  function makeCtx(def, rec) {
    const level = S().level || 1, soft = level <= 2;
    const tags = def.mitigatedBy ? [].concat(def.mitigatedBy) : [];
    const mitTag = def.kind === 'bad' ? tags.filter(hasTag)[0] : null;
    const ampTag = def.amplifiedBy ? [].concat(def.amplifiedBy).filter(hasTag)[0] : null;
    let k = 1;
    if (def.kind === 'bad') { if (mitTag) k *= 0.5; if (soft) k *= 0.6; } else if (ampTag) k = 1.5;
    return { def, record: rec, G, level, soft, mitigated: !!mitTag, amplified: !!ampTag, mitTag, ampTag, k, hasTag, strike, result: {} };
  }
  function ctxFor(def, rec) {
    const c = makeCtx(def, rec);
    if (rec.k != null) { c.k = rec.k; c.mitigated = !!rec.mit; c.amplified = !!rec.amp; c.soft = !!rec.soft; }
    return c;
  }
  const costOf = (ch, ctx) => Math.max(0, Math.round(typeof ch.cost === 'function' ? ch.cost(ctx) : (ch.cost || 0)));
  function choicesFor(def, rec) {
    return (def.choices || []).map((c, i) => {
      const cost = (rec.costs && rec.costs[i] != null) ? rec.costs[i] : 0;
      return { index: i, label: c.label, cost, desc: c.desc, affordable: S().coins >= cost };
    });
  }
  function logEntry(def, rec, text) {
    const s = ensure();
    s.eventLog.push({ key: def.key, name: def.name, emoji: def.emoji, kind: def.kind, at: rec.startAt, text });
    while (s.eventLog.length > 30) s.eventLog.shift();
    s.stats.eventsSeen++;
  }
  function removeActive(rec) {
    const a = S().activeEvents, i = a.indexOf(rec);
    if (i >= 0) a.splice(i, 1);
  }

  function startEvent(def) {
    const s = ensure(), now = U.now();
    const rec = { id: U.uid(), key: def.key, startAt: now, endAt: now + (def.durationSec || 0) * 1000 };
    const ctx = makeCtx(def, rec);
    rec.k = Math.round(ctx.k * 1000) / 1000;
    if (ctx.mitigated) rec.mit = 1;
    if (ctx.amplified) rec.amp = 1;
    if (ctx.soft) rec.soft = 1;
    const hasChoices = !!(def.choices && def.choices.length);
    if (hasChoices) {
      rec.pending = true; rec.endAt = now + CHOICE_SEC * 1000;
      rec.costs = def.choices.map(c => costOf(c, ctx));
    }
    try { ctx.result = (def.onStart && def.onStart(ctx)) || {}; } catch (e) { console.error('[events] onStart', def.key, e); ctx.result = {}; }
    let text = '';
    try { text = def.text(ctx); } catch (e) { console.error('[events] text', def.key, e); text = def.desc || def.name; }
    if (ctx.mitigated) text += ' 🛡️ Your ' + (TAG_NAMES[ctx.mitTag] || ctx.mitTag) + ' cut the damage in half.';
    if (ctx.amplified) text += ' ✨ Your ' + (TAG_NAMES[ctx.ampTag] || ctx.ampTag) + ' amplified the benefit!';
    if (hasChoices || (def.durationSec || 0) > 0) s.activeEvents.push(rec);
    logEntry(def, rec, text);
    G.toast(def.emoji + ' ' + def.name + (hasChoices ? ': decide now!' : ': ' + text), def.kind);
    G.bus.emit('event:start', { event: rec, def, text, choices: hasChoices ? choicesFor(def, rec) : undefined, result: ctx.result });
    G.bus.emit('change');
    return rec;
  }

  function resolveChoice(rec, def, idx, auto) {
    const ch = def.choices && def.choices[idx]; if (!ch) return false;
    const ctx = ctxFor(def, rec);
    let res;
    try { res = ch.apply(ctx); } catch (e) { console.error('[events] choice', def.key, e); res = null; }
    let text = (res && typeof res === 'object') ? res.text : res;
    text = text || ch.label;
    if (auto) text = 'No decision in time. ' + text;
    rec.pending = false; rec.ci = idx; delete rec.costs;
    const dur = (ch.durationSec != null ? ch.durationSec : def.durationSec) || 0;
    const keep = dur > 0;
    if (keep) rec.endAt = U.now() + dur * 1000;
    const s = S();
    for (let i = s.eventLog.length - 1; i >= 0; i--) {
      const e = s.eventLog[i];
      if (e.key === def.key && e.at === rec.startAt) { e.text += ' → ' + text; e.choice = ch.label; break; }
    }
    G.toast(def.emoji + ' ' + text, def.kind === 'bad' && /spared|dried|protected|back before|held/.test(text) ? 'good' : def.kind);
    if (!keep) removeActive(rec);
    G.bus.emit('event:choice', { event: rec, def, choice: idx, text, auto: !!auto });
    if (!keep) G.bus.emit('event:end', { event: rec, def });
    G.bus.emit('change');
    return true;
  }

  function choose(id, idx) {
    try {
      ensure();
      const rec = S().activeEvents.find(r => r.id === id);
      if (!rec || !rec.pending) return false;
      const def = DEF[rec.key]; if (!def || !def.choices) return false;
      idx = Number(idx);
      if (!Number.isInteger(idx) || idx < 0 || idx >= def.choices.length) return false;
      const cost = (rec.costs && rec.costs[idx]) || 0;
      if (cost > 0 && !G.spend(cost)) return false;
      return resolveChoice(rec, def, idx, false);
    } catch (e) { console.error('[events] choose', e); return false; }
  }

  // ---------- scheduler ----------
  function season() { try { return G.calendar().season; } catch (e) { return 'spring'; } }
  function eligible(def, seas, level) {
    if (!(def.weight > 0)) return false;
    if (def.seasons && def.seasons.length && def.seasons.indexOf(seas) < 0) return false;
    if ((def.minLevel || 1) > level) return false;
    const s = S();
    if (s.flags['events.lastKey'] === def.key) return false;
    if (s.activeEvents.some(r => r.key === def.key)) return false;
    if (def.requires) { try { if (!def.requires()) return false; } catch (e) { return false; } }
    return true;
  }
  function pickDef() {
    const level = S().level || 1, seas = season(), soft = level <= 2;
    const recent = S().eventLog.slice(-2);
    const twoBad = recent.length === 2 && recent.every(e => e.kind === 'bad');
    const twoGood = recent.length === 2 && recent.every(e => e.kind === 'good');
    const pool = defs.filter(d => eligible(d, seas, level));
    return U.weightedPick(pool, d => {
      let w = d.weight;
      if (d.kind === 'bad') { if (soft) w *= 0.5; if (twoBad) w *= 0.35; }
      else { if (soft) w *= 1.6; if (twoGood) w *= 0.6; }
      return w;
    });
  }
  function expire(now) {
    S().activeEvents.slice().forEach(rec => {
      const def = DEF[rec.key];
      if (!def) { removeActive(rec); return; }
      if (now < rec.endAt) return;
      if (rec.pending) { resolveChoice(rec, def, def.choices.length - 1, true); return; }
      removeActive(rec);
      G.bus.emit('event:end', { event: rec, def });
      G.bus.emit('change');
    });
  }
  function schedule(now) {
    const s = S(), f = s.flags;
    if (!f['events.nextAt']) f['events.nextAt'] = Math.max(s.startedAt + 60000, now) + U.rand(25000, 90000);
    if (now < f['events.nextAt']) return;
    if (now - s.startedAt < 60000) { f['events.nextAt'] = s.startedAt + 60000 + U.rand(5000, 30000); return; }
    if (s.activeEvents.length >= MAX_ACTIVE) { f['events.nextAt'] = now + 20000; return; }
    const def = pickDef();
    if (!def) { f['events.nextAt'] = now + 30000; return; }
    f['events.nextAt'] = now + U.rand(120000, 240000);
    f['events.lastKey'] = def.key;
    startEvent(def);
  }

  G.bus.on('tick', p => {
    try {
      ensure();
      const now = (p && p.now) || U.now();
      expire(now);
      schedule(now);
    } catch (e) { console.error('[events] tick', e); }
  });

  G.bus.on('init', () => {
    try {
      const s = ensure(), now = U.now();
      s.activeEvents = s.activeEvents.filter(r => r && DEF[r.key] && (r.pending || now < r.endAt));
      s.activeEvents.slice().forEach(rec => {
        if (!rec.pending) return;
        const def = DEF[rec.key];
        if (now >= rec.endAt) { resolveChoice(rec, def, def.choices.length - 1, true); return; }
        setTimeout(() => {
          try { if (rec.pending) G.bus.emit('event:start', { event: rec, def, text: def.text(ctxFor(def, rec)), choices: choicesFor(def, rec), resumed: true }); } catch (e) { console.error(e); }
        }, 50);
      });
      const f = s.flags;
      if (!f['events.nextAt'] || f['events.nextAt'] < now) f['events.nextAt'] = Math.max(s.startedAt + 60000, now) + U.rand(25000, 75000);
    } catch (e) { console.error('[events] init', e); }
  });

  // ---------- public API ----------
  G.Events = {
    register(def) {
      if (!def || !def.key || DEF[def.key]) return false;
      def.weight = def.weight == null ? 1 : def.weight; def.seasons = def.seasons || ['spring', 'summer', 'fall', 'winter']; def.minLevel = def.minLevel || 1;
      defs.push(def); DEF[def.key] = def; return true;
    },
    definitions: defs,
    growthMult: key => combined('growth', key),
    yieldMult: key => combined('yield', key),
    animalMult: key => combined('animal', key),
    priceMult: key => combined('price', key),
    active() { ensure(); const now = U.now(); return S().activeEvents.filter(r => r && DEF[r.key] && (r.pending || now < r.endAt)); },
    pending() { return G.Events.active().filter(r => r.pending); },
    def: key => DEF[key] || null,
    trigger(key) {
      const def = DEF[key]; if (!def) return null;
      ensure();
      S().activeEvents.filter(r => r.key === key).forEach(removeActive);
      S().flags['events.lastKey'] = key;
      try { return startEvent(def); } catch (e) { console.error('[events] trigger', key, e); return null; }
    },
    choose,
    describeMods,
    timeLeft
  };
})();
