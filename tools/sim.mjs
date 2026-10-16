// Headless reachability simulation. Runs the real world and player logic with
// a bot that taps random sides, and checks that a jump target always exists
// on both sides and the camera rule never strands the player.
//
// Usage: node tools/sim.mjs [runs] [seconds]

import { CFG, scrollSpeed } from '../src/config.js';
import { createWorld } from '../src/world.js';
import { createPlayer, pressDirection, updatePlayer } from '../src/player.js';

// Small seeded RNG so failures are reproducible
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const runs = Number(process.argv[2] || 50);
const seconds = Number(process.argv[3] || 300);
const H = 854;
const DT = 1 / 60;

let deaths = 0;
let missingTargets = 0;
let landings = 0;
let maxHeight = 0;
let worstGap = 0;

for (let r = 0; r < runs; r++) {
  const rng = mulberry32(1000 + r);
  const world = createWorld(rng);
  const p = createPlayer(world.start);
  const cam = { y: 0 };
  let reaction = 0;

  for (let t = 0; t < seconds; t += DT) {
    world.ensure(cam.y + H + 600);

    // Bot: after a random reaction delay, tap a random side
    if (!p.jumping) {
      reaction -= DT;
      if (reaction <= 0) {
        const side = rng() < 0.5 ? 'left' : 'right';
        for (const s of ['left', 'right']) {
          const tgt = world.target(s, p.y);
          if (!tgt) missingTargets++;
          else worstGap = Math.max(worstGap, tgt.y - p.y);
        }
        pressDirection(p, world, side);
        reaction = 0.05 + rng() * 0.4;
      }
    }

    const ev = updatePlayer(p, world, DT);
    if (ev.includes('land')) landings++;

    const climbed = Math.max(0, p.maxY - CFG.startY);
    cam.y += scrollSpeed(climbed) * DT;
    const over = p.y - cam.y - H * CFG.followLine;
    if (over > 0) cam.y += over * Math.min(1, CFG.followRate * DT);
    world.prune(cam.y);

    if (p.y < cam.y - CFG.deathMargin) { deaths++; break; }
  }
  maxHeight = Math.max(maxHeight, (p.maxY - CFG.startY) / CFG.unitsPerMeter);
}

console.log(`runs ${runs} x ${seconds}s`);
console.log(`landings ${landings}, deaths ${deaths}, max height ${maxHeight.toFixed(0)} m`);
console.log(`worst rise to a target ${worstGap.toFixed(0)} (limit ${CFG.maxRise})`);
console.log(`missing targets: ${missingTargets}`);
process.exit(missingTargets === 0 ? 0 : 1);
