/**
 * Helpers injected into every page before it loads, so rules can share them
 * inside `page.evaluate`. Kept as a plain string because it runs in the
 * browser, not in Node.
 */
export const helperScript = `
window.__honestlint = {
  cssPath(el) {
    const parts = [];
    while (el && el.nodeType === 1 && parts.length < 6) {
      if (el.id) {
        parts.unshift("#" + CSS.escape(el.id));
        break;
      }
      let part = el.tagName.toLowerCase();
      const parent = el.parentElement;
      if (parent) {
        const same = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
        if (same.length > 1) part += ":nth-of-type(" + (same.indexOf(el) + 1) + ")";
      }
      parts.unshift(part);
      el = parent;
    }
    return parts.join(" > ");
  },
  isVisible(el) {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  },
  text(el) {
    return (el.innerText || el.value || el.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim();
  },
};
`;

export interface HonestlintHelpers {
  cssPath(el: Element): string;
  isVisible(el: Element): boolean;
  text(el: Element): string;
}

declare global {
  interface Window {
    __honestlint: HonestlintHelpers;
  }
}
