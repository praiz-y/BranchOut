// Checks for the difficulty mechanics: risk-and-reward points, jump time, stumble,
// dry branches (crack, snap, fall, catch, rescue), patterns, hazard aiming,
// waves, ladder lanes and wind. Runs the real code with a fake game object.
//
// Usage: node tools/mechanics-test.mjs

import { CFG, RUN, HAZ, PATTERN, DRY, WIND, landingPoints, jumpDuration, crackTime } from '../src/config.js';
import { biomeAt } from '../src/biomes.js';
import { createWorld } from '../src/world.js';
import { createPlayer, pressDirection, updatePlayer } from '../src/player.js';
import { createHazards } from '../src/hazards.js';
import { playState } from '../src/play.js';

let failed = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failed++;
}

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function newGame() {
  const calls = [];
  const audio = new Proxy({}, { get: (t, p) => (...a) => calls.push(p) });
  const g = {
    w: CFG.W, h: 854, time: 0, taps: [], charIndex: 0, over: null, audio, calls,
    save: { best: 0, char: 'squirrel', seenHint: true, muted: false },
    goto(n) { g.over = n; },
  };
  playState.enter(g);
  g.hz.update = () => {};            // no random hazards: tests place them by hand
  return g;
}
const step = (g, actions = [], n = 1) => {
  for (let i = 0; i < n && !g.over; i++) playState.update(g, 1 / 60, actions);
};
// Keep the camera from ending the run while a test waits
const holdCamera = (g) => { g.cam.y = Math.min(g.cam.y, g.player.y - 150); };

// ---------- points and jump time ----------
check('a short hop is worth 10', landingPoints(100) === RUN.landPoints);
check('longer rises are worth more (150: 15, 200: 20, 250: 25)',
  landingPoints(160) === 15 && landingPoints(220) === 20 && landingPoints(280) === 25);
check('landing on a dry branch adds the dry bonus (short hop = 20)', landingPoints(100, true) === 20);
check('longer jumps stay in the air longer, within limits',
  jumpDuration(60) === CFG.jumpTimeMin && jumpDuration(300) === CFG.jumpTimeMax
  && jumpDuration(150) > jumpDuration(100));

// ---------- stumble ----------
{
  const noTarget = { target: () => null };
  const p = createPlayer({ landX: 120, y: 140, side: 'left' });
  const jumped = pressDirection(p, noTarget, 'right');
  check('tapping a side with nothing to jump to makes you stumble', !jumped && p.stumble === CFG.stumbleTime && p.blocked);

  const world = createWorld(mulberry32(1));
  const q = createPlayer(world.start);
  q.stumble = 0.1;
  check('taps do nothing while stumbling', pressDirection(q, world, 'right') === false && !q.jumping);
  updatePlayer(q, world, 0.11);
  check('the stumble wears off after its short lock', q.stumble === 0 && pressDirection(q, world, 'right') === true);
}

// ---------- patterns ----------
{
  const world = createWorld(mulberry32(7));
  world.ensure(60000);
  const kinds = new Set(world.sections.map((s) => s.kind));
  check('the world generates both zigzag and ladder stretches', kinds.has('zigzag') && kinds.has('ladder'));
  check('no zigzag or ladder before 10 m',
    world.sections.every((s) => s.from >= CFG.startY + PATTERN.firstAt));

  const z = world.sections.find((s) => s.kind === 'zigzag');
  const inZig = [...world.lists.left, ...world.lists.right]
    .filter((b) => b.y >= z.from && b.y <= z.to - 60)
    .sort((a, b) => a.y - b.y);
  let alternates = true;
  for (let i = 1; i < inZig.length; i++) if (inZig[i].side === inZig[i - 1].side) alternates = false;
  check('a zigzag stretch strictly alternates trees', inZig.length >= PATTERN.zigzag.countMin && alternates);

  const l = world.sections.find((s) => s.kind === 'ladder');
  const inLadder = [...world.lists.left, ...world.lists.right].filter((b) => b.y >= l.from && b.y <= l.to - 60);
  check('a ladder stretch has branches on one tree only', inLadder.length >= PATTERN.ladder.countMin && inLadder.every((b) => b.side === l.side));
}

