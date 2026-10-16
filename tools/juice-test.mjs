// Game-feel checks: landing and hit effects, slow-motion death, summit moment.
// Runs the real play state with a fake game object and a fake canvas context.
//
// Usage: node tools/juice-test.mjs

import { CFG, RUN, HAZ } from '../src/config.js';
import { SUMMIT_M } from '../src/biomes.js';
import { playState } from '../src/play.js';
import { createFx } from '../src/fx.js';
import { toScreenY } from '../src/render.js';

let failed = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failed++;
}

const gradient = { addColorStop() {} };
const ctx = new Proxy({}, {
  get(t, p) {
    if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => gradient;
    if (p in t) return t[p];
    return () => {};
  },
  set(t, p, v) { t[p] = v; return true; },
});

function newGame() {
  const calls = [];
  const audio = new Proxy({}, { get: (t, p) => (...a) => calls.push(p) });
  const g = {
    w: CFG.W, h: 854, time: 0, taps: [], charIndex: 0, over: null, audio, calls,
    save: { best: 0, char: 'squirrel', seenHint: true, muted: false },
    goto(n) { g.over = n; },
  };
  playState.enter(g);
  g.hz.update = () => {};
  return g;
}
const step = (g, actions = [], n = 1) => {
  for (let i = 0; i < n && !g.over; i++) playState.update(g, 1 / 60, actions);
};
function hitPlayer(g) {
  const h = g.hz.pool.find((p) => !p.active);
  Object.assign(h, {
    active: true, type: 'pinecone', x: g.player.x, y: toScreenY(g, g.player.y) - CFG.playerR,
    vx: 0, vy: 0, r: 16, hitR: 16 * HAZ.hitScale, rot: 0, spin: 0, sway: false,
  });
}
const partCount = (g) => { let n = 0; g.fx.drawParts(new Proxy(ctx, { get: (t, p) => (p === 'beginPath' || p === 'fillRect' ? () => { n++; } : t[p]) }), g); return n; };

// --- takeoff and landing ---
{
  const g = newGame();
  step(g, ['right']);
  check('jumping stretches the sprite tall and thin', g.fx.scaleFor({ jumping: true, t: 0.5 }).y > 1.1);
  check('takeoff makes dust and plays the jump sound', partCount(g) > 0 && g.calls.includes('jump'));
  for (let i = 0; i < 60 && !g.calls.includes('land'); i++) step(g);
  check('landing plays a land sound', g.calls.includes('land'));
  const sq = g.fx.scaleFor({ jumping: false });
  check('landing squashes the sprite wide and short', sq.x > 1 && sq.y < 1);
  step(g, [], 30);
  const rest = g.fx.scaleFor({ jumping: false });
  check('the squash settles back to normal', Math.abs(rest.x - 1) < 0.001 && Math.abs(rest.y - 1) < 0.001);
}

// --- hit feedback ---
{
  const g = newGame();
  g.run.score = 40;
  hitPlayer(g);
  step(g);
  const off = g.fx.shakeOffset();
  check('a hit shakes the screen', Math.abs(off.x) + Math.abs(off.y) >= 0);
  check('a hit starts the heart-loss animation on the lost heart', g.fx.heartAnim.t > 0 && g.fx.heartAnim.i === RUN.hearts - 1);
  check('a hit plays the hit sound', g.calls.includes('hit'));
  step(g, [], 30);
  check('hit effects fade out', g.fx.heartAnim.t === 0);
}

// --- particle cap ---
{
  const fx = createFx();
  for (let i = 0; i < 50; i++) { fx.dust(100, 100, 10); fx.confetti(480); }
  fx.update(0.01);
  let n = 0;
  fx.drawParts(new Proxy(ctx, { get: (t, p) => (p === 'beginPath' || p === 'save' ? () => { n++; } : t[p]) }), { h: 854, cam: { y: 0 } });
  check('particles are capped (no unbounded growth)', n <= 160);
  for (let i = 0; i < 400; i++) fx.update(0.05);
  n = 0;
  fx.drawParts(new Proxy(ctx, { get: (t, p) => (p === 'beginPath' || p === 'save' ? () => { n++; } : t[p]) }), { h: 854, cam: { y: 0 } });
  check('all particles expire', n === 0);
}

// --- death in slow motion ---
{
  const g = newGame();
  g.run.hearts = 1;
  hitPlayer(g);
  step(g);
  check('losing the last heart starts a slow-motion death, not an instant game over', !!g.dying && !g.over);
  check('the game over sound plays at the moment of death', g.calls.includes('gameOver'));

  const camBefore = g.cam.y;
  step(g, [], 30);
  const moved = g.cam.y - camBefore;
  check('the world runs at quarter speed during the death', moved < (CFG.scrollBase / 60) * 30 * 0.4 + 0.001);

  hitPlayer(g);
  const hearts = g.run.hearts;
  step(g);
  check('no further damage while dying', g.run.hearts === hearts);

  step(g, [], 60);
  check('the game over screen opens after the beat', g.over === 'gameover' && g.result.reason === 'hearts');
  playState.render(g, ctx);
}
{
  const g = newGame();
  g.player.y = -1000;
  step(g);
  check('falling starts a short death beat', !!g.dying && g.dying.reason === 'fall');
  step(g, [], 30);
  check('falling ends the run quickly', g.over === 'gameover' && g.result.reason === 'fall');
}

// --- player input is ignored while dying ---
{
  const g = newGame();
  g.player.y = -1000;
  step(g);
  const landings = g.player.landings;
  step(g, ['left', 'right'], 5);
  check('taps do nothing during the death beat', g.player.landings === landings && !g.player.jumping);
}

// --- summit ---
{
  const g = newGame();
  g.player.maxY = CFG.startY + (SUMMIT_M - 1) * CFG.unitsPerMeter;
  g.player.y = g.player.maxY;
  g.cam.y = g.player.y - 300;
  step(g);
  check('nothing before the summit height', !g.run.summit);

  g.player.maxY = CFG.startY + SUMMIT_M * CFG.unitsPerMeter + 10;
  g.player.y = g.player.maxY;
  g.cam.y = g.player.y - 300;
  step(g);
  check('reaching the summit height triggers the moment once', g.run.summit && g.calls.filter((c) => c === 'summit').length === 1);
  playState.render(g, ctx);
  step(g, [], 30);
  check('the summit moment does not repeat', g.calls.filter((c) => c === 'summit').length === 1);
  for (let i = 0; i < 400; i++) step(g, [], 1) || (g.cam.y = Math.max(g.cam.y, g.player.y - 300));
  playState.render(g, ctx);
}

process.exit(failed ? 1 : 0);
