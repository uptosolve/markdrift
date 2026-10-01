import { loadSettings, saveSettings, randomSeed } from './settings.js';
import { renderWatermark, StampCache } from './watermark.js';
// the video engine is big, only fetch it once someone actually drops a video
const videoEngine = () => import('./video.js');
const videoSupported = () => typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined';
import { loadImage, exportImages, outputName } from './image.js';
import { icon } from './icons.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const el = {
  drop: $('#drop'), fileInput: $('#fileInput'), dropTitle: $('#dropTitle'), dropHint: $('#dropHint'),
  preview: $('#preview'), fileName: $('#fileName'), fileMeta: $('#fileMeta'), replaceBtn: $('#replaceBtn'),
  frame: $('#frame'), video: $('#video'), base: $('#base'), overlay: $('#overlay'),
  player: $('#player'), playBtn: $('#playBtn'), playIcon: $('#playIcon'), scrub: $('#scrub'), time: $('#time'),
  thumbs: $('#thumbs'), stageNote: $('#stageNote'),
  queueWrap: $('#queueWrap'), queue: $('#queue'), queueSummary: $('#queueSummary'), addVideosBtn: $('#addVideosBtn'),
  logoInput: $('#logoInput'), logoThumb: $('#logoThumb'), logoLabel: $('#logoLabel'),
  seedView: $('#seedView'), seedBtn: $('#seedBtn'),
  qualityField: $('#qualityField'), exportBtn: $('#exportBtn'),
  progress: $('#progress'), bar: $('#bar'), progressText: $('#progressText'), cancelBtn: $('#cancelBtn'),
  result: $('#result'), toast: $('#toast'),
  demo: $('#demo'), caption: $('#caption'), cartList: $('#cartList'), browserNote: $('#browserNote'),
  sumFiles: $('#sumFiles'), sumStyle: $('#sumStyle'), sumWhere: $('#sumWhere'),
  textInput: document.querySelector('[data-key="text"]'), colorInput: document.querySelector('[data-key="color"]'),
};

// Each tool page can start in its own setup, set on <body> by scripts/build-pages.mjs
// (data-preset-tab, -mode, -kind, -position). It overrides the saved tab, mode, kind and
// position for this page load only. Text, colour, size and the rest stay as saved.
const PRESET = (() => {
  const d = document.body.dataset;
  const p = {};
  if (['video', 'image'].includes(d.presetTab)) p.tab = d.presetTab;
  if (['fixed', 'bounce', 'jump', 'tile', 'combo'].includes(d.presetMode)) p.mode = d.presetMode;
  if (['text', 'image'].includes(d.presetKind)) p.kind = d.presetKind;
  if (/^[tmb][lcr]$/.test(d.presetPosition || '')) p.position = d.presetPosition;
  return p;
})();
function withPreset(s) {
  const { tab, ...rest } = PRESET;
  return { ...s, ...rest };
}

const state = {
  tab: 'video',
  settings: withPreset(loadSettings()),
  logo: null,
  video: null,        // the video on screen: { file, info, url, playable, still }
  videos: [],         // the batch: [{ id, file, info, thumb, status, progress, error, outName }]
  vcurrent: 0,
  images: [],         // [{ file, w, h, url }] url is a small thumbnail
  current: 0,
  exporting: false,
  cancel: null,
  clock: { t: 0, playing: false, last: 0 },   // used when <video> cannot play the file
  dirty: true,
  lastUrl: null,
};

const previewStamps = new StampCache();
const canEncode = videoSupported();

/* ---------- settings <-> inputs ---------- */

function readInput(input) {
  if (input.type === 'checkbox') return input.checked;
  if (input.type === 'range' || input.type === 'number') return Number(input.value);
  return input.value;
}

function syncInputs() {
  const s = state.settings;
  for (const input of $$('[data-key]')) {
    const v = s[input.dataset.key];
    if (input.type === 'radio') input.checked = input.value === String(v);
    else if (input.type === 'checkbox') input.checked = !!v;
    else input.value = v;
  }
  syncOutputs();
  syncVisibility();
}

const SIZE_PRESETS = [3.5, 5, 7.5];
const STYLE_NAME = { combo: 'Hardest to remove', bounce: 'Moving', tile: 'Tiled', jump: 'Jumping', fixed: 'Corner' };

// The size buttons, colour dots and summary mirror settings that live elsewhere.
function syncExtras() {
  const s = state.settings;
  for (const r of $$('input[name="sizePreset"]')) r.checked = Math.abs(Number(r.value) - s.size) < 0.01;
  let matched = false;
  for (const r of $$('input[name="swatch"]')) {
    r.checked = r.value.toLowerCase() === String(s.color).toLowerCase();
    matched ||= r.checked;
  }
  el.colorInput.closest('label').classList.toggle('on', !matched);
  renderSummary();
}

function renderSummary() {
  const vids = state.videos.length, imgs = state.images.length;
  const onVideo = state.tab === 'video';
  const n = onVideo ? vids : imgs;
  if (!n) {
    el.sumFiles.textContent = 'No files yet';
  } else if (onVideo) {
    const total = state.videos.reduce((a, v) => a + (v.info.duration || 0), 0);
    el.sumFiles.textContent = `${n} video${n === 1 ? '' : 's'} (${fmtTime(total)})`;
  } else {
    el.sumFiles.textContent = `${n} photo${n === 1 ? '' : 's'}`;
  }
  el.sumStyle.textContent = STYLE_NAME[state.settings.mode] || '';
  let where = 'your Downloads';
  if (onVideo && vids > 1) {
    where = ('testDir' in state ? state.testDir : typeof window.showDirectoryPicker === 'function')
      ? 'a folder you pick'
      : 'your Downloads, one at a time';
  } else if (!onVideo && imgs > 1) {
    where = 'your Downloads as one ZIP';
  }
  el.sumWhere.textContent = where;
}

function syncOutputs() {
  for (const out of $$('output[data-for]')) {
    const v = state.settings[out.dataset.for];
    out.textContent = `${Number.isInteger(v) ? v : Number(v).toFixed(1)}${out.dataset.unit || ''}`;
  }
  el.seedView.textContent = '#' + String(state.settings.seed).slice(-6).padStart(6, '0');
  syncExtras();
}

