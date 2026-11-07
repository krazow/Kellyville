# Kellyville 3D art pass: brief for art agents

Goal: give the walkable farm a **top-down 3D look** (Hay Day–style three-quarter view): chunky, crisp, cartoon-y, with volumes that read as solid objects. The engine (`src/world.js`) already does the projection. You only write drawing code in **your own `src/art-*.js` file**. Never edit world.js, ui.js, styles.css or another agent's file. Do NOT git commit.

## The camera (already implemented)
- A three-quarter orthographic camera looks **north**. The ground plane is foreshortened vertically by `H.F = 0.75`. Heights rise straight up the screen at `H.HZ = 0.8` per world px.
- You draw in **ground space**: x and y in world px (1 tile = `H.T` = 40 px; the map is 40×30 tiles). The canvas transform squashes y by F for you.
- `H.P3(x, y, z)` → `[x, y']` converts a 3D point (z = height in world px) to ground-space draw coordinates. `H.lift(z)` gives the same height as a y offset.
- Visible faces of a block are its **top** and its **south (front) face**. With a north-facing camera, east and west walls are edge-on. Fake extra depth with shading, bevels, roof overhangs and slightly visible side planes if you like, but keep the projection consistent.
- **Lighting:** the sun is in the north-west (upper left). Top faces are brightest, south faces are mid-tone, and darker toward the bottom (ambient occlusion). Cast shadows fall to the south-east via `H.castShadow(c, x, y, w, d, h, alpha)`. Every upright object gets a contact shadow plus a cast shadow.

## Helper kit `H` (passed as the last argument to every hook)
`T W H F HZ TAU Z PAL POND TABLE_XS TABLE_YS ROAD0 ROAD1 PEN_POS PASTURE_GATE DECOR_TREES SPAWN SUN`
- 3D: `lift(z)`, `P3(x,y,z)`, `poly(c, [[x,y,z],...], fill, stroke, lw)`, `box(c, x, y, w, d, h, {top, front, stroke, lw, z0})`, `cyl(c, cx, cy, r, h, {side, top, hi, dark, shade, z0})`, `castShadow(c, x,y,w,d,h,a)`, `light(x, y, z, r, rgba)` (night glow; call it **inside a props() builder**, not inside body).
- Upright drawing: `bbAt(c, x, y, fn)` undoes the squash around ground point (x, y), so inside fn you draw like a flat sprite standing on the ground. Use it for signs, people, text and flat-art details on a wall. `em(c, emoji, x, y, size, {flip, rot, alpha, force})`, `emStatic`, `plate(c, cx, cy, text, {size, bg, fg, bd})`, `bubble`, `shadow(c, x, y, rx, a)` (contact shadow) all stand themselves up automatically.
- Misc: `rr(c,x,y,w,h,r)` (rounded-rect path), `tree(c, x, y, scale, kind 0|1, P_, seed)`, `fence(...)`, `fenceRect(...)`, `hash(str)`, `mulberry(seed)` (deterministic RNG; **never use Math.random in static art**, because tiles are re-rendered and must match at the seams), `clamp lerp ease`, `S()` (game state), `iEmoji(k) iName(k)`, `vis(x, y, pad)`, `plotRect(i)` (tile units, 2×2), `buildingSlot(i)` (tile units), `layout()` (L: `.pens .lots .tables .stage`), `standBuilt() restStage() tableCount() hasTractor() equipped() driving() avatarEm()`, `upright()`.
- `H.legacy.*`: the old flat painters, for reference or reuse of details.
- `P_` = season palette (`PAL[season]`), with keys g1, g2, tuft, hill, hillA, hillB, path, pathD, soil, soilD, soilL, pasture, deck, pond, pond2, road, roadD, trees[3], snow (0/1), flower (0/1). Support all four seasons (winter = snow caps on roofs, posts and trees). Test with `--season winter` and `--night`.

