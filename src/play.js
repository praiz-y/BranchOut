// The playing state: world, player, camera, death check.

import { CFG, scrollSpeed } from './config.js';
import { createWorld } from './world.js';
import { createPlayer, pressDirection, updatePlayer } from './player.js';
import { drawWorld, drawText } from './render.js';

const metres = (g) => Math.max(0, Math.floor((g.player.maxY - CFG.startY) / CFG.unitsPerMeter));

export const playState = {
  enter(g) {
    g.world = createWorld();
    g.player = createPlayer(g.world.start);
    g.cam = { y: 0 };
    g.world.ensure(g.cam.y + g.h + 600);
  },

  update(g, dt, actions) {
    const { world, player, cam } = g;

    for (const a of actions) {
      if (a === 'left' || a === 'right') pressDirection(player, world, a);
    }
    updatePlayer(player, world, dt);

    // Camera rises steadily; it is pushed up if the player climbs past the follow line
    const climbed = player.maxY - CFG.startY;
    cam.y += scrollSpeed(Math.max(0, climbed)) * dt;
    const over = player.y - cam.y - g.h * CFG.followLine;
    if (over > 0) cam.y += over * Math.min(1, CFG.followRate * dt);

    world.ensure(cam.y + g.h + 600);
    world.prune(cam.y);

    // Falling below the bottom edge ends the run
    if (player.y < cam.y - CFG.deathMargin) {
      g.result = { height: metres(g), landings: player.landings };
      g.goto('gameover');
    }
  },

  render(g, ctx) {
    drawWorld(ctx, g);
    drawText(ctx, `${metres(g)} m`, g.w / 2, 40, 32, '#1f5f3f');
    drawText(ctx, `Landings ${g.player.landings}`, g.w - 16, 40, 18, '#1f5f3f', 'right');
  },
};