function syncVisibility() {
  const { mode, kind } = state.settings;
  for (const node of $$('[data-show]')) node.hidden = !node.dataset.show.split(' ').includes(mode);
  for (const node of $$('[data-kind]')) node.hidden = node.dataset.kind !== kind;
  el.qualityField.hidden = state.tab !== 'video';
  el.frame.classList.toggle('placing', mode === 'fixed');
  if (state.tab === 'image' && state.images.length) {
    el.stageNote.hidden = !['bounce', 'jump', 'combo'].includes(mode);
    el.stageNote.textContent = 'On photos, Bounce and Jump just pick one spot from the pattern. Tile covers the whole photo.';
  }
  updateExportButton();
}

function onSettingInput(e) {
  const input = e.target.closest?.('[data-key]');
  if (!input) return;
  if (input.type === 'radio' && !input.checked) return;
  state.settings[input.dataset.key] = readInput(input);
  if (input.dataset.key === 'text' && !state.settings.text.trim()) state.settings.text = '';
  saveSettings(state.settings);
  syncOutputs();
  if (['mode', 'kind'].includes(input.dataset.key)) syncVisibility();
  else updateExportButton();
  if (input.dataset.key === 'text') el.textInput.classList.remove('needs');
  state.dirty = true;
  state.thumbsDirty = true;
}

/* ---------- tabs ---------- */

function setTab(tab) {
  if (state.exporting) return;
  state.tab = tab;
  for (const b of $$('.tab')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  el.fileInput.multiple = true;
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const other = tab === 'video' ? state.images.length : state.videos.length;
  el.dropTitle.textContent = other ? (tab === 'video' ? 'Add videos' : 'Add photos') : 'Choose videos or photos';
  el.dropHint.textContent = touch ? 'One or many. MP4, MOV, JPG, PNG and more.' : 'or drop them anywhere on this page';
  if (tab !== 'video') pauseVideo();
  el.result.hidden = true;
  renderStage();
  syncVisibility();
}

function renderStage() {
  const hasContent = state.tab === 'video' ? state.videos.length > 0 && !!state.video : state.images.length > 0;
  el.drop.hidden = hasContent;
  el.preview.hidden = !hasContent;
  el.cartList.hidden = !(state.videos.length || state.images.length);
  el.replaceBtn.hidden = true;
  el.caption.hidden = hasContent;
  renderSummary();
  if (!hasContent) {
    el.fileName.textContent = 'Preview';
    el.fileMeta.textContent = 'Your mark on a landscape and a vertical frame. Change the settings to see it update.';
    el.stageNote.hidden = true;
    el.queueWrap.hidden = state.tab !== 'video';
    el.thumbs.hidden = state.tab !== 'image';
    if (state.tab === 'video') renderQueue(); else renderThumbs();
    el.queueSummary.textContent = state.tab === 'video' ? 'No videos yet. Add some with the button above.' : 'No photos yet. Add some with the button above.';
    return;
  }

  if (state.tab === 'video') {
    const v = state.video;
    el.player.hidden = false;
    el.thumbs.hidden = true;
    el.queueWrap.hidden = false;
    el.preview.classList.toggle('has-queue', state.videos.length > 1);
    renderQueue();
    el.video.hidden = !v.playable;
    el.base.hidden = v.playable;
    if (!v.playable) paintBase(v.still, v.info.width, v.info.height);
    el.fileName.textContent = v.file.name;
    el.fileMeta.textContent = `${v.info.width}×${v.info.height} ${orientation(v.info)} · ${fmtTime(v.info.duration)} · ${fmtSize(v.file.size)}${v.info.hasAudio ? '' : ' · no audio'}`;
    el.stageNote.hidden = v.playable;
    el.stageNote.textContent = 'Your browser cannot play this format directly, so the preview shows a still frame. The export still works.';
  } else {
    const img = state.images[state.current];
    el.player.hidden = true;
    el.video.hidden = true;
    el.base.hidden = false;
    el.thumbs.hidden = false;
    el.queueWrap.hidden = true;
    el.preview.classList.remove('has-queue');
    paintPhoto(img);
    el.fileName.textContent = state.images.length > 1 ? `${state.images.length} photos` : img.file.name;
    el.fileMeta.textContent = `${img.w}×${img.h} · ${fmtSize(img.file.size)}`;
    renderThumbs();
    syncVisibility();
  }
  state.dirty = true;
}

function paintBase(source, w, h) {
  const k = Math.min(1, 1600 / Math.max(w, h));
  el.base.width = Math.max(1, Math.round(w * k));
  el.base.height = Math.max(1, Math.round(h * k));
  const ctx = el.base.getContext('2d');
  if (source) ctx.drawImage(source, 0, 0, el.base.width, el.base.height);
  else { ctx.fillStyle = '#23231e'; ctx.fillRect(0, 0, el.base.width, el.base.height); }
}

// Photos are decoded only while they're on screen, so a big batch doesn't fill memory.
let paintSeq = 0;
async function paintPhoto(img) {
  const seq = ++paintSeq;
  paintBase(null, img.w, img.h);
  let bmp;
  try { bmp = await loadImage(img.file); } catch { return; }
  if (seq === paintSeq && state.tab === 'image') paintBase(bmp, img.w, img.h);
  bmp.close?.();
  state.dirty = true;
}

// Every thumbnail in the cart carries the mark, so a mixed batch is checked at a glance.
const thumbCanvases = new Map();
const thumbStamps = new StampCache();
function drawThumb(cv, source, cover) {
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.fillStyle = '#23231e';
  ctx.fillRect(0, 0, W, H);
  if (!source) return;
  const k = cover ? Math.max(W / source.width, H / source.height) : Math.min(W / source.width, H / source.height);
  const w = source.width * k, h = source.height * k;
  const x = (W - w) / 2, y = (H - h) / 2;
  ctx.drawImage(source, x, y, w, h);
  const base = previewSettings();
  if (!base) return;
  // at thumbnail size a true-to-scale mark is a couple of pixels; show it big enough to see it's there,
  // measured against the drawn frame so a narrow vertical clip gets a readable mark too
  // canvases are drawn at about 3x their on-screen size; aim for a mark about 7px tall on screen
  const onScreen = cv.getBoundingClientRect().width || cv.width / 3;
  const minPx = 7 * (cv.width / Math.max(1, onScreen));
  const minPct = (minPx / Math.max(1, Math.min(w, h))) * 100;
  const s = { ...base, size: Math.min(34, Math.max(base.size * 2.4, minPct)), opacity: Math.max(base.opacity, 80) };
  ctx.save();
  ctx.beginPath();
  ctx.rect(Math.max(0, x), Math.max(0, y), Math.min(W, w), Math.min(H, h));
  ctx.clip();
  ctx.translate(x, y);
  renderWatermark(ctx, w, h, 1.4, s, thumbStamps.get(s, state.logo, Math.min(w, h)));
  ctx.restore();
}
function refreshThumbs() {
  for (const [item, cv] of thumbCanvases) {
    if (!cv.isConnected) { thumbCanvases.delete(item); continue; }
    drawThumb(cv, item.thumbCanvas, true);
  }
}
// What the previews show: the user's mark, or a sample while they haven't typed one.
function previewSettings() {
  let s = state.settings;
  if (s.kind === 'image' && !state.logo) s = { ...s, kind: 'text', text: 'Your logo' };
  if (s.kind === 'text' && !s.text.trim()) s = { ...s, text: '@yourname' };
  return s;
}

function renderThumbs() {
  const n = state.images.length;
  if (n) el.queueSummary.textContent = `${n} photo${n === 1 ? '' : 's'}. Your settings apply to all of them. Click one to preview it.`;
  el.thumbs.replaceChildren();
  state.images.forEach((img, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', img.file.name);
    b.setAttribute('aria-current', String(i === state.current));
    const cv = document.createElement('canvas');
    cv.width = cv.height = 220;
    thumbCanvases.set(img, cv);
    drawThumb(cv, img.thumbCanvas, true);
    b.append(cv);
    b.onclick = () => { state.current = i; renderStage(); };
    el.thumbs.append(b);
  });
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'add';
  add.innerHTML = icon('plus', 22);
  add.setAttribute('aria-label', 'Add more photos');
  add.onclick = () => { el.fileInput.dataset.append = '1'; el.fileInput.click(); };
  el.thumbs.append(add);
}

/* ---------- loading files ---------- */

const isVideo = (f) => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv|avi|ts)$/i.test(f.name);
const isImage = (f) => f.type.startsWith('image/');

