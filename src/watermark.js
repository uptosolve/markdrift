import { bouncePos, fixedPos, jumpPos, tileCenters, jitter } from './motion.js';

export const FONTS = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Bengali", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", "Noto Serif", serif',
  mono: 'ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace',
  heavy: 'Impact, "Arial Black", "Segoe UI Black", system-ui, sans-serif',
};

// Builds the watermark "stamp" once per size, then we just blit it every frame.
export class StampCache {
  constructor() {
    this.key = '';
    this.canvas = null;
  }

  get(settings, logo, unit) {
    const px = Math.max(6, Math.round((settings.size / 100) * unit));
    const key = [
      px, settings.kind, settings.text, settings.font, settings.bold, settings.color,
      settings.outline, settings.whiten, logo ? logo.width + 'x' + logo.height : '', settings.logoId,
    ].join('|');
    if (key === this.key && this.canvas) return this.canvas;
    this.key = key;
    this.canvas = settings.kind === 'image' && logo ? buildLogo(logo, px, settings) : buildText(px, settings);
    return this.canvas;
  }
}

function makeCanvas(w, h) {
  w = Math.max(1, Math.ceil(w));
  h = Math.max(1, Math.ceil(h));
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function buildText(px, s) {
  const text = (s.text || '').trim() || ' ';
  const font = `${s.bold ? 700 : 500} ${px}px ${FONTS[s.font] || FONTS.sans}`;
  const probe = makeCanvas(4, 4).getContext('2d');
  probe.font = font;
  const m = probe.measureText(text);
  const pad = Math.ceil(px * 0.25);
  const w = m.width + pad * 2;
  const h = px * 1.3 + pad * 2;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const cx = c.width / 2;
  const cy = c.height / 2;
  if (s.outline) {
    // dark halo keeps light text readable on bright footage and vice versa
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.5, px * 0.09);
    ctx.strokeStyle = isLight(s.color) ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.6)';
    ctx.strokeText(text, cx, cy);
  }
  ctx.fillStyle = s.color;
  ctx.fillText(text, cx, cy);
  return c;
}

function buildLogo(logo, px, s) {
  const h = px * 1.6;
  const w = (logo.width / logo.height) * h;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(logo, 0, 0, c.width, c.height);
  if (s.whiten) {
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
  }
  return c;
}

function isLight(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return true;
  const n = parseInt(m[1], 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

function drawStamp(ctx, stamp, cx, cy, rot, scale, alpha) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.translate(cx, cy);
  if (rot) ctx.rotate(rot);
  const w = stamp.width * scale;
  const h = stamp.height * scale;
  ctx.drawImage(stamp, -w / 2, -h / 2, w, h);
  ctx.restore();
}

// Draws the watermark for time t onto ctx (already holding the frame).
export function renderWatermark(ctx, W, H, t, s, stamp) {
  const unit = Math.min(W, H);
  const baseAlpha = s.opacity / 100;
  const baseRot = (s.rotation * Math.PI) / 180;
  const margin = (s.margin / 100) * unit;
  const sw = stamp.width;
  const sh = stamp.height;
  // a single mark must fit inside the frame, or it gets cut off and stops moving
  const fit = Math.min(1, Math.max(1, W - 2 * margin) / (sw * 1.12), Math.max(1, H - 2 * margin) / (sh * 1.12));
  const mw = sw * fit;
  const mh = sh * fit;

  const drawMover = (x, y, alphaMul, index) => {
    const j = jitter(t, s.seed, index, s.jitter);
    drawStamp(
      ctx, stamp,
      x + mw / 2 + j.dx * unit, y + mh / 2 + j.dy * unit,
      baseRot + j.rot, j.scale * fit, baseAlpha * alphaMul * j.alpha,
    );
  };

  const drawTiles = (alphaMul) => {
    const { centers, angle } = tileCenters(t, W, H, sw, sh, s.tileGap, s.tileAngle, s.tileDrift, s.speed, s.seed);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(angle);
    const half = Math.hypot(W, H) / 2 + Math.max(sw, sh);
    for (const c of centers) {
      if (Math.abs(c.x) > half || Math.abs(c.y) > half) continue;
      const j = jitter(t, s.seed, c.i + 1, s.jitter);
      drawStamp(ctx, stamp, c.x + j.dx * unit, c.y + j.dy * unit, j.rot, j.scale, baseAlpha * alphaMul * j.alpha);
    }
    ctx.restore();
  };

  switch (s.mode) {
    case 'fixed': {
      const p = fixedPos(W, H, mw, mh, margin, s.position);
      drawMover(p.x, p.y, 1, 0);
      break;
    }
    case 'bounce': {
      const p = bouncePos(t, W, H, mw, mh, margin, s.speed, s.seed);
      drawMover(p.x, p.y, 1, 0);
      break;
    }
    case 'jump': {
      const p = jumpPos(t, W, H, mw, mh, margin, s.interval, s.seed);
      drawMover(p.x, p.y, p.alpha, 0);
      break;
    }
    case 'tile':
      drawTiles(1);
      break;
    case 'combo': {
      drawTiles(s.tileOpacity / 100);
      const p = bouncePos(t, W, H, mw, mh, margin, s.speed, s.seed);
      drawMover(p.x, p.y, 1, 0);
      break;
    }
  }
}
