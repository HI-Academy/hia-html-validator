"use strict";
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

function parsePages(value) {
  if (value == null) return null;
  const pages = new Set();
  for (const part of String(value).split(',')) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
    if (!match) throw new Error('--pages must contain positive page numbers/ranges, e.g. 2,4-6');
    const first = Number(match[1]), last = Number(match[2] || match[1]);
    if (!Number.isSafeInteger(first) || first < 1 || last < first || last > 10000) throw new Error('--pages must be ascending ranges within 1–10000');
    for (let n = first; n <= last; n++) pages.add(n);
  }
  return [...pages].sort((a, b) => a - b);
}

// Resolve only explicit local files. No downloads, shell font tools or OS writes.
function readFontManifest(file) {
  if (!file) return [];
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.fonts) || !manifest.fonts.length || manifest.fonts.length > 32) throw new Error('Font manifest requires schemaVersion 1 and 1–32 fonts');
  return manifest.fonts.map(font => {
    if (typeof font.family !== 'string' || !font.family.trim() || typeof font.path !== 'string' || !font.path || !/\.(?:ttf|otf|woff2?)$/i.test(font.path)) throw new Error('Each font requires family and a local .ttf/.otf/.woff/.woff2 path');
    const weight = String(font.weight || '400'), style = font.style || 'normal';
    if (!/^(?:[1-9]\d{0,2}|1000)(?: (?:[1-9]\d{0,2}|1000))?$/.test(weight) || (weight.includes(' ') && Number(weight.split(' ')[0]) > Number(weight.split(' ')[1])) || !['normal', 'italic', 'oblique'].includes(style)) throw new Error('Invalid font weight/style descriptor');
    const resolved = fs.realpathSync(path.resolve(path.dirname(file), font.path));
    const bytes = fs.readFileSync(resolved);
    if (!bytes.length || bytes.length > 16 * 1024 * 1024) throw new Error('Font files must contain 1 byte–16 MiB');
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    if (font.sha256 && font.sha256 !== sha256) throw new Error(`Font checksum mismatch: ${resolved}`);
    return { family: font.family.trim(), path: resolved, weight, style, sha256, bytes: bytes.length, data: bytes.toString('base64') };
  });
}