## Hooks (register in your IIFE)
```js
(function () { 'use strict'; const G = window.G; const A = G.WorldArt = G.WorldArt || {};
  A.structures = A.structures || {}; A.terrain = A.terrain || {}; A.actors = A.actors || {};
  A.structures.barn = { ground(c, ctx, H) {...}, props(ctx, H) { return [{ sortY, x0, y0, x1, y1, hit, body(c) {...} }]; } };
})();
```
- **Structures:** `G.WorldArt.structures[key] = { ground?(c, ctx, H), props?(ctx, H) }`.
  - `ground` is flat stuff baked into the cached terrain tiles: footprint, aprons, cast shadows, decks, floors.
  - `props` returns upright pieces, each `{ sortY, x0, y0, x1, y1, hit?, body(c) }`:
    - `sortY` is in **tile units**: the y where the piece meets the ground at its front. Characters with y < sortY are drawn behind it, which is how walking behind a building works.
    - `x0..y1` is a generous bounding box in ground px. `y0` must include `lift(height)` plus roof and chimney.
    - `hit` is a tighter box for taps.
    - `body(c)` draws at absolute coordinates. It is cached at device resolution and only re-rendered on zoom or layout change, so it can be detailed.
  - Split anything characters can be inside or around: a pen is a back-fence prop (sortY = top edge) and a front-fence prop (sortY = bottom edge), and the deck stays on the ground.
  - `ctx` always has `rect` (ground px: x, y, w, h), `P_` and `zone`. Keys and extra ctx:
    - `barn`, `house`, `shop`, `orders`: no extra ctx.
    - `shed`: `{owned}`.
    - `stand`: `{built}`.
    - `restaurant`: `{stage:'none'|'permit'|'building'|'open', tables, tablePos:[{x,y}] (tile units)}`.
    - `building`: `{type, bld, def}`, one per owned production building.
    - `lot`: `{type, def}` for buildings for sale.
    - `pen`: `{pen:{type, owned, rect:{x,y} (tile units, 6×4), gate:{x,y,side}}, type, owned, def}`.
    - `pasture`: `{gate}`.
    - `trees`: `{decor, windbreak}`, covering the tree line, decor trees, lamp posts, hay bales and well.
  - Return `props` for everything upright. If you define a key you fully own it: the legacy painter is skipped.
- **Terrain:** `G.WorldArt.terrain[name] = (c, P_, H) => {}` with names `ground, hills, paths, road, plots, pond, pivotTrack`. Optional `G.WorldArt.extraProps = H => [props...]` adds free-standing upright scenery.
- **Actors** (drawn every frame; keep them cheap: cached shapes and emoji, no per-frame gradient spam). `G.WorldArt.actors[name] = (c, o, H) => {}`, drawn in ground space; use `bbAt` for upright parts and `shadow` / `castShadow` for ground parts.
  - `player`: `o = {x, y (feet), t, dir, moving, walk, driving, def, avatar, name, drawTractor(c, o)}`. It must draw the name tag. When driving, draw the tractor via `G.WorldArt.actors.tractor` or `o.drawTractor`.
  - `tractor`: `{x, y, dir, def (color, key, name), t, moving, withDriver, avatar}`.
  - `npc`: `{x, y, cu (emoji, phase, mood, t), walk, sit, t, i}`.
  - `animal`: `{x, y, type, emoji, size, t, i, dir, moving, status, productEmoji, bees}`, showing a 🍽️ bubble when hungry and a product bubble when ready.
  - `cattle`: `{x, y, h (stage, emoji, scale, hungry, name), size, t, i, dir, moving, grazing, night, hungry}`.
  - `duck`: `{x, y, a, t, i}`.
  - `vehicle`: `{x, y, dir, emoji, t, kind}`, for road traffic.
  - `plot`: `{i, p (status, crop), x, y, w, h (ground px, 2×2 tiles), crop (emoji, name), prog 0..1, t, now, P_}`. This dynamic layer draws crops on a plot; the soil bed itself is `terrain.plots`. It must keep the progress ring, ready sparkle and glow, and the withered look.

## Must keep
- Layout and collision are unchanged: draw within each zone's footprint (`H.Z[...]`, tile units). Labels stay readable: use `plate()` for each zone name, for example 'THE BARN', 'FARMHOUSE', 'TRACTOR SHED', 'FARM STAND', 'CO-OP STORE', 'ORDERS', each building's name, pen names, 'CATTLE PASTURE', 'YOUR FIELDS', 'BUY LAND 🪙cost', 'COUNTY RD 9', and the restaurant signage per stage.
- Performance on phones: props are cached, so they can be rich. Actors run every frame: aim for under 0.3 ms each.
- Crisp at every zoom. Draw shapes, not stretched bitmaps.

## Testing (each agent, in parallel)
`python3 tests/art_shot.py <name> <zone> [--season winter] [--night] [--zoom 1.5]` builds and screenshots an emulated 3× iPhone with a full mid-game farm to `shots/art/<name>.png`. It exits 1 on console errors. Look at every shot with the Read tool and iterate until it looks great. Other agents are editing their own art files at the same time; if a build error clearly comes from another file, ignore it. Prefix your shot names with your agent name.
