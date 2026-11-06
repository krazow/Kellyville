# Kellyville — module contract

A Hay Day–style mobile farming game set in Eastern Washington (Palouse wheat country, Yakima Valley, Walla Walla, Wenatchee, Columbia Basin, Tri-Cities, Ellensburg, Spokane). It ships as ONE self-contained HTML file that runs offline (no CDNs, no external fonts or images, emoji + CSS + inline SVG only). It is built by concatenating:

```
src/styles.css  -> <style>
src/body.html   -> <body> markup
src/core.js     (engine, DONE: read it fully, do NOT edit it)
src/data.js     (Agent: Data)
src/events.js   (Agent: Events)
src/economy.js  (Agent: Economy)
src/ui.js       (Agent: UI, also writes styles.css + body.html)
```

Every module is a plain IIFE `(function(){ 'use strict'; const G = window.G; ... })();` with no imports. Modules talk only through `window.G`, the `G.bus` event bus and the `G.state` save object. Wrap every bus handler body in defensive code: a missing optional field must never crash the game.

## Engine facts (from core.js)
- Real-time. 1 game day = `G.DAY_SEC` (90s); 7 days per season; seasons `spring|summer|fall|winter`. `G.calendar()` → `{day, dayOfSeason, season, year, dayProgress}`.
- Bus events emitted by core: `init` (once at boot, after save loaded), `tick` `{now, cal}` every 500ms, `change` (state changed: UI re-render), `newday`, `newseason`, `levelup` `{level}`, `coins` `{delta, reason}`, `planted`, `harvested` `{plotIdx, cropKey, n}`, `collected` `{kind, key, n}`, `sold`, `expansion`, `state:reset`.
- Actions: `G.plant(i,crop)`, `G.harvest(i)`, `G.clearWithered(i)`, `G.buyPlot()`, `G.plotCost()`, `G.buyAnimal(type)`, `G.feedAnimal(i)`, `G.collectAnimal(i)`, `G.buyBuilding(type)`, `G.startRecipe(bIdx, recipeId)`, `G.collectBuilding(bIdx)`, `G.buyExpansion(key)`, `G.hasExpansion(key)`, `G.sell(key,n)`, `G.sellPrice(key)`.
- Inventory: `G.qty(k)`, `G.hasItems(req)`, `G.addItem(k,n)`, `G.removeItems(req)`, `G.barnCount()`, `G.barnFree()`, `G.itemInfo(k)`, `G.addCoins(n,reason)`, `G.spend(n)`, `G.addXP(n)`, `G.xpForLevel(lvl)`.
- Event helper: `G.affectPlots({crops:'all'|[keys], fraction, mode:'destroy'|'delay'|'reduce'|'boost'|'ripen', amount, includeReady})` → affected plot indexes.
- `G.toast(msg, kind)` where kind is `'good'|'bad'|'info'`; UI replaces it.
- State (`G.state`): `coins, xp, level, barn{key:qty}, barnCap, plots[{status:'empty'|'growing'|'ready'|'withered', crop, plantedAt, readyAt, yieldMult}], animals[{type,status:'hungry'|'producing'|'ready',readyAt}], buildings[{type, queue[{recipeId,startAt,readyAt}], maxQueue}], orders[], market{}, activeEvents[], eventLog[], ownedExpansions[], stats{}, flags{}`.

## data.js → `G.DATA` (assign into the existing objects, e.g. `Object.assign(G.DATA.crops, {...})`)
```js
crops[key]     = { name, emoji, seedCost, growSec, yield, xp, level, sellPrice, seasons:['spring',...], region, desc }
products[key]  = { name, emoji, sellPrice, desc }        // every animal product & building output. Crops do NOT need a product entry.
animals[key]   = { name, emoji, cost, level, max, feed:productKey, feedQty, produceSec, product:productKey, productQty, xp, desc }
buildings[key] = { name, emoji, cost, level, desc, recipes:[{ id, name, inputs:{key:qty}, output:productKey, qty, sec, xp, level }] }
expansions[key]= { name, emoji, cost, level, desc, barnCap?, maxPlots?, requires?, tag? }
G.DATA.regions = { key: { name, emoji, blurb } }   // flavor, used by UI/events
```
Every key used in inputs/feed/output must exist in crops or products. Feed items come from a building (e.g. a feed mill makes chicken/cow feed from wheat/alfalfa/corn).
Expansion `tag` values with gameplay meaning that events.js reads: `'irrigation'` (center-pivot: protects from drought/heat), `'windbreak'` (reduces wind/dust damage), `'frost_fans'` (orchard wind machines: reduce frost damage), `'beehives'` (pollination bonus), `'firebreak'` (reduces wildfire damage), `'cold_storage'` (protects from price crashes: let events read it).

## events.js → `G.Events`
Must expose: `growthMult(cropKey)`, `yieldMult(cropKey)`, `animalMult(animalKey)`, `priceMult(productKey)` (all return numbers; 1 = neutral; neutral when no event active), `definitions` (array), `trigger(key)` (force one: for testing/debug), `active()` (list).
Active event record stored in `G.state.activeEvents`: `{ id, key, startAt, endAt }` (re-derive effects from the definition, so saves stay small). Push log entries to `G.state.eventLog` (`{key,name,emoji,kind,at,text}`, keep the last 30).
Emits: `event:start` `{event: activeRecord, def, text, choices?}`, `event:end` `{event, def}`. If a def has `choices`, UI shows a modal and calls `G.Events.choose(eventId, choiceIndex)`.

## economy.js → `G.Economy`
Owns `G.state.orders` and `G.state.market`. Exposes: `orders()`, `fulfill(orderId)`, `discard(orderId)`, `canFulfill(orderId)`, `refreshMarket()`, `shopCatalog()` → `{ animals:[...], buildings:[...], expansions:[...], plot:{cost, available} }` (each entry includes key, def, locked:boolean, owned/count, affordable).
Order record: `{ id, customer, customerEmoji, region, items:{key:qty}, coins, xp, createdAt, expiresAt|null, cooldownUntil|null }`.
Emits: `order:done`, `order:new`, `market:update`.

## ui.js
Owns rendering, input, `G.toast`. Reads `G.DATA`, `G.state`, calls the actions above, and listens to bus events. Must also consume `event:start` (show a banner/modal with choices), `levelup` (a celebration), `order:*`.
