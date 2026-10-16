// Input plumbing: pointer (touch + mouse) and keyboard are normalised into
// a queue of actions: 'left' | 'right' | 'start'. The game drains the queue
// once per fixed update, so input is never lost between frames.

const KEY_ACTIONS = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'start',
  Enter: 'start',
};

export function createInput(canvas) {
  const queue = [];

  function push(action) {
    // Cap the queue so a stuck key or tap storm cannot grow it unbounded
    if (queue.length < 8) queue.push(action);
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const side = e.clientX - rect.left < rect.width / 2 ? 'left' : 'right';
    push(side);
    push('start'); // a tap also starts / restarts from non-play screens
  });

  window.addEventListener('keydown', (e) => {
    const action = KEY_ACTIONS[e.code];
    if (!action || e.repeat) return;
    e.preventDefault();
    push(action);
  });

  // Block gestures that would scroll, zoom or open menus mid-game
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  return {
    // Remove and return all queued actions
    drain() {
      return queue.splice(0, queue.length);
    },
    clear() {
      queue.length = 0;
    },
  };
}
