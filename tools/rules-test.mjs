// Rule checks for the playing state: scoring, streak, damage, invulnerability,
// hearts, game over. Runs the real play state with a fake game object.
//
// Usage: node tools/rules-test.mjs

import { CFG, RUN, HAZ } from '../src/config.js';
import { playState } from '../src/play.js';
import { toScreenY } from '../src/render.js';

let failed = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failed++;
}

function newGame() {
  const g = { w: CFG.W, h: 854, over: null, goto(n) { g.over = n; } };
  playState.enter(g);
  g.hz.update = () => {};            // no random hazards: tests place them by hand
  return g;
}
const step = (g, actions = [], n = 1) => {
  for (let i = 0; i < n && !g.over; i++) playState.update(g, 1 / 60, actions);
};

// Put a hazard exactly on the player
function hitPlayer(g) {
  const h = g.hz.pool.find((p) => !p.active);
  const feet = toScreenY(g, g.player.y);
  Object.assign(h, {
    active: true, type: 'pinecone', x: g.player.x, y: feet - CFG.playerR,
    vx: 0, vy: 0, r: 16, hitR: 16 * HAZ.hitScale, rot: 0, spin: 0, sway: false,
  });
}

// --- landing score ---
{
  const g = newGame();
  step(g, ['right']);
  step(g, [], 60);
  check('a landing scores +10', g.player.landings === 1 && g.run.score === RUN.landPoints);
}

// --- streak multiplier: quick landings build it, a long pause resets it ---
{
  const g = newGame();
  let jumps = 0;
  for (let i = 0; i < 400 && g.player.landings < RUN.streakStep; i++) {
    const dir = jumps % 2 ? 'left' : 'right';
    if (!g.player.jumping) jumps++;
    step(g, [dir]);
  }
  check(`streak of ${RUN.streakStep} gives x2`, g.run.mult === 2);
  // Stand still on the branch (drop any queued tap, finish the current jump): the multiplier lapses
  g.player.buffered = null;
  while (g.player.jumping) { g.player.buffered = null; step(g); }
  g.cam.y = Math.min(g.cam.y, g.player.y - 100);
  const hearts = g.run.hearts;
  step(g, [], Math.ceil((RUN.streakWindow + 0.2) * 60));
  check('multiplier lapses after a pause', g.run.mult === 1 && g.run.hearts === hearts);
}

// --- damage ---
{
  const g = newGame();
  g.run.score = 40;
  hitPlayer(g);
  step(g);
  check('hit removes a heart', g.run.hearts === RUN.hearts - 1);
  check('hit removes 15 points', g.run.score === 40 - RUN.hitPenalty);
  check('hit starts invulnerability', g.run.invuln > 0.9);

  hitPlayer(g);
  step(g);
  check('no damage while invulnerable', g.run.hearts === RUN.hearts - 1);

  step(g, [], 70);
  check('invulnerability ends after about 1 s', g.run.invuln === 0);
}

// --- score never below zero ---
{
  const g = newGame();
  g.run.score = 5;
  hitPlayer(g);
  step(g);
  check('score floors at 0', g.run.score === 0);
}

// --- three hits end the run ---
{
  const g = newGame();
  for (let i = 0; i < 3; i++) {
    hitPlayer(g);
    step(g);
    step(g, [], 65);                 // wait out invulnerability (stay on the branch)
    if (g.over) break;
    // keep the camera from killing the player while waiting
    g.cam.y = Math.min(g.cam.y, g.player.y - 100);
  }
  check('three hits end the run', g.over === 'gameover' && g.result.reason === 'hearts');
}

// --- falling ends the run ---
{
  const g = newGame();
  step(g, [], 60 * 6);
  check('falling below the screen ends the run', g.over === 'gameover' && g.result.reason === 'fall');
}

// --- fast climbing: the camera stays calm and the player stays on screen ---
{
  const g = newGame();
  let worstTop = -Infinity;
  const speeds = [];
  let last = g.cam.y;
  for (let i = 0; i < 60 * 90 && !g.over; i++) {
    // Zero-delay bot (faster than any human): jump again the instant it lands
    const acts = g.player.jumping ? [] : [i % 3 === 0 ? 'left' : 'right'];
    playState.update(g, 1 / 60, acts);
    worstTop = Math.max(worstTop, g.player.y - g.cam.y);
    speeds.push((g.cam.y - last) * 60);
    last = g.cam.y;
  }
  speeds.sort((a, b) => a - b);
  const p99 = speeds[Math.floor(speeds.length * 0.99)];
  check('fast climbing keeps the player on screen', worstTop < g.h - 10);
  // The cap loosens only when the player nears the top edge, so even this
  // inhuman bot should stay close to it
  check('the camera sits at its cap and rarely exceeds it (99% of frames within 40%)',
    p99 <= (CFG.followMaxSpeed + CFG.scrollMax) * 1.4);
}

process.exit(failed ? 1 : 0);
