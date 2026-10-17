// Tunable numbers. World units: y grows upward, 50 units = 1 metre of height.

export const CFG = {
  W: 480,                 // logical width

  trunkW: 46,
  branchThick: 16,
  branchLenMin: 100,
  branchLenMax: 140,

  // Vertical gap between consecutive branches on the same tree (free climbing).
  // Worst-case rise to the next branch on a side is gapMax + minRise,
  // which must stay below maxRise so a jump target always exists.
  gapMin: 140,
  gapMax: 240,
  minRise: 30,            // a target must be at least this far above the feet
  maxRise: 300,           // and no further than this

  // Jump time grows with the rise: a long jump commits you for longer
  jumpTimeMin: 0.30,
  jumpTimeMax: 0.42,
  jumpArc: 50,            // extra height at the top of the arc
  bufferWindow: 0.12,     // taps this close to landing are queued
  stumbleTime: 0.2,       // tapping a side with nothing to jump to trips you for this long

  startY: 140,            // height of the first branch
  unitsPerMeter: 50,

  scrollBase: 65,         // camera rise speed at the start (units/s)
  scrollGain: 0.045,      // extra speed per unit of height climbed
  scrollMax: 170,
  followLine: 0.55,       // camera is pushed up if the player passes this fraction of screen height
  followRate: 6,
  followMaxSpeed: 450,    // the follow push is capped so the background never whips past (px/s)
  deathMargin: 24,        // falling this far below the bottom edge ends the run

  playerR: 20,
};

// Run rules: hearts, damage, scoring
export const RUN = {
  hearts: 3,
  invuln: 1.0,            // seconds of protection after a hit
  landPoints: 10,
  dryBonus: 10,           // extra points for landing on a dry branch (10 + 10 = 20 for a short hop)
  hitPenalty: 15,
  streakWindow: 0.9,      // landings closer together than this build a streak
  streakStep: 5,          // streak length per multiplier step: 5 -> x2, 10 -> x3, 15 -> x4
  streakMax: 4,
};

// Points for a landing. Longer rises are worth more (risk and reward).
export function landingPoints(rise, dry = false) {
  const bonus = rise < 150 ? 0 : rise < 200 ? 5 : rise < 250 ? 10 : 15;
  return RUN.landPoints + bonus + (dry ? RUN.dryBonus : 0);
}

export function jumpDuration(rise) {
  const k = Math.min(1, Math.max(0, (rise - 60) / 220));
  return CFG.jumpTimeMin + (CFG.jumpTimeMax - CFG.jumpTimeMin) * k;
}

// Falling hazards. Positions are in screen space so fall speed does not
// depend on camera movement.
export const HAZ = {
  telegraph: 0.6,         // warning time before a hazard enters the screen (start of the climb)
  telegraphMin: 0.4,      // ... and at full difficulty
  lockTime: 0.15,         // the warning marker stops following the player this long before release
  trackSpeed: 420,        // px/s the marker follows the player
  intervalStart: 1.9,     // seconds between spawns at the start
  intervalMin: 0.6,       // ... and at full difficulty
  speedStart: 300,        // px/s
  speedMax: 620,
  rampUnits: 3500,        // height over which difficulty reaches its maximum (70 m)
  driftMax: 130,          // px/s sideways drift at full difficulty
  spawnY: -40,
  bandFrac: 0.6,          // screen fraction (from top) where the player usually stands
  conflictWindow: 0.9,    // hazards on opposite sides must arrive this far apart
  aimChance: 0.75,        // chance a hazard is aimed at the player
  aimJitter: 40,          // aim error in px at the start ...
  aimJitterMin: 18,       // ... and at full difficulty
  zones: { left: [100, 176], right: [304, 380], mid: [190, 290] }, // where players stand and cross
  midChance: 0.2,         // chance an unaimed hazard targets the crossing path
  waveStart: 0.15,        // difficulty at which waves begin
  waveChance: 0.4,        // chance of a wave at full difficulty
  waveGap: [0.28, 0.45],  // seconds between hazards in a wave
  waveSpread: 44,         // px between hazards in a wave
  maxActive: 20,
  hitScale: 0.9,          // hitbox is slightly smaller than the artwork
  camFollow: 0.3,         // share of the camera's climb speed added to the fall speed, so hazards
                          // still look like they fall when the background scrolls past fast
  types: {
    pinecone: { r: 16, speed: 1.0, drift: 0.7, spin: 2 },    // bounces between the trunks
    twig: { r: 14, speed: 1.25, drift: 1.0, spin: 5 },       // falls diagonally
    leaf: { r: 15, speed: 0.7, drift: 0.0, spin: 3, sway: true },
  },
};

// 0 at the start, 1 at full difficulty
export function ramp(climbed) {
  return Math.min(1, Math.max(0, climbed / HAZ.rampUnits));
}

// Branch patterns. Heights are in units above CFG.startY.
export const PATTERN = {
  firstAt: 500,           // no zigzag or ladder before 10 m
  freeMin: 1100,          // length of a free stretch (units) ...
  freeMax: 1700,
  freeShrink: 0.4,        // ... shrinks by up to this fraction as difficulty rises
  rampUnits: 3500,
  zigzagChance: 0.6,      // otherwise a ladder
  zigzag: { countMin: 5, countMax: 9, gapMin: 165, gapMax: 185 },
  ladder: { countMin: 5, countMax: 8, gapMin: 140, gapMax: 200, firstMin: 130, firstMax: 185 },
  seamGap: [110, 170],    // first branch of the sync pair above everything
  seamDiff: [40, 90],     // second branch of the pair, above the first
};

// Dry (weak) branches: crack after you land and snap if you stay
export const DRY = {
  startUnits: 1000,       // none before 20 m
  chanceMin: 0.12,
  chanceMax: 0.38,
  rampUnits: 5000,
  crackStart: 1.0,        // seconds from landing to snap ...
  crackMin: 0.65,         // ... shrinking with height
  crackRampUnits: 5000,
  separation: 300,        // no dry branch within this height of a dry branch on the other tree
                          // (wider than the 270-unit window of branches one jump can reach)
  gravity: 2600,          // units/s^2 while falling after a snap
};

// Gusts of wind (Autumn and Storm): leaves blow in as a warning, then hazards drift sideways
export const WIND = {
  strength: 90,           // peak sideways push on hazards, px/s (scaled by the biome's wind value)
  warn: 0.5,              // seconds of blowing leaves before the push starts
  dur: 1.6,               // seconds the push lasts
  gapMin: 6,              // seconds between gusts (shorter in windier biomes)
  gapMax: 10,
};

export function crackTime(climbed) {
  const k = Math.min(1, Math.max(0, climbed / DRY.crackRampUnits));
  return DRY.crackStart + (DRY.crackMin - DRY.crackStart) * k;
}

export function scrollSpeed(climbed) {
  return Math.min(CFG.scrollMax, CFG.scrollBase + climbed * CFG.scrollGain);
}
