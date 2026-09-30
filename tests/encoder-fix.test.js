import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixAvcC } from '../src/encoder-fix.js';

const hex = (s) => Uint8Array.from(s.match(/../g).map((b) => parseInt(b, 16)));
const toHex = (u) => Buffer.from(u).toString('hex');

// avcC produced by Firefox 153 on Windows (Media Foundation encoder)
const firefox = '016400280301001b6767640028ac2cac0780227e5840000003004000000f036822114e0100056868ce3c30';
// avcC produced by Chrome for the same kind of video
const chrome = '01640028ffe1001967640028ac2b403c0113f2e022000007d00001d4c01e38554001000468ee3cb0fdf8f800';

test('repairs the doubled NAL header bytes from Firefox', () => {
  const fixed = toHex(fixAvcC(hex(firefox)));
  assert.equal(fixed, '01640028ffe1001a67640028ac2cac0780227e5840000003004000000f036822114e01000468ce3c30');
});

test('leaves a correct record untouched', () => {
  const input = hex(chrome);
  assert.equal(fixAvcC(input), input);
});

test('ignores garbage', () => {
  const junk = hex('00010203');
  assert.equal(fixAvcC(junk), junk);
});
