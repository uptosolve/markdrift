import { zipSync } from 'fflate';
import { renderWatermark, StampCache } from './watermark.js';

export async function loadImage(file) {
  // createImageBitmap respects EXIF orientation in current browsers
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

const EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// iOS Safari refuses canvases above ~16.7 megapixels.
const SAFE_PIXELS = 16_700_000;

function watermarkToCanvas(bitmap, settings, logo, canvas, scale = 1) {
  const W = Math.max(1, Math.round(bitmap.width * scale));
  const H = Math.max(1, Math.round(bitmap.height * scale));
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, W, H);
  const stamp = new StampCache().get(settings, logo, Math.min(W, H));
  renderWatermark(ctx, W, H, 0, settings, stamp);
}

function canvasToBlob(canvas, type) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, 0.92));
}

export function outputName(name, ext, suffix = '-watermarked') {
  const base = name.replace(/\.[^.]+$/, '') || 'image';
  return `${base}${suffix}.${ext}`;
}

async function exportOne(file, settings, logo, canvas) {
  const bitmap = await loadImage(file);
  try {
    const type = EXT[file.type] ? file.type : 'image/png';
    let shrunk = false;
    watermarkToCanvas(bitmap, settings, logo, canvas);
    let blob = await canvasToBlob(canvas, type);
    if (!blob) {
      // too big for this browser's canvas, try again just under the limit
      const scale = Math.sqrt(SAFE_PIXELS / (bitmap.width * bitmap.height)) * 0.98;
      if (scale >= 1) throw new Error(`Could not encode ${file.name}.`);
      watermarkToCanvas(bitmap, settings, logo, canvas, scale);
      blob = await canvasToBlob(canvas, type);
      shrunk = true;
      if (!blob) throw new Error(`Could not encode ${file.name}.`);
    }
    // Safari can't write WebP and quietly gives PNG instead, so trust the blob's type
    const ext = EXT[blob.type] || 'png';
    return { blob, name: outputName(file.name, ext), shrunk };
  } finally {
    bitmap.close?.();
    canvas.width = canvas.height = 1; // release the pixel buffer between photos
  }
}

// Returns { blob, name, shrunk } for one photo, or a zip for many.
// Photos are decoded one at a time so big batches don't run out of memory.
export async function exportImages(items, settings, logo, onProgress) {
  const canvas = document.createElement('canvas');
  if (items.length === 1) {
    const r = await exportOne(items[0].file, settings, logo, canvas);
    onProgress?.(1);
    return { ...r, shrunk: r.shrunk ? 1 : 0 };
  }

  const files = {};
  const used = new Set();
  let shrunk = 0;
  for (let i = 0; i < items.length; i++) {
    const r = await exportOne(items[i].file, settings, logo, canvas);
    if (r.shrunk) shrunk++;
    let n = r.name;
    for (let k = 2; used.has(n); k++) n = r.name.replace(/(\.[^.]+)$/, `-${k}$1`);
    used.add(n);
    // images are already compressed, store them as-is
    files[n] = [new Uint8Array(await r.blob.arrayBuffer()), { level: 0 }];
    onProgress?.((i + 1) / items.length);
  }
  const zip = zipSync(files);
  return { blob: new Blob([zip], { type: 'application/zip' }), name: 'watermarked-images.zip', shrunk };
}