// ---------- dry branches ----------
{
  const g = newGame();
  const b = g.world.lists.right[0];
  b.dry = true;
  step(g, ['right']);
  for (let i = 0; i < 60 && !g.player.branch; i++) step(g);
  check('landing on a dry branch starts it cracking', g.player.branch === b && b.state === 'cracking');
  check('landing on a dry branch scores the dry bonus', g.run.score === landingPoints(g.player.lastRise, true));

  const hearts = g.run.hearts;
  const secs = crackTime(0);
  for (let i = 0; i < Math.floor((secs - 0.1) * 60); i++) { step(g); holdCamera(g); }
  check('no snap before the time is up', b.state === 'cracking' && g.run.hearts === hearts);
  for (let i = 0; i < 20; i++) { step(g); holdCamera(g); }
  check('staying too long snaps the branch', b.state === 'broken');
  check('the snap costs a heart and starts a fall', g.run.hearts === hearts - 1 && g.player.falling);
  check('the snap and creaks make sound', g.calls.includes('snap') && g.calls.includes('creak'));
}
{
  // Leaving in time: nothing happens to the player
  const g = newGame();
  const b = g.world.lists.right[0];
  b.dry = true;
  step(g, ['right']);
  for (let i = 0; i < 60 && !g.player.branch; i++) step(g);
  const hearts = g.run.hearts;
  step(g, ['left']);                      // jump away straight away
  for (let i = 0; i < 90; i++) { step(g); holdCamera(g); }
  check('jumping away in time costs nothing, and the branch still falls away', g.run.hearts === hearts && b.state === 'broken' && !g.player.falling);
}
{
  // A healthy branch below catches the fall
  const g = newGame();
  const b = g.world.lists.right[0];
  b.dry = true;
  const below = { id: 999, side: 'right', y: b.y - 120, len: 120, landX: b.landX, dry: false, state: 'ok', crackT: 0, crackDur: 0, fallT: 0 };
  g.world.lists.right.unshift(below);
  step(g, ['right']);
  for (let i = 0; i < 60 && g.player.branch !== b; i++) step(g);
  for (let i = 0; i < 120 && !g.player.falling; i++) { step(g); holdCamera(g); }
  check('a snap starts a fall', g.player.falling);
  for (let i = 0; i < 60 && g.player.falling; i++) step(g);
  check('falling onto a branch below catches you (and costs the heart)', g.player.branch === below && !g.player.falling && g.run.hearts === 2);
}
{
  // Nothing below: you fall out of the world
  const g = newGame();
  const b = g.world.lists.right[0];
  b.dry = true;
  step(g, ['right']);
  for (let i = 0; i < 60 && g.player.branch !== b; i++) step(g);
  for (let i = 0; i < 400 && !g.over; i++) step(g);
  check('falling past every branch ends the run', g.over === 'gameover' && g.result.reason === 'fall');
}
{
  // Tapping during the fall rescues you by jumping to a branch above
  const g = newGame();
  const b = g.world.lists.right[0];
  b.dry = true;
  step(g, ['right']);
  for (let i = 0; i < 60 && g.player.branch !== b; i++) step(g);
  for (let i = 0; i < 120 && !g.player.falling; i++) { step(g); holdCamera(g); }
  step(g, ['left']);
  check('tapping while falling jumps to a branch (rescue)', g.player.jumping && !g.player.falling);
}
{
  // The last heart lost to a snap ends the run as a normal death
  const g = newGame();
  g.run.hearts = 1;
  const b = g.world.lists.right[0];
  b.dry = true;
  step(g, ['right']);
  for (let i = 0; i < 60 && g.player.branch !== b; i++) step(g);
  for (let i = 0; i < 120 && !g.dying; i++) { step(g); holdCamera(g); }
  check('a snap on the last heart starts the death sequence', !!g.dying && g.dying.reason === 'hearts');
}

