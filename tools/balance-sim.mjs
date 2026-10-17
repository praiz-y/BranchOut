// Balance simulation: plays the real play state with bots of different skill and
// reports how far they get, how they die and how fast they reach each biome.
// It does not replace human playtests, but it shows where the game is
// obviously too hard, too easy or too slow to reach its content.
//
// Usage: node tools/balance-sim.mjs [runsPerProfile] [maxSeconds]

import { CFG, HAZ } from '../src/config.js';
import { BIOMES } from '../src/biomes.js';
import { playState } from '../src/play.js';
import { toScreenY } from '../src/render.js';

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// reaction: seconds the bot waits after landing before its next tap
// aware: chance it checks for incoming hazards and picks the safer tree
const PROFILES = [
  { name: 'casual', reaction: 0.55, aware: 0.45 },
  { name: 'average', reaction: 0.35, aware: 0.75 },
  { name: 'expert', reaction: 0.18, aware: 0.95 },
];

const runs = Number(process.argv[2] || 40);
const maxSeconds = Number(process.argv[3] || 300);
const DT = 1 / 60;
const MILESTONES = BIOMES.slice(1).map((b) => b.at);

// Seconds until the next hazard reaches the player's height on a lane. A player
// reads the marker, waits for a gap and crosses then; Infinity means no threat.
function dangerTime(g, side) {
  const feet = toScreenY(g, g.player.y) - CFG.playerR;
  const half = CFG.W / 2;
  const sideOf = (x) => (x < half ? 'left' : 'right');
  const cam = g.camVel || 0;
  let best = Infinity;
  for (const tg of g.hz.telegraphs) {
    if (tg.side !== side) continue;
    const speed = tg.spec.vy + HAZ.camFollow * cam;
    const t = tg.delay + Math.max(0, tg.t) + (feet - HAZ.spawnY) / Math.max(1, speed);
    best = Math.min(best, t);
  }
  for (const h of g.hz.pool) {
    if (!h.active || sideOf(h.x) !== side) continue;
    if (h.y > feet) continue;               // already below the player
    const speed = h.vy + HAZ.camFollow * cam;
    best = Math.min(best, (feet - h.y) / Math.max(1, speed));
  }
  return best;
}

function playOne(profile, seed) {
  const rng = mulberry32(seed);
  const realRandom = Math.random;
  Math.random = rng;
  const g = {
    w: CFG.W, h: 854, time: 0, taps: [], charIndex: 0, over: null,
    save: { best: 0, char: 'squirrel', seenHint: true, muted: false },
    goto(n) { g.over = n; },
  };
  playState.enter(g);

  let wait = 0.3;
  let hits = 0;
  let lastHearts = g.run.hearts;
  let lastLandings = 0;
  let lastLandAt = 0;
  let prevFalling = false;
  let snaps = 0, catches = 0, rescues = 0;
  const reached = {};
  let t = 0;

  while (!g.over && t < maxSeconds) {
    const actions = [];
    const p = g.player;

    // Track what the dry branches did to this run
    if (p.landings > lastLandings) { lastLandings = p.landings; lastLandAt = t; }
    if (p.falling && !prevFalling) snaps++;
    if (!p.falling && prevFalling) { if (p.jumping) rescues++; else catches++; }
    prevFalling = p.falling;

    if (!g.dying && !p.jumping) {
      wait -= DT;
      if (wait <= 0) {
        // A player can see which trees have a branch in reach, and which look dry
        const valid = ['left', 'right'].filter((s) => g.world.target(s, p.y));
        let candidates = valid.length ? valid : ['left', 'right'];
        if (rng() < profile.aware) {
          const healthy = candidates.filter((s) => !g.world.target(s, p.y)?.dry);
          if (healthy.length) candidates = healthy;
        }
        // Cross to the lane whose next hazard arrives furthest away
        if (candidates.length > 1 && rng() < profile.aware) {
          const d = Object.fromEntries(candidates.map((s) => [s, dangerTime(g, s)]));
          const safe = candidates.filter((s) => d[s] > 0.8);
          if (safe.length) {
            candidates = safe;
          } else {
            const best = Math.max(...candidates.map((s) => d[s]));
            candidates = candidates.filter((s) => d[s] >= best - 0.15);
          }
        }
        const side = candidates[Math.floor(rng() * candidates.length)];
        actions.push(side);
        wait = Math.max(0.04, profile.reaction * (0.6 + rng() * 0.8));
      }
    }
    playState.update(g, DT, actions);
    t += DT;
    if (g.run.hearts < lastHearts) { hits += lastHearts - g.run.hearts; lastHearts = g.run.hearts; }
    const m = (g.player.maxY - CFG.startY) / CFG.unitsPerMeter;
    for (const at of MILESTONES) if (m >= at && reached[at] === undefined) reached[at] = t;
  }
  Math.random = realRandom;

  return {
    seconds: t,
    height: Math.max(0, Math.floor((g.player.maxY - CFG.startY) / CFG.unitsPerMeter)),
    score: g.run.score,
    hits,
    cause: g.over ? g.result.reason : 'survived',
    hearts: g.run.hearts,
    snaps, catches, rescues,
    idle: g.over && g.result.reason === 'fall' ? t - lastLandAt : 0,
    reached,
  };
}

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

console.log(`${runs} runs per profile, capped at ${maxSeconds}s of play\n`);
for (const profile of PROFILES) {
  const res = [];
  for (let i = 0; i < runs; i++) res.push(playOne(profile, 9000 + i));

  const causes = {};
  for (const r of res) causes[r.cause] = (causes[r.cause] || 0) + 1;
  const hitsPerMin = (res.reduce((s, r) => s + r.hits, 0) / res.reduce((s, r) => s + r.seconds, 0)) * 60;
  const sum = (k) => res.reduce((s, r) => s + r[k], 0);
  const falls = res.filter((r) => r.cause === 'fall');
  const idle = median(falls.map((r) => r.idle));

  console.log(`${profile.name} (react ${profile.reaction}s, aware ${profile.aware})`);
  console.log(`  median: ${median(res.map((r) => r.seconds)).toFixed(0)}s, ${median(res.map((r) => r.height))} m, score ${median(res.map((r) => r.score))}`);
  console.log(`  ends: ${Object.entries(causes).map(([k, v]) => `${k} ${v}`).join(', ')}   hits per minute: ${hitsPerMin.toFixed(1)}`);
  console.log(`  dry: ${sum('snaps')} snaps, ${sum('catches')} caught, ${sum('rescues')} rescued; fall deaths ${falls.length}${falls.length ? ` (median ${idle.toFixed(1)}s since last landing)` : ''}`);
  const line = BIOMES.slice(1).map((b) => {
    const times = res.filter((r) => r.reached[b.at] !== undefined).map((r) => r.reached[b.at]);
    return `${b.name} ${times.length}/${runs}${times.length ? ` (median ${median(times).toFixed(0)}s)` : ''}`;
  }).join(', ');
  console.log(`  reached: ${line}\n`);
}
