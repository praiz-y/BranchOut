// Six cartoon animals, drawn with canvas paths. Cosmetic only.

export const CHARACTERS = [
  { id: 'squirrel', name: 'Squirrel', body: '#c8763a', belly: '#f3d9b1', dark: '#6b3410' },
  { id: 'fox', name: 'Fox', body: '#f58a1f', belly: '#fff1dc', dark: '#7a3500' },
  { id: 'bunny', name: 'Bunny', body: '#f6f1ff', belly: '#ffd1dc', dark: '#6a5a8c' },
  { id: 'bear', name: 'Bear', body: '#a8693a', belly: '#e9c79a', dark: '#4f2a0c' },
  { id: 'raccoon', name: 'Raccoon', body: '#9aa5b0', belly: '#e6ebef', dark: '#33404b' },
  { id: 'frog', name: 'Frog', body: '#5fc24a', belly: '#d9f6ac', dark: '#256116' },
];

// Draw an animal centred at (cx, cy) with body radius r.
export function drawCharacter(ctx, ch, cx, cy, r) {
  ctx.save();
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ch.dark;

  const paint = (fill, stroke = true) => {
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) ctx.stroke();
  };
  const circle = (x, y, rad, fill, stroke = true) => {
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    paint(fill, stroke);
  };
  const ellipse = (x, y, rx, ry, rot, fill, stroke = true) => {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    paint(fill, stroke);
  };
  const tri = (x1, y1, x2, y2, x3, y3, fill) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    paint(fill);
  };

  // Parts that sit behind the body: ears and tails
  switch (ch.id) {
    case 'squirrel':
      ellipse(cx + r * 0.95, cy - r * 0.2, r * 0.5, r * 0.95, 0.35, ch.body);
      ellipse(cx + r * 1.0, cy - r * 0.35, r * 0.22, r * 0.6, 0.35, ch.belly, false);
      circle(cx - r * 0.62, cy - r * 0.85, r * 0.3, ch.body);
      circle(cx + r * 0.62, cy - r * 0.85, r * 0.3, ch.body);
      break;
    case 'fox':
      ellipse(cx + r * 1.0, cy + r * 0.2, r * 0.65, r * 0.34, -0.5, ch.body);
      ellipse(cx + r * 1.4, cy - r * 0.05, r * 0.26, r * 0.2, -0.5, '#fff');
      tri(cx - r * 0.9, cy - r * 0.3, cx - r * 0.6, cy - r * 1.3, cx - r * 0.05, cy - r * 0.8, ch.body);
      tri(cx + r * 0.9, cy - r * 0.3, cx + r * 0.6, cy - r * 1.3, cx + r * 0.05, cy - r * 0.8, ch.body);
      break;
    case 'bunny':
      ellipse(cx - r * 0.4, cy - r * 1.3, r * 0.28, r * 0.72, -0.15, ch.body);
      ellipse(cx + r * 0.4, cy - r * 1.3, r * 0.28, r * 0.72, 0.15, ch.body);
      ellipse(cx - r * 0.4, cy - r * 1.3, r * 0.13, r * 0.5, -0.15, ch.belly, false);
      ellipse(cx + r * 0.4, cy - r * 1.3, r * 0.13, r * 0.5, 0.15, ch.belly, false);
      break;
    case 'bear':
      circle(cx - r * 0.7, cy - r * 0.78, r * 0.32, ch.body);
      circle(cx + r * 0.7, cy - r * 0.78, r * 0.32, ch.body);
      break;
    case 'raccoon':
      ellipse(cx + r * 1.0, cy + r * 0.3, r * 0.62, r * 0.3, -0.4, ch.body);
      ellipse(cx + r * 1.15, cy + r * 0.22, r * 0.12, r * 0.3, -0.4, ch.dark, false);
      circle(cx - r * 0.7, cy - r * 0.78, r * 0.3, ch.body);
      circle(cx + r * 0.7, cy - r * 0.78, r * 0.3, ch.body);
      break;
    default:
      break;
  }

  // Body and belly
  circle(cx, cy, r, ch.body);
  ellipse(cx, cy + r * 0.38, r * 0.6, r * 0.48, 0, ch.belly, false);

  // Raccoon mask
  if (ch.id === 'raccoon') ellipse(cx, cy - r * 0.12, r * 0.86, r * 0.3, 0, ch.dark, false);

  // Eyes
  const eye = (x, y, rad) => {
    circle(x, y, rad, '#fff', ch.id === 'frog');
    circle(x + rad * 0.15, y + rad * 0.1, rad * 0.5, '#1c1c1c', false);
  };
  if (ch.id === 'frog') {
    eye(cx - r * 0.5, cy - r * 0.78, r * 0.33);
    eye(cx + r * 0.5, cy - r * 0.78, r * 0.33);
  } else {
    eye(cx - r * 0.34, cy - r * 0.1, r * 0.2);
    eye(cx + r * 0.34, cy - r * 0.1, r * 0.2);
  }

  // Nose and mouth
  if (ch.id === 'frog') {
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.15, r * 0.5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else {
    ellipse(cx, cy + r * 0.14, r * 0.13, r * 0.1, 0, ch.id === 'bunny' ? '#ff7a9a' : '#2a2a2a', false);
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.2, r * 0.22, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }

  ctx.restore();
}
