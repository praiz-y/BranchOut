// Render smoke test: runs the menu, play and game over screens against a fake
// canvas context that accepts any call. It cannot judge how things look; it
// catches crashes (typos, undefined values, bad imports) in the drawing code.
//
// Usage: node tools/render-smoke.mjs

import { menuState, gameoverState } from '../src/screens.js';
import { playState } from '../src/play.js';
import { CHARACTERS } from '../src/characters.js';

const gradient = { addColorStop() {} };
const ctx = new Proxy({}, {
  get(target, prop) {
    if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
    if (prop === 'measureText') return () => ({ width: 10 });
    if (prop in target) return target[prop];
    return () => {};
  },
  set(target, prop, value) {
    target[prop] = value;
    return true;
  },
});

let failed = 0;
function run(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name}: ${e.stack}`);
  }
}

function newGame(h = 854) {
  const g = {
    w: 480, h, time: 0, taps: [], charIndex: 0,
    save: { best: 120, char: 'squirrel', seenHint: false },
    goto(name) { g.next = name; },
  };
  return g;
}

for (const h of [640, 854, 1100]) {
  run(`menu renders at h=${h}`, () => {
    const g = newGame(h);
    for (let i = 0; i < CHARACTERS.length; i++) {
      g.charIndex = i;
      menuState.render(g, ctx);
    }
  });
}

run('menu: tapping a character selects it, tapping PLAY starts', () => {
  const g = newGame();
  const slotX = (i) => ((g.w - 72 * 6) / 2 + i * 72 + 36) / g.w;
  g.taps = [{ nx: slotX(3), ny: 0.5 }];
  menuState.update(g, 1 / 60, []);
  if (g.charIndex !== 3 || g.save.char !== 'bear') throw new Error('character not selected');
  g.taps = [{ nx: 0.5, ny: 0.65 + 0.03 }];
  menuState.update(g, 1 / 60, []);
  if (g.next !== 'playing') throw new Error('play did not start');
});

run('menu: arrow keys cycle characters and wrap', () => {
  const g = newGame();
  menuState.update(g, 1 / 60, ['left']);
  if (g.charIndex !== CHARACTERS.length - 1) throw new Error('did not wrap');
  menuState.update(g, 1 / 60, ['right']);
  if (g.charIndex !== 0) throw new Error('did not wrap back');
});

run('play renders with the hint, then without', () => {
  const g = newGame();
  playState.enter(g);
  if (!g.hint) throw new Error('hint should show on a first run');
  playState.render(g, ctx);
  // Tutorial hold: nothing moves before the first jump
  const camBefore = g.cam.y;
  for (let i = 0; i < 120; i++) playState.update(g, 1 / 60, []);
  if (g.cam.y !== camBefore) throw new Error('world moved during tutorial hold');
  g.taps = [{ nx: 0.9, ny: 0.5 }];
  playState.update(g, 1 / 60, []);
  g.taps = [];
  if (g.hint) throw new Error('hint should clear after the first jump');
  if (!g.save.seenHint) throw new Error('seenHint not saved');
  for (let i = 0; i < 30; i++) playState.update(g, 1 / 60, []);
  playState.render(g, ctx);
});

run('play: no hint once seen; every character renders in play', () => {
  const g = newGame();
  g.save.seenHint = true;
  for (let i = 0; i < CHARACTERS.length; i++) {
    g.charIndex = i;
    playState.enter(g);
    if (g.hint) throw new Error('hint shown again');
    playState.render(g, ctx);
  }
});

run('game over: new best is recorded and the sheet renders', () => {
  const g = newGame();
  g.save.seenHint = true;
  playState.enter(g);
  g.run.score = 500;
  g.player.y = -1000; // below the screen: forces the fall game over
  for (let i = 0; i < 60 && !g.next; i++) playState.update(g, 1 / 60, []); // short death beat
  if (g.next !== 'gameover') throw new Error('did not end');
  if (!g.result.newBest || g.save.best !== 500 || g.result.best !== 500) throw new Error('best not updated');
  gameoverState.enter(g);
  g.time = 1;
  gameoverState.render(g, ctx);
});

run('game over: a lower score keeps the old best; restart works after the lock', () => {
  const g = newGame();
  g.save.seenHint = true;
  playState.enter(g);
  g.run.score = 30;
  g.player.y = -1000;
  for (let i = 0; i < 60 && !g.next; i++) playState.update(g, 1 / 60, []);
  if (g.result.newBest || g.save.best !== 120) throw new Error('best overwritten');
  g.next = null;
  gameoverState.enter(g);
  g.time = 0.1;
  gameoverState.update(g, 1 / 60, ['start']);
  if (g.next) throw new Error('restart accepted during the lock');
  g.time = 0.5;
  gameoverState.update(g, 1 / 60, ['start']);
  if (g.next !== 'playing') throw new Error('restart not accepted after the lock');
});

process.exit(failed ? 1 : 0);
