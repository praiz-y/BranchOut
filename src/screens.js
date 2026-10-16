// Menu and game over screens.

import { CHARACTERS, drawCharacter } from './characters.js';
import { persist } from './storage.js';
import { BIOMES } from './biomes.js';
import { drawWorld, drawHazards } from './render.js';
import { drawButton, drawText, drawTitleText, inRect, roundRectPath } from './ui.js';

const tapPoint = (g, t) => ({ x: t.nx * g.w, y: t.ny * g.h });

const click = (g) => { if (g.audio) g.audio.ui(); };

function selectCharacter(g, i) {
  click(g);
  const n = CHARACTERS.length;
  g.charIndex = ((i % n) + n) % n;
  g.save.char = CHARACTERS[g.charIndex].id;
  persist(g.save);
}

// ---------- Menu ----------

function menuLayout(g) {
  const cell = 72;
  const x0 = (g.w - cell * CHARACTERS.length) / 2;
  const pickerY = g.h * 0.5;
  return {
    pickerY,
    play: { x: g.w / 2 - 125, y: g.h * 0.65, w: 250, h: 74 },
    slots: CHARACTERS.map((c, i) => ({ x: x0 + i * cell, y: pickerY - cell / 2, w: cell, h: cell })),
  };
}

function drawSapling(ctx, g) {
  const groundY = g.h * 0.9;
  ctx.fillStyle = '#5fc24a';
  ctx.fillRect(0, groundY, g.w, g.h - groundY);
  ctx.fillStyle = '#8a5a2b';
  ctx.fillRect(0, groundY + 26, g.w, g.h - groundY - 26);
  // The twig: a tiny sapling at ground level
  const x = g.w / 2;
  ctx.fillStyle = '#7a4b20';
  ctx.fillRect(x - 3, groundY - 38, 6, 40);
  ctx.fillStyle = '#3fa34d';
  ctx.beginPath();
  ctx.ellipse(x - 14, groundY - 36, 14, 7, -0.5, 0, Math.PI * 2);
  ctx.ellipse(x + 14, groundY - 42, 14, 7, 0.5, 0, Math.PI * 2);
  ctx.fill();
}

export const menuState = {
  update(g, dt, actions) {
    const L = menuLayout(g);
    for (const a of actions) {
      if (a === 'start') { click(g); return g.goto('playing'); }
      if (a === 'left') selectCharacter(g, g.charIndex - 1);
      if (a === 'right') selectCharacter(g, g.charIndex + 1);
    }
    for (const t of g.taps || []) {
      const p = tapPoint(g, t);
      if (inRect(L.play, p.x, p.y)) { click(g); return g.goto('playing'); }
      L.slots.forEach((s, i) => {
        if (inRect(s, p.x, p.y)) selectCharacter(g, i);
      });
    }
  },

  render(g, ctx) {
    const L = menuLayout(g);
    const sky = ctx.createLinearGradient(0, 0, 0, g.h);
    sky.addColorStop(0, BIOMES[0].skyTop);
    sky.addColorStop(1, BIOMES[0].skyBot);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.w, g.h);
    drawSapling(ctx, g);

    drawTitleText(ctx, 'Branch Out', g.w / 2, g.h * 0.13, 64, '#fff', '#1f7a3f');
    drawText(ctx, 'From twig to treetop', g.w / 2, g.h * 0.13 + 50, 22, '#1f5f3f');

    // Big preview of the chosen animal, bobbing
    const ch = CHARACTERS[g.charIndex];
    const bob = Math.sin(g.time * 3) * 6;
    drawCharacter(ctx, ch, g.w / 2, g.h * 0.32 + bob, 56);
    drawText(ctx, ch.name, g.w / 2, g.h * 0.32 + 92, 26, '#1f5f3f');

    // Picker
    L.slots.forEach((s, i) => {
      const selected = i === g.charIndex;
      if (selected) {
        roundRectPath(ctx, s.x + 2, s.y + 2, s.w - 4, s.h - 4, 16);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ffb703';
        ctx.stroke();
      }
      drawCharacter(ctx, CHARACTERS[i], s.x + s.w / 2, s.y + s.h / 2 + 3, selected ? 22 : 19);
    });

    drawButton(ctx, L.play, 'PLAY', { size: 38 });
    if (g.save.best > 0) {
      drawText(ctx, `Best ${g.save.best}`, g.w / 2, L.play.y + L.play.h + 44, 24, '#1f5f3f');
    }
    drawText(ctx, 'Tap left or right side to jump', g.w / 2, g.h * 0.83, 18, '#1f5f3f');
  },
};

