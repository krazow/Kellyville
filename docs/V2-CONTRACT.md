# Kellyville v2 redesign: module contract

Read `docs/ARCHITECTURE.md` (the v1 contract) and `src/core.js` first. v2 adds a walkable farm world, tractors, beef cattle, a farm stand with customers and a farm-to-table restaurant (in the spirit of a celebrity-farmer TV farm, but **never** use any real show, person or brand name; everything is original and set in Eastern Washington). Everything is still ONE offline HTML file with no external assets: emoji, CSS and canvas/SVG only.

Build order: core, data, events, economy, **machines, ranch, stand, restaurant**, ui, **world**. Each module is a plain IIFE on `window.G`, defensive (guard every lookup, never throw from bus handlers), and must work if any OTHER v2 module is missing.

## New platform APIs (already implemented)
- `G.addModHook(type, fn)` where type is `'growth'|'yield'|'animal'|'price'` and `fn(key) -> multiplier` (yield >1 = more harvest; growth >1 = slower).
- `G.injectCSS(id, cssText)`: modules put their own CSS here. **Only the World agent edits styles.css, body.html and ui.js.** Use the existing palette: cream cards `#fff8e7`, ink `#4a2c12`, gold `#f2b631`, green `#5fb53c`, red `#d9533b`, rounded 16–20px corners, chunky shadows, heavy system-ui type.
- `G.panels[key] = { title(arg), sub?(arg), render(arg) -> html string (or null to close), onAction(action, el, arg, event), live?: bool }`. Open it with `G.openPanel(key, arg)` and close it with `G.closePanel()`. Inside the html, every clickable element is `data-act="pact" data-pa="<action>"` plus any `data-*`. A button with `aria-disabled="true" data-why="reason"` toasts the reason instead of acting. `live:true` re-renders every 500 ms (only when the html changed, and never while an input is focused). Panels show in the existing bottom sheet, and existing CSS classes are available: `.btn .btn-gold .btn-green .btn-gray .btn-red .sm .off`, `.sub` (section label), `.need.ok/.no` chips, `.empty-note`, `.lockpill`, `.hscroll`, `.mini>i` (progress bar), and timers via `G.uikit.tm('bar'|'txt', startMs, endMs)` attributes, which the UI updates automatically.
- `G.showModal({emoji, title, text, html?, kind:'good'|'bad'|'neutral', buttons:[{label, cls, onClick}], confetti})`.
- `G.uikit`: `esc, fmt, fmtT, needChips(req), iEmoji(k), iName(k), tm, fly, confetti, openSeed(plotIdx), openBuilding(bIdx), openEvent(id), closeSheet, sheetOpen(), showTab('farm'|'orders'|'shop'|'barn'|'almanac'), tab()`.
- `G.Events.register(def)` adds a new random event (same def format as events.js: key, name, emoji, kind, seasons, minLevel, weight, durationSec, desc, text(ctx), onStart(ctx), mods, choices, mitigatedBy). Register on load, not on init. Read `src/events.js` for the exact ctx and the shape of choices.
- State: put module state under `G.state.<module>` (e.g. `G.state.ranch`), created lazily with defaults in an `ensure()` function called on `init` and `state:reset` and before use (old saves won't have it).
- Calendar: `G.calendar()` gives `{day, season, dayProgress}`. 1 day = 90 s. Daytime is roughly dayProgress 0.05–0.8.

## Module APIs other modules rely on
### machines.js → `G.Machines` (Agent: Machines)
`list()` (defs), `owned()` (keys), `equipped()` → def or null (the tractor the player drives), `equip(key)`, `buy(key)`, `isDriving()`, `setDriving(bool)`, `yieldBonus(cropKey)`. Each def is `{ key, name, emoji, cost, level, desc, yieldBonus (e.g. 0.10 = +10%), speed (walk-speed multiplier, 1.4–2.6), radius (tiles harvested around the tractor while driving, 0–2), seeder:boolean (auto-plants the last crop on empty plots it drives over), fuelPerMin?, color (CSS color for the world sprite) }`. Panel key `'machines'` (tractor shed). Bus: `machine:bought`, `machine:equip`, `drive:start`, `drive:stop`.
### ranch.js → `G.Ranch` (Agent: Ranch)
`herd()` → `[{ id, stage:'calf'|'yearling'|'steer'|'cow'|'bull', emoji, scale (0.6–1.3), hungry:boolean, name? }]`, `pastureCap()`. Panel key `'ranch'`. Products it adds to `G.DATA.products`: **`ground_beef`, `ribeye`, `brisket`** (exact keys; restaurant uses them), plus optional `leather`. Bus: `ranch:sold`, `ranch:born`.
### stand.js → `G.Stand` (Agent: Stand)
`isBuilt()`, `customers()` → `[{ id, emoji, phase:'arriving'|'browsing'|'paying'|'leaving', t:0..1 progress within the phase, mood?:'happy'|'meh'|'sad' }]`. Panel key `'stand'`. Bus: `stand:sale {key, n, coins}`.
### restaurant.js → `G.Restaurant` (Agent: Restaurant)
`stage()` → `'none'|'permit'|'building'|'open'`, `isServing()`, `customers()` → `[{ id, emoji, phase:'arriving'|'seated'|'eating'|'leaving', t:0..1, table?: index }]`, `tables()` (count). Panel key `'restaurant'`. Bus: `restaurant:served`, `restaurant:review`.

### world.js → `G.World` (Agent: World)
Owns the walkable farm. `G.World.goTo(zoneId)` walks the player to a zone. Zone ids: `fields, pens, buildings, barn, orders, shop, shed, pasture, stand, restaurant, house`.

## Existing product keys you can use
crops: wheat, lentils, chickpeas, peas, alfalfa, canola, corn, potatoes, sweet_onions, asparagus, mint, hops, apples, cherries, grapes, pumpkins.
products: chicken_feed, cow_feed, sheep_feed, eggs, milk, wool, honey, flour, bread, butter, cheese, apple_cider, apple_pie, cherry_pie, wine, ipa, french_fries, onion_rings, hummus, lentil_soup, mint_oil, wool_sweater, pumpkin_pie, honey_cake, grape_juice, rose, hefeweizen, mint_tea, wool_scarf.

## Testing
Each agent: node-test your module with stubs (`global.window = global; global.document = undefined; localStorage` stub). Load `src/core.js`, `data.js`, `events.js`, `economy.js`, then your module. Emit `init`, simulate time by stubbing `Date.now`, and run every action and every registered event (`G.Events.trigger(key)`). Then run the full browser build with `python3 build.py` and `/usr/bin/google-chrome` via Python playwright at 390x844 `is_mobile`/`has_touch`: open your panel with `G.openPanel(key)`, screenshot it, view it with the Read tool, and fix any console errors. Other agents edit other files in parallel, so a build may include their half-finished modules; if their error isn't yours, ignore it. Write test scripts under `/home/claude/kellyville/tests/<module>/` only.
