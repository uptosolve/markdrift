// Works around a Firefox (Windows, Media Foundation H.264) bug: the AVC decoder
// config it hands out repeats the first byte of every SPS/PPS NAL unit and leaves
// the reserved bits unset. The MP4 still decodes in ffmpeg, but Chrome and many
// players fail on it. We repair the record before the muxer sees it.

export function fixAvcC(description) {
  const src = description instanceof ArrayBuffer
    ? new Uint8Array(description)
    : new Uint8Array(description.buffer, description.byteOffset, description.byteLength);
  if (src.length < 7 || src[0] !== 1) return description;

  let p = 5;
  const lengthSizeMinusOne = src[4] & 3;
  const readList = (count) => {
    const list = [];
    for (let i = 0; i < count; i++) {
      if (p + 2 > src.length) return null;
      const len = (src[p] << 8) | src[p + 1];
      p += 2;
      if (p + len > src.length) return null;
      list.push(src.subarray(p, p + len));
      p += len;
    }
    return list;
  };
  const sps = readList(src[p++] & 0x1f);
  if (!sps || p >= src.length) return description;
  const pps = readList(src[p++]);
  if (!pps) return description;
  const rest = src.subarray(p);

  let changed = (src[4] & 0xfc) !== 0xfc || (src[5] & 0xe0) !== 0xe0;
  const dedupe = (nal, type) => {
    if (nal.length >= 2 && nal[0] === nal[1] && (nal[0] & 0x1f) === type) {
      changed = true;
      return nal.subarray(1);
    }
    return nal;
  };
  const spsFixed = sps.map((n) => dedupe(n, 7));
  const ppsFixed = pps.map((n) => dedupe(n, 8));
  if (!changed) return description;

  const first = spsFixed[0];
  const size = 6 + spsFixed.reduce((a, n) => a + 2 + n.length, 0) + 1 + ppsFixed.reduce((a, n) => a + 2 + n.length, 0) + rest.length;
  const out = new Uint8Array(size);
  let o = 0;
  out[o++] = 1;
  out[o++] = first ? first[1] : src[1];
  out[o++] = first ? first[2] : src[2];
  out[o++] = first ? first[3] : src[3];
  out[o++] = 0xfc | lengthSizeMinusOne;
  out[o++] = 0xe0 | spsFixed.length;
  for (const n of spsFixed) { out[o++] = n.length >> 8; out[o++] = n.length & 255; out.set(n, o); o += n.length; }
  out[o++] = ppsFixed.length;
  for (const n of ppsFixed) { out[o++] = n.length >> 8; out[o++] = n.length & 255; out.set(n, o); o += n.length; }
  out.set(rest, o);
  return out;
}

// Firefox on Windows has a small pool of hardware H.264 decoders. When they're all taken
// (a preview, a thumbnail, the last export not yet garbage collected), configure() fails with
// "The given encoding is not supported". After that happens once, we ask for software
// decoding, which is slower but always there.
let softwareDecode = false;
export function preferSoftwareDecoding() {
  softwareDecode = true;
}

function installDecoderFix() {
  if (typeof VideoDecoder === 'undefined') return;
  const Native = globalThis.VideoDecoder;
  const soften = (cfg) => (softwareDecode && cfg && !cfg.hardwareAcceleration ? { ...cfg, hardwareAcceleration: 'prefer-software' } : cfg);
  class PatchedVideoDecoder extends Native {
    configure(cfg) {
      return super.configure(soften(cfg));
    }
    static isConfigSupported(cfg) {
      return Native.isConfigSupported(soften(cfg));
    }
  }
  globalThis.VideoDecoder = PatchedVideoDecoder;
}

let installed = false;

export function installEncoderFix() {
  if (installed || typeof VideoEncoder === 'undefined') return;
  installed = true;
  installDecoderFix();
  const Native = globalThis.VideoEncoder;
  class PatchedVideoEncoder extends Native {
    constructor(init) {
      super({
        ...init,
        output: (chunk, meta) => {
          const cfg = meta?.decoderConfig;
          if (cfg?.description && /^avc[13]\./.test(cfg.codec || '')) {
            try {
              meta = { ...meta, decoderConfig: { ...cfg, description: fixAvcC(cfg.description) } };
            } catch { /* leave it as is */ }
          }
          init.output(chunk, meta);
        },
      });
    }
  }
  globalThis.VideoEncoder = PatchedVideoEncoder;
}
