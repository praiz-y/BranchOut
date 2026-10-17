// Biome palettes by height. The climb moves through four looks that blend
// into each other: green forest, autumn canopy, misty canopy, stormy treetops.
// Pure logic, no DOM.

export const BLEND = 20; // metres over which one biome fades into the next

const RAW = [
  {
    name: 'Forest', at: 0,
    skyTop: '#6fcbff', skyBot: '#d9f6c6', cloud: '#ffffff', hill: '#8fd98a',
    trunk: '#8f5d2c', trunkDark: '#5a3510', branch: '#b57f42', branchLight: '#dfae6a',
    leaf: '#4cc24f', leafDark: '#2a8a34', fog: 0, rain: 0, flash: 0,
  },
  {
    name: 'Autumn', at: 50,
    skyTop: '#ff9f68', skyBot: '#ffe7b0', cloud: '#fff1dd', hill: '#f0b35a',
    trunk: '#7d4a20', trunkDark: '#4d2a0e', branch: '#a8692f', branchLight: '#d79a58',
    leaf: '#f08a2c', leafDark: '#b3501a', fog: 0, rain: 0, flash: 0, wind: 1,
  },
  {
    name: 'Mist', at: 120,
    skyTop: '#9db6c6', skyBot: '#e3ebee', cloud: '#f5f9fa', hill: '#b9cfca',
    trunk: '#6f5b49', trunkDark: '#43352a', branch: '#8f7761', branchLight: '#b8a086',
    leaf: '#6fa58d', leafDark: '#437662', fog: 0.55, rain: 0, flash: 0, hazFade: 1,
  },
  {
    name: 'Storm', at: 220,
    skyTop: '#2b3452', skyBot: '#66769a', cloud: '#8892ad', hill: '#46547a',
    trunk: '#54443a', trunkDark: '#2a1f19', branch: '#7a6354', branchLight: '#a08672',
    leaf: '#4f8a72', leafDark: '#2b5645', fog: 0.2, rain: 1, flash: 1, sun: 0, wind: 1.3, hazFade: 0.4,
  },
  {
    // Above the storm: the sun comes up and the climb goes on in golden light
    name: 'Summit', at: 400,
    skyTop: '#ff8f6b', skyBot: '#ffe2a0', cloud: '#fff3d6', hill: '#ffc27a',
    trunk: '#8f5d2c', trunkDark: '#5a3510', branch: '#b57f42', branchLight: '#e6b574',
    leaf: '#7acb4a', leafDark: '#3f8f2a', fog: 0.12, rain: 0, flash: 0, sun: 1,
  },
];

export const SUMMIT_M = 400;

const COLOR_KEYS = ['skyTop', 'skyBot', 'cloud', 'hill', 'trunk', 'trunkDark', 'branch', 'branchLight', 'leaf', 'leafDark'];
// wind: how windy (gusts push hazards sideways); hazFade: how much hazards fade in late (mist)
const NUM_KEYS = ['fog', 'rain', 'flash', 'sun', 'wind', 'hazFade'];

const parseHex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));

export const BIOMES = RAW.map((b) => {
  const rgb = {};
  for (const k of COLOR_KEYS) rgb[k] = parseHex(b[k]);
  return { ...b, rgb };
});

const toCss = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

// Palette for a height in metres, blended near the boundary with the next biome
export function biomeAt(metres) {
  let i = 0;
  while (i + 1 < BIOMES.length && metres >= BIOMES[i + 1].at) i++;
  const cur = BIOMES[i];
  const next = BIOMES[i + 1];
  // Fade towards the next biome during the last BLEND metres before it starts
  let t = 0;
  if (next) t = Math.min(1, Math.max(0, (metres - (next.at - BLEND)) / BLEND));
  const out = { name: t > 0.5 && next ? next.name : cur.name };
  for (const k of COLOR_KEYS) {
    const a = cur.rgb[k];
    const b = next ? next.rgb[k] : a;
    out[k] = toCss([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
  }
  for (const k of NUM_KEYS) {
    const a = cur[k] ?? 0;
    const b = next ? next[k] ?? 0 : a;
    out[k] = a + (b - a) * t;
  }
  return out;
}
