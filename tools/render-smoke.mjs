// Render smoke test: runs the menu, play and game over screens against a fake
// canvas context that accepts any call. It cannot judge how things look; it
// catches crashes (typos, undefined values, bad imports) in the drawing code.
//
// Usage: node tools/render-smoke.mjs

import { menuState, gameoverState, menuLayout, sheetLayout } from '../src/screens.js';
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

for (const h of [640, 720, 854, 1100]) {
  run(`menu: tapping a character selects it, tapping PLAY starts (h=${h})`, () => {
    const g = newGame(h);
    const L = menuLayout(g);
    const mid = (r) => ({ nx: (r.x + r.w / 2) / g.w, ny: (r.y + r.h / 2) / g.h });
    g.taps = [mid(L.slots[3])];
    menuState.update(g, 1 / 60, []);
    if (g.charIndex !== 3 || g.save.char !== 'bear') throw new Error('character not selected');
    g.taps = [mid(L.play)];
    menuState.update(g, 1 / 60, []);
    if (g.next !== 'playing') throw new Error('play did not start');
  });

  run(`menu: blocks are stacked with room between them and stay above the ground (h=${h})`, () => {
    const g = newGame(h);
    const L = menuLayout(g);
    const blocks = [
      ['title', L.title.y, L.title.y + L.title.h],
      ['preview', L.preview.y, L.preview.y + L.preview.h],
      ['name', L.name.y, L.name.y + L.name.h],
      ['picker', L.picker.y, L.picker.y + L.picker.h],
      ['play', L.play.y, L.play.y + L.play.h],
      ['best', L.best.y, L.best.y + L.best.h],
    ];
    for (let i = 1; i < blocks.length; i++) {
      const gap = blocks[i][1] - blocks[i - 1][2];
      if (gap < 5) throw new Error(`${blocks[i - 1][0]} and ${blocks[i][0]} are only ${gap.toFixed(1)}px apart`);
    }
    if (blocks[0][1] < 0) throw new Error('title starts above the screen');
    const bottom = blocks[blocks.length - 1][2];
    if (bottom > L.groundTop - 5) throw new Error(`best pill ends at ${bottom.toFixed(0)}, ground starts at ${L.groundTop.toFixed(0)}`);
    // The mute button (top right) must not sit on the title or the picker
    const mute = { x: 418, y: 72, w: 50, h: 50 };
    if (L.slots.some((s) => s.x + s.w > mute.x && s.x < mute.x + mute.w && s.y < mute.y + mute.h && s.y + s.h > mute.y)) {
      throw new Error('mute button overlaps the picker');
    }
  });
}

run('game over: Home goes to the menu (button and Esc), Play Again restarts', () => {
  const g = newGame();
  const L = sheetLayout(g);
  const mid = (r) => ({ nx: (r.x + r.w / 2) / g.w, ny: (r.y + r.h / 2) / g.h });
  g.save.seenHint = true;
  playState.enter(g);
  g.result = { score: 10, height: 1, landings: 1, best: 10, newBest: false, reason: 'fall' };

  gameoverState.enter(g);
  g.time = 0.1;
  g.taps = [mid(L.home)];
  gameoverState.update(g, 1 / 60, []);
  if (g.next) throw new Error('Home accepted during the lock');

  g.time = 0.5;
  g.taps = [mid(L.home)];
  gameoverState.update(g, 1 / 60, []);
  if (g.next !== 'menu') throw new Error('Home button did not open the menu');

  g.next = null;
  g.taps = [];
  gameoverState.update(g, 1 / 60, ['back']);
  if (g.next !== 'menu') throw new Error('Esc did not open the menu');

  g.next = null;
  g.taps = [mid(L.again)];
  gameoverState.update(g, 1 / 60, []);
  if (g.next !== 'playing') throw new Error('Play Again did not restart');

  gameoverState.render(g, ctx);
});

run('game over sheet buttons do not overlap each other', () => {
  const g = newGame();
  const L = sheetLayout(g);
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  if (overlap(L.home, L.share) || overlap(L.again, L.home) || overlap(L.again, L.share)) throw new Error('buttons overlap');
  const s = L.sheet;
  for (const b of [L.again, L.home, L.share]) {
    if (b.x < s.x || b.x + b.w > s.x + s.w || b.y + b.h > s.y + s.h) throw new Error('button outside the sheet');
  }
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