// Every load gets a number. A fresh load (not "add more") makes older ones stale,
// and their results are dropped when they finish late.
let loadSeq = 0;
let activeLoads = 0;

async function handleFiles(list, append = false) {
  const files = Array.from(list || []);
  if (!files.length || state.exporting) return;
  const vids = files.filter(isVideo);
  const imgs = files.filter(isImage);
  if (!vids.length && !imgs.length) return toast('Those files are not videos or photos this tool can open.');
  if (vids.length && imgs.length) {
    // a mixed pick: photos go to the photo list, videos stay in front
    const photoAppend = state.images.length > 0;
    setTab('image');
    await handleFiles(imgs, photoAppend);
    setTab('video');
    return handleFiles(vids, append && state.videos.length > 0);
  }
  if (state.tab === 'video' && !vids.length) { append = append && state.images.length > 0; setTab('image'); }
  else if (state.tab === 'image' && !imgs.length) { append = append && state.videos.length > 0; setTab('video'); }

  const seq = append ? loadSeq : ++loadSeq;
  activeLoads++;
  state.loading = true;
  updateExportButton();
  try {
    if (state.tab === 'video') {
      if (!vids.length) return toast('That does not look like a video file.');
      await loadVideos(vids, append, seq);
    } else {
      if (!imgs.length) return toast('Please choose JPG, PNG or WebP photos.');
      await loadImages(imgs, append, seq);
    }
  } finally {
    activeLoads--;
    if (!activeLoads) {
      state.loading = false;
      updateExportButton();
    }
  }
}

let videoIds = 0;

// Reads size and length, and grabs a small thumbnail from the first frame.
async function describeVideo(file, engine) {
  const info = await engine.probeVideo(file);
  const thumb = '';
  let thumbCanvas = null;
  try {
    const frame = await engine.firstFrame(file);
    if (frame) {
      const k = 240 / Math.max(frame.width, frame.height);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(frame.width * k));
      c.height = Math.max(1, Math.round(frame.height * k));
      c.getContext('2d').drawImage(frame, 0, 0, c.width, c.height);
      thumbCanvas = c;
    }
  } catch (e) { console.warn('thumbnail failed', e); }
  return { id: ++videoIds, file, info, thumb, thumbCanvas, status: 'ready', progress: 0, error: '', outName: '' };
}

async function loadVideos(files, append, seq) {
  pauseVideo();
  const engine = await videoEngine();
  const loaded = [];
  const skipped = [];
  for (const file of files) {
    try {
      loaded.push(await describeVideo(file, engine));
    } catch (err) {
      console.error(err);
      skipped.push(file.name);
    }
    if (seq !== loadSeq) { loaded.forEach(releaseVideo); return; }
  }
  if (skipped.length) {
    toast(skipped.length === 1
      ? `Skipped ${skipped[0]}: could not read it.`
      : `Skipped ${skipped.length} files that could not be read.`);
  }
  if (!loaded.length) return;
  el.result.hidden = true;
  if (!append) {
    state.videos.forEach(releaseVideo);
    state.videos = loaded;
    await selectVideo(0, seq);
  } else {
    const first = state.videos.length;
    state.videos.push(...loaded);
    await selectVideo(first, seq);
  }
}

function releaseVideo(item) {
  if (item.thumb) URL.revokeObjectURL(item.thumb);
}

function removeVideo(id) {
  if (state.exporting) return;
  const i = state.videos.findIndex((v) => v.id === id);
  if (i < 0) return;
  releaseVideo(state.videos[i]);
  state.videos.splice(i, 1);
  if (!state.videos.length) {
    pauseVideo();
    el.video.removeAttribute('src');
    if (state.video?.url) URL.revokeObjectURL(state.video.url);
    state.video = null;
    renderStage();
    updateExportButton();
    return;
  }
  if (i === state.vcurrent) selectVideo(Math.min(i, state.videos.length - 1));
  else {
    if (i < state.vcurrent) state.vcurrent--;
    renderQueue();
    updateExportButton();
  }
}

