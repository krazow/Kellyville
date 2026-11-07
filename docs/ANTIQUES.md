# Kellyville Antique Store: contract

The user asked: "add a buy and sell store for antiques to the farm, at a cost."
The store sits across County Rd 9 on a new roadside strip. World zone `antiques` covers tiles x 16..24, y 29..32. Its storefront faces the camera (south), and the walk-up point is on the front walk at (20, 32.55). The map is now 40×35 tiles; the bottom row (y 34) is hills.

Read `docs/V2-CONTRACT.md` (module rules, panels, `G.injectCSS`, `G.Events.register`, `G.showModal`) and `docs/ART-3D.md` (3D art hooks and helper kit H) as needed. Look at `src/stand.js` (a shop with customers) as a reference.

## Already done (world.js, by the coordinator)
- The zone, Go-to entry, collision (the building footprint is solid once built) and walk-up action:
  - not built: "🏺 Open an antique store" → `G.openPanel('antiques')`.
  - built: "🏺 Antique store", or "💰 Antique offers (N)" when `offerCount() > 0`.
- A flat fallback drawing.
- Shoppers drawn walking from the road around to the front door, from `G.Antiques.customers()`.
- The map redraws its static art on the `antiques:change` bus event, and when `level()`, `upgrades()` or the display keys change.

## Logic: `src/antiques.js` → `G.Antiques` (Agent: Antiques Logic)
**API**
- `isBuilt()`, `build()`: costs coins (about 1,500, unlocks at level 6), with a celebratory `G.showModal`.
- `name()` / `setName(s)`: player-named, sanitized, default "<playerName>'s Antiques".
- `level()`: 1..3. `upgrades()`: owned upgrades as `{ key: true }`, e.g. `porch`, `workshop`, `neonSign`, `appraiser`, `secondFloor`.
- `display()`: up to 6 `{ key, emoji, name }` for items currently on display; the art shows them on the porch and in the windows.
- `customers()`: `[{ id, emoji, phase: 'arriving'|'browsing'|'leaving', t: 0..1, mood }]`, kept in memory only and capped at 4.
- `offerCount()`: number of pending buyer offers.
- Emit `antiques:change` (plus `change`) only on structural changes (built, level, upgrades, display contents), not every tick.

**Data:** `G.DATA.antiques[key] = { name, emoji, category, era, baseValue, rarity: 'common'|'uncommon'|'rare'|'legendary', desc }`.
- About 30 items with Eastern Washington and Inland Northwest flavor. Examples:
  - a Palouse barn-find wagon wheel, a cast-iron skillet, a hand-crank butter churn, galvanized milk cans
  - a cream separator, a cast-iron tractor seat, a railroad lantern, a Depression-glass candy dish
  - an Expo '74 Spokane World's Fair souvenir, a grain-elevator tin sign, a mason jar collection, a washboard
  - a steamer trunk, a crank gramophone, a rotary phone, a manual typewriter, a pocket watch, a hand-stitched quilt
  - a cowboy saddle, a brass cowbell, a vintage feed-sack dress, a kerosene lamp, an oak icebox, a film camera
- Never include Native American artifacts, human remains, ivory, or anything illegal to trade. Use no real brand names.

**Buying:** rotating sources that restock each in-game day: a Walla Walla estate sale, a Ritzville farm auction, a Spokane flea market, a Moscow–Pullman yard sale, and an occasional "Barn find" tip.
- Each listing has a condition (poor / fair / good / mint) and a price around value × source discount × randomness.
- Some listings are bargains and some are overpriced. The `appraiser` upgrade reveals the true value range.

**Inventory and Workshop:** owned items keep a condition and their purchase price.
- Restoring an item (needs the `workshop` upgrade) costs coins plus real time (1–4 min) and raises its condition one step.
- Value = baseValue × condition multiplier (poor .5, fair 1, good 1.6, mint 2.5) × a small market drift.

