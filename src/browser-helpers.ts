/**
 * Helpers injected into every frame before it loads, so rules can share them
 * inside `frame.evaluate`. Kept as a plain string because it runs in the
 * browser, not in Node.
 *
 * Elements inside open shadow roots are included everywhere: consent banners
 * are often rendered in shadow DOM, which `querySelectorAll` cannot see into.
 */
export const helperScript = `
window.__honestlint = {
  /** Like document.querySelectorAll, but also searches open shadow roots. */
  all(selector, root) {
    const found = [];
    const visit = (node) => {
      found.push(...node.querySelectorAll(selector));
      for (const el of node.querySelectorAll("*")) {
        if (el.shadowRoot) visit(el.shadowRoot);
      }
    };
    visit(root || document);
    return found;
  },
  /** A readable CSS path. Shadow root boundaries are shown as " >>> ". */
  cssPath(el) {
    const segments = [];
    let current = el;
    while (current) {
      const parts = [];
      let node = current;
      while (node && parts.length < 6) {
        if (node.id) {
          parts.unshift("#" + CSS.escape(node.id));
          break;
        }
        let part = node.tagName.toLowerCase();
        const parent = node.parentElement;
        if (parent) {
          const same = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
          if (same.length > 1) part += ":nth-of-type(" + (same.indexOf(node) + 1) + ")";
        }
        parts.unshift(part);
        node = parent;
      }
      segments.unshift(parts.join(" > "));
      const root = current.getRootNode();
      current = root instanceof ShadowRoot ? root.host : null;
    }
    return segments.join(" >>> ");
  },
  /** Tag an element so the runner can find it again for the screenshot. */
  mark(el) {
    const ref = "hl-" + (++window.__honestlintRefs);
    el.setAttribute("data-honestlint-ref", ref);
    return ref;
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
  /** Visible text of the document, including text inside open shadow roots. */
  pageText() {
    const parts = [document.body ? document.body.innerText : ""];
    for (const el of this.all("*")) {
      if (el.shadowRoot) {
        for (const child of el.shadowRoot.children) {
          if (child.tagName !== "STYLE" && child.tagName !== "SCRIPT") parts.push(child.innerText || "");
        }
      }
    }
    return parts.join("\\n");
  },
};
window.__honestlintRefs = window.__honestlintRefs || 0;
`;

export interface HonestlintHelpers {
  all<E extends Element = HTMLElement>(selector: string, root?: ParentNode): E[];
  cssPath(el: Element): string;
  mark(el: Element): string;
  isVisible(el: Element): boolean;
  text(el: Element): string;
  pageText(): string;
}

declare global {
  interface Window {
    __honestlint: HonestlintHelpers;
    __honestlintRefs: number;
  }
}
