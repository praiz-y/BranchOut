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
  deathMargin: 24,        // falling this far below the bottom edge ends the run

  playerR: 20,
};

export function scrollSpeed(climbed) {
  return Math.min(CFG.scrollMax, CFG.scrollBase + climbed * CFG.scrollGain);
}
