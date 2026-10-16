import { createInput } from './input.js';
import { createStateMachine } from './state.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Logical coordinate space: fixed width, height follows the screen aspect so
// the play area is always full height. Game code only sees these units.
const LOGICAL_W = 480;
const MIN_H = 640;
const MAX_H = 1100;

const STEP = 1 / 60;       // fixed update step (seconds)
const MAX_FRAME = 0.25;    // clamp long frames (tab switch, debugger)

const game = {
  w: LOGICAL_W,
  h: 854,
  dpr: 1,
  time: 0,
  debug: new URLSearchParams(location.search).has('debug'),
  fps: 0,
  placeholder: { x: LOGICAL_W / 2, y: 0 },
};

const input = createInput(canvas);

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const aspect = rect.height / Math.max(rect.width, 1);
  game.h = Math.round(Math.min(MAX_H, Math.max(MIN_H, LOGICAL_W * aspect)));
  game.dpr = dpr;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  // Map logical units to device pixels
  ctx.setTransform(canvas.width / game.w, 0, 0, canvas.height / game.h, 0, 0);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

// --- Placeholder states (replaced in later phases) ---

function drawBackground(color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, game.w, game.h);
}

function centerText(text, y, size, color = '#fff') {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, game.w / 2, y);
}

const states = {
  menu: {
    update(g, dt, actions) {
      if (actions.includes('start')) sm.go('playing', g);
    },
    render(g) {
      drawBackground('#7fd6ff');
      centerText('Branch Out', g.h * 0.38, 56, '#1f5f3f');
      centerText('From twig to treetop', g.h * 0.38 + 48, 22, '#1f5f3f');
      centerText('Tap or press Space to play', g.h * 0.6, 24);
    },
  },
  playing: {
    enter(g) {
      g.placeholder.x = g.w / 2;
      g.placeholder.y = g.h * 0.7;
    },
    update(g, dt, actions) {
      for (const a of actions) {
        if (a === 'left') g.placeholder.x = Math.max(40, g.placeholder.x - 60);
        if (a === 'right') g.placeholder.x = Math.min(g.w - 40, g.placeholder.x + 60);
      }
      // Phase 0 stand-in for dying: fall off the bottom
      g.placeholder.y += 120 * dt;
      if (g.placeholder.y > g.h + 40) sm.go('gameover', g);
    },
    render(g) {
      drawBackground('#9be3a0');
      ctx.fillStyle = '#e8590c';
      ctx.beginPath();
      ctx.arc(g.placeholder.x, g.placeholder.y, 28, 0, Math.PI * 2);
      ctx.fill();
      centerText('Left / right to move', 60, 22, '#1f5f3f');
    },
  },
  gameover: {
    update(g, dt, actions) {
      if (actions.includes('start')) sm.go('playing', g);
    },
    render(g) {
      drawBackground('#ffb4a2');
      centerText('Game over', g.h * 0.42, 48, '#7a1f12');
      centerText('Tap or press Space to retry', g.h * 0.58, 24, '#7a1f12');
    },
  },
};

const sm = createStateMachine(states, 'menu');
sm.start(game);

// --- Debug overlay (?debug in the URL, or press the backtick key) ---

window.addEventListener('keydown', (e) => {
  if (e.code === 'Backquote') game.debug = !game.debug;
});

function drawDebug() {
  const lines = [
    `fps ${game.fps.toFixed(0)}`,
    `state ${sm.name}`,
    `logical ${game.w}x${game.h}  dpr ${game.dpr}`,
    `canvas ${canvas.width}x${canvas.height}`,
  ];
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(6, 6, 190, lines.length * 18 + 10);
  ctx.fillStyle = '#0f0';
  ctx.font = '13px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, 12, 12 + i * 18));
  ctx.restore();
}

// --- Main loop: fixed timestep update, render once per frame ---

let last = performance.now();
let acc = 0;
let fpsFrames = 0;
let fpsTimer = 0;

function frame(now) {
  const dt = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  acc += dt;

  while (acc >= STEP) {
    sm.update(game, STEP, input.drain());
    game.time += STEP;
    acc -= STEP;
  }

  sm.render(game, ctx);
  if (game.debug) drawDebug();

  fpsFrames++;
  fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    game.fps = fpsFrames / fpsTimer;
    fpsFrames = 0;
    fpsTimer = 0;
  }

  requestAnimationFrame(frame);
}

// After a tab switch, drop stale time and queued input instead of fast-forwarding
document.addEventListener('visibilitychange', () => {
  last = performance.now();
  acc = 0;
  input.clear();
});

requestAnimationFrame(frame);
