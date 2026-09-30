# Contributing to MarkDrift

Thanks for helping. This file covers how to run things, the few rules that keep the tool working, and what a finished change looks like. It applies to people and to AI assistants alike.

Small, focused pull requests are easiest to review. For anything bigger than a bug fix, open an issue first so we can agree on the approach before you spend time on it.

## Setup

Node 22.12 or newer.

```bash
npm install
npm run dev     # open the URL Vite prints
```

The pages are generated: `scripts/build-pages.mjs` builds `site/` from `content/` and the app markup in `index.html`, and both `npm run dev` and `npm run build` run it first. Edit `index.html`, `src/` or `content/`, never `site/`.

## Tests

```bash
npm test                 # unit tests, no browser needed
npm run make-test-media  # builds test-media/ with ffmpeg (run from Git Bash or WSL on Windows)
npm run e2e              # real exports in Chrome and Firefox, checked with ffprobe and ffmpeg
npm run e2e -- chrome    # one browser only: chrome, edge or firefox
npm run build            # production build into dist/
```

`npm test` runs `tests/motion.test.js` and `tests/encoder-fix.test.js` with Node's built-in test runner.

`npm run e2e` starts the dev server, runs `tests/e2e/suite.js` inside the page, saves every export through the dev-only `/__save` route into `test-media/out/`, and then `tests/e2e/run.mjs` checks each file with `ffprobe` and a full `ffmpeg` decode. It needs:

- Chrome and/or Firefox installed in the default location (the paths are listed at the top of `tests/e2e/run.mjs`)
- `ffmpeg` and `ffprobe` on your PATH
- the test media from `npm run make-test-media` (about 150 MB, most of it one 3-minute clip; git ignores the folder)

CI only runs `npm test` and `npm run build`, because GitHub's runners don't have the browsers, ffmpeg or test media set up for this. So please run `npm run e2e` yourself before opening a pull request that touches export, and say in the PR which browsers you ran it in.

`npm run screenshots` regenerates the screenshots in `docs/`. It uses Chrome at the Windows default path.

## Rules that keep it working

1. **No server.** Everything runs in the browser. No uploads, no API calls that carry user files, and nothing that reads or reports file content. It has to stay deployable as static files.
2. **Free, with no account, credits or watermark of our own.**
3. **Preview and export share `renderWatermark`, and it stays pure.** `renderWatermark(ctx, W, H, t, settings, stamp)` in `src/watermark.js` depends only on its arguments. The preview calls it with `video.currentTime`; the exporter in `src/video.js` calls it with each frame's timestamp. That is the only reason the preview matches the file. So inside it and in `src/motion.js`:
   - no `Math.random()`, `Date.now()` or `performance.now()`. Randomness comes from `hash01` and the smooth noise in `src/motion.js`, seeded by `settings.seed` and `t`
   - no state carried from one frame to the next. Frame 5000 must come out the same whether or not frames 1 to 4999 were drawn first, because the preview seeks
   - no DOM access in `src/motion.js`
4. **Sizes are relative.** Measure everything against `unit = Math.min(W, H)` so a mark looks the same at 720p and 4K, vertical or landscape.
5. **Vanilla JS and Vite, few dependencies.** Right now the runtime dependencies are `mediabunny` and `fflate`. Adding one needs a good reason in the PR.
6. **UI copy is plain English.** Short labels, no em dashes, no hype words. Protection claims say "harder to remove", never "impossible" or "AI-proof".
7. **Don't break privacy by accident.** Fonts are self-hosted. Don't add third-party scripts, fonts or trackers.

## Adding a motion style

Say you're adding a style called `orbit`.

1. **Motion math** in `src/motion.js`: export a pure function such as `orbitPos(t, W, H, w, h, margin, speed, seed)` that returns `{ x, y }` (and `alpha` if it fades). `x` and `y` are the top-left corner of a mark of size `w × h`. Keep it inside `margin` of every edge.
2. **Unit tests** in `tests/motion.test.js`: the mark never leaves the frame at a few speeds, the same inputs give the same output, different seeds give different paths, and a mark bigger than the frame doesn't produce `NaN`. The bounce and jump tests are good templates.
3. **Draw it** in `renderWatermark` (`src/watermark.js`): add a `case 'orbit'` to the `switch (s.mode)` and call `drawMover(p.x, p.y, alpha, 0)`. `drawMover` applies the wobble and the fit-to-frame scaling for you.
4. **Settings** in `src/settings.js`: add `'orbit'` to the list of allowed modes in `loadSettings`, or saved settings will fall back to the default. Put any new setting in `DEFAULTS` with a comment giving its range.
5. **UI**: add a radio to the Style group in `index.html` (copy one of the `label.style` blocks, including its small diagram), add the display name to `STYLE_NAME` in `src/main.js`, and add `orbit` to the `data-show` attribute of every control that applies to it (speed, angle, distance from edge and so on).
6. **e2e**: add a row to the `videos` list in `tests/e2e/suite.js` and the matching output name to `SOURCES` in `tests/e2e/run.mjs`, then run `npm run e2e`.
7. **Look at it.** Scrub the preview, export a short clip, and pull a frame out of the result with ffmpeg to compare against the preview at the same time.

## Browser quirks (read before touching `src/encoder-fix.js`)

- **Firefox avcC.** Firefox on Windows encodes H.264 through Media Foundation, and the decoder config it gives back repeats the first byte of every SPS and PPS NAL unit and leaves the reserved bits unset. ffmpeg decodes the file anyway, but Chrome and many players stall. `fixAvcC()` rewrites the record before mediabunny's muxer sees it, by wrapping `VideoEncoder` so the `decoderConfig` in the output metadata is repaired. `tests/encoder-fix.test.js` has the exact bytes from Firefox 153 and a correct record from Chrome that must pass through untouched.
- **Firefox decoder pool.** Firefox on Windows has a small pool of hardware H.264 decoders. When the preview, the thumbnails and a finished export are all holding one, `configure()` fails with "The given encoding is not supported". `preferSoftwareDecoding()` switches every later `VideoDecoder` to `hardwareAcceleration: 'prefer-software'`, which is slower but always available. `isDecoderBusy()` in `src/video.js` recognises the error.
- **Firefox has no AAC encoder**, so audio that needs converting becomes Opus there.
- **Firefox under automation** returns empty responses when fetching `.mov` and `.mkv` test files, so the e2e tests load media through the dev-only `/__media` route. Real users pick files from disk, so this only affects tests.

Both fixes are installed once when `src/video.js` loads. Keep them unless you've confirmed in Firefox on Windows that the problem is gone.

## Definition of done

A change is done when:

- `npm test` passes
- `npm run build` works and no file in `dist/` is over 25 MiB (the per-file limit for Cloudflare static assets)
- for anything that touches export: `npm run e2e` passes in Chrome and Firefox, the exported video was checked with `ffprobe` (duration, frame count, audio present), and you looked at at least one extracted frame
- the page works at 375 px wide without sideways scrolling
- there are no console errors
- new motion math has unit tests, and changes to exports have an e2e step
- the PR description says what you tested and in which browsers

## Commit messages

Short, present tense, saying what changed: "Fix jump fade on the first frame", "Add orbit style". One logical change per commit is ideal but not required.

## Security

Please don't open public issues for security problems. See [SECURITY.md](SECURITY.md).

## License

By contributing you agree that your contributions are licensed under the MIT license in [LICENSE](LICENSE).
