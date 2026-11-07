# Kellyville Apiary: contract

The player can **build an apiary**: a beekeeping yard beside the pond, between the pond and the restaurant (world zone `apiary`, tile rect x 27.5..30, y 2.4..7, the open ground between the pond and the restaurant; the walk-up point is on the farm path below it at (28.75, 7.5)). This is separate from, and bigger than, the existing small `bees` animal pen.

Read `docs/V2-CONTRACT.md` (module rules, panels, `G.injectCSS`, `G.Events.register`, `G.addModHook`) and `docs/ART-3D.md` (3D art hooks) as needed.

## Already done (world.js, by the coordinator)
- The zone is on the map, with a "Go to → Apiary" entry.
- The walk-up action button:
  - not built: "🐝 Build an apiary" → `G.openPanel('apiary')`
  - built: "🐝 Apiary" → panel
  - any hive ready: "🍯 Harvest honey ×N" → `G.Apiary.harvestAll()`
- A flat fallback drawing, flying 🐝 around active or ready hives (not at night, not in winter), and a 🍯 bubble over `ready` hives (🦠 over `sick` ones).
- Hive positions are `H.APIARY_SLOTS[i]` (tile units, base centre), up to 8.
- The map redraws its static art when `G.Apiary` emits `apiary:change` and when the layout signature (built, hive count, each hive's supers and away/empty state, `upgrades()`) changes.

## logic: `src/apiary.js` → `G.Apiary` (Agent: Apiary Logic)
- `isBuilt()`, `build()` → bool. Unlock at level 5. Cost about 600 coins. Celebrate with `G.showModal` and confetti.
- `hives()` → `[{ id, name, status: 'active'|'ready'|'dormant'|'away'|'sick'|'empty', strength: 0..1, fill: 0..1, supers: 0..3, queen?: 'young'|'old' }]` (in slot order, up to `maxHives()`).
- `maxHives()` (4, or 6 / 8 with upgrades), `buyHive()`, `harvest(i)`, `harvestAll()` → number of hives harvested, `readyCount()`, `upgrades()` → `{ key: true }` for owned upgrades (e.g. `bearFence`, `honeyHouse`, `moreHives1`, `moreHives2`, `windbreak`).
- Emit `apiary:change` (plus `change`) whenever built state, hive count, supers, away/empty status or upgrades change. Do not emit it on every fill tick.
- State lives in `G.state.apiary`, created lazily in `ensure()` on `init`, on `state:reset` and before use. Tick cheaply (at most once per second).
- **Real Eastern Washington beekeeping, simplified and fun:**
  - **Seasons:** spring buildup, summer main flow (fills fastest), fall a smaller flow plus prepping for winter, winter `dormant` (no honey; colonies may need a sugar-syrup feed action or strength drops).
  - **Forage:** fill speed increases with flowering crops currently planted or growing on the farm (canola, alfalfa, apples, cherries, pumpkins, mint, sweet_onions), and with active pollinator events.
  - **Harvest:** when `fill` reaches 1 the hive is `ready`. Harvesting yields `honey` (existing product) scaled by strength and supers, plus a chance of `honeycomb` and `beeswax`. Add `honeycomb` and `beeswax` to `G.DATA.products` (emoji, name, sellPrice), plus `beeswax_candle` if you add a Honey House upgrade that crafts candles. Give XP.
  - **Supers:** add a honey super (coins plus wood) to raise capacity and yield; the art shows supers as stacked boxes.
  - **Pollination:** `G.addModHook('yield', key => ...)` gives a yield bonus to pollinator crops (apples, cherries, canola, pumpkins, alfalfa, plus small effects elsewhere), scaling with active strong hives and capped at about +25%. Show the bonus in the panel.
  - **Pollination contracts:** in spring, rent hives to Wenatchee or Yakima orchards. Hives go `away` for a few minutes and come back with coins and strength. Very authentic to the region.
  - **Health:** Varroa mites (a `sick` status, treat with a coins action). Swarming (a strong hive may swarm in spring and lose half its strength unless split; splitting creates a new hive if there's room).
- Register 3 to 4 events via `G.Events.register`, only when the apiary is built:
  - "Black bear raids a hive" (bad; Blue Mountains bears; `bearFence` upgrade mitigates).
  - "Wildfire smoke grounds the foragers" (bad; fill slows for its duration).
  - "Canola bloom nectar flow" (good).
  - "Varroa mite outbreak" (bad; choice: treat vs wait).
- **Panel `'apiary'`** (`live: true`, mobile-first, CSS via `G.injectCSS('apiary', ...)`):
  - Not built: a build card explaining the payoff.
  - Built: header (hive count, pollination bonus %, season status), hive cards (emoji 🐝, name, status pill, strength bar, honey fill bar, supers, and actions: Harvest, Add super, Treat mites, Feed syrup in winter, Split), Buy hive, Pollination contracts, Upgrades.
  - Use `data-act="pact" data-pa=...` per the panel API.

## art: `src/art-apiary.js` (Agent: Apiary Art)
- `G.WorldArt.structures.apiary = { ground(c, ctx, H), props(ctx, H) }`, where `ctx = { rect, P_, built, hives: [hive records as above], slots: H.APIARY_SLOTS, maxHives, upgrades }`.
- **Not built:** a flat, staked-out clearing, plus an upright wooden sign "BUILD AN APIARY · walk up and tap" as a prop.
- **Built:**
  - Ground: a mown clover and wildflower patch, a gravel pad under the hives, cast shadows.
  - One prop per hive at its slot (sortY = slot y): a 3D Langstroth hive. It is a white or pastel box body on a wooden stand, with stacked honey supers per `supers`, a telescoping lid with a metal top, a landing board and entrance, and a light per-hive pastel colour from `hash(id)`.
    - `away` hives show an empty stand with a little "🚚 at the orchard" tag.
    - `empty` slots show nothing.
    - `sick` shows a small red tag.
    - `dormant`/winter shows snow on the lids and a wrapped tar-paper winter wrap.
  - A small 3D honey house when `upgrades.honeyHouse` (stone or wood shed with a hex-window sign) placed at the top (north) end of the yard, y about 2.4–3.3.
  - A low electric bear fence (posts plus wire) around the yard when `upgrades.bearFence`, as back and front props like the pens.
  - An "APIARY" plate.
- Optional `G.WorldArt.actors.apiaryBee(c, o, H)`, with `o = { x, y, z, t, i, k, dir }`: a tiny cute 3D bee (striped body, wings flapping by t, shadow on the ground at (x, y)). It is drawn often, so it must stay cheap (cache a sprite).
- Follow ART-3D.md: north-west light, cast shadows, crisp outlines, deterministic randomness, seasons (P_.snow), stay within the zone footprint.

## Testing
Each agent tests its own piece. `python3 tests/art_shot.py <name> apiary [--season winter] [--night] [--zoom 1.5]` screenshots the zone. Its full setup does not build the apiary, so write a small script under `tests/apiary/` (copy art_shot.py) that calls `G.Apiary.build()`, buys hives, adds supers, sets statuses, then screenshots. The logic agent node-tests the full lifecycle with stubbed time plus every registered event. Do NOT git commit. Do not edit files other than your own (the logic agent: `src/apiary.js` and `tests/apiary/*`; the art agent: `src/art-apiary.js` and `tests/apiary/art_*`).
