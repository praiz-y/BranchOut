// Placeholder drawing for Phase 1. Real art arrives in Phase 5.

import { CFG } from './config.js';

// World height to screen y (world y grows up, screen y grows down)
export const toScreenY = (g, wy) => g.h - (wy - g.cam.y);

export function drawSky(ctx, g, color = '#bfe8ff') {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, g.w, g.h);
}

function drawTrunks(ctx, g) {
  ctx.fillStyle = '#7a4b20';
  ctx.fillRect(0, 0, CFG.trunkW, g.h);
  ctx.fillRect(g.w - CFG.trunkW, 0, CFG.trunkW, g.h);

  // Bark marks that scroll with the world so the climb is visible
  ctx.fillStyle = '#5c3815';
  const step = 90;
  const first = Math.floor(g.cam.y / step) * step;
  for (let wy = first; wy < g.cam.y + g.h + step; wy += step) {
    const sy = toScreenY(g, wy);
    ctx.fillRect(10, sy, 6, 28);
    ctx.fillRect(g.w - CFG.trunkW + 28, sy - 40, 6, 28);
  }
}

function drawBranch(ctx, g, b) {
  const sy = toScreenY(g, b.y);
  if (sy < -40 || sy > g.h + 40) return;
  const x0 = b.side === 'left' ? CFG.trunkW - 4 : g.w - CFG.trunkW - b.len;
  ctx.fillStyle = '#a8743a';
  ctx.fillRect(x0, sy, b.len + 4, CFG.branchThick);
  ctx.fillStyle = '#c99455';
  ctx.fillRect(x0, sy, b.len + 4, 4);
  // Leaf tuft at the tip
  const tipX = b.side === 'left' ? x0 + b.len : x0;
  ctx.fillStyle = '#3fa34d';
  ctx.beginPath();
  ctx.arc(tipX, sy + 4, 12, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer(ctx, g, p) {
  const sx = p.x;
  const sy = toScreenY(g, p.y) - CFG.playerR;
  ctx.fillStyle = '#e8590c';
  ctx.beginPath();
  ctx.arc(sx, sy, CFG.playerR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(sx - 7, sy - 4, 5, 0, Math.PI * 2);
  ctx.arc(sx + 7, sy - 4, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(sx - 7, sy - 4, 2, 0, Math.PI * 2);
  ctx.arc(sx + 7, sy - 4, 2, 0, Math.PI * 2);
  ctx.fill();
}

export function drawWorld(ctx, g) {
  drawSky(ctx, g);
  drawTrunks(ctx, g);
  for (const side of ['left', 'right']) {
    for (const b of g.world.lists[side]) drawBranch(ctx, g, b);
  }
  drawPlayer(ctx, g, g.player);
}

export function drawText(ctx, text, x, y, size, color = '#fff', align = 'center') {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}
