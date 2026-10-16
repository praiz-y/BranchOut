// Smoke tests for the Phase 5 art and audio code. They catch crashes and bad
// values; they cannot judge how anything looks or sounds.
//
// Usage: node tools/art-audio-smoke.mjs

import { biomeAt, BIOMES, BLEND } from '../src/biomes.js';
import { playState } from '../src/play.js';
import { drawWorld, drawHazards, drawHud, drawHint } from '../src/render.js';
import { drawMuteButton } from '../src/ui.js';
import { CHARACTERS, drawCharacter } from '../src/characters.js';
import { createAudio } from '../src/audio.js';

let failed = 0;
function run(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name}: ${e.stack}`);
  }
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };

// ---- fake canvas context ----
const gradient = { addColorStop() {} };
const ctx = new Proxy({}, {
  get(t, p) {
    if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => gradient;
    if (p in t) return t[p];
    return () => {};
  },
  set(t, p, v) { t[p] = v; return true; },
});

// ---- biomes ----
run('biomes: palette at each height is complete and well formed', () => {
  for (const m of [0, 10, 40, 49, 50, 70, 100, 119, 120, 180, 219, 220, 400, 5000]) {
    const p = biomeAt(m);
    for (const k of ['skyTop', 'skyBot', 'cloud', 'hill', 'trunk', 'trunkDark', 'branch', 'branchLight', 'leaf', 'leafDark']) {
      assert(/^rgb\(\d+,\d+,\d+\)$/.test(p[k]), `${k} bad at ${m}: ${p[k]}`);
    }
    for (const k of ['fog', 'rain', 'flash']) assert(Number.isFinite(p[k]), `${k} bad at ${m}`);
  }
});

run('biomes: names follow the climb and blending is continuous', () => {
  assert(biomeAt(0).name === 'Forest', 'start is forest');
  assert(biomeAt(BIOMES[1].at + 1).name === 'Autumn', 'autumn after its start');
  assert(biomeAt(BIOMES[2].at + 1).name === 'Mist', 'mist');
  assert(biomeAt(BIOMES[3].at + 1).name === 'Storm', 'storm');
  assert(biomeAt(BIOMES[4].at + 1).name === 'Summit', 'summit');
  assert(biomeAt(9999).name === 'Summit', 'summit continues forever');

  // No sudden jumps: step through every 0.1 m and compare neighbouring colours
  let prev = biomeAt(0);
  for (let m = 0.1; m < 450; m += 0.1) {
    const cur = biomeAt(m);
    const a = prev.skyTop.match(/\d+/g).map(Number);
    const b = cur.skyTop.match(/\d+/g).map(Number);
    const diff = Math.max(...a.map((v, i) => Math.abs(v - b[i])));
    assert(diff <= 12, `colour jump of ${diff} at ${m.toFixed(1)} m`);
    prev = cur;
  }
});

run('biomes: rain and lightning only in the storm', () => {
  assert(biomeAt(0).rain === 0 && biomeAt(100).rain === 0, 'no rain early');
  assert(biomeAt(300).rain === 1 && biomeAt(300).flash === 1, 'storm has rain and flash');
  assert(biomeAt(500).rain === 0 && biomeAt(500).sun === 1, 'summit is calm with a sun');
});

// ---- drawing ----
function newGame() {
  const g = {
    w: 480, h: 854, time: 3.3, taps: [], charIndex: 0,
    save: { best: 10, char: 'squirrel', seenHint: true, muted: false },
    goto(n) { g.next = n; },
  };
  return g;
}

run('world renders in every biome, with and without hazards', () => {
  const g = newGame();
  playState.enter(g);
  for (const m of [0, 30, 60, 100, 130, 200, 230, 500]) {
    g.biomeM = m;
    g.pal = biomeAt(m);
    g.cam.y = m * 50;
    g.hz.telegraphs.push({ x: 200, t: 0.3, spec: {} });
    const h = g.hz.pool;
    ['pinecone', 'twig', 'leaf'].forEach((type, i) => {
      Object.assign(h[i], { active: true, type, x: 100 + i * 100, y: 300, r: 15, rot: 1, hitR: 12 });
    });
    drawWorld(ctx, g);
    drawHazards(ctx, g);
    drawHud(ctx, g, m);
    g.hz.telegraphs.length = 0;
  }
});

run('ground and sapling render at the start and are skipped high up', () => {
  const g = newGame();
  playState.enter(g);
  g.cam.y = 0;
  drawWorld(ctx, g);
  g.cam.y = 100000;
  drawWorld(ctx, g);
});

run('hint, mute button and every character render', () => {
  const g = newGame();
  g.save.seenHint = false;
  playState.enter(g);
  drawHint(ctx, g);
  drawMuteButton(ctx, true);
  drawMuteButton(ctx, false);
  for (const c of CHARACTERS) drawCharacter(ctx, c, 100, 100, 24);
});

run('play updates biome as height is gained', () => {
  const g = newGame();
  playState.enter(g);
  g.player.maxY = 140 + 130 * 50; // 130 m up
  g.player.y = g.player.maxY;
  g.cam.y = g.player.y - 300;
  for (let i = 0; i < 300; i++) playState.update(g, 1 / 60, []);
  assert(g.biomeM > 100, `biomeM should ease towards 130, got ${g.biomeM}`);
});

// ---- audio with a fake AudioContext ----
function makeFakeAudioContext() {
  const node = () => new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} },
    frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    connect() {}, start() {}, stop() {},
  }, { get: (t, p) => (p in t ? t[p] : () => {}) });
  return class FakeAudioContext {
    constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = {}; }
    createGain() { return node(); }
    createOscillator() { return node(); }
    createBiquadFilter() { return node(); }
    createBufferSource() { return node(); }
    createBuffer(c, n) { const d = new Float32Array(n); return { getChannelData: () => d }; }
    resume() { this.state = 'running'; }
    suspend() { this.state = 'suspended'; }
  };
}

run('audio: calls before unlock are harmless', () => {
  const a = createAudio();
  a.jump(); a.land(3); a.hit(); a.warn(); a.ui(); a.gameOver(); a.newBest();
  a.music(true); a.musicLevel(0.5); a.setMuted(true); a.suspend(); a.resume();
});

run('audio: every sound and the music loop run after unlock', () => {
  globalThis.AudioContext = makeFakeAudioContext();
  const a = createAudio();
  a.music(true);            // asked for before unlock: must start on unlock
  a.unlock();
  a.jump(); a.land(1); a.land(20); a.hit(); a.warn(); a.ui(); a.gameOver(); a.newBest();
  a.musicLevel(0.2);
  a.setMuted(true);
  assert(a.muted === true, 'mute flag');
  a.setMuted(false);
  a.suspend(); a.resume();
  a.music(false);           // stops the scheduler so the process can exit
});

run('audio: missing AudioContext does not throw', () => {
  delete globalThis.AudioContext;
  const a = createAudio();
  a.unlock();
  a.jump();
});

process.exit(failed ? 1 : 0);