// Puts one video of the batch in the preview.
let showSeq = 0;
async function selectVideo(index, seq = loadSeq) {
  const item = state.videos[index];
  if (!item) return;
  const mine = ++showSeq;
  state.vcurrent = index;
  pauseVideo();
  const { file, info } = item;
  if (state.video?.url) URL.revokeObjectURL(state.video.url);
  const url = URL.createObjectURL(file);
  state.video = { file, info, url, playable: true, still: null };
  state.clock = { t: 0, playing: false, last: 0 };
  renderStage();

  const ok = await new Promise((resolve) => {
    const done = (v) => { el.video.onloadeddata = el.video.onerror = null; clearTimeout(timer); resolve(v); };
    const timer = setTimeout(() => done(el.video.readyState >= 2 && el.video.videoWidth > 0), 6000);
    el.video.onloadeddata = () => done(el.video.videoWidth > 0);
    el.video.onerror = () => done(false);
    el.video.src = url;
    el.video.load();
  });
  if (mine !== showSeq || seq !== loadSeq || state.video?.file !== file) return;
  state.video.playable = ok;
  if (!ok) {
    el.video.removeAttribute('src');
    try { state.video.still = await (await videoEngine()).firstFrame(file); } catch (e) { console.warn(e); }
    if (mine !== showSeq) return;
  }
  renderStage();
  updateExportButton();
}

function orientation(info) {
  if (info.width > info.height) return 'landscape';
  if (info.height > info.width) return 'vertical';
  return 'square';
}

const STATUS_TEXT = { ready: '', working: '', done: 'Saved', failed: 'Failed', cancelled: 'Cancelled', skipped: 'Not done' };

function renderQueue() {
  const n = state.videos.length;
  const total = state.videos.reduce((a, v) => a + (v.info.duration || 0), 0);
  el.queueSummary.textContent = n
    ? `${n} video${n === 1 ? '' : 's'} · ${fmtTime(total)} in total. Your settings apply to all of them.${state.exporting ? '' : ' Click one to preview it.'}`
    : 'No videos yet. Add some with the button above.';
  el.addVideosBtn.disabled = state.exporting;
  el.queue.replaceChildren(...state.videos.map((v, i) => {
    const li = document.createElement('li');
    li.className = 'qitem';
    li.setAttribute('aria-current', String(i === state.vcurrent));
    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'qpick';
    pick.onclick = () => { if (!state.exporting) selectVideo(i); };
    pick.disabled = state.exporting;
    const th = document.createElement('canvas');
    th.className = 'qthumb';
    th.width = 216;
    th.height = 132;
    thumbCanvases.set(v, th);
    drawThumb(th, v.thumbCanvas, true); // fill the box: a letterboxed vertical clip leaves no room to see the mark
    const tx = document.createElement('span');
    tx.className = 'qtext';
    const b = document.createElement('b');
    b.textContent = v.file.name;
    const sm = document.createElement('small');
    sm.textContent = v.status === 'failed' && v.error
      ? v.error
      : `${v.info.width}×${v.info.height} ${orientation(v.info)} · ${fmtTime(v.info.duration)}`;
    tx.append(b, sm);
    if (v.status === 'working') {
      const bar = document.createElement('span');
      bar.className = 'qbar';
      const fill = document.createElement('i');
      fill.style.width = `${Math.round(v.progress * 100)}%`;
      bar.append(fill);
      tx.append(bar);
    }
    pick.append(th, tx);
    const st = document.createElement('span');
    st.className = `qstatus ${v.status}`;
    if (v.status === 'working') st.textContent = `${Math.floor(v.progress * 100)}%`;
    else if (v.status === 'done') st.innerHTML = icon('check', 16) + 'Saved';
    else st.textContent = STATUS_TEXT[v.status];
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'qremove';
    rm.innerHTML = icon('x', 18);
    rm.disabled = state.exporting;
    rm.setAttribute('aria-label', `Remove ${v.file.name}`);
    rm.onclick = () => removeVideo(v.id);
    li.append(pick, st, rm);
    return li;
  }));
}

// Reads the size and makes a small thumbnail, then lets the full bitmap go.
async function describePhoto(file) {
  const bmp = await loadImage(file);
  const w = bmp.width, h = bmp.height;
  const k = 256 / Math.max(w, h);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return { file, w, h, url: '', thumbCanvas: c };
}

async function loadImages(files, append, seq) {
  const loaded = [];
  for (const file of files) {
    try {
      loaded.push(await describePhoto(file));
    } catch (err) {
      console.error(err);
      toast(`Skipped ${file.name}: could not open it.`);
    }
    if (seq !== loadSeq) { loaded.forEach((i) => URL.revokeObjectURL(i.url)); return; }
  }
  if (!loaded.length) return;
  if (!append) {
    state.images.forEach((i) => URL.revokeObjectURL(i.url));
    state.images = loaded;
    state.current = 0;
  } else {
    state.current = state.images.length;
    state.images.push(...loaded);
  }
  el.result.hidden = true;
  renderStage();
  updateExportButton();
}

// SVGs often have only a viewBox and no size, which browsers handle differently.
// Give them an explicit size and rasterise once so every browser sees the same logo.
async function rasteriseSvg(file) {
  const doc = new DOMParser().parseFromString(await file.text(), 'image/svg+xml');
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg') throw new Error('not an svg');
  const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  let w = parseFloat(svg.getAttribute('width')) || vb[2] || 300;
  let h = parseFloat(svg.getAttribute('height')) || vb[3] || 150;
  const k = 1024 / Math.max(w, h);
  w = Math.round(w * k);
  h = Math.round(h * k);
  if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', `0 0 ${w / k} ${h / k}`);
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const LOGO_KEY = 'markdrift.logo.v1';
async function restoreLogo() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOGO_KEY) || 'null');
    if (!saved?.data) return false;
    const blob = await (await fetch(saved.data)).blob();
    await loadLogo(new File([blob], saved.name || 'logo.png', { type: blob.type }), { remember: false });
    return true;
  } catch { return false; }
}

