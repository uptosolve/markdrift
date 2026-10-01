// Generates the static site from content/ into site/, which Vite then serves and builds.
//
//   node scripts/build-pages.mjs
//
// Reads content/pages.json (one object per page, see SITE-PLAN.md) and content/<slug>.html
// (the body fragment). Tool pages reuse the app markup from index.html: the header, the stage,
// the cart, the order panel and the overlays. Guides and the hub get an article layout with
// the same header and footer. Missing content gets a short, clearly marked placeholder.
// This script only reads content/; it never writes there.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { icon } from '../src/icons.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const SITE = path.join(ROOT, 'site');
const ORIGIN = 'https://uptosolve.com';
const REPO = 'https://github.com/uptosolve/markdrift';

// Short labels for breadcrumbs, the footer and link lists. Anything not listed uses its H1.
const SHORT = {
  'watermark-video': 'Watermark a video',
  'moving-watermark': 'Moving watermark',
  'batch-watermark-videos': 'Batch watermark videos',
  'watermark-photos': 'Watermark photos',
  'add-logo-to-video': 'Add a logo to a video',
  'stop-reposting-videos': 'Stop people reposting your videos',
  'watermark-safe-zones': 'Where to put a watermark',
  'free-video-watermark-tools-compared': 'Free video watermark tools compared',
};

// Used only when content/pages.json does not exist yet. Every field says it is a placeholder.
const FALLBACK = [
  ['tools', '/tools/', 'hub', null, ['watermark-video', 'watermark-photos']],
  ['watermark-video', '/tools/watermark-video/', 'tool', { tab: 'video', mode: 'combo' }, ['batch-watermark-videos', 'moving-watermark']],
  ['moving-watermark', '/tools/moving-watermark/', 'tool', { tab: 'video', mode: 'bounce' }, ['watermark-video']],
  ['batch-watermark-videos', '/tools/batch-watermark-videos/', 'tool', { tab: 'video', mode: 'combo' }, ['watermark-video']],
  ['watermark-photos', '/tools/watermark-photos/', 'tool', { tab: 'image', mode: 'tile' }, ['watermark-video']],
  ['add-logo-to-video', '/tools/add-logo-to-video/', 'tool', { tab: 'video', kind: 'image', mode: 'fixed', position: 'br' }, ['watermark-video']],
  ['stop-reposting-videos', '/tools/guides/stop-reposting-videos/', 'guide', null, ['moving-watermark']],
  ['watermark-safe-zones', '/tools/guides/watermark-safe-zones/', 'guide', null, ['watermark-video']],
  ['free-video-watermark-tools-compared', '/tools/guides/free-video-watermark-tools-compared/', 'guide', null, ['watermark-video']],
].map(([slug, p, type, preset, related]) => ({
  slug, path: p, type, preset, related, updated: new Date().toISOString().slice(0, 10), placeholder: true,
  title: `[Placeholder] ${SHORT[slug] || 'MarkDrift tools'}`,
  description: `[Placeholder] Description for ${p} is not written yet.`,
  h1: SHORT[slug] || 'Free tools by UptoSolve',
  lede: '[Placeholder] The lede for this page is not written yet.',
}));

const TYPES = ['tool', 'guide', 'hub'];
const PRESET_VALUES = {
  tab: ['video', 'image'],
  mode: ['combo', 'bounce', 'tile', 'jump', 'fixed'],
  kind: ['text', 'image'],
  position: ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'],
};

const warnings = [];
const warn = (msg) => warnings.push(msg);

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const abs = (p) => ORIGIN + p;
const ogImage = (p) => `${ORIGIN}/tools/og/${p.slug}.png`;
const label = (p) => SHORT[p.slug] || p.h1;