// ---------- hazards: tracking, waves, ladder lanes ----------
{
  const rng = mulberry32(3);
  const hz = createHazards(rng);
  const ctx = { h: 854, climbed: 0, aimX: 130, camSpeed: 0 };
  let tg = null;
  for (let i = 0; i < 60 * 60 && !tg; i++) {
    hz.update(1 / 60, ctx);
    tg = hz.telegraphs.find((t) => t.track && t.delay <= 0) || null;
  }
  check('aimed hazards get a warning marker that follows the player', !!tg);
  if (tg) {
    // Move the target and watch the marker follow, then freeze before release
    const lane = tg.side;
    ctx.aimX = lane === 'left' ? 90 : 390;
    const startX = tg.x;
    let frozenAt = null;
    let lockedX = null;
    while (hz.telegraphs.includes(tg)) {
      hz.update(1 / 60, ctx);
      if (tg.t > HAZ.lockTime) lockedX = tg.x;
      if (tg.t <= HAZ.lockTime && frozenAt === null) frozenAt = tg.x;
    }
    const moved = Math.abs(lockedX - startX) > 1 || Math.abs(startX - ctx.aimX) < 2;
    check('the marker moves towards where the player is', moved);
    check('the marker stops following just before release', frozenAt === null || Math.abs(frozenAt - lockedX) < HAZ.trackSpeed / 60 + 1);
  }
}
{
  const hz = createHazards(mulberry32(11));
  const groups = [];
  hz.onSpawn = (s) => { if (s.first) groups.push({ n: 1, side: s.side }); else { groups[groups.length - 1].n++; if (groups[groups.length - 1].side !== s.side) groups[groups.length - 1].mixed = true; } };
  for (let t = 0; t < 600; t += 1 / 60) hz.update(1 / 60, { h: 854, climbed: 6000, aimX: 130, camSpeed: 0 });
  check('at full difficulty some hazards come in waves of 2 or 3', groups.some((g) => g.n >= 2) && groups.every((g) => g.n <= 3));
  check('every hazard in a wave stays on the same side', groups.every((g) => !g.mixed));

  const early = createHazards(mulberry32(12));
  let earlyWaves = 0;
  early.onSpawn = (s) => { if (!s.first) earlyWaves++; };
  for (let t = 0; t < 120; t += 1 / 60) early.update(1 / 60, { h: 854, climbed: 0, aimX: 130, camSpeed: 0 });
  check('no waves at the very start', earlyWaves === 0);
}
{
  // Warning shrinks with height
  const slow = createHazards(mulberry32(5));
  const fast = createHazards(mulberry32(5));
  const first = (hz, climbed) => {
    for (let i = 0; i < 60 * 30; i++) {
      hz.update(1 / 60, { h: 854, climbed, aimX: 130, camSpeed: 0 });
      if (hz.telegraphs.length) return hz.telegraphs[0].t;
    }
    return null;
  };
  const a = first(slow, 0);
  const b = first(fast, 6000);
  check('the warning is shorter at height', a !== null && b !== null && b < a && b >= HAZ.telegraphMin - 0.05);
}
{
  const hz = createHazards(mulberry32(21));
  let onLockedSide = 0;
  let total = 0;
  hz.onSpawn = (s) => { total++; if (s.x < CFG.W / 2) onLockedSide++; };
  for (let t = 0; t < 400; t += 1 / 60) hz.update(1 / 60, { h: 854, climbed: 3000, aimX: 130, camSpeed: 0, blockedSide: 'left' });
  check('nothing is aimed at the tree a ladder locks you to', total > 20 && onLockedSide === 0);
}

// ---------- wind ----------
{
  const g = newGame();
  // Stand at 60 m so the biome logic itself picks the Autumn palette
  g.player.maxY = CFG.startY + 60 * CFG.unitsPerMeter;
  g.player.y = g.player.maxY;
  g.biomeM = 60;
  g.pal = biomeAt(60);
  g.wind.timer = 0.01;
  step(g);
  check('a gust starts in the Autumn biome', !!g.wind.active);
  let peak = 0;
  for (let i = 0; i < Math.ceil((WIND.warn + WIND.dur + 0.5) * 60) && !g.over; i++) {
    step(g);
    holdCamera(g);
    peak = Math.max(peak, Math.abs(g.wind.x));
  }
  check('the gust pushes sideways, within its strength, then ends', peak > 20 && peak <= WIND.strength * 1.3 + 1 && g.wind.x === 0 && !g.wind.active);

  const calm = newGame();
  calm.wind.timer = 0.01;
  for (let i = 0; i < 300 && !calm.over; i++) { step(calm); holdCamera(calm); }
  check('no wind in the Forest biome', !calm.wind.active);
}

process.exit(failed ? 1 : 0);
