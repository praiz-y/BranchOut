// Hazard fairness simulation: spawns hazards at full difficulty for many seeds
// and checks the rules the game promises.
//
// Usage: node tools/hazard-sim.mjs [runs] [seconds]

import { CFG, HAZ } from '../src/config.js';
import { createHazards } from '../src/hazards.js';

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const runs = Number(process.argv[2] || 30);
const seconds = Number(process.argv[3] || 300);
const DT = 1 / 60;
const H = 854;

let spawns = 0;
let conflicts = 0;
let outOfBounds = 0;
let maxActive = 0;
let spawnedOnScreen = 0;

for (const climbed of [0, 3000, 6000]) {
  for (let r = 0; r < runs; r++) {
    const rng = mulberry32(500 + r);
    const hz = createHazards(rng);
    const recs = [];
    hz.onSpawn = (s) => {
      spawns++;
      if (s.x < CFG.trunkW || s.x > CFG.W - CFG.trunkW) outOfBounds++;
      for (const o of recs) {
        if (o.side !== s.side && Math.abs(o.arrive - s.arrive) < HAZ.conflictWindow) conflicts++;
      }
      recs.push(s);
    };

    for (let t = 0; t < seconds; t += DT) {
      hz.update(DT, { h: H, climbed, aimX: 100 + rng() * 280 });
      maxActive = Math.max(maxActive, hz.activeCount());
      for (const h of hz.pool) if (h.active && h.y > 0 && h.y < HAZ.spawnY + 1) spawnedOnScreen++;
    }
  }
}

console.log(`spawns ${spawns}, opposite-side conflicts ${conflicts}, out of bounds ${outOfBounds}`);
console.log(`max active ${maxActive} (pool ${HAZ.maxActive})`);
const ok = conflicts === 0 && outOfBounds === 0 && spawnedOnScreen === 0;
process.exit(ok ? 0 : 1);