// ---------- Game over ----------

const SHEET_H = 420;

function sheetLayout(g) {
  const x = 20;
  const w = g.w - 40;
  const y = g.h - 20 - SHEET_H;
  return {
    sheet: { x, y, w, h: SHEET_H },
    again: { x: x + 24, y: y + 270, w: w - 48, h: 76 },
    share: { x: x + 24, y: y + 362, w: w - 48, h: 40 },
  };
}

function shareText(g) {
  const r = g.result;
  return `I scored ${r.score} (${r.height} m) in Branch Out! Can you beat it? ${location.href.split('?')[0]}`;
}

function copyScore(g) {
  const text = shareText(g);
  const done = () => { g.copiedAt = g.time; };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
      return;
    }
  } catch { /* try the fallback */ }
  fallbackCopy(text, done);
}

function fallbackCopy(text, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) done();
  } catch { /* copy not available */ }
}

export const gameoverState = {
  enter(g) {
    g.overAt = g.time;
    g.copiedAt = -99;
  },

  update(g, dt, actions) {
    // Short lock so a panicked tap during death does not skip the screen
    if (g.time - g.overAt < 0.25) return;
    const L = sheetLayout(g);
    if (actions.includes('start')) { click(g); return g.goto('playing'); }
    for (const t of g.taps || []) {
      const p = tapPoint(g, t);
      if (inRect(L.again, p.x, p.y)) { click(g); return g.goto('playing'); }
      if (inRect(L.share, p.x, p.y)) { click(g); copyScore(g); }
    }
  },

  render(g, ctx) {
    // Frozen last frame, dimmed
    drawWorld(ctx, g);
    drawHazards(ctx, g);
    ctx.fillStyle = 'rgba(10, 30, 20, 0.45)';
    ctx.fillRect(0, 0, g.w, g.h);

    const r = g.result || { score: 0, height: 0, landings: 0, best: 0, newBest: false };
    const L = sheetLayout(g);
    const k = Math.min(1, (g.time - g.overAt) / 0.3);
    const slide = (1 - (1 - (1 - k) * (1 - k))) * (SHEET_H + 40);

    ctx.save();
    ctx.translate(0, slide);
    const s = L.sheet;
    roundRectPath(ctx, s.x, s.y, s.w, s.h, 28);
    ctx.fillStyle = '#fffaf0';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#1f7a3f';
    ctx.stroke();

    const cx = s.x + s.w / 2;
    drawText(ctx, r.reason === 'fall' ? 'You fell!' : 'Out of hearts!', cx, s.y + 38, 30, '#7a1f12');
    drawText(ctx, String(r.score), cx, s.y + 108, 72, '#1f5f3f');
    drawText(ctx, `Best ${r.best}`, cx, s.y + 165, 24, '#555');
    if (r.newBest) drawText(ctx, 'NEW BEST!', cx, s.y + 195, 22, '#e08a00');
    drawText(ctx, `${r.height} m   ·   ${r.landings} landings`, cx, s.y + 222, 18, '#555');

    // Selected character
    const ch = CHARACTERS[g.charIndex];
    drawCharacter(ctx, ch, s.x + 54, s.y + 120, 28);
    drawText(ctx, ch.name, s.x + 54, s.y + 168, 15, '#555');

    drawButton(ctx, L.again, 'PLAY AGAIN', { size: 34 });
    const copied = g.time - g.copiedAt < 1.6;
    drawButton(ctx, L.share, copied ? 'Copied!' : 'Copy my score', {
      fill: '#ffd34d', edge: '#c28a00', color: '#5a3a00', size: 20, lift: 4,
    });
    ctx.restore();
  },
};
