/* data.js — Kellyville content: crops, products, animals, buildings, expansions, regions. */
(function () {
  'use strict';
  const G = window.G;
  const D = G.DATA;
  const ALL = ['spring', 'summer', 'fall', 'winter'];

  Object.assign(D.crops, {
    wheat: { name: 'Winter Wheat', emoji: '🌾', seedCost: 2, growSec: 20, yield: 4, xp: 1, level: 1, sellPrice: 3, seasons: ALL, region: 'palouse', desc: 'Rolling Palouse hills turn gold with the staple that built the Inland Northwest.' },
    lentils: { name: 'Lentils', emoji: '🫘', seedCost: 3, growSec: 30, yield: 3, xp: 2, level: 1, sellPrice: 5, seasons: ['spring', 'summer'], region: 'palouse', desc: 'Palouse lentils: small, speedy, and proud of the "Lentil Capital" title.' },
    alfalfa: { name: 'Alfalfa', emoji: '🌿', seedCost: 3, growSec: 40, yield: 4, xp: 2, level: 1, sellPrice: 4, seasons: ['spring', 'summer', 'fall', 'winter'], region: 'columbia_basin', desc: 'Cut it, bale it, feed it; every Basin pivot circle has some.' },
    corn: { name: 'Sweet Corn', emoji: '🌽', seedCost: 5, growSec: 60, yield: 4, xp: 3, level: 2, sellPrice: 6, seasons: ['spring', 'summer'], region: 'columbia_basin', desc: 'Basin sunshine and pivot water make ears as sweet as a Saturday market.' },
    peas: { name: 'Green Peas', emoji: '🫛', seedCost: 4, growSec: 45, yield: 4, xp: 3, level: 3, sellPrice: 6, seasons: ['spring', 'fall', 'winter'], region: 'palouse', desc: 'Cool-weather peas that love Palouse rotation fields.' },
    chickpeas: { name: 'Garbanzos', emoji: '🥜', seedCost: 8, growSec: 90, yield: 3, xp: 5, level: 4, sellPrice: 12, seasons: ['spring', 'summer'], region: 'palouse', desc: 'Dry-land garbanzos: the hummus-maker\'s favorite Palouse export.' },
    canola: { name: 'Canola', emoji: '🌼', seedCost: 5, growSec: 75, yield: 4, xp: 4, level: 5, sellPrice: 7, seasons: ['spring', 'fall', 'winter'], region: 'palouse', desc: 'Bright yellow fields that bees swarm to like a rock concert.' },
    potatoes: { name: 'Russet Potatoes', emoji: '🥔', seedCost: 10, growSec: 150, yield: 5, xp: 8, level: 6, sellPrice: 12, seasons: ['spring', 'summer'], region: 'columbia_basin', desc: 'Basin russets grown under center pivots, destined for fries.' },
    sweet_onions: { name: 'Walla Walla Sweets', emoji: '🧅', seedCost: 14, growSec: 180, yield: 4, xp: 10, level: 7, sellPrice: 20, seasons: ['spring', 'summer', 'winter'], region: 'walla_walla', desc: 'So sweet you could almost eat them like an apple. Almost.' },
    asparagus: { name: 'Asparagus', emoji: '🌱', seedCost: 16, growSec: 120, yield: 3, xp: 10, level: 8, sellPrice: 26, seasons: ['spring'], region: 'tri_cities', desc: 'Spring spears shoot up overnight in the warm Tri-Cities soil.' },
    mint: { name: 'Peppermint', emoji: '🍃', seedCost: 18, growSec: 200, yield: 4, xp: 12, level: 9, sellPrice: 24, seasons: ['summer', 'fall'], region: 'yakima', desc: 'The Yakima Valley smells like a candy cane after harvest.' },
    pumpkins: { name: 'Pumpkins', emoji: '🎃', seedCost: 25, growSec: 240, yield: 3, xp: 15, level: 10, sellPrice: 38, seasons: ['fall'], region: 'spokane', desc: 'Orange giants bound for Spokane\'s fall farmers markets.' },
    hops: { name: 'Hops', emoji: '🍺', seedCost: 40, growSec: 360, yield: 5, xp: 20, level: 11, sellPrice: 26, seasons: ['summer', 'fall'], region: 'yakima', desc: 'Towering Yakima bines supply most of America\'s hops.' },
    apples: { name: 'Apples', emoji: '🍎', seedCost: 50, growSec: 420, yield: 6, xp: 25, level: 12, sellPrice: 24, seasons: ['fall'], region: 'wenatchee', desc: 'Crisp Honeycrisp from the Apple Capital of the World.' },
    cherries: { name: 'Cherries', emoji: '🍒', seedCost: 60, growSec: 480, yield: 5, xp: 30, level: 14, sellPrice: 36, seasons: ['summer'], region: 'wenatchee', desc: 'Rainier and Bing cherries: one short, sweet summer rush.' },
    grapes: { name: 'Wine Grapes', emoji: '🍇', seedCost: 70, growSec: 540, yield: 6, xp: 35, level: 16, sellPrice: 32, seasons: ['fall'], region: 'tri_cities', desc: 'Sun-soaked Red Mountain vines make big, bold fruit.' }
  });

  Object.assign(D.products, {
    chicken_feed: { name: 'Chicken Feed', emoji: '🥣', sellPrice: 6, desc: 'Wheat and cracked corn scratch mix.' },
    cow_feed: { name: 'Cow Feed', emoji: '🪣', sellPrice: 8, desc: 'Alfalfa and corn blend, cattle approved.' },
    sheep_feed: { name: 'Sheep Feed', emoji: '🌾', sellPrice: 9, desc: 'Alfalfa pellets for the Ellensburg flock.' },
    eggs: { name: 'Farm Eggs', emoji: '🥚', sellPrice: 10, desc: 'Fresh from the henhouse.' },
    milk: { name: 'Milk', emoji: '🥛', sellPrice: 16, desc: 'Cold, creamy, and straight from the dairy.' },
    wool: { name: 'Wool', emoji: '🧶', sellPrice: 32, desc: 'Soft fleece sheared off a rodeo-town sheep.' },
    honey: { name: 'Canola Honey', emoji: '🍯', sellPrice: 24, desc: 'Mild, creamy honey from canola blossoms.' },
    flour: { name: 'Palouse Flour', emoji: '🥡', sellPrice: 9, desc: 'Stone-ground wheat flour.' },
    bread: { name: 'Country Bread', emoji: '🍞', sellPrice: 42, desc: 'A warm loaf with a crackly crust.' },
    butter: { name: 'Butter', emoji: '🧈', sellPrice: 42, desc: 'Churned creamery butter.' },
    cheese: { name: 'Farmhouse Cheese', emoji: '🧀', sellPrice: 70, desc: 'Sharp, aged, and loved in Spokane.' },
    apple_cider: { name: 'Apple Cider', emoji: '🧃', sellPrice: 55, desc: 'Pressed from Wenatchee apples.' },
    apple_pie: { name: 'Apple Pie', emoji: '🥧', sellPrice: 140, desc: 'Cinnamon, butter-crust, Apple Capital pride.' },
    cherry_pie: { name: 'Cherry Pie', emoji: '🍰', sellPrice: 200, desc: 'Tart cherries in a golden lattice.' },
    wine: { name: 'Red Mountain Red', emoji: '🍷', sellPrice: 200, desc: 'A bold red from Tri-Cities grapes.' },
    ipa: { name: 'Yakima IPA', emoji: '🍻', sellPrice: 130, desc: 'Piney, citrusy, and hop-forward.' },
    french_fries: { name: 'French Fries', emoji: '🍟', sellPrice: 55, desc: 'Golden Basin russet fries.' },
    onion_rings: { name: 'Onion Rings', emoji: '⭕', sellPrice: 75, desc: 'Crispy rings of Walla Walla sweets.' },
    hummus: { name: 'Hummus', emoji: '🥙', sellPrice: 55, desc: 'Silky Palouse garbanzo dip.' },
    lentil_soup: { name: 'Lentil Soup', emoji: '🍲', sellPrice: 55, desc: 'Hearty, warm, and wintertime ready.' },
    mint_oil: { name: 'Mint Oil', emoji: '🧴', sellPrice: 110, desc: 'Distilled peppermint essence from Yakima.' },
    mint_tea: { name: 'Mint Tea', emoji: '🍵', sellPrice: 70, desc: 'A cool, bright cup of valley peppermint.' },
    wool_sweater: { name: 'Wool Sweater', emoji: '🧥', sellPrice: 100, desc: 'Cozy knit for those chilly Spokane winters.' },
    wool_scarf: { name: 'Wool Scarf', emoji: '🧣', sellPrice: 52, desc: 'A quick weave, a lot of warmth.' },
    pumpkin_pie: { name: 'Pumpkin Pie', emoji: '🥧', sellPrice: 160, desc: 'Fall on a plate, whipped cream optional.' },
    honey_cake: { name: 'Honey Cake', emoji: '🎂', sellPrice: 80, desc: 'Moist, golden, and just sweet enough.' },
    grape_juice: { name: 'Grape Juice', emoji: '🫐', sellPrice: 75, desc: 'Sweet Concord-style juice from fresh grapes.' },
    rose: { name: 'Columbia Valley Rosé', emoji: '🥂', sellPrice: 260, desc: 'Blush wine blended with a splash of cherry.' },
    hefeweizen: { name: 'Hefeweizen', emoji: '🍺', sellPrice: 60, desc: 'A hazy, easy-drinking wheat beer.' }
  });

  Object.assign(D.animals, {
    chickens: { name: 'Chicken', emoji: '🐔', cost: 60, level: 2, max: 6, feed: 'chicken_feed', feedQty: 1, produceSec: 60, product: 'eggs', productQty: 1, xp: 2, desc: 'Free-range hens pecking around the Palouse farmyard.' },
    cows: { name: 'Dairy Cow', emoji: '🐄', cost: 300, level: 5, max: 6, feed: 'cow_feed', feedQty: 1, produceSec: 150, product: 'milk', productQty: 2, xp: 6, desc: 'Ellensburg-raised Holsteins with plenty of opinions.' },
    bees: { name: 'Beehive', emoji: '🐝', cost: 350, level: 6, max: 4, feed: 'canola', feedQty: 1, produceSec: 200, product: 'honey', productQty: 2, xp: 8, desc: 'Busy bees working the canola bloom.' },
    sheep: { name: 'Sheep', emoji: '🐑', cost: 450, level: 8, max: 6, feed: 'sheep_feed', feedQty: 1, produceSec: 240, product: 'wool', productQty: 2, xp: 10, desc: 'Woolly flock from Ellensburg rodeo country.' }
  });

  Object.assign(D.buildings, {
    feed_mill: { name: 'Feed Mill', emoji: '🏭', cost: 100, level: 2, desc: 'Mixes grain and hay into animal feed.', recipes: [
      { id: 'chicken_feed', name: 'Chicken Feed', inputs: { wheat: 2, corn: 1 }, output: 'chicken_feed', qty: 2, sec: 30, xp: 3, level: 2 },
      { id: 'cow_feed', name: 'Cow Feed', inputs: { alfalfa: 2, corn: 1 }, output: 'cow_feed', qty: 2, sec: 45, xp: 4, level: 5 },
      { id: 'sheep_feed', name: 'Sheep Feed', inputs: { alfalfa: 2, wheat: 1 }, output: 'sheep_feed', qty: 2, sec: 60, xp: 5, level: 8 }
    ] },
    grain_mill: { name: 'Grain Mill', emoji: '⚙️', cost: 250, level: 3, desc: 'Stone burrs grind Palouse wheat to flour.', recipes: [
      { id: 'flour', name: 'Flour', inputs: { wheat: 2 }, output: 'flour', qty: 1, sec: 40, xp: 4, level: 3 },
      { id: 'flour_bulk', name: 'Bulk Flour', inputs: { wheat: 6 }, output: 'flour', qty: 3, sec: 100, xp: 10, level: 5 }
    ] },
    bakery: { name: 'Bakery', emoji: '🥖', cost: 400, level: 4, desc: 'Ovens warm the farm with bread and pies.', recipes: [
      { id: 'bread', name: 'Country Bread', inputs: { flour: 2, eggs: 1 }, output: 'bread', qty: 1, sec: 90, xp: 8, level: 4 },
      { id: 'honey_cake', name: 'Honey Cake', inputs: { flour: 2, honey: 1, eggs: 1 }, output: 'honey_cake', qty: 1, sec: 150, xp: 14, level: 9 },
      { id: 'apple_pie', name: 'Apple Pie', inputs: { flour: 2, apples: 3 }, output: 'apple_pie', qty: 1, sec: 180, xp: 25, level: 12 },
      { id: 'cherry_pie', name: 'Cherry Pie', inputs: { flour: 2, cherries: 3 }, output: 'cherry_pie', qty: 1, sec: 210, xp: 32, level: 14 }
    ] },
    creamery: { name: 'Creamery', emoji: '🏪', cost: 500, level: 6, desc: 'Turns fresh milk into butter and cheese.', recipes: [
      { id: 'butter', name: 'Butter', inputs: { milk: 2 }, output: 'butter', qty: 1, sec: 60, xp: 8, level: 6 },
      { id: 'cheese', name: 'Farmhouse Cheese', inputs: { milk: 3 }, output: 'cheese', qty: 1, sec: 120, xp: 14, level: 8 }
    ] },
    fry_shack: { name: 'Fry Shack', emoji: '🍔', cost: 600, level: 7, desc: 'Sizzling fryer for Basin spuds and Walla Walla onions.', recipes: [
      { id: 'french_fries', name: 'French Fries', inputs: { potatoes: 3 }, output: 'french_fries', qty: 1, sec: 90, xp: 12, level: 7 },
      { id: 'onion_rings', name: 'Onion Rings', inputs: { sweet_onions: 2, flour: 1 }, output: 'onion_rings', qty: 1, sec: 100, xp: 16, level: 8 }
    ] },
    kitchen: { name: 'Farm Kitchen', emoji: '🍳', cost: 700, level: 5, desc: 'A big stove for soups, dips, and holiday pies.', recipes: [
      { id: 'lentil_soup', name: 'Lentil Soup', inputs: { lentils: 3, sweet_onions: 1 }, output: 'lentil_soup', qty: 1, sec: 100, xp: 10, level: 7 },
      { id: 'hummus', name: 'Hummus', inputs: { chickpeas: 3 }, output: 'hummus', qty: 1, sec: 80, xp: 10, level: 5 },
      { id: 'pumpkin_pie', name: 'Pumpkin Pie', inputs: { flour: 2, pumpkins: 2, eggs: 1 }, output: 'pumpkin_pie', qty: 1, sec: 170, xp: 24, level: 10 }
    ] },
    distillery: { name: 'Mint Distillery', emoji: '⚗️', cost: 800, level: 9, desc: 'Copper stills steam out peppermint oil.', recipes: [
      { id: 'mint_tea', name: 'Mint Tea', inputs: { mint: 2 }, output: 'mint_tea', qty: 1, sec: 60, xp: 12, level: 10 },
      { id: 'mint_oil', name: 'Mint Oil', inputs: { mint: 3 }, output: 'mint_oil', qty: 1, sec: 150, xp: 18, level: 9 }
    ] },
    loom: { name: 'Weaving Loom', emoji: '🧵', cost: 900, level: 9, desc: 'Weaves wool into warm winter wear.', recipes: [
      { id: 'wool_scarf', name: 'Wool Scarf', inputs: { wool: 1 }, output: 'wool_scarf', qty: 1, sec: 90, xp: 12, level: 9 },
      { id: 'wool_sweater', name: 'Wool Sweater', inputs: { wool: 2 }, output: 'wool_sweater', qty: 1, sec: 180, xp: 20, level: 10 }
    ] },
    cider_press: { name: 'Cider Press', emoji: '🍏', cost: 900, level: 12, desc: 'Squeezes Wenatchee apples and grapes into juice.', recipes: [
      { id: 'apple_cider', name: 'Apple Cider', inputs: { apples: 3 }, output: 'apple_cider', qty: 2, sec: 120, xp: 22, level: 12 },
      { id: 'grape_juice', name: 'Grape Juice', inputs: { grapes: 3 }, output: 'grape_juice', qty: 2, sec: 150, xp: 28, level: 16 }
    ] },
    hop_brewery: { name: 'Hop Brewery', emoji: '🛢️', cost: 1200, level: 13, desc: 'Small-batch brewhouse in Yakima style.', recipes: [
      { id: 'hefeweizen', name: 'Hefeweizen', inputs: { hops: 1, wheat: 4 }, output: 'hefeweizen', qty: 1, sec: 120, xp: 18, level: 13 },
      { id: 'ipa', name: 'Yakima IPA', inputs: { hops: 3, wheat: 2 }, output: 'ipa', qty: 1, sec: 200, xp: 30, level: 14 }
    ] },
    winery: { name: 'Winery', emoji: '🍾', cost: 1500, level: 16, desc: 'Oak barrels and Walla Walla Valley bragging rights.', recipes: [
      { id: 'wine', name: 'Red Mountain Red', inputs: { grapes: 4 }, output: 'wine', qty: 1, sec: 240, xp: 38, level: 16 },
      { id: 'rose', name: 'Columbia Valley Rosé', inputs: { grapes: 3, cherries: 2 }, output: 'rose', qty: 1, sec: 300, xp: 50, level: 18 }
    ] }
  });

  Object.assign(D.expansions, {
    barn_1: { name: 'Barn Extension I', emoji: '🏚️', cost: 200, level: 3, desc: 'Add a lean-to for 40 more items.', barnCap: 40 },
    barn_2: { name: 'Barn Extension II', emoji: '🏠', cost: 800, level: 8, desc: 'A proper hayloft: 60 more items.', barnCap: 60, requires: 'barn_1' },
    barn_3: { name: 'Grain Elevator', emoji: '🏗️', cost: 2500, level: 18, desc: 'Towering silo space: 100 more items.', barnCap: 100, requires: 'barn_2' },
    land_1: { name: 'Neighbor\'s Field', emoji: '🗺️', cost: 400, level: 4, desc: 'Buy the north forty. Room for 6 more plots.', maxPlots: 6 },
    land_2: { name: 'Ridgeline Acres', emoji: '⛰️', cost: 1500, level: 12, desc: 'Another stretch of hills: 6 more plots.', maxPlots: 6, requires: 'land_1' },
    center_pivot: { name: 'Center Pivot', emoji: '💦', cost: 1200, level: 6, desc: 'Columbia Basin irrigation protects crops from drought and heat.', tag: 'irrigation' },
    windbreak_trees: { name: 'Windbreak Trees', emoji: '🌲', cost: 600, level: 5, desc: 'Rows of poplars tame dust storms and gales.', tag: 'windbreak' },
    frost_fans: { name: 'Frost Fans', emoji: '🌀', cost: 2000, level: 12, desc: 'Orchard wind machines fight off spring frost.', tag: 'frost_fans' },
    apiary_partners: { name: 'Apiary Partners', emoji: '🐝', cost: 700, level: 7, desc: 'Hire beekeepers for a pollination bonus.', tag: 'beehives' },
    firebreak: { name: 'Firebreak', emoji: '🚒', cost: 900, level: 9, desc: 'Disced strips slow wildfire in dry summers.', tag: 'firebreak' },
    cold_storage: { name: 'Cold Storage', emoji: '🧊', cost: 1500, level: 15, desc: 'Controlled-atmosphere rooms ride out price crashes.', tag: 'cold_storage' }
  });

  D.regions = {
    palouse: { name: 'The Palouse', emoji: '🌄', blurb: 'Rolling golden hills of wheat, lentils, and chickpeas near Pullman. Dryland farming at its finest.' },
    yakima: { name: 'Yakima Valley', emoji: '🍺', blurb: 'Sunny valley that grows most of the nation\'s hops, plus fragrant mint and juicy orchards.' },
    walla_walla: { name: 'Walla Walla', emoji: '🍷', blurb: 'Home of the famous sweet onion and a booming wine country in the Blue Mountain foothills.' },
    wenatchee: { name: 'Wenatchee', emoji: '🍎', blurb: 'The Apple Capital of the World, with cherry orchards climbing the Columbia river bluffs.' },
    columbia_basin: { name: 'Columbia Basin', emoji: '💦', blurb: 'Desert turned green by center pivots: potatoes, corn, and alfalfa as far as you can see.' },
    tri_cities: { name: 'Tri-Cities', emoji: '🍇', blurb: 'Kennewick, Pasco, and Richland: early asparagus and Red Mountain grapes in the sun.' },
    ellensburg: { name: 'Ellensburg', emoji: '🤠', blurb: 'Rodeo town famous for timothy hay, sheep, cattle, and Labor Day bucking broncos.' },
    spokane: { name: 'Spokane', emoji: '🛍️', blurb: 'The Lilac City and its bustling farmers market, where every harvest finds a buyer.' }
  };
})();
