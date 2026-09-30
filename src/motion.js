// Pure motion math. No DOM here so it can be tested in Node.
// Everything is a function of time `t` (seconds) and the settings seed,
// so the live preview and the exported file always match frame for frame.

// Small, fast, seedable hash -> [0, 1)
export function hash01(...nums) {
  let h = 2166136261 >>> 0;
  for (const n of nums) {
    let x = Math.floor(n) | 0;
    for (let i = 0; i < 4; i++) {
      h ^= x & 0xff;
      h = Math.imul(h, 16777619) >>> 0;
      x >>>= 8;
    }
  }
  // final avalanche
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39) >>> 0;
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

// Triangle wave: 0 -> 1 -> 0 over u in [0, 2)
export function tri(u) {
  const m = ((u % 2) + 2) % 2;
  return m < 1 ? m : 2 - m;
}

// Smooth 1D value noise in [-1, 1], changes about `freq` times per second.
export function smoothNoise(seed, channel, t, freq = 1.5) {
  const x = t * freq;
  const i = Math.floor(x);
  const f = x - i;
  const a = hash01(seed, channel, i) * 2 - 1;
  const b = hash01(seed, channel, i + 1) * 2 - 1;
  const s = f * f * (3 - 2 * f);
  return a + (b - a) * s;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Speed 1..10 -> pixels per second, relative to the short side of the frame.
export function speedToPx(speed, unit) {
  return unit * (0.04 + 0.06 * clamp(speed, 1, 10));
}

// Top-left position of a box (w x h) bouncing inside W x H like the DVD logo.
export function bouncePos(t, W, H, w, h, margin, speed, seed) {
  const unit = Math.min(W, H);
  const v = speedToPx(speed, unit);
  const rx = Math.max(0, W - w - 2 * margin);
  const ry = Math.max(0, H - h - 2 * margin);
  const px = hash01(seed, 11) * 2;
  const py = hash01(seed, 12) * 2;
  const x = margin + (rx > 0 ? tri((t * v) / rx + px) * rx : 0);
  const y = margin + (ry > 0 ? tri((t * v) / ry + py) * ry : 0);
  return { x, y };
}

// Random jump: the mark teleports every `interval` seconds and fades at the edges.
export function jumpPos(t, W, H, w, h, margin, interval, seed) {
  const iv = Math.max(0.5, interval);
  const slot = Math.floor(t / iv);
  const rx = Math.max(0, W - w - 2 * margin);
  const ry = Math.max(0, H - h - 2 * margin);
  const pick = (s) => {
    // try a few candidates, keep the one farthest from the previous slot
    const prev = s > 0 ? basePick(s - 1) : null;
    let best = basePick(s, 0);
    if (!prev) return best;
    let bestD = -1;
    for (let k = 0; k < 4; k++) {
      const c = basePick(s, k);
      const d = Math.hypot(c.x - prev.x, c.y - prev.y);
      if (d > bestD) { bestD = d; best = c; }
    }
    return best;
  };
  const basePick = (s, k = 0) => ({
    x: margin + hash01(seed, 21, s, k) * rx,
    y: margin + hash01(seed, 22, s, k) * ry,
  });
  const pos = pick(slot);
  const local = t - slot * iv;
  const fade = Math.min(0.35, iv * 0.15);
  let alpha = 1;
  if (fade > 0) {
    // no fade-in on the very first slot, so frame one (and photos) always show the mark
    if (local < fade && slot > 0) alpha = local / fade;
    else if (local > iv - fade) alpha = (iv - local) / fade;
  }
  return { x: pos.x, y: pos.y, alpha: clamp(alpha, 0, 1) };
}

// Fixed spot out of a 3x3 grid, e.g. "tl", "mc", "br".
export function fixedPos(W, H, w, h, margin, position) {
  const col = { l: 0, c: 1, r: 2 }[position[1]] ?? 2;
  const row = { t: 0, m: 1, b: 2 }[position[0]] ?? 2;
  const x = [margin, (W - w) / 2, W - w - margin][col];
  const y = [margin, (H - h) / 2, H - h - margin][row];
  return { x, y };
}

// Tile grid centers (in un-rotated tile space) that cover the whole frame
// after rotating by `angleDeg` around the frame center.
export function tileCenters(t, W, H, w, h, gap, angleDeg, drift, speed, seed) {
  const unit = Math.min(W, H);
  const stepX = w + gap * unit * 0.01 + unit * 0.04;
  const stepY = h + gap * unit * 0.01 + unit * 0.06;
  const diag = Math.hypot(W, H);
  const cols = Math.ceil(diag / stepX) + 2;
  const rows = Math.ceil(diag / stepY) + 2;
  let offX = hash01(seed, 31) * stepX;
  let offY = hash01(seed, 32) * stepY;
  if (drift) {
    const v = speedToPx(speed, unit) * 0.35;
    offX += t * v;
    offY += t * v * 0.5;
  }
  offX = ((offX % stepX) + stepX) % stepX;
  offY = ((offY % stepY) + stepY) % stepY;
  const out = [];
  const startX = -diag / 2 - stepX + offX;
  const startY = -diag / 2 - stepY + offY;
  for (let r = 0; r < rows; r++) {
    // brick offset every other row so it does not look like a plain grid
    const shift = r % 2 ? stepX / 2 : 0;
    for (let c = 0; c < cols; c++) {
      out.push({ x: startX + c * stepX + shift, y: startY + r * stepY, i: r * 1000 + c });
    }
  }
  return { centers: out, angle: (angleDeg * Math.PI) / 180 };
}

// Per-stamp wobble that breaks "same mark every frame" assumptions of removers.
export function jitter(t, seed, index, amount) {
  const a = clamp(amount, 0, 100) / 100;
  if (a === 0) return { alpha: 1, scale: 1, rot: 0, dx: 0, dy: 0 };
  const n = (ch, f) => smoothNoise(seed + index * 7919, ch, t, f);
  return {
    alpha: 1 - a * 0.4 * (0.5 + 0.5 * n(1, 1.3)),
    scale: 1 + a * 0.1 * n(2, 0.9),
    rot: a * 0.07 * n(3, 0.7),
    dx: a * 0.012 * n(4, 1.1),
    dy: a * 0.012 * n(5, 1.2),
  };
}
