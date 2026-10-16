// Falling hazards with telegraph markers. Pure logic, no DOM.
//
// Fairness rules enforced here:
//  - every hazard shows a marker for HAZ.telegraph seconds before it enters the screen
//  - two hazards headed for opposite sides never arrive at the player's height
//    within HAZ.conflictWindow of each other, so switching trees is always a dodge
//  - hitboxes are smaller than the artwork (HAZ.hitScale)

import { CFG, HAZ, ramp } from './config.js';

const TYPE_NAMES = Object.keys(HAZ.types);
const lerp = (a, b, t) => a + (b - a) * t;

export function createHazards(rng = Math.random) {
  const pool = Array.from({ length: HAZ.maxActive }, () => ({ active: false }));
  const telegraphs = [];   // { x, t, spec }
  const records = [];      // { side, arrive } for the conflict rule
  let time = 0;
  let timer = 1.5;         // grace period before the first hazard

  const hz = {
    pool,
    telegraphs,
    onSpawn: null,         // optional test hook: called with { side, arrive, x }

    activeCount() {
      let n = 0;
      for (const h of pool) if (h.active) n++;
      return n;
    },

    update(dt, ctx) {
      time += dt;
      timer -= dt;
      if (timer <= 0) trySpawn(ctx);

      for (let i = telegraphs.length - 1; i >= 0; i--) {
        const tg = telegraphs[i];
        tg.t -= dt;
        if (tg.t <= 0) {
          activate(tg.spec);
          telegraphs.splice(i, 1);
        }
      }

      const minX = CFG.trunkW;
      const maxX = CFG.W - CFG.trunkW;
      for (const h of pool) {
        if (!h.active) continue;
        h.y += (h.vy + HAZ.camFollow * (ctx.camSpeed || 0)) * dt;
        h.rot += h.spin * dt;
        if (h.sway) {
          h.x = h.baseX + Math.sin(time * 2.2 + h.phase) * h.swayAmp;
        } else {
          h.x += h.vx * dt;
          if (h.x < minX + h.r || h.x > maxX - h.r) h.vx = -h.vx; // bounce off trunks
        }
        if (h.y > ctx.h + 60) h.active = false;
      }

      for (let i = records.length - 1; i >= 0; i--) {
        if (records[i].arrive < time - 1) records.splice(i, 1);
      }
    },

    // Circle test against all hazards. A hit consumes the hazard and returns it.
    collide(px, py, pr) {
      for (const h of pool) {
        if (!h.active) continue;
        const dx = h.x - px;
        const dy = h.y - py;
        const rr = pr + h.hitR;
        if (dx * dx + dy * dy < rr * rr) {
          h.active = false;
          return h;
        }
      }
      return null;
    },

    clear() {
      for (const h of pool) h.active = false;
      telegraphs.length = 0;
      records.length = 0;
      timer = 1.5;
    },
  };

  function activate(spec) {
    const h = pool.find((p) => !p.active);
    if (!h) return; // pool full: drop it rather than allocate
    Object.assign(h, spec, { active: true });
  }

  function trySpawn(ctx) {
    if (hz.activeCount() + telegraphs.length >= HAZ.maxActive) {
      timer = 0.2;
      return;
    }
    const d = ramp(ctx.climbed);
    const name = TYPE_NAMES[Math.floor(rng() * TYPE_NAMES.length)];
    const type = HAZ.types[name];

    const minX = CFG.trunkW + 20;
    const maxX = CFG.W - CFG.trunkW - 20;
    let x = rng() < HAZ.aimChance
      ? ctx.aimX + (rng() * 2 - 1) * HAZ.aimJitter
      : minX + rng() * (maxX - minX);
    x = Math.min(maxX, Math.max(minX, x));

    const speed = lerp(HAZ.speedStart, HAZ.speedMax, d) * type.speed * (0.9 + rng() * 0.2);
    const vx = type.sway ? 0 : (rng() * 2 - 1) * HAZ.driftMax * d * type.drift;
    const bandY = ctx.h * HAZ.bandFrac;
    const fallT = (bandY - HAZ.spawnY) / (speed + HAZ.camFollow * (ctx.camSpeed || 0));
    const arrive = time + HAZ.telegraph + fallT;

    const sideOf = (px) => (px < CFG.W / 2 ? 'left' : 'right');
    const endX = Math.min(maxX, Math.max(minX, x + vx * fallT));
    let side = sideOf(endX);
    let spawnX = x;
    let spawnVx = vx;

    const conflicts = (s) =>
      records.some((r) => r.side !== s && Math.abs(r.arrive - arrive) < HAZ.conflictWindow);

    if (conflicts(side)) {
      // Mirror to the other tree; if that also conflicts, try again shortly
      spawnX = CFG.W - x;
      spawnVx = -vx;
      side = side === 'left' ? 'right' : 'left';
      if (conflicts(side)) {
        timer = 0.15;
        return;
      }
    }

    telegraphs.push({
      x: spawnX,
      t: HAZ.telegraph,
      spec: {
        type: name,
        x: spawnX,
        baseX: spawnX,
        y: HAZ.spawnY,
        vx: spawnVx,
        vy: speed,
        r: type.r,
        hitR: type.r * HAZ.hitScale,
        rot: rng() * Math.PI * 2,
        spin: (rng() < 0.5 ? -1 : 1) * type.spin,
        sway: !!type.sway,
        swayAmp: 25 + 35 * d,
        phase: rng() * Math.PI * 2,
      },
    });
    records.push({ side, arrive });
    if (hz.onSpawn) hz.onSpawn({ side, arrive, x: spawnX });

    timer = lerp(HAZ.intervalStart, HAZ.intervalMin, d) * (0.8 + rng() * 0.4);
  }

  return hz;
}
