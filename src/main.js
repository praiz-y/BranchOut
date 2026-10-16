import { createInput } from './input.js';
import { createStateMachine } from './state.js';
import { playState } from './play.js';
import { menuState, gameoverState } from './screens.js';
import { CHARACTERS } from './characters.js';
import { loadSave, persist } from './storage.js';
import { createAudio } from './audio.js';
import { drawMuteButton, MUTE_RECT, inRect } from './ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Logical coordinate space: fixed width, height follows the screen aspect so
// the play area is always full height. Game code only sees these units.
const LOGICAL_W = 480;
const MIN_H = 640;
const MAX_H = 1100;

const STEP = 1 / 60;       // fixed update step (seconds)
const MAX_FRAME = 0.25;    // clamp long frames (tab switch, debugger)

const save = loadSave();

const game = {
  w: LOGICAL_W,
  h: 854,
  dpr: 1,
  time: 0,
  debug: new URLSearchParams(location.search).has('debug'),
  fps: 0,
  result: null,
  taps: [],
  save,
  charIndex: Math.max(0, CHARACTERS.findIndex((c) => c.id === save.char)),
};

const input = createInput(canvas);

// Audio: created on the first tap or key press (browser rule), muted state is saved
const audio = createAudio();
audio.setMuted(save.muted);
game.audio = audio;
const unlockAudio = () => audio.unlock();
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

function toggleMute() {
  audio.setMuted(!audio.muted);
  save.muted = audio.muted;
  persist(save);
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM' && !e.repeat) toggleMute();
});

// Load the title font before first use so canvas text does not fall back
if (document.fonts && document.fonts.load) {
  document.fonts.load("700 24px 'Fredoka'").catch(() => {});
}

const stage = document.getElementById('stage');

function resize() {
  // Keep the play area at least MIN_H/LOGICAL_W tall. On a short, wide window
  // (a phone held sideways) the column gets narrower instead of the picture
  // being squashed.
  const maxW = Math.min(LOGICAL_W, Math.floor((window.innerHeight * LOGICAL_W) / MIN_H));
  stage.style.maxWidth = `${Math.max(maxW, 200)}px`;
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

const states = { menu: menuState, playing: playState, gameover: gameoverState };
const sm = createStateMachine(states, 'menu');
const MUSIC_LEVEL = { menu: 0.55, playing: 1, gameover: 0.2 };
game.goto = (name) => {
  sm.go(name, game);
  audio.musicLevel(MUSIC_LEVEL[name] ?? 1);
};
sm.start(game);
audio.music(true);
audio.musicLevel(MUSIC_LEVEL.menu);

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
    // The mute button works on every screen and swallows its own taps
    game.taps = input.drainTaps().filter((t) => {
      if (!inRect(MUTE_RECT, t.nx * game.w, t.ny * game.h)) return true;
      toggleMute();
      return false;
    });
    sm.update(game, STEP, input.drain());
    game.time += STEP;
    acc -= STEP;
  }

  sm.render(game, ctx);
  drawMuteButton(ctx, audio.muted);
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
  if (document.hidden) audio.suspend();
  else audio.resume();
});

requestAnimationFrame(frame);