async function loadDocument(page, file, { loadMode = 'file', fonts = [] } = {}) {
  if (loadMode === 'memory') {
    // Explicit self-contained-document mode; no file-policy changes or server.
    // Relative resources require the normal file mode. Preserve the input bytes.
    await page.setContent(fs.readFileSync(file, 'utf8'), { waitUntil: 'load', timeout: 20000 });
    const relative = await page.evaluate(() => {
      const isRelative = value => value && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value.trim());
      const values = [...document.querySelectorAll('script[src],img[src],link[href],video[src],audio[src],source[src],iframe[src],object[data]')].flatMap(n => [n.getAttribute('src') || n.getAttribute('href') || n.getAttribute('data')]);
      // Include CSS url()/@import and srcset rather than silently accepting
      // resources that about:blank cannot resolve. CSS syntax can be complex;
      // memory transport is deliberately conservative.
      for (const node of document.querySelectorAll('style,[style]')) {
        const css = node.localName === 'style' ? node.textContent : node.getAttribute('style');
        for (const match of css.matchAll(/url\(\s*["']?([^\s"')]+)|@import\s+["']([^"']+)/gi)) values.push(match[1] || match[2]);
      }
      const unresolved = values.filter(isRelative);
      if (document.querySelector('[srcset],base')) unresolved.push('srcset/base requires file transport');
      return unresolved;
    });
    if (relative.length) throw new Error(`Memory loading requires self-contained HTML; use --load-mode file for relative assets/base/srcset: ${relative.slice(0, 3).join(', ')}`);
  } else await page.goto(pathToFileURL(file).href, { waitUntil: 'load', timeout: 20000 });
  for (const font of fonts) {
    await page.evaluate(async ({ family, data, weight, style }) => {
      const binary = Uint8Array.from(atob(data), c => c.charCodeAt(0));
      const face = new FontFace(family, binary, { weight, style });
      await face.load(); document.fonts.add(face);
    }, font);
  }
  await page.evaluate(async () => {
    await Promise.race([document.fonts.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('Fonts did not settle within 5 seconds')), 5000))]);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function fontEvidence(page, config, fonts, loadMode, browserVersion) {
  const result = { browserVersion, loadMode, suppliedFonts: fonts.map(({ data, ...metadata }) => metadata), platformFonts: [], limitations: ['Font manifest family/weight names are supplied declarations; confirm the rendered platform-font evidence.', 'System font binary contents, external assets and screenshot pixels are not fingerprinted.'] };
  try {
    const selectors = await page.evaluate(selectors => {
      const all = [...document.querySelectorAll(selectors.slides)], marked = all.filter(n => n.classList.contains('active'));
      const root = marked[0] || all.find(n => getComputedStyle(n).display !== 'none') || document.body;
      const paths = new Set(), walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode() && paths.size < 64) {
        const node = walker.currentNode, parent = node.parentElement;
        if (!node.textContent.trim() || parent.closest('script,style,.hi-wm,.watermark,annotation') || getComputedStyle(parent).visibility !== 'visible' || !parent.getClientRects().length) continue;
        const parts = [];
        for (let n = parent; n; n = n.parentElement) {
          if (n.id) { parts.unshift('#' + CSS.escape(n.id)); break; }
          const peers = n.parentElement ? [...n.parentElement.children].filter(p => p.localName === n.localName) : [];
          parts.unshift(n.localName + (peers.length > 1 ? `:nth-of-type(${peers.indexOf(n) + 1})` : ''));
        }
        paths.add(parts.join(' > '));
      }
      return [...paths];
    }, config.selectors);
    const session = await page.context().newCDPSession(page);
    try {
      await session.send('DOM.enable'); await session.send('CSS.enable');
      const { root } = await session.send('DOM.getDocument');
      for (const selector of selectors) {
        const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector });
        if (nodeId) {
          const { fonts: observed } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
          if (observed.length) result.platformFonts.push({ selector, fonts: observed });
        }
      }
    } finally { await session.detach(); }
    result.status = 'OBSERVED';
  } catch (error) { result.status = 'UNASSESSED'; result.reason = error.message; }
  return result;
}

// Metadata only: used to navigate past unselected pages without auditing them.
function captureLessonState(config) {
  const slides = [...document.querySelectorAll(config.selectors.slides)];
  const visible = n => {
    for (let p = n; p; p = p.parentElement) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) <= .01) return false; }
    const r = n.getBoundingClientRect(); return r.width > .5 && r.height > .5;
  };
  const marked = slides.filter(n => n.classList.contains('active')), active = marked.length ? marked : slides.filter(visible);
  if (active.length !== 1) throw new Error(`Expected exactly one active slide while navigating; found ${active.length}`);
  const slide = active[0], nodes = [...slide.querySelectorAll(config.selectors.reveals)];
  const match = /Step\s+(\d+)\s*(?:\/|of)\s*(\d+)/i.exec(document.querySelector('#step,#step-badge,[data-step-counter]')?.textContent || '');
  const values = ns => ns.map(n => Number(n.getAttribute('data-step'))).filter(n => Number.isInteger(n) && n > 0);
  return { runtimeSlide: slides.indexOf(slide) + 1, runtimeSlides: slides.length, slideId: slide.id,
    step: match ? Number(match[1]) : Math.max(0, ...values(nodes.filter(visible))),
    maxStep: match ? Number(match[2]) : Math.max(0, ...values(nodes)) };
}
module.exports = { parsePages, readFontManifest, loadDocument, fontEvidence, captureLessonState };
