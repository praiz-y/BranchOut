// Saved data (personal best, selected character, tutorial flag).
// localStorage can be unavailable or throw (private mode, blocked data), so
// every access is wrapped and the game works without it.

const KEY = 'branchout.v1';
const DEFAULTS = { best: 0, char: 'squirrel', seenHint: false, muted: false };

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && typeof d === 'object') {
        return {
          best: Number.isFinite(d.best) && d.best > 0 ? Math.floor(d.best) : 0,
          char: typeof d.char === 'string' ? d.char : DEFAULTS.char,
          seenHint: d.seenHint === true,
          muted: d.muted === true,
        };
      }
    }
  } catch { /* fall through to defaults */ }
  return { ...DEFAULTS };
}

export function persist(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch { /* storage unavailable: play on without saving */ }
}
