// Falling hazards with telegraph markers. Pure logic, no DOM.
//
// Fairness rules enforced here:
//  - every hazard shows a marker for HAZ.telegraph seconds before it enters the screen
//  - the marker follows the player but stops following just before release, so the
//    player always has the whole fall time to leave
//  - two hazards headed for opposite sides never arrive at the player's height
//    within HAZ.conflictWindow of each other, so switching trees is always a dodge
//  - hitboxes are smaller than the artwork (HAZ.hitScale)
//  - while a ladder stretch locks the player to one tree, nothing is aimed at that tree

import { CFG, HAZ, ramp } from './config.js';

const TYPE_NAMES = Object.keys(HAZ.types);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const MIN_X = CFG.trunkW + 20;
const MAX_X = CFG.W - CFG.trunkW - 20;
const MID = CFG.W / 2;
const sideOf = (x) => (x < MID ? 'left' : 'right');
const otherSide = (s) => (s === 'left' ? 'right' : 'left');
const laneBounds = (side) => (side === 'left' ? [MIN_X, MID - 8] : [MID + 8, MAX_X]);

export function createHazards(rng = Math.random) {
  const pool = Array.from({ length: HAZ.maxActive }, () => ({ active: false }));
  const telegraphs = [];   // { x, t, delay, track, offset, side, spec }
  const records = [];      // { side, arrive } for the conflict rule
  let time = 0;
  let timer = 1.5;         // grace period before the first hazard

  const hz = {
    pool,
    telegraphs,
    onSpawn: null,         // optional hook: called per hazard with { side, arrive, x, first }

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
        if (tg.delay > 0) {
          tg.delay -= dt;
          continue;
        }
        tg.t -= dt;
        // Follow the player until just before release
        if (tg.track && tg.t > HAZ.lockTime) {
          const [lo, hi] = laneBounds(tg.side);
          const want = clamp(ctx.aimX + tg.offset, lo, hi);
          const step = HAZ.trackSpeed * dt;
          tg.x += clamp(want - tg.x, -step, step);
        }
        if (tg.t <= 0) {
          activate(tg);
          telegraphs.splice(i, 1);
        }
      }

      const wind = ctx.windX || 0;
      const minX = CFG.trunkW;
      const maxX = CFG.W - CFG.trunkW;
      for (const h of pool) {
        if (!h.active) continue;
        h.y += (h.vy + HAZ.camFollow * (ctx.camSpeed || 0)) * dt;
        h.rot += h.spin * dt;
        if (h.sway) {
          h.baseX += wind * dt;
          h.x = h.baseX + Math.sin(time * 2.2 + h.phase) * h.swayAmp;
        } else {
          h.x += (h.vx + wind) * dt;
          // Bounce off the trunks
          if (h.x < minX + h.r) { h.x = minX + h.r; h.vx = Math.abs(h.vx); }
          if (h.x > maxX - h.r) { h.x = maxX - h.r; h.vx = -Math.abs(h.vx); }
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

  function activate(tg) {
    const h = pool.find((p) => !p.active);
    if (!h) return; // pool full: drop it rather than allocate
    Object.assign(h, tg.spec, { x: tg.x, baseX: tg.x, active: true });
  }

  function trySpawn(ctx) {
    if (hz.activeCount() + telegraphs.length + 3 > HAZ.maxActive) {
      timer = 0.2;
      return;
    }
    const d = ramp(ctx.climbed);
    const tele = lerp(HAZ.telegraph, HAZ.telegraphMin, d);

    // Waves: 2 or 3 hazards down the same tree, a moment apart
    let n = 1;
    if (d > HAZ.waveStart) {
      const p = (HAZ.waveChance * (d - HAZ.waveStart)) / (1 - HAZ.waveStart);
      if (rng() < p) n = rng() < 0.6 ? 2 : 3;
    }

    // Where the first hazard goes: at the player, or in a place players stand or cross
    const jitter = lerp(HAZ.aimJitter, HAZ.aimJitterMin, d);
    let aimed = rng() < HAZ.aimChance;
    let x0;
    if (aimed) {
      x0 = ctx.aimX + (rng() * 2 - 1) * jitter;
    } else {
      const z = rng() < HAZ.midChance
        ? HAZ.zones.mid
        : rng() < 0.5 ? HAZ.zones.left : HAZ.zones.right;
      x0 = z[0] + rng() * (z[1] - z[0]);
    }
    x0 = clamp(x0, MIN_X, MAX_X);
    let lane = sideOf(x0);

    // A ladder locks the player to one tree: never aim at it, nothing could be dodged
    if (ctx.blockedSide && lane === ctx.blockedSide) {
      x0 = CFG.W - x0;
      lane = otherSide(lane);
      aimed = false;
    }

    const bandY = ctx.h * HAZ.bandFrac;
    const baseSpeed = lerp(HAZ.speedStart, HAZ.speedMax, d);

    const build = (flip) => {
      const plan = [];
      let delay = 0;
      const laneSide = flip ? otherSide(lane) : lane;
      const [lo, hi] = laneBounds(laneSide);
      for (let i = 0; i < n; i++) {
        if (i > 0) delay += HAZ.waveGap[0] + rng() * (HAZ.waveGap[1] - HAZ.waveGap[0]);
        const name = TYPE_NAMES[Math.floor(rng() * TYPE_NAMES.length)];
        const type = HAZ.types[name];
        const baseX = flip ? CFG.W - x0 : x0;
        const x = clamp(baseX + (i - (n - 1) / 2) * HAZ.waveSpread, lo, hi);
        const speed = baseSpeed * type.speed * (0.9 + rng() * 0.2);
        let vx = type.sway ? 0 : (rng() * 2 - 1) * HAZ.driftMax * d * type.drift;
        const fallT = (bandY - HAZ.spawnY) / (speed + HAZ.camFollow * (ctx.camSpeed || 0));
        const arrive = time + delay + tele + fallT;
        // Keep the hazard on its own tree's side: if its drift would carry it across
        // the middle, turn the drift towards its trunk instead. This keeps the
        // "opposite sides never arrive together" rule honest.
        if (sideOf(clamp(x + vx * fallT, MIN_X, MAX_X)) !== laneSide) vx = -vx;
        plan.push({
          name, type, x, vx, speed, delay, arrive, side: laneSide,
          rot: rng() * Math.PI * 2,
          spin: (rng() < 0.5 ? -1 : 1) * type.spin,
          phase: rng() * Math.PI * 2,
        });
      }
      return { plan, laneSide };
    };

    const conflicts = (plan) => plan.some((p) =>
      records.some((r) => r.side !== p.side && Math.abs(r.arrive - p.arrive) < HAZ.conflictWindow));

    let { plan, laneSide } = build(false);
    if (conflicts(plan)) {
      // Mirror to the other tree; if that also conflicts, try again shortly
      aimed = false;
      ({ plan, laneSide } = build(true));
      if (conflicts(plan)) {
        timer = 0.15;
        return;
      }
    }

    plan.forEach((p, i) => {
      telegraphs.push({
        x: p.x,
        t: tele,
        delay: p.delay,
        track: aimed,
        offset: p.x - ctx.aimX,
        side: laneSide,
        spec: {
          type: p.name,
          y: HAZ.spawnY,
          vx: p.vx,
          vy: p.speed,
          r: p.type.r,
          hitR: p.type.r * HAZ.hitScale,
          rot: p.rot,
          spin: p.spin,
          sway: !!p.type.sway,
          swayAmp: 25 + 35 * d,
          phase: p.phase,
        },
      });
      records.push({ side: p.side, arrive: p.arrive });
      if (hz.onSpawn) hz.onSpawn({ side: p.side, arrive: p.arrive, x: p.x, first: i === 0 });
    });

    timer = lerp(HAZ.intervalStart, HAZ.intervalMin, d) * (0.8 + rng() * 0.4) + (n - 1) * 0.6;
  }

  return hz;
}
