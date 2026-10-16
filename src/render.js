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
  // Blink while protected after a hit
  const run = g.run;
  const blink = run && run.invuln > 0 && Math.floor(run.t * 10) % 2 === 0;
  ctx.save();
  if (blink) ctx.globalAlpha = 0.3;
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
  ctx.restore();
}

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.1, y + s * 0.2, x - s * 0.6, y - s * 0.7, x, y - s * 0.2);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 0.7, x + s * 1.1, y + s * 0.2, x, y + s * 0.9);
  ctx.closePath();
}

const HAZARD_TOP_MARKER_Y = 110;

export function drawHazards(ctx, g) {
  // Warning markers at the top of the screen
  for (const tg of g.hz.telegraphs) {
    const pulse = 1 + 0.15 * Math.sin(tg.t * 30);
    const s = 20 * pulse;
    ctx.save();
    ctx.translate(tg.x, HAZARD_TOP_MARKER_Y);
    ctx.fillStyle = '#ffd236';
    ctx.strokeStyle = '#7a4b00';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s, s * 0.8);
    ctx.lineTo(-s, s * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7a4b00';
    ctx.font = `bold ${Math.round(s)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, s * 0.2);
    ctx.restore();
  }

  for (const h of g.hz.pool) {
    if (!h.active) continue;
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.rot);
    if (h.type === 'pinecone') {
      ctx.fillStyle = '#8b5a2b';
      ctx.beginPath();
      ctx.ellipse(0, 0, h.r * 0.8, h.r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5c3815';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-h.r * 0.6, -h.r * 0.3);
      ctx.lineTo(h.r * 0.6, h.r * 0.3);
      ctx.moveTo(h.r * 0.6, -h.r * 0.3);
      ctx.lineTo(-h.r * 0.6, h.r * 0.3);
      ctx.stroke();
    } else if (h.type === 'twig') {
      ctx.fillStyle = '#6b4423';
      ctx.fillRect(-h.r * 1.6, -3, h.r * 3.2, 6);
      ctx.fillRect(h.r * 0.2, -h.r * 0.6, 4, h.r * 0.7);
    } else {
      ctx.fillStyle = '#7bc043';
      ctx.beginPath();
      ctx.ellipse(0, 0, h.r, h.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3f7d1f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-h.r, 0);
      ctx.lineTo(h.r, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawHud(ctx, g, metres) {
  const run = g.run;
  // Hearts, top left
  for (let i = 0; i < 3; i++) {
    heartPath(ctx, 28 + i * 32, 30, 14);
    if (i < run.hearts) {
      ctx.fillStyle = '#ff4d5e';
      ctx.fill();
      ctx.strokeStyle = '#9b1c2b';
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    }
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  drawText(ctx, String(run.score), g.w / 2 + 20, 34, 34, '#1f5f3f');
  drawText(ctx, `${metres} m`, g.w / 2 + 20, 66, 16, '#1f5f3f');
  if (run.mult > 1) drawText(ctx, `x${run.mult}`, g.w - 16, 34, 28, '#e08a00', 'right');
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
