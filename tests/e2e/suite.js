// Runs inside the page (dev server). Drives the real app through its test hook,
// saves every export to test-media/out/<prefix>-<name> through the dev-only /__save endpoint.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runSuite(prefix) {
  const md = window.__markdrift;
  const $ = (s) => document.querySelector(s);
  const results = [];

  // (media comes through /__media, see vite.config.js)
  const load = async (p, type) => new File([await (await fetch('/__media?name=' + encodeURIComponent(p))).blob()], p, { type });
  const waitIdle = async () => {
    await sleep(200);
    while (md.state.exporting || md.state.loading) await sleep(150);
  };
  const setSetting = (key, value) => {
    const inputs = document.querySelectorAll(`[data-key="${key}"]`);
    for (const input of inputs) {
      if (input.type === 'radio') { if (input.value === String(value)) input.click(); continue; }
      if (input.type === 'checkbox') input.checked = !!value;
      else input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
  const exportAndSave = async (outName) => {
    $('#exportBtn').click();
    const t0 = performance.now();
    await waitIdle();
    const text = $('#result').textContent;
    let size = 0;
    if (text.startsWith('Done') && md.state.lastUrl) {
      const b = await (await fetch(md.state.lastUrl)).blob();
      await fetch('/__save?name=' + encodeURIComponent(`${prefix}-${outName}`), { method: 'POST', body: b });
      size = b.size;
    }
    return { text, size, secs: +((performance.now() - t0) / 1000).toFixed(1) };
  };
  const step = async (name, fn) => {
    try {
      results.push({ name, ok: true, ...(await fn()) });
    } catch (e) {
      results.push({ name, ok: false, error: String(e && e.message || e) });
    }
  };

  $('[data-tab=video]').click();
  setSetting('kind', 'text');
  setSetting('text', '@markdrift_test');
  setSetting('quality', 'original');

  const videos = [
    ['landscape-1080p.mp4', 'video/mp4', 'bounce', 'bounce-1080.mp4'],
    ['landscape-1080p.mp4', 'video/mp4', 'jump', 'jump-1080.mp4'],
    ['phone-rotated.mp4', 'video/mp4', 'tile', 'tile-rotated.mp4'],
    ['clip.webm', 'video/webm', 'combo', 'combo-webm.mp4'],
    ['pcm-audio.mov', 'video/quicktime', 'fixed', 'fixed-pcm.mp4'],
    ['clip.mkv', 'video/x-matroska', 'bounce', 'bounce-mkv.mp4'],
  ];
  for (const [file, type, mode, out] of videos) {
    await step(`video ${mode} ${file}`, async () => {
      setSetting('mode', mode);
      await md.handleFiles([await load(file, type)]);
      await waitIdle();
      const r = await exportAndSave(out);
      return { ...r, out: `${prefix}-${out}`, playable: md.state.video.playable };
    });
  }

  await step('logo svg on video', async () => {
    await md.loadLogo(await load('logo.svg', 'image/svg+xml'));
    setSetting('kind', 'image');
    setSetting('mode', 'bounce');
    await md.handleFiles([await load('clip.webm', 'video/webm')]);
    await waitIdle();
    const r = await exportAndSave('logo.mp4');
    setSetting('kind', 'text');
    return { ...r, out: `${prefix}-logo.mp4` };
  });

  await step('cancel mid export', async () => {
    await md.handleFiles([await load('landscape-1080p.mp4', 'video/mp4')]);
    await waitIdle();
    $('#exportBtn').click();
    await sleep(400);
    $('#cancelBtn').click();
    await waitIdle();
    const text = $('#result').textContent;
    if (!text.startsWith('Cancelled')) throw new Error('expected cancel, got: ' + text);
    return { text };
  });

  await step('empty text asks for text instead of exporting', async () => {
    setSetting('text', '   ');
    const label = $('#exportBtn').textContent;
    $('#exportBtn').click();
    await sleep(300);
    const input = document.querySelector('[data-key="text"]');
    const ok = /Type your/.test(label) && !md.state.exporting && $('#result').hidden && input.classList.contains('needs') && document.activeElement === input;
    setSetting('text', '@markdrift_test');
    if (!ok) throw new Error('label=' + label + ' needs=' + input.classList.contains('needs'));
    return { text: 'asks for text, no export' };
  });

  await step('stale load is ignored', async () => {
    // start a slow load, then a fast one; the fast (newer) one must win
    const a = md.handleFiles([await load('long-3min.mp4', 'video/mp4')]).catch(() => {});
    const b = md.handleFiles([await load('clip.webm', 'video/webm')]);
    await Promise.all([a, b]);
    await waitIdle();
    const name = md.state.video.file.name;
    if (name !== 'clip.webm') throw new Error('older load won: ' + name);
    return { text: 'newest file kept' };
  });

  await step('space plays and pauses', async () => {
    await md.handleFiles([await load('clip.webm', 'video/webm')]);
    await waitIdle();
    const v = $('#video');
    document.activeElement?.blur?.();
    const press = () => document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
    press();
    await sleep(400);
    const played = !v.paused;
    press();
    await sleep(100);
    if (!played || !v.paused) throw new Error(`played=${played} pausedAfter=${v.paused}`);
    return { text: 'toggles' };
  });

  await step('dragging files shows the drop target', async () => {
    const dt = new DataTransfer();
    dt.items.add(new File(['x'], 'x.mp4', { type: 'video/mp4' }));
    window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true }));
    const shown = document.body.classList.contains('dragging') && getComputedStyle($('#dropveil')).display !== 'none';
    window.dispatchEvent(new DragEvent('dragleave', { dataTransfer: dt, bubbles: true }));
    const hidden = !document.body.classList.contains('dragging');
    if (!shown || !hidden) throw new Error(`shown=${shown} hiddenAfter=${hidden}`);
    return { text: 'shows and hides' };
  });

  /* ----- batch of mixed videos ----- */

  // Stands in for a folder from showDirectoryPicker. Files are assembled from the
  // positioned chunks the exporter writes, just like the real file system does.
  const fakeDir = (name) => {
    const files = new Map();
    return {
      name,
      files,
      async getFileHandle(n, opts = {}) {
        if (!files.has(n)) {
          if (!opts.create) throw new DOMException('not found', 'NotFoundError');
          files.set(n, null);
        }
        return {
          async createWritable() {
            const parts = [];
            let size = 0;
            return new WritableStream({
              write(c) { parts.push([c.position, c.data.slice()]); size = Math.max(size, c.position + c.data.byteLength); },
              close() { const buf = new Uint8Array(size); for (const [p, d] of parts) buf.set(d, p); files.set(n, buf); },
              abort() { files.delete(n); },
            });
          },
        };
      },
      async removeEntry(n) { files.delete(n); },
    };
  };
  const saveAs = (name, data) => fetch('/__save?name=' + encodeURIComponent(name), { method: 'POST', body: data });
  const mixed = async () => [
    await load('landscape-1080p.mp4', 'video/mp4'),
    await load('phone-rotated.mp4', 'video/mp4'),
    await load('clip.webm', 'video/webm'),
    await load('pcm-audio.mov', 'video/quicktime'),
  ];

  setSetting('kind', 'text');
  setSetting('mode', 'combo');

  await step('batch: 4 mixed videos into a folder', async () => {
    const dir = fakeDir('Watermarked');
    md.state.testDir = dir;
    await md.handleFiles(await mixed());
    await waitIdle();
    if (md.state.videos.length !== 4) throw new Error('queue has ' + md.state.videos.length);
    if (!/Watermark 4 videos/.test($('#exportBtn').textContent)) throw new Error('button: ' + $('#exportBtn').textContent);
    $('#exportBtn').click();
    await waitIdle();
    const statuses = md.state.videos.map((v) => v.status).join(',');
    if (statuses !== 'done,done,done,done') throw new Error('statuses ' + statuses + ' / ' + $('#result').textContent);
    const outs = [];
    for (const [n, data] of dir.files) {
      await saveAs(`${prefix}-dir-${n}`, data);
      outs.push({ out: `${prefix}-dir-${n}`, src: md.state.videos.find((v) => v.outName === n).file.name });
    }
    if (outs.length !== 4) throw new Error('folder has ' + outs.length + ' files');
    return { text: $('#result').textContent, outs };
  });

  await step('batch: same folder again gets new names', async () => {
    const dir = md.state.testDir;
    $('#exportBtn').click();
    await waitIdle();
    const names = [...dir.files.keys()];
    if (names.length !== 8 || !names.some((n) => /-watermarked-2\.mp4$/.test(n))) throw new Error('names: ' + names.join(', '));
    return { text: `${names.length} files, no overwrite` };
  });

  await step('batch: downloads one by one', async () => {
    md.state.testDir = null;
    const got = [];
    md.onDownload = (blob, name) => got.push({ blob, name });
    await md.handleFiles(await mixed());
    await waitIdle();
    $('#exportBtn').click();
    await waitIdle();
    md.onDownload = null;
    if (got.length !== 4) throw new Error('downloads: ' + got.length);
    const outs = [];
    for (const [i, g] of got.entries()) {
      await saveAs(`${prefix}-dl-${g.name}`, g.blob);
      outs.push({ out: `${prefix}-dl-${g.name}`, src: md.state.videos[i].file.name });
    }
    return { text: $('#result').textContent, outs };
  });

  await step('batch: add more keeps the list', async () => {
    await md.handleFiles([await load('clip.mkv', 'video/x-matroska')], true);
    await waitIdle();
    if (md.state.videos.length !== 5) throw new Error('queue has ' + md.state.videos.length);
    return { text: '5 in queue' };
  });

  await step('batch: stop halfway', async () => {
    const dir = fakeDir('Stop test');
    md.state.testDir = dir;
    $('#exportBtn').click();
    // wait for the second video to start, then stop
    while (md.state.videos[1].status !== 'working') await sleep(50);
    await sleep(150);
    $('#cancelBtn').click();
    await waitIdle();
    const statuses = md.state.videos.map((v) => v.status).join(',');
    if (!statuses.startsWith('done,cancelled') || !/skipped/.test(statuses)) throw new Error('statuses ' + statuses + ' errors: ' + md.state.videos.map((v) => v.error).filter(Boolean).join(' | '));
    if (dir.files.size !== 1) throw new Error('folder should hold only the finished video, has ' + dir.files.size);
    if (!/^Stopped/.test($('#result').textContent)) throw new Error($('#result').textContent);
    return { text: statuses };
  });
  delete md.state.testDir;

  $('[data-tab=image]').click();
  setSetting('mode', 'tile');
  await step('one photo', async () => {
    await md.handleFiles([await load('photo-big.jpg', 'image/jpeg')]);
    await waitIdle();
    const r = await exportAndSave('photo.jpg');
    return { ...r, out: `${prefix}-photo.jpg` };
  });
  await step('photo batch zip', async () => {
    await md.handleFiles([
      await load('photo-big.jpg', 'image/jpeg'),
      await load('photo-portrait.png', 'image/png'),
      await load('photo-big.jpg', 'image/jpeg'),
    ]);
    await waitIdle();
    const r = await exportAndSave('photos.zip');
    return { ...r, out: `${prefix}-photos.zip` };
  });
  $('[data-tab=video]').click();

  return { ua: navigator.userAgent, results };
}
