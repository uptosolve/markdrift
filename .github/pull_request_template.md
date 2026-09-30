## What this changes

<!-- One or two sentences. Link the issue if there is one. -->

## How I tested it

<!-- Which commands you ran and in which browsers. For export changes, say what ffprobe showed and whether you looked at a frame. -->

- [ ] `npm test` passes
- [ ] `npm run build` works and no file in `dist/` is over 25 MiB
- [ ] `npm run e2e` passes (needed if this touches export). Browsers: <!-- chrome / firefox / edge -->
- [ ] Checked at 375 px wide, no sideways scrolling
- [ ] No console errors

## Rules

- [ ] `renderWatermark` and `src/motion.js` are still pure (no `Math.random`, no clock, no state between frames)
- [ ] Nothing new sends user files or content anywhere
- [ ] New motion math has unit tests; export changes have an e2e step