async function loadLogo(file, { remember = true } = {}) {
  const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
  const bmp = isSvg ? await rasteriseSvg(file) : await createImageBitmap(file);
  if (!bmp.width || !bmp.height) throw new Error('empty logo');
  state.logo?.close?.();
  state.logo = bmp;
  state.settings.logoId = (state.settings.logoId || 0) + 1;
  if (state.logoUrl) URL.revokeObjectURL(state.logoUrl);
  const url = (state.logoUrl = URL.createObjectURL(file));
  el.logoThumb.style.backgroundImage = `url("${url}")`;
  el.logoThumb.innerHTML = '';
  el.logoLabel.textContent = file.name;
  state.dirty = true;
  state.thumbsDirty = true;
  updateExportButton();
  if (remember && file.size < 350_000) {
    const reader = new FileReader();
    reader.onload = () => {
      try { localStorage.setItem(LOGO_KEY, JSON.stringify({ name: file.name, data: reader.result })); } catch { /* storage full or blocked */ }
    };
    reader.readAsDataURL(file);
  }
}

/* ---------- preview loop ---------- */

function previewTime() {
  const v = state.video;
  if (!v) return 0;
  if (v.playable) return el.video.currentTime || 0;
  const c = state.clock;
  if (c.playing) {
    const now = performance.now();
    c.t += (now - c.last) / 1000;
    c.last = now;
    if (c.t > v.info.duration) c.t = 0;
  }
  return c.t;
}

