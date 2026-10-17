// Player jump, stumble and fall logic. Pure logic, no DOM.

import { CFG, DRY, jumpDuration } from './config.js';

const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const easeOut = (k) => 1 - (1 - k) * (1 - k);

export function createPlayer(branch) {
  return {
    x: branch.landX,
    y: branch.y,          // feet position in world units
    branch,               // the branch being stood on (null while falling)
    jumping: false,
    t: 0,
    dur: CFG.jumpTimeMin, // seconds for the current jump
    rise: 0,              // height gained by the current jump
    lastRise: 0,          // height gained by the last completed jump (for scoring)
    fromX: 0,
    fromY: 0,
    to: null,
    buffered: null,       // 'left' | 'right' queued just before landing
    stumble: 0,           // seconds left of a stumble (taps do nothing)
    blocked: false,       // set when a tap just caused a stumble; the game clears it
    falling: false,       // dropping after a branch snapped
    vy: 0,
    maxY: branch.y,
    landings: 0,
  };
}

function startJump(p, target) {
  p.jumping = true;
  p.falling = false;
  p.vy = 0;
  p.branch = null;
  p.t = 0;
  p.fromX = p.x;
  p.fromY = p.y;
  p.to = target;
  p.rise = target.y - p.y;
  p.dur = jumpDuration(p.rise);
}

// Returns true if a jump started
function tryJump(p, world, side) {
  const target = world.target(side, p.y);
  if (!target) return false;
  startJump(p, target);
  return true;
}

// Called when the branch under the player snaps
export function startFall(p) {
  p.falling = true;
  p.jumping = false;
  p.vy = 0;
  p.branch = null;
  p.to = null;
  p.buffered = null;
}

// Handle a left/right tap. Returns true if it caused a jump.
export function pressDirection(p, world, side) {
  if (p.stumble > 0) return false;
  if (p.falling) return tryJump(p, world, side); // a rescue attempt: no stumble if it fails
  if (!p.jumping) {
    if (tryJump(p, world, side)) return true;
    // Nothing to jump to that way: you trip for a moment
    p.stumble = CFG.stumbleTime;
    p.blocked = true;
    return false;
  }
  // Mid-jump: only queue the tap if it lands very soon
  const remaining = p.dur * (1 - p.t);
  if (remaining <= CFG.bufferWindow) p.buffered = side;
  return false;
}

// Advance the player. Returns a list of events: 'land' | 'jump' | 'catch'
export function updatePlayer(p, world, dt) {
  const events = [];
  if (p.stumble > 0) p.stumble = Math.max(0, p.stumble - dt);

  if (p.falling) {
    const prevY = p.y;
    p.vy -= DRY.gravity * dt;
    p.y += p.vy * dt;
    const b = world.catchBelow(p.x, prevY, p.y);
    if (b) {
      p.y = b.y;
      p.branch = b;
      p.falling = false;
      p.vy = 0;
      events.push('catch');
    }
    return events;
  }

  if (!p.jumping) return events;

  p.t += dt / p.dur;
  const k = Math.min(1, p.t);
  p.x = p.fromX + (p.to.landX - p.fromX) * easeInOut(k);
  p.y = p.fromY + (p.to.y - p.fromY) * easeOut(k) + CFG.jumpArc * 4 * k * (1 - k);

  if (p.t >= 1) {
    p.x = p.to.landX;
    p.y = p.to.y;
    p.jumping = false;

    // The branch snapped while we were in the air: straight into a fall
    if (p.to.state === 'broken') {
      p.to = null;
      startFall(p);
      return events;
    }

    p.branch = p.to;
    p.to = null;
    p.lastRise = p.rise;
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
