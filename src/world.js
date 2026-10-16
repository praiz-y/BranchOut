// Endless branch generation. Pure logic, no DOM, so it can be simulated in Node.
// Each tree keeps its own ascending list of branches; the two lists are
// generated independently so the heights interleave in an uneven rhythm.

import { CFG } from './config.js';

const SIDES = ['left', 'right'];

export function createWorld(rng = Math.random) {
  const range = (a, b) => a + rng() * (b - a);
  const lists = { left: [], right: [] };
  const next = { left: 0, right: 0 };
  let nextId = 0;

  function add(side, y, len) {
    const l = len ?? range(CFG.branchLenMin, CFG.branchLenMax);
    const landX = side === 'left'
      ? CFG.trunkW + l - 28
      : CFG.W - CFG.trunkW - l + 28;
    const branch = { id: nextId++, side, y, len: l, landX };
    lists[side].push(branch);
    return branch;
  }

  // Start branch on the left, first right branch a short hop above it
  const start = add('left', CFG.startY, CFG.branchLenMax);
  next.left = CFG.startY + range(CFG.gapMin, CFG.gapMax);
  const firstRightY = CFG.startY + range(110, 200);
  add('right', firstRightY);
  next.right = firstRightY + range(CFG.gapMin, CFG.gapMax);

  return {
    start,
    lists,

    // Make sure both trees have branches up to topY
    ensure(topY) {
      for (const side of SIDES) {
        while (next[side] < topY) {
          add(side, next[side]);
          next[side] += range(CFG.gapMin, CFG.gapMax);
        }
      }
    },

    // Drop branches far below the screen
    prune(bottomY) {
      for (const side of SIDES) {
        const list = lists[side];
        while (list.length > 2 && list[1].y < bottomY - 100) list.shift();
      }
    },

    // Next branch above fromY on a side, or null if none is within reach
    target(side, fromY) {
      for (const b of lists[side]) {
        if (b.y >= fromY + CFG.minRise) {
          return b.y - fromY <= CFG.maxRise ? b : null;
        }
      }
      return null;
    },
  };
}
