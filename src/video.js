import {
  Input, Output, Conversion, BlobSource, BufferTarget, StreamTarget, ALL_FORMATS,
  Mp4OutputFormat, WebMOutputFormat, CanvasSink, canEncodeAudio,
  Quality,
} from 'mediabunny';
import { renderWatermark, StampCache } from './watermark.js';
import { installEncoderFix, preferSoftwareDecoding as softDecode } from './encoder-fix.js';

// Firefox on Windows can also run out of hardware encoders. After the first refusal,
// use software for both decoding and encoding: slower, but it always works.
let softwareEncode = false;
export function preferSoftwareDecoding() {
  softDecode();
  softwareEncode = true;
}

installEncoderFix();

// 'original' keeps the file size close to the source by matching its bitrate.
async function videoQuality(track, level) {
  if (level === 'high') return new Quality('high');
  if (level === 'low') return new Quality('low');
  try {
    const stats = await track.computePacketStats(600);
    if (stats.averageBitrate > 0) {
      // a little headroom, the overlay adds detail the encoder has to spend bits on
      const bitrate = Math.round(Math.min(60e6, Math.max(1e6, stats.averageBitrate * 1.1)));
      return new Quality({ bitrate });
    }
  } catch (e) {
    console.warn('bitrate probe failed', e);
  }
  return new Quality('medium');
}

export async function probeVideo(file) {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error('No video track found in this file.');
    const [width, height, duration, audio] = await Promise.all([
      track.getDisplayWidth(), track.getDisplayHeight(), input.computeDuration(), input.getPrimaryAudioTrack(),
    ]);
    return { width, height, duration, hasAudio: !!audio };
  } finally {
    input.dispose?.();
  }
}

// First frame as a canvas, used when the browser <video> tag cannot play the file.
export async function firstFrame(file, time = 0) {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return null;
    const sink = new CanvasSink(track, { poolSize: 0 });
    const start = await track.getFirstTimestamp();
    const wrapped = await sink.getCanvas(start + time);
    return wrapped ? wrapped.canvas : null;
  } finally {
    input.dispose?.();
  }
}

function makeFrameCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

async function buildConversion(file, settings, logo, format, writable) {
  const isMp4 = format instanceof Mp4OutputFormat;
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  const target = writable ? new StreamTarget(writable, { chunked: true }) : new BufferTarget();
  const output = new Output({ format, target });
  const stamps = new StampCache();
  let canvas = null;
  let ctx = null;
  let startTs = null;

  const conversion = await Conversion.init({
    input,
    output,
    tracks: 'primary',
    video: async (track) => ({
      forceTranscode: true,
      ...(softwareEncode ? { hardwareAcceleration: 'prefer-software' } : {}),
      // H.264 is the only codec every phone, gallery and editor plays inside MP4
      ...(isMp4 ? { codec: 'avc' } : {}),
      // bake rotation into pixels so the mark is drawn upright on phone footage
      allowTransformationMetadata: false,
      quality: await videoQuality(track, settings.quality),
      process: (sample) => {
        const W = sample.displayWidth;
        const H = sample.displayHeight;
        if (!canvas || canvas.width !== W || canvas.height !== H) {
          canvas = makeFrameCanvas(W, H);
          ctx = canvas.getContext('2d', { alpha: false });
        }
        if (startTs === null) startTs = sample.timestamp;
        sample.drawWithFit(ctx, { fit: 'fill' });
        const stamp = stamps.get(settings, logo, Math.min(W, H));
        renderWatermark(ctx, W, H, Math.max(0, sample.timestamp - startTs), settings, stamp);
        return canvas;
      },
    }),
    audio: (track) => audioOptions(track, format),
  });
  return { input, output, conversion };
}

// A hardware decoder that was just released can still be busy for a moment.
export function isDecoderBusy(err) {
  return /encoding is not supported|NotSupportedError|decoder/i.test(String(err?.message || err));
}

// With `writable` (a file picked through the File System Access API) the result is
// streamed straight to disk, so even very large videos never sit in memory.
export async function exportVideo(file, settings, logo, { onProgress, writable, signal } = {}) {
  const checkCancel = () => {
    if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
  };
  const mp4 = writable ? new Mp4OutputFormat({ fastStart: false }) : new Mp4OutputFormat({ fastStart: 'in-memory' });
  let built = await buildConversion(file, settings, logo, mp4, writable);
  checkCancel();
  let ext = 'mp4';
  let mime = 'video/mp4';
  if (!built.conversion.isValid || !hasVideo(built.conversion)) {
    built.input.dispose?.();
    if (writable) {
      await writable.abort?.().catch(() => {});
      throw new Error('This browser cannot make an MP4 from this video. Try Chrome or Edge.');
    }
    built = await buildConversion(file, settings, logo, new WebMOutputFormat());
    checkCancel();
    ext = 'webm';
    mime = 'video/webm';
  }
  const { conversion, output, input } = built;
  if (!conversion.isValid || !hasVideo(conversion)) {
    input.dispose?.();
    const reasons = conversion.discardedTracks.map((d) => d.reason).join(', ');
    throw new Error(`This browser cannot re-encode this video (${reasons || 'unknown reason'}). Try Chrome or Edge.`);
  }
  const audioDropped = conversion.discardedTracks.some((d) => d.track.type === 'audio');
  conversion.onProgress = (p) => onProgress?.(p);
  const onAbort = () => conversion.cancel();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    checkCancel();
    await conversion.execute();
  } catch (err) {
    if (writable) await writable.abort?.().catch(() => {});
    throw err;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    input.dispose?.();
  }
  if (writable) return { blob: null, streamed: true, ext, audioDropped };
  const blob = new Blob([output.target.buffer], { type: mime });
  return { blob, ext, audioDropped };
}

function hasVideo(conversion) {
  return conversion.utilizedTracks.some((t) => t.type === 'video');
}

// MP4 players everywhere understand AAC and MP3. Opus or PCM inside MP4 plays in
// browsers but not in many phone galleries or editors, so convert those to AAC.
async function audioOptions(track, format) {
  if (!(format instanceof Mp4OutputFormat)) return {};
  if (track.codec === 'aac' || track.codec === 'mp3') return {};
  const opts = { numberOfChannels: Math.min(2, track.numberOfChannels || 2), sampleRate: track.sampleRate };
  if (await canEncodeAudio('aac', { ...opts, bitrate: 192e3 })) return { codec: 'aac', quality: new Quality('high') };
  // Firefox has no AAC encoder. Opus is the next best thing: small and it plays in browsers and on Android.
  if (track.codec !== 'opus' && await canEncodeAudio('opus', { ...opts, sampleRate: 48000, bitrate: 160e3 })) {
    return { codec: 'opus', quality: new Quality('high') };
  }
  return {};
}
