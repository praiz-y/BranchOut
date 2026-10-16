// The playing state: world, player, camera, hazards, hearts, scoring, game feel.

import { CFG, RUN, scrollSpeed } from './config.js';
import { createWorld } from './world.js';
import { createPlayer, pressDirection, updatePlayer } from './player.js';
import { createHazards } from './hazards.js';
import { CHARACTERS } from './characters.js';
import { biomeAt, SUMMIT_M } from './biomes.js';
import { createFx, buzz } from './fx.js';
import { persist } from './storage.js';
import { drawWorld, drawHazards, drawHud, drawHint, toScreenY } from './render.js';

const SLOWMO = 0.25;           // world speed while the death plays out
const DYING_HEARTS = 0.8;      // seconds (real time) of slow motion after the last heart
const DYING_FALL = 0.3;        // short beat when you simply fall off the bottom

const metres = (g) => Math.max(0, Math.floor((g.player.maxY - CFG.startY) / CFG.unitsPerMeter));
const playerScreenY = (g) => toScreenY(g, g.player.y) - CFG.playerR;

function onJump(g) {
  g.fx.dust(g.player.x, g.player.y, 3);
  if (g.audio) g.audio.jump();
}

function onLand(g) {
  const { run, player, fx } = g;
  run.streak = run.t - run.lastLand <= RUN.streakWindow ? run.streak + 1 : 1;
  run.lastLand = run.t;
  run.mult = Math.min(RUN.streakMax, 1 + Math.floor(run.streak / RUN.streakStep));
  const points = RUN.landPoints * run.mult;
  run.score += points;
  if (g.audio) g.audio.land(run.streak);
  fx.dust(player.x, player.y, 7);
  fx.squash();
  fx.pop(player.x, playerScreenY(g) - 46, run.mult > 1 ? `+${points}  x${run.mult}` : `+${points}`,
    run.mult > 1 ? '#ffd236' : '#ffffff', run.mult > 1 ? 28 : 24);
}

function onHit(g) {
  const { run, player, fx } = g;
  const before = run.score;
  run.hearts--;
  run.score = Math.max(0, run.score - RUN.hitPenalty);
  run.invuln = RUN.invuln;
  run.streak = 0;
  run.mult = 1;
  if (g.audio) g.audio.hit();
  const px = player.x;
  const py = playerScreenY(g);
  fx.sparks(px, py, '#ffb703', 14);
  fx.shake(10, 0.3);
  fx.hitFlash();
  fx.heartLost(run.hearts);
  const lost = before - run.score;
  fx.pop(px, py - 46, lost > 0 ? `-${lost}` : 'Ouch!', '#ff5a5f', 28);
  buzz(80);
}

// Death plays out in slow motion before the game over screen
function startDying(g, reason) {
  g.dying = {
    reason,
    t: 0,
    duration: reason === 'hearts' ? DYING_HEARTS : DYING_FALL,
    vy: 260,
    rot: 0,
  };
  if (g.audio) g.audio.gameOver();
  if (reason === 'hearts') {
    g.fx.shake(14, 0.4);
    buzz([60, 40, 120]);
  }
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
  if (g.audio && newBest && prevBest > 0) g.audio.newBest();
  g.goto('gameover');
}

function updateDying(g, realDt) {
  const { world, player, cam, run, hz, dying } = g;
  dying.t += realDt;
  const dt = realDt * SLOWMO;
  run.t += dt;

  // The world keeps moving, slowly
  cam.y += scrollSpeed(Math.max(0, player.maxY - CFG.startY)) * dt;
  world.ensure(cam.y + g.h + 600);
  world.prune(cam.y);
  hz.update(dt, { h: g.h, climbed: Math.max(0, player.maxY - CFG.startY), aimX: player.x });

  // Knocked out: a small hop, then a tumbling fall
  if (dying.reason === 'hearts') {
    dying.vy -= 900 * dt;
    player.y += dying.vy * dt;
    dying.rot += 9 * dt;
  }

  if (dying.t >= dying.duration) endRun(g, dying.reason);
}