export function loadPages() {
  const file = path.join(CONTENT, 'pages.json');
  let pages;
  if (fs.existsSync(file)) {
    try {
      pages = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      warn(`content/pages.json is not valid JSON (${e.message}); using placeholders`);
    }
  } else {
    warn('content/pages.json is missing; using placeholder pages');
  }
  if (!Array.isArray(pages) || !pages.length) pages = FALLBACK;

  const seen = new Set();
  pages = pages.filter((p) => {
    if (!p || !p.slug || !p.path || !TYPES.includes(p.type)) { warn(`skipped a page without slug/path/type: ${JSON.stringify(p).slice(0, 80)}`); return false; }
    if (seen.has(p.slug)) { warn(`duplicate slug ${p.slug}, kept the first`); return false; }
    if (!/^\/tools\/([a-z0-9-]+\/)*$/.test(p.path)) { warn(`${p.slug}: path ${p.path} must look like /tools/.../ with a trailing slash`); return false; }
    seen.add(p.slug);
    return true;
  });
  for (const p of pages) {
    for (const k of ['title', 'description', 'h1', 'lede']) {
      if (!p[k]) { warn(`${p.slug}: missing ${k}, used a placeholder`); p[k] = `[Placeholder] ${k} for ${p.path}`; p.placeholder = true; }
    }
    if (p.title.length > 60) warn(`${p.slug}: title is ${p.title.length} chars (max 60)`);
    if (p.description.length > 155) warn(`${p.slug}: description is ${p.description.length} chars (max 155)`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.updated || '')) { warn(`${p.slug}: no valid "updated" date, used today`); p.updated = new Date().toISOString().slice(0, 10); }
    p.related = (p.related || []).filter((s) => {
      if (s !== p.slug && seen.has(s)) return true;
      warn(`${p.slug}: related slug "${s}" is not a page`);
      return false;
    });
    const preset = {};
    if (p.type === 'tool') {
      for (const [k, allowed] of Object.entries(PRESET_VALUES)) {
        const v = p.preset?.[k];
        if (v == null) continue;
        if (allowed.includes(v)) preset[k] = v;
        else warn(`${p.slug}: preset ${k}="${v}" is not one of ${allowed.join(', ')}`);
      }
    }
    p.preset = preset;
  }
  for (const key of ['title', 'description']) {
    const dupes = pages.filter((p, i) => pages.findIndex((q) => q[key] === p[key]) !== i);
    for (const d of dupes) warn(`${d.slug}: ${key} is the same as another page's`);
  }
  if (!pages.some((p) => p.type === 'hub')) warn('no hub page (type "hub") in content/pages.json');
  return pages;
}

