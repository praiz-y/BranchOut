// Sound effects and music, synthesised with WebAudio. No audio files.
//
// Browsers (iOS especially) only allow audio after a user gesture, so the
// AudioContext is created in unlock(), which main.js calls on the first tap
// or key press. Until then every call is a quiet no-op.

const midiToHz = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Music: 16 eighth-note steps in C major pentatonic
const BPM = 112;
const BASS = [48, 0, 48, 0, 43, 0, 43, 0, 45, 0, 45, 0, 43, 0, 50, 0];
const LEAD = [72, 0, 76, 0, 79, 76, 0, 74, 72, 0, 69, 0, 67, 0, 0, 0];

export function createAudio() {
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let noiseBuf = null;
  let muted = false;
  let wantMusic = false;
  let musicOn = false;
  let nextTime = 0;
  let step = 0;
  let timer = null;
  let musicLevel = 1;

  const MASTER_VOL = 0.8;

  function unlock() {
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return;
      try {
        ctx = new AC();
      } catch {
        return;
      }
      master = ctx.createGain();
      master.gain.value = muted ? 0 : MASTER_VOL;
      master.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 1;
      sfxBus.connect(master);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.35 * musicLevel;
      musicBus.connect(master);

      // One second of white noise, reused for thuds and hi-hats
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    if (wantMusic) startMusic();
  }

  // Oscillator note with a quick attack and exponential decay
  function tone(freq, endFreq, dur, type, vol, delay = 0, bus = sfxBus) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq, delay = 0, bus = sfxBus) {
    if (!ctx || !noiseBuf) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(bus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ----- Music scheduler: schedules notes slightly ahead of the audio clock -----

  function scheduleMusic() {
    if (!musicOn || !ctx) return;
    const stepDur = 60 / BPM / 2;
    while (nextTime < ctx.currentTime + 0.2) {
      const i = step % 16;
      const d = Math.max(0, nextTime - ctx.currentTime);
      if (BASS[i]) tone(midiToHz(BASS[i]), midiToHz(BASS[i]), stepDur * 1.8, 'sine', 0.5, d, musicBus);
      if (LEAD[i]) tone(midiToHz(LEAD[i]), midiToHz(LEAD[i]), stepDur * 1.4, 'triangle', 0.3, d, musicBus);
      if (i % 2 === 1) noise(0.04, 0.05, 6000, d, musicBus);
      nextTime += stepDur;
      step++;
    }
    timer = setTimeout(scheduleMusic, 50);
  }

  function startMusic() {
    if (!ctx || musicOn) return;
    musicOn = true;
    nextTime = ctx.currentTime + 0.05;
    step = 0;
    scheduleMusic();
  }

  function stopMusic() {
    musicOn = false;
    clearTimeout(timer);
  }

  return {
    unlock,

    // Sound effects
    jump() {
      tone(330, 660, 0.12, 'square', 0.1);
    },
    // Pitch climbs with the streak so a run of quick landings sounds like a rising scale
    land(streak = 1) {
      const f = midiToHz(60 + Math.min(12, Math.max(0, streak - 1)) * 2);
      tone(f, f * 0.7, 0.1, 'triangle', 0.25);
      noise(0.04, 0.08, 1800);
    },
    hit() {
      noise(0.28, 0.35, 500);
      tone(220, 55, 0.3, 'sawtooth', 0.22);
    },
    warn() {
      tone(880, 880, 0.06, 'square', 0.035);
    },
    ui() {
      tone(700, 900, 0.07, 'sine', 0.15);
    },
    gameOver() {
      [392, 330, 262, 196].forEach((f, i) => tone(f, f, 0.22, 'triangle', 0.22, i * 0.18));
    },
    newBest() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.16, 'square', 0.1, 0.15 + i * 0.1));
    },
    // A dry branch creaking: gets higher and sharper as it nears snapping
    creak(progress = 0) {
      const f = 150 + progress * 260;
      tone(f, f * 0.8, 0.07, 'sawtooth', 0.07 + progress * 0.06);
      noise(0.03, 0.05, 1200 + progress * 1500);
    },
    snap() {
      noise(0.12, 0.4, 2600);
      tone(520, 90, 0.18, 'square', 0.18);
    },
    bonk() {
      tone(140, 70, 0.1, 'triangle', 0.22);
    },
    wind() {
      if (!ctx || !noiseBuf) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(400, t);
      filter.frequency.exponentialRampToValueAtTime(1400, t + 1.0);
      filter.frequency.exponentialRampToValueAtTime(400, t + 2.1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.1);
      src.connect(filter);
      filter.connect(g);
      g.connect(sfxBus);
      src.start(t);
      src.stop(t + 2.2);
    },
    summit() {
      [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.25, 'triangle', 0.22, i * 0.11));
    },

    // Music
    music(on) {
      wantMusic = on;
      if (on) startMusic();
      else stopMusic();
    },
    musicLevel(level) {
      musicLevel = level;
      if (musicBus) musicBus.gain.setTargetAtTime(0.35 * level, ctx.currentTime, 0.15);
    },

    // Mute
    setMuted(m) {
      muted = m;
      if (master) master.gain.setTargetAtTime(m ? 0 : MASTER_VOL, ctx.currentTime, 0.02);
    },
    get muted() { return muted; },

    // Pause and resume with the tab
    suspend() {
      if (ctx && ctx.state === 'running') ctx.suspend();
    },
    resume() {
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
  };
}
