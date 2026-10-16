// Small canvas UI helpers: rounded rects, buttons, outlined text, hit testing.

// Fredoka is loaded from Google Fonts in index.html; the rest is the fallback
export const FONT = "'Fredoka', 'Trebuchet MS', 'Arial Rounded MT Bold', system-ui, sans-serif";

// Mute button: same spot on every screen, below the HUD row at the top right
export const MUTE_RECT = { x: 418, y: 72, w: 50, h: 50 };

export function drawMuteButton(ctx, muted) {
  const b = MUTE_RECT;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 21, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1f5f3f';
  ctx.stroke();

  // Speaker
  ctx.fillStyle = '#1f5f3f';
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 4);
  ctx.lineTo(cx - 5, cy - 4);
  ctx.lineTo(cx + 2, cy - 10);
  ctx.lineTo(cx + 2, cy + 10);
  ctx.lineTo(cx - 5, cy + 4);
  ctx.lineTo(cx - 10, cy + 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#1f5f3f';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  if (muted) {
    ctx.beginPath();
    ctx.moveTo(cx + 6, cy - 5);
    ctx.lineTo(cx + 14, cy + 5);
    ctx.moveTo(cx + 14, cy - 5);
    ctx.lineTo(cx + 6, cy + 5);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(cx + 3, cy, 7, -0.9, 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 3, cy, 12, -0.9, 0.9);
    ctx.stroke();
  }
  ctx.restore();
}

export function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export const inRect = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

export function drawText(ctx, text, x, y, size, color = '#fff', align = 'center') {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

// Chunky outlined text for titles
export function drawTitleText(ctx, text, x, y, size, fill, stroke) {
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.2;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

// Chunky cartoon button with a darker "edge" under it
export function drawButton(ctx, b, label, o = {}) {
  const fill = o.fill || '#3ccf5a';
  const edge = o.edge || '#1e7a34';
  const lift = o.lift ?? 6;
  roundRectPath(ctx, b.x, b.y + lift, b.w, b.h, 18);
  ctx.fillStyle = edge;
  ctx.fill();
  roundRectPath(ctx, b.x, b.y, b.w, b.h, 18);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = edge;
  ctx.stroke();
  drawText(ctx, label, b.x + b.w / 2, b.y + b.h / 2 + 1, o.size || 30, o.color || '#fff');
}
