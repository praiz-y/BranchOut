// Endless branch generation with patterns. Pure logic, no DOM, so it can be
// simulated in Node.
//
// The climb alternates between stretches of:
//   free    each tree has its own branches at uneven heights
//   zigzag  branches strictly alternate between the trees, so every jump crosses
//   ladder  only one tree has branches for a while, so you cannot cross
// Stretches are joined by a "sync pair" of branches on both trees at nearly the
// same height, so a jump target always exists whichever tree you stand on.
//
// Some branches are dry: they crack after you land and snap if you stay.

import { CFG, PATTERN, DRY } from './config.js';

const SIDES = ['left', 'right'];
const other = (s) => (s === 'left' ? 'right' : 'left');

export function createWorld(rng = Math.random) {
  const range = (a, b) => a + rng() * (b - a);
  const rangeOf = (pair) => range(pair[0], pair[1]);

  const lists = { left: [], right: [] };
  const sections = [];            // { from, to, kind, side } for ladder and zigzag stretches
  const next = { left: 0, right: 0 };
  let nextId = 0;
  let top = CFG.startY;           // generation is complete up to this height
  let nextKind = 'pattern';       // what follows the current free stretch

  const lastY = (side) => {
    const l = lists[side];
    return l.length ? l[l.length - 1].y : -Infinity;
  };

  // Decide whether a new branch is dry. Dry branches never sit close to a dry
  // branch on the other tree, and never twice in a row on the same tree.
  function rollDry(side, y) {
    const rel = y - CFG.startY;
    if (rel < DRY.startUnits) return false;
    const d = Math.min(1, (rel - DRY.startUnits) / DRY.rampUnits);
    const p = DRY.chanceMin + (DRY.chanceMax - DRY.chanceMin) * d;
    if (rng() >= p) return false;
    const mine = lists[side];
    if (mine.length && mine[mine.length - 1].dry) return false;
    // Any branch within reach of the same standing point must not be dry on both trees,
    // so a healthy choice always exists: no dry branch on the other tree within
    // DRY.separation (wider than one jump's reach window).
    const theirs = lists[other(side)];
    for (let i = theirs.length - 1; i >= 0; i--) {
      const b = theirs[i];
      if (b.y < y - DRY.separation) break;
      if (b.dry && Math.abs(b.y - y) < DRY.separation) return false;
    }
    return true;
  }

  function add(side, y, len, allowDry = true) {
    const l = len ?? range(CFG.branchLenMin, CFG.branchLenMax);
    const landX = side === 'left'
      ? CFG.trunkW + l - 28
      : CFG.W - CFG.trunkW - l + 28;
    const branch = {
      id: nextId++, side, y, len: l, landX,
      dry: allowDry ? rollDry(side, y) : false,
      state: 'ok',          // 'ok' | 'cracking' | 'broken'
      crackT: 0,
      crackDur: 0,
      fallT: 0,
    };
    lists[side].push(branch);
    return branch;
  }

  // ---- stretches ----

  function genFree(length) {
    const segEnd = top + length;
    for (const side of SIDES) {
      while (next[side] < segEnd) {
        add(side, next[side]);
        next[side] += range(CFG.gapMin, CFG.gapMax);
      }
    }
    top = segEnd;
  }

  // Branches on both trees at nearly the same height, above everything so far
  function genSeam() {
    const base = Math.max(lastY('left'), lastY('right'));
    const first = rng() < 0.5 ? 'left' : 'right';
    const y1 = base + rangeOf(PATTERN.seamGap);
    const y2 = y1 + rangeOf(PATTERN.seamDiff);
    add(first, y1, undefined, false);
    add(other(first), y2, undefined, false);
    top = y2;
    return { first, y2 };
  }

  function afterPattern(lastSide, lastHeight) {
    next[lastSide] = lastHeight + range(CFG.gapMin, CFG.gapMax);
    next[other(lastSide)] = lastHeight + range(60, 150);
  }

  function genZigzag() {
    const { first, y2 } = genSeam();
    const z = PATTERN.zigzag;
    const n = Math.floor(range(z.countMin, z.countMax + 1));
    let side = first;                // opposite of the higher branch of the pair
    let y = y2 + range(z.gapMin, z.gapMax);
    const from = y - 120;
    let lastSide = side;
    let lastHeight = y;
    for (let i = 0; i < n; i++) {
      // Never dry: the next branch is the only target, so a dry one would be a
      // forced hit rather than a risk the player can choose.
      add(side, y, undefined, false);
      lastSide = side;
      lastHeight = y;
      side = other(side);
      y += range(z.gapMin, z.gapMax);
    }
    sections.push({ from, to: lastHeight + 60, kind: 'zigzag', side: null });
    top = lastHeight;
    afterPattern(lastSide, lastHeight);
  }

  function genLadder() {
    const { y2 } = genSeam();
    const l = PATTERN.ladder;
    const n = Math.floor(range(l.countMin, l.countMax + 1));
    const side = rng() < 0.5 ? 'left' : 'right';
    let y = y2 + range(l.firstMin, l.firstMax);
    const from = y - 120;
    let lastHeight = y;
    for (let i = 0; i < n; i++) {
      // Never dry: with one tree there is no alternative branch to pick.
      add(side, y, undefined, false);
      lastHeight = y;
      y += range(l.gapMin, l.gapMax);
    }
    sections.push({ from, to: lastHeight + 60, kind: 'ladder', side });
    top = lastHeight;
    afterPattern(side, lastHeight);
  }

  function genSegment() {
    if (nextKind === 'pattern') {
      if (rng() < PATTERN.zigzagChance) genZigzag();
      else genLadder();
      nextKind = 'free';
    } else {
      const d = Math.min(1, (top - CFG.startY) / PATTERN.rampUnits);
      const len = range(PATTERN.freeMin, PATTERN.freeMax) * (1 - PATTERN.freeShrink * d);
      genFree(len);
      nextKind = 'pattern';
    }
  }

  // ---- first stretch: start branch, a short hop to the first right branch, then free climbing ----

  const start = add('left', CFG.startY, CFG.branchLenMax, false);
  next.left = CFG.startY + range(CFG.gapMin, CFG.gapMax);
  const firstRightY = CFG.startY + range(110, 200);
  add('right', firstRightY, undefined, false);
  next.right = firstRightY + range(CFG.gapMin, CFG.gapMax);
  top = CFG.startY;
  genFree(PATTERN.firstAt + range(0, 300));
  nextKind = 'pattern';

  const spanContains = (b, x) => (b.side === 'left'
    ? x >= CFG.trunkW - 6 && x <= CFG.trunkW + b.len + 6
    : x >= CFG.W - CFG.trunkW - b.len - 6 && x <= CFG.W - CFG.trunkW + 6);

  return {
    start,
    lists,
    sections,

    // Make sure both trees have branches up to topY
    ensure(topY) {
      while (top < topY) genSegment();
    },

    // Drop branches far below the screen
    prune(bottomY) {
      for (const side of SIDES) {
        const list = lists[side];
        while (list.length > 2 && list[1].y < bottomY - 100) list.shift();
      }
      while (sections.length && sections[0].to < bottomY - 300) sections.shift();
    },

    // Next branch above fromY on a side, or null if none is within reach.
    // Broken branches no longer count.
    target(side, fromY) {
      for (const b of lists[side]) {
        if (b.state === 'broken') continue;
        if (b.y >= fromY + CFG.minRise) {
          return b.y - fromY <= CFG.maxRise ? b : null;
        }
      }
      return null;
    },

    // While falling: the highest unbroken branch crossed between yPrev and yNew at column x
    catchBelow(x, yPrev, yNew) {
      let best = null;
      for (const side of SIDES) {
        for (const b of lists[side]) {
          if (b.state === 'broken' || b.y > yPrev || b.y < yNew) continue;
          if (!spanContains(b, x)) continue;
          if (!best || b.y > best.y) best = b;
        }
      }
      return best;
    },

    // The ladder or zigzag stretch around a height, if any
    sectionAt(y) {
      for (const s of sections) if (y >= s.from && y <= s.to) return s;
      return null;
    },
  };
}
