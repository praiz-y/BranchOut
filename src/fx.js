// Game-feel effects: squash and stretch, dust, sparks, score pops, screen shake,
// hit flash, summit confetti and banner, vibration. Cosmetic only: nothing here
// changes scoring or collisions.

import { toScreenY } from './render.js';
import { drawTitleText } from './ui.js';

// Respect the player's "reduce motion" setting by shrinking the shake
const reduceMotion = (() => {
  try {
    return !!(globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
})();

export function buzz(pattern) {
  try {
    if (globalThis.navigator && navigator.vibrate && !document.hidden) navigator.vibrate(pattern);
  } catch { /* vibration not available */ }
}

const MAX_PARTS = 160;
const LAND_SQUASH = 0.18;   // seconds
const HEART_ANIM = 0.45;
const HIT_FLASH = 0.3;
const CONFETTI = ['#ff4d5e', '#ffd236', '#4cc24f', '#3aa0ff', '#ff8fd0', '#ffffff'];

const rand = (a, b) => a + Math.random() * (b - a);
const easeOutBack = (k) => 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2);

export function createFx() {
  const parts = [];
  const pops = [];
  let shakeT = 0;
  let shakeDur = 0.3;
  let shakeAmp = 0;
  let hitT = 0;
  let landT = 0;
  let heart = { i: -1, t: 0 };
  let banner = null;

  const add = (p) => { if (parts.length < MAX_PARTS) parts.push(p); };

  return {
    // World-space dust puff at the feet (wy is world height, up is positive)
    dust(x, wy, n = 6) {
      for (let i = 0; i < n; i++) {
        const dir = i % 2 ? 1 : -1;
        add({
          screen: false, x: x + dir * rand(0, 8), y: wy + 2,
          vx: dir * rand(30, 110), vy: rand(10, 50), g: 160,
          life: rand(0.3, 0.5), max: 0.5, size: rand(3, 6), color: '#ffffff', alpha: 0.85,
        });
      }
    },

    // Screen-space spark burst
    sparks(x, y, color, n = 12) {
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2);
        const s = rand(110, 280);
        add({
          screen: true, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, g: 520,
          life: rand(0.3, 0.55), max: 0.55, size: rand(3, 6), color, alpha: 1,
        });
      }
    },

    confetti(w) {
      for (let i = 0; i < 70; i++) {
        add({
          screen: true, rect: true, x: rand(0, w), y: rand(-240, -10),
          vx: rand(-50, 50), vy: rand(120, 300), g: 30,
          life: rand(2.4, 3.6), max: 3.6, size: rand(5, 9),
          color: CONFETTI[i % CONFETTI.length], alpha: 1, rot: rand(0, 6), spin: rand(-8, 8),
        });
      }
    },

    // Leaves blown across the screen as a warning before a gust of wind
    gustLeaves(dir, w, h) {
      const colors = ['#f08a2c', '#d96a1a', '#c9a227', '#7acb4a', '#b3501a'];
      for (let i = 0; i < 28; i++) {
        add({
          screen: true, rect: true, x: dir > 0 ? rand(-60, -10) : w + rand(10, 60), y: rand(0, h),
          vx: dir * rand(380, 640), vy: rand(-40, 70), g: 0,
          life: rand(1.4, 2.0), max: 2.0, size: rand(7, 12),
          color: colors[i % colors.length], alpha: 0.9, rot: rand(0, 6), spin: rand(-10, 10),
        });
      }
    },

    // Tapped a side with nothing to jump to
    bonk() {
      shakeAmp = Math.max(shakeT > 0 ? shakeAmp : 0, 3 * (reduceMotion ? 0.25 : 1));
      shakeDur = 0.12;
      shakeT = 0.12;
    },

    pop(x, y, text, color = '#ffffff', size = 24) {
      pops.push({ x, y, text, color, size, t: 0.8 });
    },

    shake(amp, dur = 0.3) {
      shakeAmp = Math.max(shakeT > 0 ? shakeAmp : 0, amp * (reduceMotion ? 0.25 : 1));
      shakeDur = dur;
      shakeT = dur;
    },
    shakeOffset() {
      if (shakeT <= 0) return { x: 0, y: 0 };
      const k = shakeT / shakeDur;
      return { x: (Math.random() * 2 - 1) * shakeAmp * k, y: (Math.random() * 2 - 1) * shakeAmp * k };
    },

    hitFlash() { hitT = HIT_FLASH; },
    heartLost(i) { heart = { i, t: HEART_ANIM }; },
    get heartAnim() { return heart; },
    squash() { landT = LAND_SQUASH; },

    banner(text, sub) { banner = { text, sub, t: 3.4, total: 3.4 }; },

    // Scale for the player sprite, anchored at the feet
    scaleFor(p) {
      if (p.falling) return { x: 0.85, y: 1.2 };
      if (p.stumble > 0) {
        // A quick wobble while tripping
        const wob = Math.sin(p.stumble * 70) * 0.2 * Math.min(1, p.stumble / 0.1);
        return { x: 1 + wob, y: 1 - wob * 0.8 };
      }
      if (p.jumping) {
        const sy = 1 + 0.22 * Math.sin(Math.min(1, p.t) * Math.PI);
        return { x: 1 / sy, y: sy };
      }
      const k = Math.max(0, landT / LAND_SQUASH);
      return { x: 1 + 0.3 * k, y: 1 - 0.3 * k };
    },

    update(dt) {
      shakeT = Math.max(0, shakeT - dt);
      hitT = Math.max(0, hitT - dt);
      landT = Math.max(0, landT - dt);
      if (heart.t > 0) heart.t = Math.max(0, heart.t - dt);
      if (banner) {
        banner.t -= dt;
        if (banner.t <= 0) banner = null;
      }

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dt;
        if (p.life <= 0) {
          parts[i] = parts[parts.length - 1];
          parts.pop();
          continue;
        }
        p.x += p.vx * dt;
        if (p.screen) {
          p.y += p.vy * dt;
          p.vy += p.g * dt;
        } else {
          p.y += p.vy * dt;
          p.vy -= p.g * dt;
        }
        if (p.rot !== undefined) p.rot += p.spin * dt;
      }
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i];
        p.t -= dt;
        p.y -= 55 * dt;
        if (p.t <= 0) pops.splice(i, 1);
      }
    },

    // Particles (inside the screen-shake group)
    drawParts(ctx, g) {
      for (const p of parts) {
        const a = Math.min(1, p.life / (p.max * 0.5)) * p.alpha;
        const sy = p.screen ? p.y : toScreenY(g, p.y);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        if (p.rect) {
          ctx.save();
          ctx.translate(p.x, sy);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, sy, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    },

    // Score pops, hit flash and banner (drawn above the HUD, not shaken)
    drawOverlay(ctx, g) {
      if (hitT > 0) {
        ctx.fillStyle = `rgba(255,40,50,${(0.3 * hitT) / HIT_FLASH})`;
        ctx.fillRect(0, 0, g.w, g.h);
      }
      for (const p of pops) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.t / 0.35);
        drawTitleText(ctx, p.text, p.x, p.y, p.size, p.color, 'rgba(30,30,30,0.85)');
        ctx.restore();
      }
      if (banner) {
        const age = banner.total - banner.t;
        const scale = easeOutBack(Math.min(1, age / 0.45));
        const alpha = Math.min(1, banner.t / 0.6);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(g.w / 2, g.h * 0.3);
        ctx.scale(scale, scale);
        drawTitleText(ctx, banner.text, 0, 0, 64, '#ffd236', '#8a4b00');
        drawTitleText(ctx, banner.sub, 0, 46, 22, '#ffffff', 'rgba(60,30,0,0.85)');
        ctx.restore();
      }
    },
  };
}