export const playState = {
  enter(g) {
    g.world = createWorld();
    g.player = createPlayer(g.world.start);
    g.cam = { y: 0 };
    g.camVel = 0;
    g.fx = createFx();
    g.dying = null;
    g.hz = createHazards();
    g.hz.onSpawn = () => { if (g.audio && !g.dying) g.audio.warn(); };
    g.biomeM = 0;
    g.pal = biomeAt(0);
    g.run = {
      score: 0, hearts: RUN.hearts, invuln: 0, streak: 0, mult: 1, lastLand: -99, t: 0, summit: false,
    };
    g.character = CHARACTERS[g.charIndex || 0];
    // First ever run: show the tap hint, and hold the world until the first jump
    g.hint = g.save ? !g.save.seenHint : false;
    g.world.ensure(g.cam.y + g.h + 600);
  },

  update(g, dt, actions) {
    const { world, player, cam, run, hz, fx } = g;
    fx.update(dt);
    if (g.dying) return updateDying(g, dt);

    run.t += dt;
    run.invuln = Math.max(0, run.invuln - dt);

    // Keyboard actions plus screen taps (left or right half) both mean "jump that way"
    const moves = actions.filter((a) => a === 'left' || a === 'right');
    for (const t of g.taps || []) moves.push(t.nx < 0.5 ? 'left' : 'right');
    for (const a of moves) {
      if (pressDirection(player, world, a)) onJump(g);
    }

    const events = updatePlayer(player, world, dt);
    if (events.includes('land')) onLand(g);
    if (events.includes('jump')) onJump(g);

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

    // Ease the biome palette towards the height reached
    const targetM = Math.max(0, (player.maxY - CFG.startY) / CFG.unitsPerMeter);
    g.biomeM += (targetM - g.biomeM) * Math.min(1, 3 * dt);
    g.pal = biomeAt(g.biomeM);

    // Summit: confetti, banner and fanfare the first time the sunrise height is reached
    if (!run.summit && targetM >= SUMMIT_M) {
      run.summit = true;
      fx.confetti(g.w);
      fx.banner('SUMMIT!', 'From twig to treetop');
      if (g.audio) g.audio.summit();
      buzz([30, 40, 30, 40, 60]);
    }

    // The streak lapses if the player waits too long between landings
    if (run.t - run.lastLand > RUN.streakWindow) {
      run.streak = 0;
      run.mult = 1;
    }

    // Camera rises steadily; it is pushed up if the player climbs past the follow line
    const climbed = Math.max(0, player.maxY - CFG.startY);
    const camBefore = cam.y;
    cam.y += scrollSpeed(climbed) * dt;
    const over = player.y - cam.y - g.h * CFG.followLine;
    if (over > 0) {
      // Cap the push so the background never whips past, but allow more
      // if the player gets close to the top edge
      const want = over * Math.min(1, CFG.followRate * dt);
      const nearTop = Math.max(0, player.y - cam.y - g.h * 0.8);
      cam.y += Math.min(want, (CFG.followMaxSpeed + nearTop * 12) * dt);
    }
    // Smoothed camera speed, used to keep hazards looking like they fall
    g.camVel += ((cam.y - camBefore) / dt - g.camVel) * Math.min(1, 8 * dt);

    world.ensure(cam.y + g.h + 600);
    world.prune(cam.y);

    // Hazards (screen space). They aim near where the player is, or is jumping to.
    const feetY = toScreenY(g, player.y);
    const aimX = player.jumping ? player.to.landX : player.x;
    hz.update(dt, { h: g.h, climbed, aimX, camSpeed: g.camVel });

    if (run.invuln <= 0 && hz.collide(player.x, feetY - CFG.playerR, CFG.playerR * 0.8)) {
      onHit(g);
      if (run.hearts <= 0) return startDying(g, 'hearts');
    }

    // Falling below the bottom edge ends the run
    if (player.y < cam.y - CFG.deathMargin) startDying(g, 'fall');
  },

  render(g, ctx) {
    // Fill first so screen shake never exposes stale pixels at the edges
    ctx.fillStyle = g.pal.skyBot;
    ctx.fillRect(0, 0, g.w, g.h);

    ctx.save();
    const s = g.fx.shakeOffset();
    ctx.translate(s.x, s.y);
    drawWorld(ctx, g);
    drawHazards(ctx, g);
    g.fx.drawParts(ctx, g);
    ctx.restore();

    drawHud(ctx, g, metres(g));
    g.fx.drawOverlay(ctx, g);
    if (g.hint) drawHint(ctx, g);
  },
};
