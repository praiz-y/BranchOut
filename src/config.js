// Tunable numbers. World units: y grows upward, 50 units = 1 metre of height.

export const CFG = {
  W: 480,                 // logical width

  trunkW: 46,
  branchThick: 16,
  branchLenMin: 100,
  branchLenMax: 140,

  // Vertical gap between consecutive branches on the same tree.
  // Worst-case rise to the next branch on a side is gapMax + minRise,
  // which must stay below maxRise so a jump target always exists.
  gapMin: 140,
  gapMax: 240,
  minRise: 30,            // a target must be at least this far above the feet
  maxRise: 300,           // and no further than this

  jumpTime: 0.34,         // seconds in the air
  jumpArc: 50,            // extra height at the top of the arc
  bufferWindow: 0.12,     // taps this close to landing are queued

  startY: 140,            // height of the first branch
  unitsPerMeter: 50,

  scrollBase: 45,         // camera rise speed at the start (units/s)
  scrollGain: 0.03,       // extra speed per unit of height climbed
  scrollMax: 110,
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
  hitPenalty: 15,
  streakWindow: 0.9,      // landings closer together than this build a streak
  streakStep: 5,          // streak length per multiplier step: 5 -> x2, 10 -> x3, 15 -> x4
  streakMax: 4,
};

// Falling hazards. Positions are in screen space so fall speed does not
// depend on camera movement.
export const HAZ = {
  telegraph: 0.6,         // warning time before a hazard enters the screen
  intervalStart: 2.4,     // seconds between spawns at the start
  intervalMin: 0.8,       // ... and at full difficulty
  speedStart: 280,        // px/s
  speedMax: 520,
  rampUnits: 6000,        // height over which difficulty reaches its maximum
  driftMax: 60,           // px/s sideways drift at full difficulty
  spawnY: -40,
  bandFrac: 0.6,          // screen fraction (from top) where the player usually stands
  conflictWindow: 0.9,    // hazards on opposite sides must arrive this far apart
  aimChance: 0.6,         // chance a hazard is aimed near the player
  aimJitter: 45,
  maxActive: 20,
  hitScale: 0.8,          // hitbox is smaller than the artwork
  camFollow: 0.3,         // share of the camera's climb speed added to the fall speed, so hazards
                          // still look like they fall when the background scrolls past fast
  types: {
    pinecone: { r: 16, speed: 1.0, drift: 0.0, spin: 2 },
    twig: { r: 14, speed: 1.25, drift: 0.3, spin: 5 },
    leaf: { r: 15, speed: 0.7, drift: 0.0, spin: 3, sway: true },
  },
};

// 0 at the start, 1 at full difficulty
export function ramp(climbed) {
  return Math.min(1, Math.max(0, climbed / HAZ.rampUnits));
}

export function scrollSpeed(climbed) {
  return Math.min(CFG.scrollMax, CFG.scrollBase + climbed * CFG.scrollGain);
}
