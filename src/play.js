// The playing state: world, player, camera, hazards, hearts, scoring.

import { CFG, RUN, scrollSpeed } from './config.js';
import { createWorld } from './world.js';
import { createPlayer, pressDirection, updatePlayer } from './player.js';
import { createHazards } from './hazards.js';
import { CHARACTERS } from './characters.js';
import { persist } from './storage.js';
import { drawWorld, drawHazards, drawHud, drawHint, toScreenY } from './render.js';

const metres = (g) => Math.max(0, Math.floor((g.player.maxY - CFG.startY) / CFG.unitsPerMeter));

function onLand(run) {
  run.streak = run.t - run.lastLand <= RUN.streakWindow ? run.streak + 1 : 1;
  run.lastLand = run.t;
  run.mult = Math.min(RUN.streakMax, 1 + Math.floor(run.streak / RUN.streakStep));
  run.score += RUN.landPoints * run.mult;
}

function onHit(run) {
  run.hearts--;
  run.score = Math.max(0, run.score - RUN.hitPenalty);
  run.invuln = RUN.invuln;
  run.streak = 0;
  run.mult = 1;
}

function endRun(g, reason) {
  const score = g.run.score;
  const prevBest = g.save ? g.save.best : 0;
  const newBest = score > prevBest;
  if (g.save && newBest) {
    g.save.best = score;
    persist(g.save);
  }
  g.result = {
    score,
    height: metres(g),
    landings: g.player.landings,
    best: Math.max(score, prevBest),
    newBest,
    reason,
  };
  g.goto('gameover');
}

export const playState = {
  enter(g) {
    g.world = createWorld();
    g.player = createPlayer(g.world.start);
    g.cam = { y: 0 };
    g.hz = createHazards();
    g.run = { score: 0, hearts: RUN.hearts, invuln: 0, streak: 0, mult: 1, lastLand: -99, t: 0 };
    g.character = CHARACTERS[g.charIndex || 0];
    // First ever run: show the tap hint, and hold the world until the first jump
    g.hint = g.save ? !g.save.seenHint : false;
    g.world.ensure(g.cam.y + g.h + 600);
  },

  update(g, dt, actions) {
    const { world, player, cam, run, hz } = g;
    run.t += dt;
    run.invuln = Math.max(0, run.invuln - dt);

    // Keyboard actions plus screen taps (left or right half) both mean "jump that way"
    const moves = actions.filter((a) => a === 'left' || a === 'right');
    for (const t of g.taps || []) moves.push(t.nx < 0.5 ? 'left' : 'right');
    for (const a of moves) pressDirection(player, world, a);

    const events = updatePlayer(player, world, dt);
    if (events.includes('land')) onLand(run);

    // Tutorial hold: nothing moves until the player makes their first jump
    if (g.hint) {
      if (player.jumping || player.landings > 0) {
        g.hint = false;
        if (g.save) {
          g.save.seenHint = true;
          persist(g.save);
        }
      } else {
        return;
      }
    }

    // The streak lapses if the player waits too long between landings
    if (run.t - run.lastLand > RUN.streakWindow) {
      run.streak = 0;
      run.mult = 1;
    }

    // Camera rises steadily; it is pushed up if the player climbs past the follow line
    const climbed = Math.max(0, player.maxY - CFG.startY);
    cam.y += scrollSpeed(climbed) * dt;
    const over = player.y - cam.y - g.h * CFG.followLine;
    if (over > 0) cam.y += over * Math.min(1, CFG.followRate * dt);

    world.ensure(cam.y + g.h + 600);
    world.prune(cam.y);

    // Hazards (screen space). They aim near where the player is, or is jumping to.
    const feetY = toScreenY(g, player.y);
    const aimX = player.jumping ? player.to.landX : player.x;
    hz.update(dt, { h: g.h, climbed, aimX });

    if (run.invuln <= 0 && hz.collide(player.x, feetY - CFG.playerR, CFG.playerR * 0.8)) {
      onHit(run);
      if (run.hearts <= 0) return endRun(g, 'hearts');
    }

    // Falling below the bottom edge ends the run
    if (player.y < cam.y - CFG.deathMargin) endRun(g, 'fall');
  },

  render(g, ctx) {
    drawWorld(ctx, g);
    drawHazards(ctx, g);
    drawHud(ctx, g, metres(g));
    if (g.hint) drawHint(ctx, g);
  },
};