**Selling:**
- Put items on display: 2 slots at level 1, up to 6 with upgrades.
- Shoppers spawn in daytime while the store is built and something is on display. Spawn rate depends on reputation, upgrades, season (summer tourists), and events.
- Shopper types: collectors, pickers, interior designers, Seattle tourists, local ranchers.
- Shoppers browse, then either buy at your price tier (Bargain 0.9× / Fair 1.2× / Collector 1.6× of value) or leave an **offer**.
- Offers are accepted, declined, or countered in the panel. A counter has a chance to succeed scaled by how greedy it is; a failed counter loses the buyer.
- The player can also quick-sell any item to a wholesale "picker" at 0.6× value.
- Track profit stats.

**Farm finds:** on the `harvested` bus event, about a 4% chance to dig up a common or uncommon antique (old horseshoe, glass bottle, rusty tool), with a toast. These go to the antique inventory, not the barn.

**Costs and upgrades:** build cost, upgrade costs (more display slots, workshop, appraiser, porch for more foot traffic, neon "OPEN" sign for evening traffic, second floor), and restoration fees.
- Balance: buying smart and restoring roughly doubles the money; the store pays back in about 20 minutes of play.

**Events** (3 via `G.Events.register`, only when built):
- "Appraisal fair in Spokane" (good; value boost).
- "TV picker crew stops by" (good; a big buyer, with a choice).
- "Reproduction scare" (bad; a fake is discovered, with a choice to refund for reputation or not).

**Panel `'antiques'`** (`live: true`, polished at 390 px wide, CSS via `G.injectCSS('antiques', ...)`):
- Not built: a build card explaining buy-low/restore/sell-high and the cost.
- Built: header (store name with rename, reputation ⭐, today's sales, open/closed) and in-panel segmented tabs: **Floor** (display slots plus offers with Accept / Counter / Decline, plus a shopper feed), **Buy** (sources and listings with condition and price), **Workshop** (restore queue), **Collection** (inventory, put on display, quick-sell), **Upgrades**.
- Use `data-act="pact" data-pa=...`, and `aria-disabled` with `data-why` for unaffordable actions.

## Art: `src/art-antiques.js` (Agent: Antiques Art)
- `G.WorldArt.structures.antiques = { ground(c, ctx, H), props(ctx, H) }`, where `ctx = { rect (ground px), P_, built, level, display: [{key, emoji, name}], upgrades, name }`.
- **Not built:** a flat lot with an upright "OPEN AN ANTIQUE STORE" sign prop.
- **Built:** a charming 3D small-town antique store: an old false-front brick or clapboard building with a big hand-painted "ANTIQUES" sign plus the store name.
  - Front porch (bigger when `upgrades.porch`) with rocking chairs, a wagon wheel leaning on the wall, enamel signs, and milk cans.
  - Display windows showing up to 6 `display` emoji items on shelves.
  - A neon "OPEN" sign glowing at night when `upgrades.neonSign` (via `H.light`).
  - A second storey when `upgrades.secondFloor` or `level >= 3`.
  - A workshop lean-to with tools when `upgrades.workshop`.
  - Ground: a gravel lot, a walk from the road around to the front door at y about 32–33, and an old rusty pickup or vintage gas pump as a prop. Keep everything within x 15..25, y 28.6..33.6.
  - The storefront faces SOUTH toward the camera; the road is behind it (north).
- Follow ART-3D.md: north-west light, cast shadows, crisp outlines, deterministic randomness, seasons (P_.snow), night glow.

## Testing
- `python3 tests/art_shot.py <name> antiques [--season winter] [--night] [--zoom 1.5]` screenshots near the store. Its setup does not build the store, so write your own script under `tests/antiques/` (copy art_shot.py) that builds the store, buys and displays items, sets upgrades, then screenshots.
- The logic agent node-tests the full loop with stubbed time (build, buy, restore, display, shoppers buy and offer, counters, farm finds, every event) and screenshots the panel tabs.
- Until `src/antiques.js` exists, the art agent stubs `G.Antiques` in its playwright script after load and calls `G.World.repaint()`.
- Do NOT git commit. Edit only your own files: logic agent `src/antiques.js` and `tests/antiques/logic_*`; art agent `src/art-antiques.js` and `tests/antiques/art_*`.
