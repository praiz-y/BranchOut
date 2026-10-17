// Headless reachability simulation of the branch generator. Uses the real world
// and player logic with a bot that taps a random side that has something to
// jump to. It checks, across zigzag, ladder and free stretches, that:
//   - at every landing at least one side has a jump target (never stuck)
//   - zigzag stretches really block same-side jumps and ladders block crossing
//   - a healthy (non-dry) branch is always available when both trees have a target
//   - pattern stretches never force a dry landing
//   - the camera rule never strands a bot that taps promptly
//
// Usage: node tools/sim.mjs [runs] [seconds]

import { CFG, PATTERN, scrollSpeed } from '../src/config.js';
import { createWorld } from '../src/world.js';
import { createPlayer, pressDirection, updatePlayer } from '../src/player.js';

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
let stuck = 0;
let bothDry = 0;
let landings = 0;
let maxHeight = 0;
let worstGap = 0;
const seen = { zigzag: 0, ladder: 0, free: 0 };
let zigzagSameSideOpen = 0;
let ladderCrossOpen = 0;
let forcedDry = 0;
let dryBranches = 0;
let totalBranches = 0;

for (let r = 0; r < runs; r++) {
  const rng = mulberry32(1000 + r);
  const world = createWorld(rng);
  const p = createPlayer(world.start);
  const cam = { y: 0 };
  let reaction = 0;
  const counted = new Set();

  for (let t = 0; t < seconds; t += DT) {
    world.ensure(cam.y + H + 600);

    if (!p.jumping) {
      reaction -= DT;
      if (reaction <= 0) {
        const tl = world.target('left', p.y);
        const tr = world.target('right', p.y);
        const section = world.sectionAt(p.y);
        const kind = section ? section.kind : 'free';

        if (!tl && !tr) stuck++;
        if (tl) worstGap = Math.max(worstGap, tl.y - p.y);
        if (tr) worstGap = Math.max(worstGap, tr.y - p.y);
        if (tl && tr && tl.dry && tr.dry) bothDry++;

        // Pattern checks, once per branch stood on
        if (p.branch && !counted.has(p.branch.id)) {
          counted.add(p.branch.id);
          seen[kind]++;
          // Interior of a stretch only: near the end, the free climbing that follows is
          // legitimately reachable from the last branches
          const interior = section && p.branch.y >= section.from + 100 && p.branch.y <= section.to - 310;
          if (interior && kind === 'zigzag') {
            const sameSide = p.branch.side === 'left' ? tl : tr;
            if (sameSide) zigzagSameSideOpen++;
          }
          if (interior && kind === 'ladder') {
            const crossSide = section.side === 'left' ? tr : tl;
            if (crossSide) ladderCrossOpen++;
          }
          // In a pattern stretch the landing branch is the only option, so a dry
          // one would be a forced hit rather than a risk the player chose.
          if (interior && kind === 'zigzag') {
            const forced = p.branch.side === 'left' ? tr : tl;
            if (forced && forced.dry) forcedDry++;
          }
          if (interior && kind === 'ladder') {
            const forced = section.side === 'left' ? tl : tr;
            if (forced && forced.dry) forcedDry++;
          }
        }

        // Bot: pick a side that has something to jump to
        const options = [];
        if (tl) options.push('left');
        if (tr) options.push('right');
        if (options.length) pressDirection(p, world, options[Math.floor(rng() * options.length)]);
        reaction = 0.05 + rng() * 0.4;
      }
    }

    const ev = updatePlayer(p, world, DT);
    if (ev.includes('land')) landings++;

    const climbed = Math.max(0, p.maxY - CFG.startY);
    cam.y += scrollSpeed(climbed) * DT;
    const over = p.y - cam.y - H * CFG.followLine;
    if (over > 0) {
      const want = over * Math.min(1, CFG.followRate * DT);
      const nearTop = Math.max(0, p.y - cam.y - H * 0.8);
      cam.y += Math.min(want, (CFG.followMaxSpeed + nearTop * 12) * DT);
    }
    world.prune(cam.y);

    if (p.y < cam.y - CFG.deathMargin) { deaths++; break; }
  }
  maxHeight = Math.max(maxHeight, (p.maxY - CFG.startY) / CFG.unitsPerMeter);
  for (const side of ['left', 'right']) {
    for (const b of world.lists[side]) { totalBranches++; if (b.dry) dryBranches++; }
  }
}

console.log(`runs ${runs} x ${seconds}s`);
console.log(`landings ${landings}, deaths ${deaths}, max height ${maxHeight.toFixed(0)} m`);
console.log(`worst rise to a target ${worstGap.toFixed(0)} (limit ${CFG.maxRise})`);
console.log(`branches stood on: free ${seen.free}, zigzag ${seen.zigzag}, ladder ${seen.ladder}`);
console.log(`dry branches in the world: ${dryBranches} of ${totalBranches} (${(100 * dryBranches / Math.max(1, totalBranches)).toFixed(0)}%)`);
console.log(`stuck positions (no target on either side): ${stuck}`);
console.log(`both next targets dry: ${bothDry}`);
console.log(`zigzag same-side jumps that were possible: ${zigzagSameSideOpen}`);
console.log(`ladder crossings that were possible: ${ladderCrossOpen}`);
console.log(`forced dry landings in pattern stretches: ${forcedDry}`);
const ok = stuck === 0 && bothDry === 0 && zigzagSameSideOpen === 0 && ladderCrossOpen === 0
  && forcedDry === 0 && seen.zigzag > 0 && seen.ladder > 0;
process.exit(ok ? 0 : 1);
