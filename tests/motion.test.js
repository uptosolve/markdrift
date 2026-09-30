import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bouncePos, jumpPos, fixedPos, tileCenters, jitter, tri, hash01 } from '../src/motion.js';

const W = 1920, H = 1080, w = 300, h = 80, m = 20;

test('hash01 is deterministic and in range', () => {
  for (let i = 0; i < 1000; i++) {
    const a = hash01(42, i), b = hash01(42, i);
    assert.equal(a, b);
    assert.ok(a >= 0 && a < 1);
  }
  assert.notEqual(hash01(1, 5), hash01(2, 5));
});

test('tri wave stays in [0,1]', () => {
  for (let u = -5; u < 5; u += 0.013) {
    const v = tri(u);
    assert.ok(v >= 0 && v <= 1, `tri(${u})=${v}`);
  }
});

test('bounce never leaves the frame', () => {
  for (const speed of [1, 5, 10]) {
    for (let t = 0; t < 120; t += 0.033) {
      const p = bouncePos(t, W, H, w, h, m, speed, 7);
      assert.ok(p.x >= m - 1e-6 && p.x + w <= W - m + 1e-6, `x ${p.x}`);
      assert.ok(p.y >= m - 1e-6 && p.y + h <= H - m + 1e-6, `y ${p.y}`);
    }
  }
});

test('bounce actually moves and seeds differ', () => {
  const a = bouncePos(0, W, H, w, h, m, 4, 1);
  const b = bouncePos(2, W, H, w, h, m, 4, 1);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 50);
  const c = bouncePos(0, W, H, w, h, m, 4, 999);
  assert.ok(Math.hypot(a.x - c.x, a.y - c.y) > 1);
});

test('bounce handles a mark bigger than the frame', () => {
  const p = bouncePos(3, 200, 100, 400, 300, 0, 5, 1);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
});

test('jump stays inside, fades, and visible at t=0', () => {
  assert.equal(jumpPos(0, W, H, w, h, m, 3, 5).alpha, 1);
  let changes = 0, prev = null;
  for (let t = 0; t < 60; t += 0.05) {
    const p = jumpPos(t, W, H, w, h, m, 3, 5);
    assert.ok(p.x >= m - 1e-6 && p.x + w <= W - m + 1e-6);
    assert.ok(p.y >= m - 1e-6 && p.y + h <= H - m + 1e-6);
    assert.ok(p.alpha >= 0 && p.alpha <= 1);
    if (prev && (p.x !== prev.x || p.y !== prev.y)) changes++;
    prev = p;
  }
  assert.ok(changes >= 15 && changes <= 25, `changes ${changes}`);
});

test('fixed corners', () => {
  assert.deepEqual(fixedPos(W, H, w, h, m, 'tl'), { x: m, y: m });
  assert.deepEqual(fixedPos(W, H, w, h, m, 'br'), { x: W - w - m, y: H - h - m });
});

test('tiles cover every corner of the frame', () => {
  for (const angle of [-60, -30, 0, 45]) {
    const { centers, angle: a } = tileCenters(1.5, W, H, w, h, 12, angle, true, 4, 3);
    // rotate each center into frame space
    const pts = centers.map((c) => ({
      x: W / 2 + c.x * Math.cos(a) - c.y * Math.sin(a),
      y: H / 2 + c.x * Math.sin(a) + c.y * Math.cos(a),
    }));
    for (const [cx, cy] of [[0, 0], [W, 0], [0, H], [W, H], [W / 2, H / 2]]) {
      const near = pts.some((p) => Math.hypot(p.x - cx, p.y - cy) < w * 1.2);
      assert.ok(near, `corner ${cx},${cy} uncovered at angle ${angle}`);
    }
  }
});

test('jitter is bounded, off at 0, and smooth', () => {
  assert.deepEqual(jitter(1, 1, 0, 0), { alpha: 1, scale: 1, rot: 0, dx: 0, dy: 0 });
  let prev = jitter(0, 9, 0, 100);
  for (let t = 0; t < 30; t += 1 / 30) {
    const j = jitter(t, 9, 0, 100);
    assert.ok(j.alpha >= 0.59 && j.alpha <= 1);
    assert.ok(j.scale >= 0.89 && j.scale <= 1.11);
    assert.ok(Math.abs(j.scale - prev.scale) < 0.02, 'scale should change smoothly');
    prev = j;
  }
});
