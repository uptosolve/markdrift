# Product

<!-- impeccable:product-schema 1 -->

> The owner asked not to be interviewed ("no need to ask me anything"). Facts below come from the build conversation, the code and the UptoSolve brand file. Items marked *(inferred)* were not confirmed by the owner.

## Platform

web

## Users

- Social-media creators and small businesses who post short videos and photos (Reels, TikTok, Shorts, Facebook) and keep seeing them reposted by others *(inferred from the owner's own need and the research)*.
- Often non-technical, often on a phone, many in Bangladesh *(inferred)*.
- The job: stamp a name or logo onto one file or a whole batch, in a way that is hard to crop or blur out, and download the results. The owner's own use case is "many videos at once", mixed landscape and vertical, different resolutions.

## Product Purpose

A free, private watermark tool. Paid tools (Recapo, Kapwing) charge credits, add their own watermark, or make you upload. This one runs entirely in the browser: files never leave the device, there's no sign-up, and it adds no watermark of its own. Success means someone can go from an empty page to watermarked downloads in under a minute without reading instructions.

## Positioning

The only free tool that combines: moving watermarks (bounce, jump, tile, tile + bounce), batch processing of many mixed-size videos with one setting, photo batches to ZIP, and fully local processing, open source. Research found no page offering all of these together.

## Operating Context

- Laptop in Chrome or Edge for batches. Phone for one or two clips *(inferred)*.
- Files come straight from a phone camera or an editing app: MP4/MOV, vertical and landscape, often with rotation metadata.
- Chrome/Edge can save a batch into a chosen folder. Other browsers download files one by one.
- Hosting: static files on a Cloudflare Worker at `uptosolve.com/tools/watermark/` (since 1 October 2026; `/tools/` itself lists all UptoSolve tools).

## Capabilities and Constraints

- Video: MP4, MOV, WebM, MKV in. H.264 MP4 out (WebM fallback). Audio kept (AAC; Opus in Firefox).
- Photos: JPG, PNG, WebP. Several photos come back as a ZIP.
- Watermark: text (four font styles, colour, bold, outline) or a logo (can be turned white). Size, opacity, tilt.
- Motion modes: bounce, jump, tile, tile + bounce, fixed (nine positions).
- "Wobble": small smooth changes in size, angle and opacity over time. It makes removal harder. It is NOT proof against AI removers; a March 2026 test showed current removers defeat jitter and tiling. Never claim "AI-proof".
- Pattern seed; quality: same as original / best / smaller file.
- Batch queue: one setting for all, per-file progress, stop, save to a folder or download one by one.
- Everything is client-side (WebCodecs through mediabunny). Speed depends on the device.
- Preview and export share one render function, so the preview matches the export frame for frame.

## Brand Commitments

- Part of the UptoSolve brand ("by UptoSolve"). The tool keeps its own name, MarkDrift *(working name; the owner has not chosen between it and "UptoSolve Watermark")*.
- UptoSolve's visual identity (from the uptosolve.com homepage styles): white page, `#F7F7F5` band, ink `#23231E`, soft text `#52524B` (darkened from `#63635A` on 1 October 2026 for contrast), lines `#E2E1DB`, yellow accent `#FCEC45`, the Google Sans Flex font, corner radii 10 / 18 / 99 px (pill buttons).
- Voice: plain, human, specific. No em dashes, no hype words, no invented facts.

## Evidence on Hand

- A working tool, with e2e tests passing in Chrome and Firefox.
- Test media in `test-media/`.
- Research notes in this conversation (keywords, competitors, SEO).
- No testimonials, user counts, ratings or benchmarks exist. Don't invent any.

## Product Principles

1. The fastest path is the default path: type a name, drop files, download. Everything else is optional.
2. Show, don't explain: the preview is the instruction manual.
3. Honest protection: say "harder to remove", never "impossible to remove".
4. Private by construction: nothing leaves the device. Don't add anything (fonts, analytics, scripts) that quietly breaks that promise.
5. One setting, many files: batch work must stay as simple as working on a single file.

## Accessibility & Inclusion

- Works with keyboard and screen reader (file inputs reachable, labelled controls).
- Respects reduced motion.
- Usable at 375px wide.
- Readable for non-native English speakers: short, plain labels *(inferred)*.
