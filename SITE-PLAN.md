# Launch plan: MarkDrift on uptosolve.com

> **Moved on 1 October 2026.** MarkDrift now lives at `/tools/watermark/` and `/tools/` is a separate hub that lists every UptoSolve tool. Old addresses 301 to the new ones. The main page (`/tools/watermark/`, slug `watermark-video`, `"main": true`) replaced both the old hub and the old video page.

Shared spec for everyone working on the launch. Last updated 2026-10-01.

## Goals

1. **Open source:** public repo at `github.com/uptosolve/markdrift` (MIT).
2. **Live:** `https://uptosolve.com/tools/`, served by a Cloudflare Worker with static assets on the route `uptosolve.com/tools/*`. The WordPress site keeps everything else. Free plan.
3. **Traffic:** rank for the watermark searches in the research below, and get cited by AI assistants. Everything is written from real product behaviour and real, dated checks. Nothing is invented.

## Writing rules (every page, README, post)

- Plain, specific, human. Write like a person who built the thing and tested it.
- No em dashes. None of these words: seamless, empower, unlock, elevate, revolutionize, game-changer, cutting-edge, leverage, robust, delve, "in today's world".
- No invented numbers, users, reviews, ratings or testimonials. Speed claims only from our own measured tests (3 min 1080p in about 19 s on the dev laptop in Chrome; say "on a mid-range laptop" and that it varies).
- Honest protection language: "harder to remove", never "impossible" or "AI-proof".
- Short sentences are fine. Vary rhythm. Avoid three-item lists everywhere, "not just X but Y", and a "so what" closing line on every section.

## URL map

All canonical URLs are absolute: `https://uptosolve.com/tools/watermark/<path>/` (with a trailing slash).

| Path | Type | Target search | Tool preset |
|---|---|---|---|
| `/tools/watermark/` | tool (primary) | add watermark to video online free / no sign up | tab video, mode bounce |
| `/tools/watermark/moving/` | tool | moving watermark maker, moving watermark on video, animated watermark | tab video, mode bounce |
| `/tools/watermark/batch/` | tool | batch / bulk watermark videos, watermark multiple videos at once | tab video, mode bounce |
| `/tools/watermark/photos/` | tool | watermark photos online free, batch watermark photos, tiled watermark | tab image, mode tile |
| `/tools/watermark/logo/` | tool | add logo to video online free without watermark | tab video, kind image, mode fixed, position br |
| `/tools/watermark/guides/stop-reposting-videos/` | guide | how to stop people reposting your reels/tiktoks | none (links to tools) |
| `/tools/watermark/guides/watermark-safe-zones/` | guide | where to put a watermark on reels / tiktok / shorts | none |
| `/tools/watermark/guides/free-video-watermark-tools-compared/` | guide | free video watermark tool without watermark, kapwing vs canva watermark | none |
| `/tools/watermark/404.html` | 404 | | |

Every tool page runs the same app with a different preset and its own content below the tool. They must differ in real substance: each has its own intro, its own how-to for its case, and its own FAQ questions. No near-duplicate pages.

## Content interface (content writer → site builder)

- `content/pages.json`: an array with one object per page:
  `{ "slug": "watermark-video", "path": "/tools/watermark-video/", "type": "tool" | "guide" | "hub", "title": "<= 60 chars", "description": "<= 155 chars", "h1": "...", "lede": "one or two sentences shown under the H1", "preset": { "tab": "video" | "image", "mode": "combo" | "bounce" | "tile" | "jump" | "fixed", "kind": "text" | "image", "position": "br" }, "related": ["slug", ...], "updated": "2026-10-01" }`
- `content/<slug>.html`: the body fragment. For tool pages it goes below the tool; for guides it is the article. Allowed: h2, h3, p, ul, ol, li, table/thead/tbody/tr/th/td, a (site-absolute `/tools/...` or full external URLs), strong, em, code, figure, figcaption, details, summary. No inline style, no script, no h1.
- A FAQ is a normal `<h2>` followed by `<details><summary>` blocks. No FAQPage schema (Google stopped showing it in 2026).

## Technical SEO (site builder)

- The main text of every page is in the static HTML: title, meta description, canonical, `og:*` and `twitter:*`, `lang="en"`, and a unique H1.
- A 1200×630 OG image per page, rendered from HTML by headless Chrome, under `/tools/og/<slug>.png`.
- JSON-LD: `WebApplication` on tool pages (offers price 0, applicationCategory MultimediaApplication, operatingSystem "Any (runs in the browser)", no ratings), `Article` on guides, and `BreadcrumbList` on all pages. `Organization` belongs to the WordPress homepage, not here.
- `sitemap.xml` at `/tools/sitemap.xml` with real pages only, and a `404.html`.
- The hub and every page link to each other with plain `<a href>`: related tools, guides, and a footer with all pages.
- Performance: fonts self-hosted, the video engine lazy loaded, the demo canvas paused off-screen, no layout shift from the tool.

## Deploy (me)

- Vite multi-page build into `dist/tools/…` with `base: '/tools/'`.
- Cloudflare Worker `markdrift`, static assets only, `html_handling: auto-trailing-slash`, `not_found_handling: 404-page`, routes `uptosolve.com/tools/*` and `uptosolve.com/tools`.
- After deploy: IndexNow ping for the sitemap URLs. Search Console and Bing verification need the owner's login.

## Later (owner)

- Link `/tools/` from the WordPress menu or footer. It's the strongest internal link available.
- Add `Sitemap: https://uptosolve.com/tools/sitemap.xml` to the WordPress robots.txt.
- Post the launch drafts from their own accounts (drafts are kept outside this repo).
