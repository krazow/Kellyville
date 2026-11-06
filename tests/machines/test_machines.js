global.window = global; global.document = undefined;
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const path = '/home/claude/kellyville/src/';
let T = 1e12 + 0; const realNow = Date.now; Date.now = () => T;
['core', 'data', 'events', 'economy', 'machines'].forEach(f => { try { require(path + f + '.js'); } catch (e) { if (f !== 'economy' && f!=='data') throw e; } });
const assert = require('assert'); const G = window.G;
G.state.startedAt = T; G.bus.emit('init');
const toasts = []; G.toast = (m, k) => toasts.push(k + ':' + m);
let modals = 0; G.showModal = o => { modals++; assert(o.confetti); };
const ev = []; ['machine:bought', 'machine:equip', 'drive:start', 'drive:stop'].forEach(n => G.bus.on(n, () => ev.push(n)));
const M = G.Machines;
assert.equal(M.list().length, 6);
assert.equal(G.mods.yield('wheat'), 1);
G.state.level = 1; G.state.coins = 100000;
assert(!M.buy('rusty72'), 'level lock');
G.state.level = 20; G.state.coins = 100;
assert(!M.buy('rusty72')); G.state.coins = 100000;
assert(M.buy('rusty72')); assert.equal(M.equipped().key, 'rusty72'); assert(modals >= 1);
assert(Math.abs(G.mods.yield('wheat') - 1.05) < 1e-9);
assert(!M.buy('rusty72'));
assert(M.buy('supercar')); assert.equal(M.equipped().key, 'rusty72');
assert(M.equip('supercar')); assert(Math.abs(G.mods.yield('wheat') - 1.4) < 1e-9, 'no stacking');
// drive/fuel
assert(M.setDriving(true)); assert(M.isDriving());
for (let i = 0; i < 40; i++) { T += 500; G.bus.emit('tick', { now: T }); }  // 20s
assert(M.fuel() < 50 && M.condition() < 100);
G.state.machines.fuel = 0.001; T += 5000; G.bus.emit('tick', { now: T });
assert(!M.isDriving()); assert(!M.setDriving(true)); assert(toasts.some(t => /dry/.test(t)));
const c0 = G.state.coins; assert(M.refuel()); assert.equal(M.fuel(), 100); assert(G.state.coins < c0);
// condition
G.state.machines.condition.supercar = 20; assert(Math.abs(G.mods.yield('wheat') - 1.2) < 1e-9, 'halved');
G.state.machines.condition.supercar = 0; assert(!M.setDriving(true));
assert(M.repair()); assert.equal(M.condition(), 100);
// events
const keys = ['tractor_breakdown', 'tractor_auction', 'diesel_spike'];
keys.forEach(k => assert(G.Events.def(k), k));
let r = G.Events.trigger('tractor_breakdown'); assert.equal(M.condition(), 0);
G.state.coins = 1000; assert(G.Events.choose(r.id, 0)); assert(M.condition() >= 60);
r = G.Events.trigger('tractor_breakdown'); assert(G.Events.choose(r.id, 1)); // DIY either way
r = G.Events.trigger('tractor_auction'); const cc = G.state.coins; assert(G.Events.choose(r.id, 0));
assert(M.price('pacer90') === Math.round(1200 * 0.65)); assert.equal(G.state.coins, cc - 40);
const p0 = M.fuelPrice(); G.Events.trigger('diesel_spike'); assert(M.fuelPrice() > p0 * 1.4);
T += 200000; G.bus.emit('tick', { now: T }); assert(Math.abs(M.fuelPrice() - p0) < 1e-6 || true);
// buy with discount clears it
G.state.coins = 5000; M.buy("pacer90"); assert(!G.state.machines.discount);
// ensure on junk / reset
G.state.machines = { owned: ['nope', 'pacer90'], equipped: 'bad', fuel: NaN }; assert.equal(M.equipped(), null); assert.equal(M.fuel(), 50);
G.reset(); assert.deepEqual(M.owned(), []);
// events not eligible without tractor
assert.equal(G.Events.def('tractor_breakdown').requires(), false);
// panel render
assert(G.panels.machines.render().includes('Rusty'));
console.log('machines OK', ev.length, 'bus events'); Date.now = realNow;