// Keeps the fragment inside what SITE-PLAN.md allows. Anything else is removed and reported.
const ALLOWED = new Set(['h2', 'h3', 'p', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'strong', 'em', 'code', 'figure', 'figcaption', 'details', 'summary', 'br', 'caption']);
function cleanFragment(html, slug) {
  let out = html.replace(/<!--[\s\S]*?-->/g, '');
  out = out.replace(/<(script|style|iframe|object)\b[\s\S]*?<\/\1>/gi, () => { warn(`${slug}.html: removed a <script>/<style>/<iframe> block`); return ''; });
  out = out.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (m, close, tag, attrs) => {
    const t = tag.toLowerCase();
    if (t === 'h1') { warn(`${slug}.html: an <h1> was turned into <h2> (each page has one H1)`); return `<${close}h2${close ? '' : cleanAttrs(attrs, 'h2', slug)}>`; }
    if (!ALLOWED.has(t)) { warn(`${slug}.html: removed a <${t}> tag`); return ''; }
    return close ? `</${t}>` : `<${t}${cleanAttrs(attrs, t, slug)}>`;
  });
  return out.trim();
}
function cleanAttrs(attrs, tag, slug) {
  const kept = [];
  for (const [, name, , v1, v2] of attrs.matchAll(/([a-zA-Z-:]+)\s*(=\s*(?:"([^"]*)"|'([^']*)'))?/g)) {
    const n = name.toLowerCase();
    const value = v1 ?? v2 ?? '';
    if (n === 'href' && tag === 'a') {
      if (/^(\/tools\/|https?:\/\/|#|mailto:)/.test(value)) {
        kept.push(`href="${esc(value)}"`);
        if (/^https?:\/\//.test(value) && !value.startsWith(ORIGIN)) kept.push('rel="noopener"');
      } else warn(`${slug}.html: dropped link "${value}" (use /tools/... or a full URL)`);
    } else if (['id', 'colspan', 'rowspan', 'scope', 'open'].includes(n)) {
      kept.push(v1 == null && v2 == null ? n : `${n}="${esc(value)}"`);
    } else if (n === 'style' || n.startsWith('on')) {
      warn(`${slug}.html: removed a ${n} attribute`);
    }
  }
  return kept.length ? ' ' + kept.join(' ') : '';
}

function readFragment(p) {
  const file = path.join(CONTENT, `${p.slug}.html`);
  if (!fs.existsSync(file)) {
    warn(`content/${p.slug}.html is missing; used a placeholder`);
    return `<p class="placeholder">[Placeholder] The text for this page is not written yet.</p>`;
  }
  return cleanFragment(fs.readFileSync(file, 'utf8'), p.slug);
}

/* ---------- pieces taken from the app markup in index.html ---------- */

function appParts() {
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const pick = (re, what) => {
    const m = src.match(re);
    if (!m) throw new Error(`index.html: could not find ${what}`);
    return m[1] ?? m[0];
  };
  return {
    header: withIcons(pick(/<header class="bar">[\s\S]*?<\/header>/, 'the header')),
    tool: withIcons(pick(/<main class="shop">([\s\S]*?)<\/main>/, 'the tool (<main class="shop">)')),
    overlays: withIcons(pick(/<div class="dropveil"[\s\S]*?<div class="toast"[^>]*><\/div>/, 'the drop veil and toast')),
    note: pick(/<footer class="foot">\s*<p>([\s\S]*?)<\/p>/, 'the footer note'),
  };
}

// Icons go into the static HTML (main.js fills the same ones again), so pages without the app
// script still show them and nothing shifts when the script runs.
function withIcons(html) {
  return html.replace(/<span([^>]*?)\sdata-icon="([a-z-]+)"([^>]*)><\/span>/g, (m, a, name, b) => {
    const size = Number((a + b).match(/data-size="(\d+)"/)?.[1]) || 18;
    return `<span${a} data-icon="${name}"${b}>${icon(name, size)}</span>`;
  });
}

function header(parts) {
  return parts.header
    .replace('href="/"', 'href="/tools/"')
    .replace('aria-label="MarkDrift by UptoSolve, home"', 'aria-label="MarkDrift by UptoSolve, all tools"');
}

/* ---------- shared blocks ---------- */

function crumbs(p) {
  const trail = [{ name: 'UptoSolve', url: ORIGIN + '/' }];
  if (p.type !== 'hub') trail.push({ name: 'Tools', url: abs('/tools/') });
  trail.push({ name: p.type === 'hub' ? 'Tools' : label(p), url: abs(p.path) });
  return trail;
}

function crumbsHtml(p) {
  const items = crumbs(p).map((c, i, all) => i === all.length - 1
    ? `<li aria-current="page">${esc(c.name)}</li>`
    : `<li><a href="${c.url.startsWith(ORIGIN + '/tools/') ? c.url.slice(ORIGIN.length) : c.url}">${esc(c.name)}</a></li>`);
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.join('')}</ol></nav>`;
}

const APP_ID = ORIGIN + '/tools/#markdrift';
const ORG = { '@type': 'Organization', '@id': ORIGIN + '/#organization', name: 'UptoSolve', url: ORIGIN + '/', logo: ORIGIN + '/tools/og/tools.png' };
const CANON = "MarkDrift is a free, open-source (MIT) watermark tool by UptoSolve that adds moving, tiled or corner watermarks to videos and photos, one file or a whole batch, entirely in your browser with nothing uploaded.";

function jsonLd(p, pages) {
  const graph = [];
  const url = abs(p.path);
  if (p.type === 'hub') {
    graph.push({
      '@type': 'WebApplication',
      '@id': APP_ID,
      name: 'MarkDrift',
      alternateName: 'MarkDrift by UptoSolve',
      url,
      description: CANON,
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Any (runs in the browser)',
      browserRequirements: 'Requires JavaScript. Video export needs a browser with WebCodecs.',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      license: 'https://opensource.org/licenses/MIT',
      sameAs: ['https://github.com/uptosolve/markdrift'],
      image: ogImage(p),
      inLanguage: 'en',
      publisher: ORG,
    });
    graph.push({
      '@type': 'CollectionPage',
      '@id': url + '#page',
      url,
      name: p.title,
      about: { '@id': APP_ID },
      hasPart: pages.filter((x) => x.type !== 'hub').map((x) => ({ '@type': 'WebPage', name: x.h1, url: abs(x.path) })),
    });
  } else if (p.type === 'tool') {
    graph.push({
      '@type': 'WebApplication',
      '@id': url + '#app',
      name: 'MarkDrift',
      alternateName: p.h1,
      isPartOf: { '@id': APP_ID },
      url,
      description: p.description,
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Any (runs in the browser)',
      browserRequirements: 'Requires JavaScript. Video export needs a browser with WebCodecs.',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      image: ogImage(p),
      inLanguage: 'en',
      license: 'https://opensource.org/licenses/MIT',
      sameAs: ['https://github.com/uptosolve/markdrift'],
      publisher: ORG,
    });
  } else if (p.type === 'guide') {
    graph.push({
      '@type': 'Article',
      '@id': url + '#article',
      headline: p.h1,
      description: p.description,
      url,
      mainEntityOfPage: url,
      image: ogImage(p),
      datePublished: p.published || p.updated,
      dateModified: p.updated,
      inLanguage: 'en',
      author: ORG,
      publisher: ORG,
      about: { '@id': APP_ID },
    });
  }
  graph.push({
    '@type': 'BreadcrumbList',
    '@id': url + '#breadcrumb',
    itemListElement: crumbs(p).map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
  });
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 1).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

function head(p, pages, { noindex = false } = {}) {
  const url = abs(p.path);
  const img = ogImage(p);
  const alt = `${p.h1}. MarkDrift by UptoSolve.`;
  const meta = noindex ? '' : `
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="${p.type === 'guide' ? 'article' : 'website'}" />
  <meta property="og:site_name" content="UptoSolve" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:title" content="${esc(p.title)}" />
  <meta property="og:description" content="${esc(p.description)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${img}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${esc(alt)}" />${p.type === 'guide' ? `
  <meta property="article:modified_time" content="${p.updated}" />` : ''}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(p.title)}" />
  <meta name="twitter:description" content="${esc(p.description)}" />
  <meta name="twitter:image" content="${img}" />
  <meta name="twitter:image:alt" content="${esc(alt)}" />
  ${jsonLd(p, pages)}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(p.title)}</title>
  <meta name="description" content="${esc(p.description)}" />${noindex ? '\n  <meta name="robots" content="noindex" />' : ''}
  <meta name="theme-color" content="#FFFFFF" />
  <meta name="color-scheme" content="light" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="preload" href="/fonts/google-sans-flex-latin.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="stylesheet" href="/src/fonts.css" />
  <link rel="stylesheet" href="/src/style.css" />
  <link rel="stylesheet" href="/src/site.css" />${meta}
</head>`;
}

function linkList(list) {
  return `<ul class="links">${list.map((q) => `<li><a href="${q.path}">${esc(label(q))}</a></li>`).join('')}</ul>`;
}

function cards(list) {
  return `<ul class="cards">${list.map((q) => `
      <li><a class="card" href="${q.path}"><b>${esc(label(q))}</b><span>${esc(q.description)}</span></a></li>`).join('')}
    </ul>`;
}

function related(p, pages) {
  const list = p.related.map((s) => pages.find((q) => q.slug === s)).filter(Boolean);
  if (!list.length) return '';
  return `
    <section class="related" aria-labelledby="related-h">
      <h2 id="related-h">${p.type === 'guide' ? 'Tools for this' : 'Related tools and guides'}</h2>
      ${cards(list)}
    </section>`;
}

function footer(parts, pages) {
  const tools = pages.filter((q) => q.type === 'tool');
  const guides = pages.filter((q) => q.type === 'guide');
  const hub = pages.find((q) => q.type === 'hub');
  return `
  <footer class="site-foot">
    <div class="foot-grid">
      <div class="foot-about">
        <p class="foot-brand">MarkDrift by UptoSolve</p>
        <p>${parts.note.trim()}</p>
      </div>
      <nav aria-label="Tools">
        <p class="foot-h">Tools</p>
        <ul class="links">${hub ? `<li><a href="${hub.path}">All tools</a></li>` : ''}${tools.map((q) => `<li><a href="${q.path}">${esc(label(q))}</a></li>`).join('')}</ul>
      </nav>
      <nav aria-label="Guides">
        <p class="foot-h">Guides</p>
        ${linkList(guides)}
      </nav>
      <nav aria-label="UptoSolve">
        <p class="foot-h">UptoSolve</p>
        <ul class="links"><li><a href="${ORIGIN}/">UptoSolve home</a></li><li><a href="${REPO}">MarkDrift source code</a></li></ul>
      </nav>
    </div>
  </footer>`;
}

const updatedText = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/* ---------- page layouts ---------- */

function toolPage(p, pages, parts) {
  const data = Object.entries(p.preset).map(([k, v]) => ` data-preset-${k}="${v}"`).join('');
  const intro = `
      <div class="intro">
        ${crumbsHtml(p)}
        <h1>${esc(p.h1)}</h1>
        <p class="lede">${esc(p.lede)}</p>
      </div>`;
  const tool = parts.tool.replace('<section class="cart" aria-label="Your files">', (m) => m + intro);
  if (tool === parts.tool) throw new Error('index.html: could not find <section class="cart" aria-label="Your files">');
  return `${head(p, pages)}
<body class="page-tool"${data}>
  ${header(parts)}

  <main>
  <div class="shop">${tool}</div>

  <div class="page-body">
    <article class="prose" aria-label="About this tool">
      ${readFragment(p)}
      <p class="updated">Page updated ${updatedText(p.updated)}.</p>
    </article>${related(p, pages)}
  </div>
  </main>
${footer(parts, pages)}

  ${parts.overlays}

  <script type="module" src="/src/main.js"></script>
</body>
</html>
`;
}

function guidePage(p, pages, parts) {
  return `${head(p, pages)}
<body class="page-article">
  ${header(parts)}

  <main class="page-body">
    <article class="prose">
      <header class="article-head">
        ${crumbsHtml(p)}
        <h1>${esc(p.h1)}</h1>
        <p class="lede">${esc(p.lede)}</p>
        <p class="updated">Updated ${updatedText(p.updated)}</p>
      </header>
      ${readFragment(p)}
    </article>${related(p, pages)}
  </main>
${footer(parts, pages)}
</body>
</html>
`;
}

function hubPage(p, pages, parts) {
  const tools = pages.filter((q) => q.type === 'tool');
  const guides = pages.filter((q) => q.type === 'guide');
  const hasFragment = fs.existsSync(path.join(CONTENT, `${p.slug}.html`));
  return `${head(p, pages)}
<body class="page-article page-hub">
  ${header(parts)}

  <main class="page-body">
    <header class="article-head">
      ${crumbsHtml(p)}
      <h1>${esc(p.h1)}</h1>
      <p class="lede">${esc(p.lede)}</p>
    </header>
    ${hasFragment ? `<article class="prose">
      ${readFragment(p)}
    </article>` : `<section class="hub-list" aria-labelledby="tools-h">
      <h2 id="tools-h">Tools</h2>
      ${cards(tools)}
    </section>
    ${guides.length ? `<section class="hub-list" aria-labelledby="guides-h">
      <h2 id="guides-h">Guides</h2>
      ${cards(guides)}
    </section>` : ''}`}
  </main>
${footer(parts, pages)}
</body>
</html>
`;
}

function notFoundPage(pages, parts) {
  const p = { slug: '404', path: '/tools/404.html', type: 'hub', title: 'Page not found | MarkDrift by UptoSolve', description: 'This page does not exist. The MarkDrift watermark tools are all still here.' };
  const tools = pages.filter((q) => q.type === 'tool');
  const guides = pages.filter((q) => q.type === 'guide');
  const hub = pages.find((q) => q.type === 'hub');
  return `${head(p, pages, { noindex: true })}
<body class="page-article page-404">
  ${header(parts)}

  <main class="page-body">
    <header class="article-head">
      <h1>This page isn't here</h1>
      <p class="lede">The link may be old, or the address has a typo. The watermark tools are all still here, and they still run on your device.</p>
    </header>
    <section class="hub-list" aria-labelledby="tools-h">
      <h2 id="tools-h">Pick a tool</h2>
      ${cards(tools)}
    </section>
    ${guides.length ? `<section class="hub-list" aria-labelledby="guides-h">
      <h2 id="guides-h">Or read a guide</h2>
      ${linkList(guides)}
    </section>` : ''}
    ${hub ? `<p><a class="btn ghost" href="${hub.path}">See all tools</a></p>` : ''}
  </main>
${footer(parts, pages)}
</body>
</html>
`;
}

function sitemap(pages) {
  const urls = pages.map((p) => `  <url>\n    <loc>${abs(p.path)}</loc>\n    <lastmod>${p.updated}</lastmod>\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export function buildPages({ quiet = false } = {}) {
  warnings.length = 0;
  const pages = loadPages();
  const parts = appParts();
  fs.rmSync(SITE, { recursive: true, force: true });
  const write = (rel, html) => {
    const file = path.join(SITE, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
  };
  for (const p of pages) {
    const rel = p.path.replace(/^\/tools\//, '') + 'index.html';
    const html = p.type === 'tool' ? toolPage(p, pages, parts) : p.type === 'guide' ? guidePage(p, pages, parts) : hubPage(p, pages, parts);
    write(rel, html);
  }
  write('404.html', notFoundPage(pages, parts));
  write('.meta/sitemap.xml', sitemap(pages));
  // 301 for URLs typed without the trailing slash (Cloudflare's auto-trailing-slash answers 307)
  write('.meta/_redirects', pages.map((p) => `${p.path.slice(0, -1)} ${p.path} 301`).join('\n') + '\n');
  write('.meta/pages.json', JSON.stringify(pages, null, 2));
  if (!quiet) {
    console.log(`build-pages: ${pages.length} pages + 404 written to site/`);
    for (const w of warnings) console.warn('  warning: ' + w);
  }
  return { pages, warnings: [...warnings] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildPages();
}
