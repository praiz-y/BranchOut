// Input plumbing: pointer (touch + mouse) and keyboard.
//
// Keyboard becomes actions: 'left' | 'right' | 'start'.
// Pointer becomes taps with normalised coordinates { nx, ny } (0..1 across the
// canvas). Screens decide what a tap means: a button press in menus, a
// left/right jump during play.
//
// Both queues are drained once per fixed update, so input is never lost
// between frames.

const KEY_ACTIONS = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'start',
  Enter: 'start',
};

export function createInput(canvas) {
  const actions = [];
  const taps = [];

  // Cap the queues so a stuck key or tap storm cannot grow them unbounded
  const pushAction = (a) => { if (actions.length < 8) actions.push(a); };
  const pushTap = (t) => { if (taps.length < 8) taps.push(t); };

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    pushTap({
      nx: (e.clientX - rect.left) / rect.width,
      ny: (e.clientY - rect.top) / rect.height,
    });
  });

  window.addEventListener('keydown', (e) => {
    const action = KEY_ACTIONS[e.code];
    if (!action || e.repeat) return;
    e.preventDefault();
    pushAction(action);
  });

  // Block gestures that would scroll, zoom or open menus mid-game
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  return {
    drain() {
      return actions.splice(0, actions.length);
    },
    drainTaps() {
      return taps.splice(0, taps.length);
    },
    clear() {
      actions.length = 0;
      taps.length = 0;
    },
  };
}
