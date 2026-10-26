import type { Rule } from "../types.js";
import { withFrame } from "./util.js";

/** Label text that suggests the checkbox grants consent rather than, say, "remember me". */
const CONSENT_PATTERN =
  /\b(newsletters?|marketing|promotions?|promotional|offers?|deals|partners?|third[- ]part(y|ies)|subscribe|updates|share my|personali[sz]ed ads)\b/i;

export const preCheckedConsent: Rule = {
  id: "pre-checked-consent",
  description: "Consent checkboxes (marketing, partners, newsletters) must not be ticked by default.",
  severity: "error",
  async check({ inFrames }) {
    const hits = await inFrames((source) => {
      const pattern = new RegExp(source, "i");
      const h = window.__honestlint;
      return h
        .all<HTMLInputElement>('input[type="checkbox"]')
        .filter((box) => box.checked && h.isVisible(box))
        .map((box) => {
          const label =
            Array.from(box.labels ?? [])
              .map((l) => h.text(l))
              .join(" ") ||
            box.getAttribute("aria-label") ||
            h.text(box.parentElement ?? box);
          return { box, label };
        })
        .filter((hit) => pattern.test(hit.label))
        .map(({ box, label }) => ({ selector: h.cssPath(box), ref: h.mark(box), label }));
    }, CONSENT_PATTERN.source);

    return hits.map((hit) => ({
      ruleId: this.id,
      severity: this.severity,
      message: "Consent checkbox is pre-checked. Users must opt in themselves.",
      selector: withFrame(hit),
      ref: hit.ref,
      snippet: hit.label.slice(0, 120),
    }));
  },
};