// The empty state: a landscape and a vertical frame side by side, both wearing your mark.
// It shows the one thing that matters for a mixed batch: one setting fits every shape.
const demoStamps = [new StampCache(), new StampCache()];
let labelPx = 12;
function demoFrame(ctx, x, y, w, h, t, s, i, label) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#46463e');
  g.addColorStop(1, '#2f2f29');
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.max(4, w * 0.02));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  ctx.translate(x, y);
  renderWatermark(ctx, w, h, t, s, demoStamps[i].get(s, state.logo, Math.min(w, h)));
  ctx.restore();
  ctx.fillStyle = '#c3c2b8';
  ctx.font = `500 ${labelPx}px "Google Sans Flex", system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillText(label, x, y + h + labelPx * 0.7);
}
let demoRect = null;
let demoLast = 0;
if ('ResizeObserver' in window) new ResizeObserver(() => { demoRect = null; }).observe(el.demo);
function drawDemo() {
  const now = performance.now();
  if (now - demoLast < 33) return;
  demoLast = now;
  const rect = demoRect || (demoRect = el.demo.getBoundingClientRect());
  if (!rect.width) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.round(rect.width * dpr), H = Math.round(rect.height * dpr);
  if (el.demo.width !== W || el.demo.height !== H) { el.demo.width = W; el.demo.height = H; }
  const ctx = el.demo.getContext('2d');
  ctx.fillStyle = '#23231e';
  ctx.fillRect(0, 0, W, H);
  const s = previewSettings();
  const t = reduceMotion.matches ? 2 : performance.now() / 1000;
  // leave the lower part for the button
  const top = H * 0.08, avail = H * 0.56, gap = W * 0.03;
  const vh = avail, vw = vh * 9 / 16;
  let lw = Math.min(W * 0.62, (W * 0.86) - vw - gap), lh = lw * 9 / 16;
  if (lh > avail) { lh = avail; lw = lh * 16 / 9; }
  const total = lw + gap + vw;
  const x0 = (W - total) / 2;
  labelPx = Math.round(Math.min(15, Math.max(11, rect.width * 0.016)) * dpr);
  // both frames sit on one baseline so the labels line up
  demoFrame(ctx, x0, top + (avail - lh), lw, lh, t, s, 0, 'Landscape 16:9');
  demoFrame(ctx, x0 + lw + gap, top, vw, vh, t, s, 1, 'Vertical 9:16');
}
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let demoVisible = true;
if ('IntersectionObserver' in window) {
  new IntersectionObserver((entries) => { demoVisible = entries[0].isIntersecting; }).observe(el.demo);
}

function frameLoop() {
  requestAnimationFrame(frameLoop);
  if (state.thumbsDirty) { state.thumbsDirty = false; refreshThumbs(); }
  if (!el.drop.hidden) { if (demoVisible && !document.hidden) drawDemo(); return; }
  if (el.preview.hidden) return;
  let W, H, t = 0;
  if (state.tab === 'video' && state.video) {
    ({ width: W, height: H } = state.video.info);
    t = previewTime();
    const d = state.video.info.duration || 0;
    el.time.textContent = `${fmtTime(t)} / ${fmtTime(d)}`;
    if (!el.scrub.matches(':active')) el.scrub.value = d ? String(Math.round((t / d) * 1000)) : '0';
    const moving = state.video.playable ? !el.video.paused : state.clock.playing;
    if (!moving && !state.dirty && t === state.lastT) return;
    state.lastT = t;
  } else if (state.tab === 'image' && state.images[state.current]) {
    if (!state.dirty) return;
    ({ w: W, h: H } = state.images[state.current]);
  } else return;

  state.dirty = false;
  const rect = el.frame.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const k = Math.min(1, (Math.max(rect.width, 50) * dpr) / W);
  const ow = Math.max(1, Math.round(W * k));
  const oh = Math.max(1, Math.round(H * k));
  if (el.overlay.width !== ow || el.overlay.height !== oh) { el.overlay.width = ow; el.overlay.height = oh; }
  const ctx = el.overlay.getContext('2d');
  ctx.clearRect(0, 0, ow, oh);
  if (state.settings.kind === 'image' && !state.logo) return;
  const stamp = previewStamps.get(state.settings, state.logo, Math.min(ow, oh));
  renderWatermark(ctx, ow, oh, t, state.settings, stamp);
}

function setPlayIcon(playing) {
  el.playIcon.innerHTML = icon(playing ? 'pause' : 'play', 18);
  el.playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
}

function togglePlay() {
  const v = state.video;
  if (!v || state.tab !== 'video') return;
  if (v.playable) {
    if (el.video.paused) el.video.play().catch(() => {});
    else el.video.pause();
  } else {
    state.clock.playing = !state.clock.playing;
    state.clock.last = performance.now();
    setPlayIcon(state.clock.playing);
  }
}

function pauseVideo() {
  if (!el.video.paused) el.video.pause();
  state.clock.playing = false;
  setPlayIcon(false);
}

/* ---------- export ---------- */

function updateExportButton() {
  const vids = state.videos.length, imgs = state.images.length;
  let ready = true;
  let label;
  if (state.tab === 'video') {
    label = !vids ? 'Choose files to start' : vids === 1 ? 'Add watermark and download' : `Watermark ${vids} videos`;
    if (vids && !canEncode) { ready = false; label = 'This browser can\'t make videos'; }
  } else {
    label = !imgs ? 'Choose files to start' : imgs === 1 ? 'Add watermark and download' : `Watermark ${imgs} photos`;
  }
  const hasFilesHere = state.tab === 'video' ? vids > 0 : imgs > 0;
  if (hasFilesHere && state.settings.kind === 'image' && !state.logo) { ready = false; label = 'Choose a logo first'; }
  if (hasFilesHere && state.settings.kind === 'text' && !state.settings.text.trim()) { label = 'Type your watermark first'; }
  if (state.loading) { ready = false; label = 'Loading your files…'; }
  el.exportBtn.disabled = !ready || state.exporting;
  el.exportBtn.textContent = state.exporting ? 'Working…' : label;
  el.exportBtn.classList.toggle('idle', !hasFilesHere);
  document.getElementById('checkout').classList.toggle('empty', !hasFilesHere && !state.exporting);
  renderSummary();
}

function setBusy(busy) {
  state.exporting = busy;
  document.body.classList.toggle('busy', busy);
  el.progress.hidden = !busy;
  el.replaceBtn.disabled = busy;
  el.playBtn.disabled = busy;
  el.scrub.disabled = busy;
  for (const b of $$('.tab')) b.disabled = busy;
  if (state.videos.length) renderQueue();
  updateExportButton();
}

// Above this size we stream to disk when the browser allows it, instead of holding the result in memory.
const STREAM_OVER = 400 * 1024 * 1024;

async function pickSaveFile(name) {
  if (typeof window.showSaveFilePicker !== 'function') return null;
  const handle = await window.showSaveFilePicker({
    suggestedName: name,
    types: [{ description: 'MP4 video', accept: { 'video/mp4': ['.mp4'] } }],
  });
  return handle.createWritable();
}

async function runExport() {
  if (state.exporting) return;
  el.result.hidden = true;
  const hasFilesHere = state.tab === 'video' ? state.videos.length > 0 : state.images.length > 0;
  if (!hasFilesHere) { el.fileInput.click(); return; }
  if (state.settings.kind === 'text' && !state.settings.text.trim()) {
    el.textInput.classList.add('needs');
    el.textInput.focus();
    el.textInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
    toast('Type the text for your watermark first, like your name or @handle.');
    return;
  }
  const settings = { ...state.settings };
  if (state.tab === 'video' && state.videos.length > 1) return runBatch(settings, state.logo);
  let writable = null;
  // capture what we export now, in case the user loads something else meanwhile
  const videoFile = state.tab === 'video' ? state.videos[0]?.file : null;
  const photos = state.tab === 'image' ? state.images.slice() : null;
  const logo = state.logo;
  if (videoFile && videoFile.size > STREAM_OVER) {
    try {
      writable = await pickSaveFile(outputName(videoFile.name, 'mp4'));
    } catch (err) {
      if (err?.name === 'AbortError') return; // user closed the save dialog
      console.warn('save picker failed, falling back to memory', err);
    }
  }
  setBusy(true);
  setProgress(0, 'Starting');
  const started = performance.now();
  await keepAwake(true);
  try {
    if (videoFile) {
      releasePreview();
      const abort = new AbortController();
      state.cancel = () => { abort.abort(); setProgress(0, 'Cancelling'); };
      el.cancelBtn.hidden = false;
      const { exportVideo, isDecoderBusy, preferSoftwareDecoding } = await videoEngine();
      const once = () => exportVideo(videoFile, settings, logo, {
        writable,
        signal: abort.signal,
        onProgress: (p) => setProgress(p, progressLabel(p, started)),
      });
      const { blob, streamed, ext, audioDropped } = await once().catch(async (err) => {
        if (abort.signal.aborted) return { cancelled: true };
        // a decoder freed a moment ago may still be busy: try once more (not when streaming to a file)
        if (!writable && isDecoderBusy(err)) {
          preferSoftwareDecoding();
          await new Promise((res) => setTimeout(res, 400));
          return once();
        }
        throw err;
      });
      const secs = (performance.now() - started) / 1000;
      if (streamed) {
        return showResult(`Done in ${fmtTime(secs)}. Saved to the file you picked.` +
          (audioDropped ? ' This browser could not carry the audio over, so the file is silent.' : ''), 'ok');
      }
      if (!blob) return showResult(writable ? 'Cancelled. The partly written file can be deleted.' : 'Cancelled. Nothing was saved.', '');
      const name = outputName(videoFile.name, ext);
      download(blob, name);
      showResult(
        `Done in ${fmtTime(secs)}. ${fmtSize(blob.size)} saved as ${name}.` +
        (audioDropped ? ' This browser could not carry the audio over, so the file is silent.' : '') +
        (ext === 'webm' ? ' Saved as WebM because this browser cannot make MP4.' : ''),
        'ok', blob, name,
      );
    } else {
      el.cancelBtn.hidden = true;
      const { blob, name, shrunk } = await exportImages(photos, settings, logo, (p) => setProgress(p, `${Math.round(p * 100)}%`));
      download(blob, name);
      showResult(`Done. ${fmtSize(blob.size)} saved as ${name}.` +
        (shrunk ? ` ${shrunk} photo${shrunk > 1 ? 's were' : ' was'} too big for this browser and got scaled down a little.` : ''),
        'ok', blob, name);
    }
  } catch (err) {
    console.error(err);
    showResult(friendly(err), 'err');
  } finally {
    state.cancel = null;
    keepAwake(false);
    setBusy(false);
    restorePreview();
  }
}

// The preview <video> holds a hardware decoder. Firefox on Windows refuses a second one
// for the same kind of video, so the export fails with "encoding is not supported".
// Let go of the preview while exporting and bring it back afterwards.
let previewReleased = false;
function releasePreview() {
  pauseVideo();
  if (el.video.getAttribute('src')) {
    previewReleased = true;
    const info = state.video?.info;
    if (info && el.video.readyState >= 2) {
      paintBase(el.video, info.width, info.height);
      el.base.hidden = false;
      el.video.hidden = true;
    }
    el.video.removeAttribute('src');
    el.video.load();
    el.stageNote.textContent = 'The preview is paused while your videos are made.';
    el.stageNote.hidden = false;
  }
}
function restorePreview() {
  if (!previewReleased) return;
  previewReleased = false;
  el.stageNote.hidden = true;
  if (state.videos.length) selectVideo(Math.min(state.vcurrent, state.videos.length - 1));
}

// Keeps a phone screen on during a long export, where the browser allows it.
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen');
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { wakeLock = null; }
}

// Turns engine errors into something a person can act on.
function friendly(err) {
  const m = String(err?.message || err || '');
  if (/cannot re-encode|cannot make an MP4|encodable|codec/i.test(m)) return 'This browser can\'t convert this video. Try it in Chrome or Edge on a computer.';
  if (/memory|allocation|out of/i.test(m)) return 'Your device ran out of memory on this file. Try a shorter clip, or use a computer.';
  if (/Could not encode/i.test(m)) return m + ' It may be too large for this browser. Try a smaller photo.';
  if (/NotAllowedError|permission/i.test(m)) return 'The browser did not allow saving to that folder. Try again and allow access, or pick another folder.';
  return 'Something went wrong with this file. ' + (m ? `(${m})` : 'Try again, or try another browser.');
}

/* ---------- batch video export ---------- */

// Chrome and Edge can write straight into a folder the user picks once.
// Elsewhere every finished video is downloaded on its own.
// (state.testDir lets automated tests swap in a fake folder, or null for downloads.)
async function pickFolder() {
  if ('testDir' in state) return state.testDir;
  if (typeof window.showDirectoryPicker !== 'function') return null;
  return window.showDirectoryPicker({ id: 'markdrift-output', mode: 'readwrite', startIn: 'videos' });
}

async function uniqueName(dir, name) {
  for (let k = 1; k < 1000; k++) {
    const n = k === 1 ? name : name.replace(/(\.[^.]+)$/, `-${k}$1`);
    try {
      await dir.getFileHandle(n);
    } catch (err) {
      if (err?.name === 'NotFoundError') return n;
      throw err;
    }
  }
  throw new Error('Too many files with the same name in that folder.');
}

async function runBatch(settings, logo) {
  const items = state.videos.slice();
  let dir = null;
  try {
    dir = await pickFolder();
  } catch (err) {
    if (err?.name === 'AbortError') return; // closed the folder dialog
    console.warn('folder picker failed, downloading instead', err);
  }

  setBusy(true);
  releasePreview();
  await keepAwake(true);
  for (const v of items) { v.status = 'ready'; v.progress = 0; v.error = ''; v.outName = ''; }
  renderQueue();
  const abort = new AbortController();
  state.cancel = () => { abort.abort(); setProgress(el.bar.style.width ? parseFloat(el.bar.style.width) / 100 : 0, 'Cancelling'); };
  el.cancelBtn.hidden = false;

  const { exportVideo, isDecoderBusy, preferSoftwareDecoding } = await videoEngine();
  const totalDur = items.reduce((a, v) => a + (v.info.duration || 1), 0);
  const started = performance.now();
  let doneDur = 0;
  let silent = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (abort.signal.aborted) break;
    item.status = 'working';
    renderQueue();
    let fname = null;
    try {
      let writable = null;
      if (dir) {
        fname = await uniqueName(dir, outputName(item.file.name, 'mp4'));
        writable = await (await dir.getFileHandle(fname, { create: true })).createWritable();
      }
      const run = (w) => exportVideo(item.file, settings, logo, {
        writable: w,
        signal: abort.signal,
        onProgress: (p) => {
          item.progress = p;
          const overall = (doneDur + p * (item.info.duration || 1)) / totalDur;
          setProgress(overall, batchLabel(i, items.length, overall, started));
          renderQueueProgress(item);
        },
      });
      let r;
      try {
        r = await run(writable);
      } catch (err) {
        if (abort.signal.aborted || !isDecoderBusy(err)) throw err;
        preferSoftwareDecoding();
        await new Promise((res) => setTimeout(res, 400));
        if (dir) writable = await (await dir.getFileHandle(fname, { create: true })).createWritable();
        r = await run(writable);
      }
      if (!dir) {
        fname = outputName(item.file.name, r.ext);
        saveBlob(r.blob, fname);
      }
      item.outName = fname;
      item.status = 'done';
      if (r.audioDropped) silent++;
    } catch (err) {
      if (abort.signal.aborted) {
        item.status = 'cancelled';
        if (dir && fname) await dir.removeEntry(fname).catch(() => {});
        break;
      }
      console.error(err);
      item.status = 'failed';
      item.error = friendly(err);
      if (dir && fname) await dir.removeEntry(fname).catch(() => {});
    }
    doneDur += item.info.duration || 1;
    renderQueue();
  }

  for (const v of items) if (v.status === 'ready') v.status = 'skipped';
  state.cancel = null;
  keepAwake(false);
  setBusy(false);
  renderQueue();
  restorePreview();

  const ok = items.filter((v) => v.status === 'done').length;
  const failed = items.filter((v) => v.status === 'failed');
  const secs = (performance.now() - started) / 1000;
  const where = dir ? ` to the folder "${dir.name}"` : '';
  let msg = abort.signal.aborted
    ? `Stopped. ${ok} of ${items.length} videos were saved${where}.`
    : `Done in ${fmtTime(secs)}. ${ok} of ${items.length} videos saved${where}.`;
  if (failed.length) msg += ` ${failed.length} failed: ${failed.map((v) => v.file.name).join(', ')}.`;
  if (silent) msg += ` ${silent} came out without sound because this browser could not carry the audio over.`;
  showResult(msg, failed.length && !ok ? 'err' : 'ok');
}

function batchLabel(i, n, overall, started) {
  const elapsed = (performance.now() - started) / 1000;
  let text = `Video ${i + 1} of ${n} · ${Math.floor(overall * 100)}%`;
  if (overall > 0.03 && elapsed > 2) text += ` · about ${fmtTime((elapsed * (1 - overall)) / overall)} left`;
  return text;
}

// Updates just the working row, so we don't rebuild the list on every frame.
function renderQueueProgress(item) {
  const i = state.videos.indexOf(item);
  const li = el.queue.children[i];
  if (!li) return;
  const pct = Math.floor(item.progress * 100);
  const st = li.querySelector('.qstatus');
  if (st) st.textContent = `${pct}%`;
  const fill = li.querySelector('.qbar i');
  if (fill) fill.style.width = `${pct}%`;
}

// Downloads a finished file without keeping it around afterwards.
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.__markdrift?.onDownload?.(blob, name);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function progressLabel(p, started) {
  const pct = Math.floor(p * 100);
  const elapsed = (performance.now() - started) / 1000;
  if (p < 0.03 || elapsed < 2) return `${pct}%`;
  const left = (elapsed * (1 - p)) / p;
  return `${pct}% · about ${fmtTime(left)} left`;
}

function setProgress(p, text) {
  el.bar.style.width = `${Math.max(0, Math.min(1, p)) * 100}%`;
  el.progressText.textContent = text;
}

function showResult(msg, kind, blob, name) {
  el.result.hidden = false;
  el.result.className = `result ${kind}`;
  el.result.textContent = msg + ' ';
  if (blob) {
    const a = document.createElement('a');
    a.href = state.lastUrl;
    a.download = name;
    a.textContent = 'Download again';
    el.result.append(a);
  }
}

function download(blob, name) {
  if (state.lastUrl) URL.revokeObjectURL(state.lastUrl);
  state.lastUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = state.lastUrl;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.__markdrift?.onDownload?.(blob, name);
}

/* ---------- helpers ---------- */

function fmtTime(s) {
  s = Math.max(0, Math.round(s || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

function fmtSize(b) {
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

let toastTimer;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, 3500);
}

/* ---------- wiring ---------- */

document.addEventListener('input', onSettingInput);
document.addEventListener('change', onSettingInput);
for (const b of $$('.tab')) b.addEventListener('click', () => setTab(b.dataset.tab));

el.fileInput.addEventListener('change', () => {
  const append = el.fileInput.dataset.append === '1';
  delete el.fileInput.dataset.append;
  handleFiles(el.fileInput.files, append);
  el.fileInput.value = '';
});
el.replaceBtn.addEventListener('click', () => el.fileInput.click());
el.addVideosBtn.addEventListener('click', () => { el.fileInput.dataset.append = '1'; el.fileInput.click(); });

// Files can be dropped anywhere on the page. With a list already loaded, a drop adds to it.
let dragDepth = 0;
const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
window.addEventListener('dragenter', (e) => {
  if (!hasFiles(e) || state.exporting) return;
  dragDepth++;
  document.body.classList.add('dragging');
});
window.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) document.body.classList.remove('dragging');
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('dragging');
  if (!e.dataTransfer?.files?.length) return;
  const hasItems = state.tab === 'image' ? state.images.length > 0 : state.videos.length > 0;
  handleFiles(e.dataTransfer.files, hasItems);
});

// Space plays and pauses the preview, unless you're typing or on a control.
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat) return;
  if (e.target.closest?.('input, select, textarea, button, [contenteditable]')) return;
  if (state.tab !== 'video' || el.preview.hidden) return;
  e.preventDefault();
  togglePlay();
});

el.logoInput.addEventListener('change', async () => {
  const f = el.logoInput.files[0];
  el.logoInput.value = '';
  if (!f) return;
  try { await loadLogo(f); } catch { toast('Could not open that logo. Try a PNG.'); }
});

el.seedBtn.addEventListener('click', () => {
  state.settings.seed = randomSeed();
  saveSettings(state.settings);
  syncOutputs();
  state.dirty = true;
});

el.playBtn.addEventListener('click', togglePlay);
el.video.addEventListener('play', () => setPlayIcon(true));
el.video.addEventListener('pause', () => setPlayIcon(false));
el.scrub.addEventListener('input', () => {
  const v = state.video;
  if (!v) return;
  const t = (Number(el.scrub.value) / 1000) * v.info.duration;
  if (v.playable) el.video.currentTime = t;
  else state.clock.t = t;
  state.dirty = true;
});
el.frame.addEventListener('click', (e) => {
  if (state.settings.mode !== 'fixed') return togglePlay();
  const r = el.frame.getBoundingClientRect();
  const col = Math.min(2, Math.floor(((e.clientX - r.left) / r.width) * 3));
  const row = Math.min(2, Math.floor(((e.clientY - r.top) / r.height) * 3));
  const pos = 'tmb'[row] + 'lcr'[col];
  const radio = document.querySelector(`input[name="position"][value="${pos}"]`);
  if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
});

// size buttons and colour dots write straight into the settings
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.name === 'sizePreset') {
    state.settings.size = Number(t.value);
  } else if (t.name === 'swatch') {
    state.settings.color = t.value;
    el.colorInput.value = t.value;
  } else return;
  saveSettings(state.settings);
  syncOutputs();
  state.dirty = true;
  state.thumbsDirty = true;
});

el.exportBtn.addEventListener('click', runExport);
el.cancelBtn.addEventListener('click', () => state.cancel?.());
window.addEventListener('beforeunload', (e) => { if (state.exporting) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('resize', () => { state.dirty = true; });

// A soft fade tells you the settings panel scrolls, and goes away at the end.
const orderBody = document.querySelector('.order-body');
function updateFade() {
  const more = orderBody.scrollHeight - orderBody.clientHeight - orderBody.scrollTop > 4;
  orderBody.classList.toggle('fade', more);
}
orderBody.addEventListener('scroll', updateFade, { passive: true });
window.addEventListener('resize', updateFade);
new ResizeObserver(updateFade).observe(orderBody);

// test hook: lets automated checks load files without a file picker
window.__markdrift = { handleFiles, loadLogo, state };

for (const node of $$('[data-icon]')) node.innerHTML = icon(node.dataset.icon, Number(node.dataset.size) || 18);
el.logoThumb.innerHTML = icon('image', 22);
el.browserNote.hidden = canEncode;
// until the saved logo is back (a logo page keeps Logo selected so you can pick one)
if (state.settings.kind === 'image' && PRESET.kind !== 'image') state.settings.kind = 'text';
syncInputs();
setTab(PRESET.tab || 'video');
requestAnimationFrame(frameLoop);
restoreLogo().then((ok) => {
  if (ok && (PRESET.kind || loadSettings().kind) === 'image') {
    state.settings.kind = 'image';
    syncInputs();
    state.dirty = true;
  }
});

// warm up the video engine in the background so the first drop feels instant
const warmEngine = () => { if (canEncode) videoEngine().catch(() => {}); };
for (const ev of ['pointerenter', 'focusin', 'touchstart']) el.drop.addEventListener(ev, warmEngine, { once: true, passive: true });
document.addEventListener('dragenter', warmEngine, { once: true });
