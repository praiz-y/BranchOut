// Tiny state machine: menu -> playing -> gameover -> playing (instant restart).
// Each state is { enter(game), update(game, dt, actions), render(game, ctx) }.

export function createStateMachine(states, initial) {
  let current = null;
  let name = null;

  function go(next, game) {
    if (!states[next]) throw new Error(`Unknown state: ${next}`);
    name = next;
    current = states[next];
    if (current.enter) current.enter(game);
  }

  return {
    go,
    get name() { return name; },
    update(game, dt, actions) { if (current && current.update) current.update(game, dt, actions); },
    render(game, ctx) { if (current && current.render) current.render(game, ctx); },
    start(game) { go(initial, game); },
  };
}
