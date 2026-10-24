"use strict";

// Self-contained: this function is serialized into the inspected browser.
function auditTextContrast(config) {
  if (config.textContrast?.enabled === false) return [];
  const findings = [], policy = config.policy || {}, thresholds = config.thresholds || {};
  const displayed = element => {
    for (let p = element; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.display === 'none' || s.contentVisibility === 'hidden' || Number(s.opacity) === 0) return false;
    }
    return true;
  };
  const visible = element => displayed(element) && !['hidden', 'collapse'].includes(getComputedStyle(element).visibility);
  const slides = [...document.querySelectorAll(config.selectors.slides)];
  const roots = config.documentMode ? [document.body] : slides.filter(s => displayed(s) && s.getBoundingClientRect().width > 0 && s.getBoundingClientRect().height > 0);
  const selector = element => {
    const parts = [];
    for (let p = element; p; p = p.parentElement) {
      if (p.id) { parts.unshift('#' + CSS.escape(p.id)); break; }
      const siblings = p.parentElement ? [...p.parentElement.children].filter(e => e.localName === p.localName) : [];
      parts.unshift(p.localName + (siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(p) + 1})` : ''));
    }
    return parts.join(' > ');
  };
  const parse = value => {
    const m = /^rgba?\((\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)(?:[, /]+(\d*\.?\d+))?\)$/.exec(value || '');
    return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null;
  };
  const over = (front, back) => {
    const alpha = front[3] + back[3] * (1 - front[3]);
    return alpha ? [0, 1, 2].map(i => (front[i] * front[3] + back[i] * back[3] * (1 - front[3])) / alpha).concat(alpha) : [0, 0, 0, 0];
  };
  const luminance = rgb => {
    const c = rgb.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  };
  const ratio = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const palette = ['#1A2B5F', '#1E293B', '#FFFFFF'].map(hex => ({ hex, rgb: [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) }));
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), owners = new Map();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const e = node.parentElement;
      if (!e || !node.textContent.trim() || e.closest('script,style,noscript,template') || !visible(e)) continue;
      const decorative = config.textContrast?.decorativeSelectors ?? '.hi-wm,.watermark,.watermark-text';
      if (decorative && e.closest(decorative)) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      if (![...range.getClientRects()].some(r => r.width > 0 && r.height > 0)) continue;
      owners.set(e, (owners.get(e) || '') + node.textContent);
    }
    for (const [element, text] of owners) {
      const style = getComputedStyle(element), declaredForeground = style.webkitTextFillColor || style.color;
      let foreground = parse(declaredForeground), background = [0, 0, 0, 0], backgroundOwner = null, unknown = null;
      const layers = [];
      if (!foreground) unknown = 'unsupported foreground colour space';
      if (element.closest('svg')) unknown = 'SVG paint order: shapes may paint behind text';
      if (style.backgroundClip === 'text' || style.webkitBackgroundClip === 'text') unknown = 'background-clipped text';
      for (let p = element; p && !unknown; p = p.parentElement) {
        const s = getComputedStyle(p), color = parse(s.backgroundColor);
        if (s.mixBlendMode !== 'normal' || s.filter !== 'none' || (s.backdropFilter && s.backdropFilter !== 'none')) { unknown = 'filter or blend compositing'; break; }
        if ((background[3] < 1 || foreground[3] < 1) && s.backgroundImage !== 'none') { unknown = 'gradient or image background'; break; }
        if (!color) { unknown = 'unsupported background colour space'; break; }
        if (!backgroundOwner && color[3] > 0) backgroundOwner = p;
        layers.push({ color, opacity: Number(s.opacity) });
        foreground = over(foreground, color); background = over(background, color);
        foreground[3] *= Number(s.opacity); background[3] *= Number(s.opacity);
      }
      const location = { slide: config.documentMode ? null : root.id || null, runtimeSlide: config.documentMode ? null : slides.indexOf(root) + 1, header: (root.querySelector(config.selectors.header)?.textContent || '').trim(), selector: selector(element) };
      const emit = (rule, severity, message, evidence) => {
        if (severity === 'off') return;
        findings.push({ rule, severity, message, ...location, evidence,
          expected: 'Text is legible against its own painted card/background, including nested cards and inherited text colours.',
          impact: 'White text inherited from a dark parent can disappear on a pale nested card; low contrast hides questions, labels and answers.',
          suggestedAction: unknown ? 'Review a rendered screenshot of the named text and its actual painted background; use a solid backing or explicit legible text colour if necessary.' : 'Set the text colour on this card or its text component, not only the outer container. Use a passing recommended colour or another verified pair; preserve numbers, wording and reveal steps.',
          confidence: 'Computed CSS solid-colour compositing, not screenshot-pixel sampling or a complete accessibility audit.',
          verification: ['Revalidate every affected reveal after fonts settle.', 'Inspect the screenshot for watermarks, pseudo-elements, overlapping siblings and anti-aliasing that DOM colour calculations cannot certify.'],
          constraints: ['Detection only; no automatic HTML edits, exceptions or approval.', 'SVG paint order, images, gradients and unsupported colour effects require separate visual review.'] });
      };
      const baseEvidence = { text: text.replace(/\s+/g, ' ').trim().slice(0, 180), declaredForeground, backgroundSelector: backgroundOwner ? selector(backgroundOwner) : null, screenshotPixelsVerified: false };
      if (unknown) { emit('B35-CONTRAST-003', policy.contrastReviewSeverity || 'warning', `Text/background contrast requires visual review: ${unknown}.`, { ...baseEvidence, kind: 'text-contrast-review-required', reason: unknown }); continue; }
      foreground = over(foreground, [255, 255, 255, 1]); background = over(background, [255, 255, 255, 1]);
      const fontSize = parseFloat(style.fontSize), weight = Number(style.fontWeight) || 400;
      const large = fontSize >= 24 || (fontSize >= 56 / 3 && weight >= 700);
      const minimum = large ? (thresholds.minimumContrastLarge ?? 3) : (thresholds.minimumContrastNormal ?? 4.5);
      const actual = ratio(foreground, background);
      if (actual + 1e-9 >= minimum) continue;
      const card = backgroundOwner && backgroundOwner !== root && !backgroundOwner.matches('body,html');
      const recommended = palette.map(c => {
        let rendered = [...c.rgb, 1];
        for (const layer of layers) { rendered = over(rendered, layer.color); rendered[3] *= layer.opacity; }
        return { color: c.hex, ratio: ratio(over(rendered, [255, 255, 255, 1]), background) };
      }).filter(c => c.ratio >= minimum);
      emit(card ? 'B35-CONTRAST-002' : 'B35-CONTRAST-001', card ? (policy.cardTextContrastSeverity || 'error') : (policy.contrastSeverity || 'warning'),
        `Text/background contrast is ${actual.toFixed(2)}:1; requires ${minimum}:1${card ? ' on this card' : ''}.`,
        { ...baseEvidence, kind: 'text-background-contrast', ratio: actual, minimum, foreground: foreground.slice(0, 3), background: background.slice(0, 3), fontSize, fontWeight: weight, largeText: large, recommended });
    }
  }
  return findings;
}
module.exports = { auditTextContrast };
