"use strict";

// Serialized into the browser. All evidence is DOM/style geometry, not pixels.
function auditPresentation(config) {
  const settings = config.presentationReview || {}, limits = config.thresholds || {};
  if (!settings.enabled) return [];
  const issues = [], severity = config.policy?.presentationReviewSeverity ?? 'warning';
  if (severity === 'off') return issues;
  const select = (scope, query) => { try { return [...scope.querySelectorAll(query)]; } catch { return []; } };
  const shown = node => {
    if (getComputedStyle(node).visibility !== 'visible') return false;
    for (let parent = node; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.display === 'none' || Number(style.opacity) <= .01) return false;
    }
    return true;
  };
  const visible = node => node && shown(node) && node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0;
  const rect = node => {
    const b = node.getBoundingClientRect();
    return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height };
  };
  const pathFor = node => {
    const parts = [];
    for (let item = node; item && parts.length < 10; item = item.parentElement) {
      if (item.id) { parts.unshift('#' + CSS.escape(item.id)); break; }
      const peers = item.parentElement ? [...item.parentElement.children].filter(p => p.localName === item.localName) : [];
      parts.unshift(item.localName + (peers.length > 1 ? `:nth-of-type(${peers.indexOf(item) + 1})` : ''));
    }
    return parts.join(' > ');
  };
  const semantic = 'math,.katex,mjx-container,[data-b35-inline-math]';
  const decorations = settings.watermarkSelectors || '.hi-wm,.watermark,.watermark-text,[data-b35-watermark]';
  const excluded = 'script,style,annotation,annotation-xml,.katex-mathml,.nav,[data-b35-ignore-composition]';
  const canvas = document.createElement('canvas').getContext('2d');
  function baseline(text, style, box, scale) {
    if (!canvas) return null;
    canvas.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const ascent = canvas.measureText(text).fontBoundingBoxAscent;
    return Number.isFinite(ascent) ? box.top + ascent * scale : null;
  }
  function mathBaselines(root, scale) {
    // Renderer stacks, fractions and scripts do not have a single text baseline.
    if (!root.matches('math,[data-b35-inline-math]') || root.querySelector('mtable,.katex,mjx-container')) return [];
    const samples = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode, parent = text.parentElement;
      if (!text.textContent.trim() || !visible(parent) || parent.closest('mfrac,sup,sub,msup > :not(:first-child),msub > :not(:first-child),msubsup > :not(:first-child),mroot > :not(:first-child),annotation')) continue;
      const range = document.createRange(); range.selectNodeContents(text);
      const boxes = [...range.getClientRects()].filter(b => b.width > 0 && b.height > 0);
      if (boxes.length !== 1) continue;
      const value = baseline(text.textContent, getComputedStyle(parent), boxes[0], scale);
      if (value !== null) samples.push(value);
    }
    return samples;
  }
  function tokens(root, scale) {
    const result = [];
    function visit(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (!visible(node.parentElement)) return;
        const style = getComputedStyle(node.parentElement);
        for (const match of node.textContent.matchAll(/\S+/gu)) {
          const range = document.createRange(); range.setStart(node, match.index); range.setEnd(node, match.index + match[0].length);
          for (const box of range.getClientRects()) if (box.width > 0 && box.height > 0) result.push({ kind: 'text', text: match[0], box, fontSize: parseFloat(style.fontSize), baseline: baseline(match[0], style, box, scale) });
        }
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE || !shown(node) || node.matches(excluded) || node.closest(decorations)) return;
      if (node !== root && node.matches(semantic)) {
        if (node.getAttribute('display') === 'block' || node.getAttribute('display') === 'true' || /^(block|flex|grid|table)/.test(getComputedStyle(node).display)) { result.push({ kind: 'break' }); return; }
        result.push({ kind: 'math', node, box: rect(node), baselines: mathBaselines(node, scale) }); return;
      }
      const block = node !== root && /^(block|flex|grid|list-item|table|flow-root)/.test(getComputedStyle(node).display);
      if (block || node.localName === 'br') result.push({ kind: 'break' });
      for (const child of node.childNodes) visit(child);
      if (block) result.push({ kind: 'break' });
    }
    visit(root); return result;
  }
  const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const slides = select(document, config.selectors.slides);
  const marked = slides.filter(s => s.classList.contains('active'));
  for (const slide of (config.documentMode ? slides : marked.length ? marked : slides.filter(visible))) {
    if (!visible(slide)) continue;
    const scale = slide.offsetWidth ? rect(slide).width / slide.offsetWidth : 1;
    if (!(scale > 0)) continue;
    const emit = (rule, message, node, evidence, expected, action) => issues.push({
      rule, severity, message, slide: slide.id, runtimeSlide: slides.indexOf(slide) + 1,
      header: select(slide, config.selectors.header)[0]?.textContent.trim() || '', selector: pathFor(node), evidence,
      expected, suggestedAction: action, confidence: 'Rendered DOM/style measurements; visual appearance and teaching intent require review.',
      verification: ['Inspect the identified region at the intended viewport after fonts load.', 'Recheck affected reveal states, wrapping, mathematics and panel bounds after changes.'],
      constraints: ['Review candidate, not automatic visual approval or a mathematical error.', 'Preserve all content, values, intentional writing space and branding; document intentional exceptions.']
    });
    const proseSelector = settings.inlineProseSelectors || 'p,.note,.rule,.hint,.check,[data-b35-content-role=explanation],[data-b35-content-role=note]';
    if (settings.inlineMathEnabled !== false) {
      const handled = new Set();
      for (const owner of select(slide, proseSelector)) {
        if (!visible(owner) || owner.closest('[data-b35-allow-inline-math-offset],.formula,[data-b35-equation],[data-b35-formula-row]')) continue;
        const items = tokens(owner, scale);
        if (items.filter(t => t.kind === 'text' && /[\p{L}]{3}/u.test(t.text)).length < 1) continue;
        for (const [index, item] of items.entries()) {
          if (item.kind !== 'math' || handled.has(item.node) || item.node.closest('[data-b35-allow-inline-math-offset]')) continue;
          handled.add(item.node);
          const before = items[index - 1], after = items[index + 1];
          const adjacent = [before, after].filter(t => t?.kind === 'text' && t.baseline !== null);
          if (!adjacent.length) continue;
          const fontSize = median(adjacent.map(t => t.fontSize));
          // Both neighboring words must share a line, or the math must overlap
          // the sole neighboring line. Natural wrapping is not a baseline defect.
          if (adjacent.length === 2 && Math.abs(adjacent[0].baseline - adjacent[1].baseline) / scale > 2) continue;
          if (adjacent.length === 1 && Math.min(item.box.bottom, adjacent[0].box.bottom) <= Math.max(item.box.top, adjacent[0].box.top)) continue;
          const proseBaseline = median(adjacent.map(t => t.baseline));
          const tolerance = Math.max(limits.inlineMathBaselineTolerancePx ?? 4, fontSize * (limits.inlineMathBaselineToleranceEm ?? .2));
          if (item.baselines.length && (Math.max(...item.baselines) - Math.min(...item.baselines)) / scale <= 2) {
            const delta = (median(item.baselines) - proseBaseline) / scale;
            if (Math.abs(delta) > tolerance) emit('B35-TYPE-005', 'Inline mathematics is displaced from the neighboring prose baseline.', item.node,
              { kind: 'inline-math-baseline-offset', offsetPx: delta, tolerancePx: tolerance, proseSelector: pathFor(owner), method: 'Text ranges plus canvas font bounding-box ascent; structural fractions/scripts excluded', opticalAlignmentVerified: false },
              'Inline base tokens follow the surrounding prose baseline while radicals, fractions and scripts retain their natural geometry.',
              'Review vertical-align, relative positioning and transforms on the inline expression. Adjust its wrapper without flattening fraction, root or script structure.');
          }
          const gaps = [];
          for (const [side, neighbor] of [['before', before], ['after', after]]) {
            if (neighbor?.kind !== 'text' || Math.min(neighbor.box.bottom, item.box.bottom) <= Math.max(neighbor.box.top, item.box.top)) continue;
            const gap = (side === 'before' ? item.box.left - neighbor.box.right : neighbor.box.left - item.box.right) / scale;
            const punctuation = side === 'after' && /^[,.;:!?]/u.test(neighbor.text);
            const maximum = punctuation ? fontSize * (limits.inlineMathPunctuationGapEm ?? .25) : Math.max(limits.inlineMathMaximumGapPx ?? 12, fontSize * (limits.inlineMathMaximumGapEm ?? .65));
            if (gap > maximum) gaps.push({ side, gapPx: gap, maximumPx: maximum, neighboringText: neighbor.text });
          }
          if (gaps.length) emit('B35-TYPE-005', 'Inline mathematics has excessive separation from adjacent prose or punctuation.', item.node,
            { kind: 'inline-math-spacing', proseSelector: pathFor(owner), measurements: gaps, opticalAlignmentVerified: false },
            'Expressions and punctuation read as part of one sentence with consistent inline spacing.',
            'Review wrapper padding/margins and repeated whitespace. Preserve normal word spacing and mathematical operator spacing.');
        }
      }
    }
    const counter = document.querySelector('#step,#step-badge')?.textContent || '';
    const match = /Step\s+(\d+)\s*(?:\/|of)\s*(\d+)/i.exec(counter);
    const hiddenReveals = select(slide, config.selectors.reveals || '[data-step]').some(node => !visible(node));
    const finalState = !(match && Number(match[1]) < Number(match[2])) && !hiddenReveals;

    if (finalState && settings.largeGapsEnabled !== false) for (const flow of select(slide, settings.flowSelectors || '.body,[data-b35-layout-flow]')) {
      if (!visible(flow) || flow.closest('[data-b35-allow-empty-space],[data-b35-allow-large-gap]')) continue;
      const blocks = [...flow.children].filter(node => visible(node) && !node.matches(excluded) && !node.closest(decorations) && !['absolute', 'fixed'].includes(getComputedStyle(node).position) && (node.textContent.trim() || node.querySelector('svg,img,canvas'))).sort((a, b) => rect(a).top - rect(b).top);
      const referenceHeight = config.documentMode ? config.viewport.height : rect(slide).height / scale;
      const maximum = Math.max(limits.presentationMaximumGapPx ?? 48, referenceHeight * (limits.presentationMaximumGapRatio ?? .10));
      const occupiedBoundary = node => {
        const box = rect(node), style = getComputedStyle(node);
        if (!node.matches(settings.gapContainerSelectors || '.two,.three,.four,[data-b35-comparison]') || !['grid','flex'].includes(style.display) || !/^(transparent|rgba\([^)]*,\s*0\))$/.test(style.backgroundColor) || style.backgroundImage !== 'none' || ['Top','Bottom','Left','Right'].some(side=>parseFloat(style['border'+side+'Width'])>0) || [...node.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim())) return { bottom: box.bottom, selectors: [pathFor(node)] };
        const children = [...node.children].filter(n=>visible(n)&&!n.matches(excluded)&&!n.closest(decorations)&&!['absolute','fixed'].includes(getComputedStyle(n).position));
        if (!children.length || children.some(n=>n.closest('[data-b35-allow-empty-space],[data-b35-allow-large-gap]'))) return { bottom: box.bottom, selectors: [pathFor(node)] };
        return { bottom: Math.max(...children.map(n=>rect(n).bottom)), selectors: children.map(pathFor) };
      };
      for (let i = 1; i < blocks.length; i++) {
        const b = rect(blocks[i]);
        const previous = blocks.slice(0, i).filter(node => { const a = rect(node); return Math.min(a.right, b.right) - Math.max(a.left, b.left) > .25 * Math.min(a.width, b.width); }).sort((a, c) => occupiedBoundary(c).bottom - occupiedBoundary(a).bottom)[0];
        if (!previous || previous.closest('[data-b35-allow-large-gap],[data-b35-allow-empty-space]') || blocks[i].closest('[data-b35-allow-large-gap],[data-b35-allow-empty-space]')) continue;
        const occupied = occupiedBoundary(previous), gap = (b.top - occupied.bottom) / scale;
        if (gap > maximum) emit('B35-COMPOSITION-003', 'Separate teaching blocks leave a large vertical gap at the final reveal.', flow,
          { kind: 'inter-block-whitespace', gapPx: gap, containerGapPx: (b.top-rect(previous).bottom)/scale, maximumPx: maximum, previousSelector: pathFor(previous), previousContentSelectors: occupied.selectors, nextSelector: pathFor(blocks[i]) },
          'Related teaching blocks have deliberate spacing and a clear visual connection.',
          'Review fixed heights, spacer rows, margins and distributed flex/grid space. Tighten unnecessary gaps; retain explicitly intended writing or pause space.');
      }
    }

    if (finalState && settings.shortLinesEnabled !== false) for (const owner of select(slide, settings.calloutSelectors || '.note,.rule,.warning,.check,.callout,[data-b35-callout]')) {
      if (!visible(owner) || owner.closest('[data-b35-allow-short-line]')) continue;
      const items = tokens(owner, scale);
      if (items.some(t => t.kind === 'break') || items.filter(t => t.kind === 'text').length < 8) continue;
      const lines = [];
      for (const item of items.filter(t => t.kind === 'text')) {
        const line = lines.find(l => Math.abs(l.baseline - item.baseline) / scale < 3);
        if (line) line.items.push(item); else lines.push({ baseline: item.baseline, items: [item] });
      }
      if (lines.length < 2 || lines.length > 4) continue;
      lines.sort((a, b) => a.baseline - b.baseline);
      for (const item of items.filter(t => t.kind === 'math')) {
        const y = item.baselines.length ? median(item.baselines) : (item.box.top + item.box.bottom) / 2;
        lines.reduce((a, b) => Math.abs(a.baseline - y) <= Math.abs(b.baseline - y) ? a : b).items.push(item);
      }
      const width = line => (Math.max(...line.items.map(t => t.box.right)) - Math.min(...line.items.map(t => t.box.left))) / scale;
      const last = lines.at(-1), longest = Math.max(...lines.slice(0, -1).map(width)), lastWidth = width(last);
      const words = last.items.filter(t => t.kind === 'text').length;
      if (words > 0 && words <= (limits.calloutShortLineMaximumWords ?? 3) && lastWidth / longest < (limits.calloutShortLineMaximumRatio ?? .28)) emit('B35-COMPOSITION-004', 'A callout soft-wraps to a very short final line.', owner,
        { kind: 'callout-short-final-line', lastLineText: last.items.filter(t => t.kind === 'text').map(t => t.text).join(' '), lastLineWords: words, lastLineWidthPx: lastWidth, precedingMaximumWidthPx: longest, widthRatio: lastWidth / longest, lineCount: lines.length },
        'Callout wrapping is balanced and preserves sentence and expression groupings.',
        'Review a concise wording, available width or a deliberate line break. Preserve the meaning; do not reduce the font merely to fit.');
    }

    if (settings.watermarksEnabled !== false) {
      const content = [], seen = new Set(), body = select(slide, config.selectors.body)[0] || slide;
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const text = walker.currentNode, parent = text.parentElement;
        if (!text.textContent.trim() || !visible(parent) || parent.closest(decorations + ',' + excluded)) continue;
        const owner = parent.closest(semantic) || parent;
        if (owner.matches(semantic)) { if (seen.has(owner)) continue; seen.add(owner); content.push({ selector: pathFor(owner), box: rect(owner) }); }
        else { const range = document.createRange(); range.selectNodeContents(text); for (const box of range.getClientRects()) if (box.width && box.height) content.push({ selector: pathFor(owner), box }); }
      }
      for (const mark of select(slide, decorations).filter(node => !node.parentElement?.closest(decorations))) {
        if (!visible(mark) || mark.closest('[data-b35-allow-watermark-overlap]')) continue;
        const hits = new Set(), paint = [], textWalker = document.createTreeWalker(mark, NodeFilter.SHOW_TEXT);
        while (textWalker.nextNode()) {
          const text = textWalker.currentNode, parent = text.parentElement;
          if (!text.textContent.trim() || !visible(parent)) continue;
          let alpha = 1;
          for (let node = parent; node; node = node.parentElement) alpha *= Number(getComputedStyle(node).opacity);
          const color = getComputedStyle(parent).color;
          if (color.startsWith('rgba(')) alpha *= Number(color.match(/[\d.]+/g)?.[3] ?? 1);
          if (alpha < (limits.watermarkReviewMinimumOpacity ?? .08)) continue;
          const range = document.createRange(); range.selectNodeContents(text);
          for (const box of range.getClientRects()) {
            for (const target of content) {
              const w = Math.min(box.right, target.box.right) - Math.max(box.left, target.box.left), h = Math.min(box.bottom, target.box.bottom) - Math.max(box.top, target.box.top);
              if (w > 0 && h > 0 && w * h / (target.box.width * target.box.height) > .05) hits.add(target.selector);
            }
          }
          paint.push(alpha);
        }
        if (hits.size >= (limits.watermarkMinimumContentIntersections ?? 3)) emit('B35-COMPOSITION-005', 'A repeated watermark geometrically crosses several teaching elements at a reviewable opacity.', mark,
          { kind: 'watermark-content-interference', contentSelectors: [...hits].slice(0, 12), contentIntersections: hits.size, maximumEffectiveOpacity: Math.max(...paint), screenshotPixelsVerified: false, occlusionVerified: false },
          'Branding remains unobtrusive across equations, captions and summary text.',
          'Inspect the screenshot for actual interference. Review watermark opacity, repetition density or placement while preserving required branding.');
      }
    }
  }
  return issues;
}
module.exports = { auditPresentation };
