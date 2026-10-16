// Small canvas UI helpers: rounded rects, buttons, outlined text, hit testing.

export const FONT = "'Trebuchet MS', 'Arial Rounded MT Bold', system-ui, sans-serif";

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
