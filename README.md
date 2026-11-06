# 🌾 Kellyville

A cozy, Hay Day–style farming game set in **Eastern Washington**: Palouse wheat and lentils, Yakima hops and mint, Walla Walla sweet onions and wine, Wenatchee apples and cherries, Columbia Basin potatoes under center pivots.

Built for phones and playable offline. The whole game is one self-contained `index.html` with no downloads, accounts or external assets.

## Play

- Open `index.html` in any mobile or desktop browser.
- Or enable **GitHub Pages** (Settings → Pages → Deploy from branch → `main` / root) and play at `https://krazow.github.io/Kellyville/`. On a phone, "Add to Home Screen" gives a full-screen app.

## Features

- **Your own farmer:** pick a name, farm name and avatar (editable any time in the Almanac).
- **Real-time farming:** 16 regional crops with seasons (a 90-second day and 7-day seasons). Out-of-season planting halves the yield.
- **Animals:** chickens, dairy cows, sheep and bees, fed from your own Feed Mill.
- **11 production buildings:** grain mill, bakery, creamery, cider press, winery, hop brewery, fry shack, kitchen, mint distillery, loom and feed mill.
- **Truck orders:** customers from Spokane, Moscow, Ellensburg, the Tri-Cities and more. Some are express orders with bonus pay.
- **Living market:** prices drift daily.
- **27 unexpected farm events** that hurt or help:
  - Bad: Palouse dust storms, wildfire smoke, heat domes, irrigation curtailment, late frost, hail, cherry-splitting rain, codling moth and grasshoppers.
  - Good: Perfect Palouse rain, bumper crops, the Sweet Onion Festival, the Yakima hop rush, the Ellensburg Rodeo, Port of Kalama export surges and 4-H kids lending a hand.
  - Some events ask you to decide, such as paying a fire crew or hiring helicopters to dry the cherries.
- **Protective upgrades:** center-pivot irrigation, windbreak trees, frost fans, firebreaks, apiary partners and cold storage each blunt the matching disasters.
- Progress saves automatically in the browser.

## Development

The source lives in `src/` as separate modules (`core`, `data`, `events`, `economy`, `ui`). `docs/ARCHITECTURE.md` describes the contract between them.

```bash
python3 build.py                     # rebuilds index.html from src/
python3 tests/test_integration.py    # headless mobile-viewport smoke test (needs Playwright + Chrome)
```

Edit `src/`, never `index.html` directly.
