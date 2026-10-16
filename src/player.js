// Player jump logic. Pure logic, no DOM.

import { CFG } from './config.js';

const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const easeOut = (k) => 1 - (1 - k) * (1 - k);

export function createPlayer(branch) {
  return {
    x: branch.landX,
    y: branch.y,          // feet position in world units
    branch,
    jumping: false,
    t: 0,
    fromX: 0,
    fromY: 0,
    to: null,
    buffered: null,       // 'left' | 'right' queued just before landing
    maxY: branch.y,
    landings: 0,
  };
}

function startJump(p, target) {
  p.jumping = true;
  p.t = 0;
  p.fromX = p.x;
  p.fromY = p.y;
  p.to = target;
}

// Returns true if a jump started
function tryJump(p, world, side) {
  const target = world.target(side, p.y);
  if (!target) return false; // nothing reachable that way: input ignored
  startJump(p, target);
  return true;
}

// Handle a left/right tap. Returns true if it caused a jump.
export function pressDirection(p, world, side) {
  if (!p.jumping) return tryJump(p, world, side);
  // Mid-jump: only queue the tap if it lands very soon
  const remaining = CFG.jumpTime * (1 - p.t);
  if (remaining <= CFG.bufferWindow) p.buffered = side;
  return false;
}

// Advance the jump. Returns a list of events: 'jump' | 'land'
export function updatePlayer(p, world, dt) {
  const events = [];
  if (!p.jumping) return events;

  p.t += dt / CFG.jumpTime;
  const k = Math.min(1, p.t);
  p.x = p.fromX + (p.to.landX - p.fromX) * easeInOut(k);
  p.y = p.fromY + (p.to.y - p.fromY) * easeOut(k) + CFG.jumpArc * 4 * k * (1 - k);

  if (p.t >= 1) {
    p.x = p.to.landX;
    p.y = p.to.y;
    p.branch = p.to;
    p.to = null;
    p.jumping = false;
    p.landings++;
    p.maxY = Math.max(p.maxY, p.y);
    events.push('land');

    if (p.buffered) {
      const side = p.buffered;
      p.buffered = null;
      if (tryJump(p, world, side)) events.push('jump');
    }
  }
  return events;
}
