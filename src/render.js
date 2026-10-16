// Drawing for the play screen: sky, trunks, branches, ground, weather, hazards, HUD.
// Everything is drawn with canvas paths, so there are no image files to load.

import { CFG } from './config.js';
import { CHARACTERS, drawCharacter } from './characters.js';
import { BIOMES, biomeAt } from './biomes.js';
import { drawText, drawTitleText, roundRectPath } from './ui.js';

// World height to screen y (world y grows up, screen y grows down)
export const toScreenY = (g, wy) => g.h - (wy - g.cam.y);

const OUTLINE = '#3a2410';

// Stable pseudo-random number in 0..1 from an integer, so scenery does not flicker
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ---------- Background ----------

function drawSky(ctx, g, pal) {
  const grad = ctx.createLinearGradient(0, 0, 0, g.h);
  grad.addColorStop(0, pal.skyTop);
  grad.addColorStop(1, pal.skyBot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, g.w, g.h);
}

// Soft distant canopy blobs and clouds that drift at different speeds as you climb
function drawDistance(ctx, g, pal) {
  ctx.save();
  ctx.fillStyle = pal.hill;
  ctx.globalAlpha = 0.45;
  const span = g.h + 320;
  for (let i = 0; i < 6; i++) {
    const y = ((hash(i + 3) * span + g.cam.y * 0.12) % span) - 160;
    const x = hash(i + 17) * g.w;
    const r = 70 + hash(i + 41) * 60;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.arc(x + r * 0.8, y + r * 0.25, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  // The summit sun rises as the palette blends in
  if (pal.sun > 0.01) {
    const sx = g.w * 0.5;
    const sy = g.h * 0.3 + (1 - pal.sun) * 140;
    const glow = ctx.createRadialGradient(sx, sy, 10, sx, sy, 200);
    glow.addColorStop(0, 'rgba(255,240,170,0.9)');
    glow.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.globalAlpha = pal.sun;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.w, g.h);
    ctx.fillStyle = '#fff6c2';
    ctx.beginPath();
    ctx.arc(sx, sy, 64, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = pal.cloud;
  ctx.globalAlpha = 0.85;
  const cspan = g.h + 240;
  for (let i = 0; i < 7; i++) {
    const par = 0.05 + (i % 3) * 0.03;
    const y = ((hash(i + 1) * cspan + g.cam.y * par) % cspan) - 120;
    const x = ((hash(i + 31) * (g.w + 240) + g.time * (5 + i * 2)) % (g.w + 240)) - 120;
    const s = 0.7 + hash(i + 7) * 0.8;
    ctx.beginPath();
    ctx.ellipse(x, y, 46 * s, 18 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 28 * s, y + 6 * s, 28 * s, 14 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 30 * s, y + 5 * s, 30 * s, 15 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFog(ctx, g, pal) {
  if (pal.fog < 0.01) return;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) {
    const y = (((hash(i + 90) * g.h + g.time * (8 + i * 3)) % (g.h + 200)) - 100);
    ctx.globalAlpha = pal.fog * 0.3;
    ctx.beginPath();
    ctx.ellipse(g.w / 2, y, g.w * 0.85, 55, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = pal.fog * 0.12;
  ctx.fillRect(0, 0, g.w, g.h);
  ctx.restore();
}

function drawRain(ctx, g, pal) {
  if (pal.rain < 0.01) return;
  ctx.save();
  ctx.strokeStyle = '#cfe0ff';
  ctx.globalAlpha = 0.45 * pal.rain;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 40; i++) {
    const x = hash(i + 200) * (g.w + 80) - 40;
    const y = ((hash(i + 300) * (g.h + 80) + g.time * 900) % (g.h + 80)) - 40;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 8, y + 22);
  }
  ctx.stroke();
  ctx.restore();

  // A dim lightning flash every few seconds
  if (pal.flash > 0.01) {
    const phase = g.time % 7;
    if (phase < 0.18) {
      ctx.save();
      ctx.globalAlpha = 0.3 * pal.flash * (1 - phase / 0.18);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, g.w, g.h);
      ctx.restore();
    }
  }
}

// ---------- Ground and sapling (the "twig" the climb starts from) ----------

function drawGround(ctx, g) {
  const gy = toScreenY(g, 0);
  if (gy > g.h + 80) return;
  const forest = BIOMES[0];
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(0, gy + 18, g.w, g.h);
  ctx.fillStyle = '#5fc24a';
  ctx.fillRect(0, gy, g.w, 22);
  ctx.fillStyle = '#4aa83a';
  ctx.fillRect(0, gy + 16, g.w, 6);
  // Grass tufts
  ctx.fillStyle = '#4aa83a';
  for (let i = 0; i < 14; i++) {
    const x = hash(i + 500) * g.w;
    ctx.beginPath();
    ctx.moveTo(x - 6, gy);
    ctx.lineTo(x - 2, gy - 12);
    ctx.lineTo(x + 2, gy);
    ctx.lineTo(x + 6, gy - 9);
    ctx.lineTo(x + 8, gy);
    ctx.fill();
  }
  // The sapling
  const x = g.w / 2;
  ctx.fillStyle = '#8f5d2c';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3;
  roundRectPath(ctx, x - 4, gy - 46, 8, 48, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = forest.leaf;
  ctx.strokeStyle = forest.leafDark;
  for (const [dx, dy, rot] of [[-17, -40, -0.5], [17, -50, 0.5]]) {
    ctx.beginPath();
    ctx.ellipse(x + dx, gy + dy, 17, 8, rot, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// ---------- Trees ----------

function drawTrunks(ctx, g, pal) {
  const tw = CFG.trunkW;
  for (const side of ['left', 'right']) {
    const x = side === 'left' ? 0 : g.w - tw;
    const grad = ctx.createLinearGradient(x, 0, x + tw, 0);
    if (side === 'left') {
      grad.addColorStop(0, pal.trunkDark);
      grad.addColorStop(0.55, pal.trunk);
      grad.addColorStop(1, pal.branch);
    } else {
      grad.addColorStop(0, pal.branch);
      grad.addColorStop(0.45, pal.trunk);
      grad.addColorStop(1, pal.trunkDark);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, tw, g.h);

    // Dark edge on the side facing the play area
    ctx.fillStyle = pal.trunkDark;
    ctx.fillRect(side === 'left' ? tw - 4 : x, 0, 4, g.h);
  }

  // Bark ridges, knots and leaf clumps, anchored to world height so they scroll
  const step = 70;
  const first = Math.floor(g.cam.y / step) - 1;
  const count = Math.ceil(g.h / step) + 3;
  for (let k = first; k < first + count; k++) {
    const sy = toScreenY(g, k * step);
    for (const side of ['left', 'right']) {
      const x = side === 'left' ? 0 : g.w - tw;
      const h1 = hash(k * 2 + (side === 'left' ? 0 : 1));
      ctx.fillStyle = pal.trunkDark;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(x + 6 + h1 * (tw - 22), sy, 4, 24 + h1 * 18);
      ctx.globalAlpha = 1;
      if (k % 4 === 0 && h1 > 0.35) {
        ctx.beginPath();
        ctx.ellipse(x + tw / 2, sy + 14, 8, 11, 0, 0, Math.PI * 2);
        ctx.fillStyle = pal.trunkDark;
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + tw / 2, sy + 14, 4, 6, 0, 0, Math.PI * 2);
        ctx.fillStyle = pal.trunk;
        ctx.fill();
      }
      if (k % 5 === 2) {
        const lx = side === 'left' ? tw - 2 : g.w - tw + 2;
        ctx.fillStyle = pal.leaf;
        ctx.strokeStyle = pal.leafDark;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(lx, sy, 11, 0, Math.PI * 2);
        ctx.arc(lx + (side === 'left' ? 9 : -9), sy + 8, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }
}

function drawBranch(ctx, g, b, pal) {
  const sy = toScreenY(g, b.y);
  if (sy < -50 || sy > g.h + 50) return;
  const dir = b.side === 'left' ? 1 : -1;
  const xBase = b.side === 'left' ? CFG.trunkW - 6 : g.w - CFG.trunkW + 6;
  const tip = xBase + dir * (b.len + 6);

  // Tapered branch, flat on top so the animal stands on it
  ctx.beginPath();
  ctx.moveTo(xBase, sy - 1);
  ctx.lineTo(tip, sy + 1);
  ctx.quadraticCurveTo(tip + dir * 5, sy + 6, tip - dir * 4, sy + 10);
  ctx.lineTo(xBase, sy + 28);
  ctx.closePath();
  ctx.fillStyle = pal.branch;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = pal.trunkDark;
  ctx.stroke();

  // Highlight along the top
  ctx.strokeStyle = pal.branchLight;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(xBase + dir * 4, sy + 4);
  ctx.lineTo(tip - dir * 12, sy + 4);
  ctx.stroke();

  // Leaf clusters at the tip and part way along
  ctx.fillStyle = pal.leaf;
  ctx.strokeStyle = pal.leafDark;
  ctx.lineWidth = 2.5;
  const clump = (x, y, r) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };
  clump(tip, sy + 3, 12);
  clump(tip - dir * 15, sy - 3, 9);
  clump(tip - dir * 7, sy + 13, 8);
  clump(xBase + dir * b.len * 0.45, sy + 20, 8);
}

function drawPlayer(ctx, g, p) {
  const sx = p.x;
  const sy = toScreenY(g, p.y) - CFG.playerR;
  // Blink while protected after a hit
  const run = g.run;
  const blink = run && run.invuln > 0 && Math.floor(run.t * 10) % 2 === 0;
  const feetY = sy + CFG.playerR;
  const sc = g.fx ? g.fx.scaleFor(p) : { x: 1, y: 1 };
  ctx.save();
  if (blink) ctx.globalAlpha = 0.3;
  // Squash and stretch anchored at the feet; tumbles when knocked out
  ctx.translate(sx, feetY);
  if (g.dying && g.dying.reason === 'hearts') ctx.rotate(g.dying.rot);
  ctx.scale(sc.x, sc.y);
  // Drawn slightly larger than the hitbox so hits feel fair
  drawCharacter(ctx, g.character || CHARACTERS[0], 0, -CFG.playerR, CFG.playerR + 3);
  ctx.restore();
}

export function drawWorld(ctx, g) {
  const pal = g.pal || biomeAt(0);
  drawSky(ctx, g, pal);
  drawDistance(ctx, g, pal);
  drawFog(ctx, g, pal);
  drawGround(ctx, g);
  drawTrunks(ctx, g, pal);
  for (const side of ['left', 'right']) {
    for (const b of g.world.lists[side]) drawBranch(ctx, g, b, pal);
  }
  drawPlayer(ctx, g, g.player);
  drawRain(ctx, g, pal);
}

// ---------- Hazards ----------

const HAZARD_TOP_MARKER_Y = 110;

function drawPinecone(ctx, h) {
  const r = h.r;
  ctx.fillStyle = '#9a6330';
  ctx.beginPath();
  ctx.ellipse(0, 2, r * 0.82, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Overlapping scales
  ctx.strokeStyle = '#5a3510';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let row = 0; row < 3; row++) {
    const y = -r * 0.45 + row * r * 0.55;
    ctx.moveTo(-r * 0.6, y);
    ctx.quadraticCurveTo(0, y + r * 0.35, r * 0.6, y);
  }
  ctx.moveTo(0, -r * 0.7);
  ctx.lineTo(0, r * 0.8);
  ctx.stroke();
  // Stem
  ctx.fillStyle = '#6b4423';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.5;
  ctx.fillRect(-2.5, -r - 6, 5, 8);
  ctx.strokeRect(-2.5, -r - 6, 5, 8);
}

function drawTwig(ctx, h) {
  const r = h.r;
  ctx.fillStyle = '#7a4f28';
  roundRectPath(ctx, -r * 1.7, -3.5, r * 3.4, 7, 3);
  ctx.fill();
  ctx.stroke();
  // Side shoot with a tiny leaf
  ctx.beginPath();
  ctx.moveTo(r * 0.1, -3);
  ctx.lineTo(r * 0.7, -r * 0.8);
  ctx.lineTo(r * 0.95, -r * 0.7);
  ctx.lineTo(r * 0.35, 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#7bc043';
  ctx.beginPath();
  ctx.ellipse(r * 1.0, -r * 0.95, 6, 3.5, -0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawLeafHazard(ctx, h, pal) {
  const r = h.r;
  ctx.fillStyle = pal.leaf;
  ctx.beginPath();
  ctx.moveTo(-r * 1.1, 0);
  ctx.quadraticCurveTo(0, -r * 0.95, r * 1.1, 0);
  ctx.quadraticCurveTo(0, r * 0.95, -r * 1.1, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = pal.leafDark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 1.1, 0);
  ctx.lineTo(r * 0.9, 0);
  ctx.moveTo(-r * 0.1, 0);
  ctx.lineTo(r * 0.35, -r * 0.4);
  ctx.moveTo(-r * 0.1, 0);
  ctx.lineTo(r * 0.35, r * 0.4);
  ctx.stroke();
}

export function drawHazards(ctx, g) {
  const pal = g.pal || biomeAt(0);

  // Warning markers at the top of the screen
  for (const tg of g.hz.telegraphs) {
    const pulse = 1 + 0.15 * Math.sin(tg.t * 30);
    const s = 20 * pulse;
    ctx.save();
    ctx.translate(tg.x, HAZARD_TOP_MARKER_Y);
    ctx.fillStyle = '#ffd236';
    ctx.strokeStyle = '#7a4b00';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s, s * 0.8);
    ctx.lineTo(-s, s * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7a4b00';
    ctx.font = `bold ${Math.round(s)}px sans-serif`;
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
    // Light halo so hazards stand out from every biome background
    ctx.shadowColor = 'rgba(255,255,255,0.85)';
    ctx.shadowBlur = 7;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    if (h.type === 'pinecone') drawPinecone(ctx, h);
    else if (h.type === 'twig') drawTwig(ctx, h);
    else drawLeafHazard(ctx, h, pal);
    ctx.restore();
  }
}

// ---------- HUD and hint ----------

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.1, y + s * 0.2, x - s * 0.6, y - s * 0.7, x, y - s * 0.2);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 0.7, x + s * 1.1, y + s * 0.2, x, y + s * 0.9);
  ctx.closePath();
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
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    }
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  // The heart that was just lost pops outward and fades
  const ha = g.fx && g.fx.heartAnim;
  if (ha && ha.t > 0 && ha.i >= 0) {
    const k = ha.t / 0.45;
    ctx.save();
    ctx.globalAlpha = k;
    heartPath(ctx, 28 + ha.i * 32, 30, 14 * (1 + (1 - k) * 0.9));
    ctx.fillStyle = '#ff4d5e';
    ctx.fill();
    ctx.restore();
  }
  // Outlined text stays readable on every biome
  drawTitleText(ctx, String(run.score), g.w / 2 + 20, 34, 36, '#ffffff', 'rgba(20,50,35,0.85)');
  drawTitleText(ctx, `${metres} m`, g.w / 2 + 20, 68, 17, '#ffffff', 'rgba(20,50,35,0.85)');
  if (run.mult > 1) drawTitleText(ctx, `x${run.mult}`, g.w - 40, 34, 30, '#ffd236', 'rgba(90,50,0,0.9)');
}

// Ghost hand showing the first-time player where to tap
export function drawHint(ctx, g) {
  const side = Math.floor(g.run.t / 1.4) % 2 === 0 ? 'right' : 'left';
  const x = side === 'right' ? g.w * 0.75 : g.w * 0.25;
  const y = g.h * 0.5;
  const press = (Math.sin(g.run.t * 6) + 1) / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(side === 'right' ? g.w / 2 : 0, 0, g.w / 2, g.h);

  ctx.translate(x, y + press * 10);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 22 + press * 14, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#3a2a1c';
  ctx.lineWidth = 3;
  roundRectPath(ctx, -10, 0, 20, 52, 10);
  ctx.fill();
  ctx.stroke();
  roundRectPath(ctx, -26, 36, 52, 44, 16);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  drawTitleText(ctx, 'Tap left or right to jump', g.w / 2, g.h * 0.3, 28, '#fff', 'rgba(20,50,35,0.85)');
  drawText(ctx, 'The tree waits for your first jump', g.w / 2, g.h * 0.3 + 38, 17, '#fff');
}
