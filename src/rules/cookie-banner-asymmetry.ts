import type { Rule } from "../types.js";

const ACCEPT_PATTERN = /^(accept|allow|agree|i agree|got it|ok|okay)( all)?( cookies)?$/i;
const REJECT_PATTERN = /\b(reject|decline|deny|refuse|necessary only|only necessary|essential only)\b/i;

/** Accept may be this many times larger (by area) than reject before we flag it. */
const MAX_AREA_RATIO = 2;

export const cookieBannerAsymmetry: Rule = {
  id: "cookie-banner-asymmetry",
  description: "Rejecting cookies must be as easy and as visible as accepting them.",
  severity: "warn",
  async check({ page }) {
    const result = await page.evaluate(
      ({ accept, reject }) => {
        if (!/cookie/i.test(document.body.innerText)) return null;
        const h = window.__honestlint;
        const controls = Array.from(
          document.querySelectorAll<HTMLElement>('button, a, [role="button"], input[type="button"], input[type="submit"]'),
        )
          .filter((el) => h.isVisible(el))
          .map((el) => {
            const rect = el.getBoundingClientRect();
            return { selector: h.cssPath(el), text: h.text(el), area: rect.width * rect.height };
          });
        return {
          accept: controls.find((c) => new RegExp(accept, "i").test(c.text)) ?? null,
          reject: controls.find((c) => new RegExp(reject, "i").test(c.text)) ?? null,
        };
      },
      { accept: ACCEPT_PATTERN.source, reject: REJECT_PATTERN.source },
    );

    if (!result?.accept) return [];
    const { accept, reject } = result;

    if (!reject) {
      return [
        {
          ruleId: this.id,
          severity: this.severity,
          message: "Cookie banner has an accept button but no visible reject option.",
          selector: accept.selector,
          snippet: accept.text,
        },
      ];
    }

    const ratio = accept.area / Math.max(reject.area, 1);
    if (ratio < MAX_AREA_RATIO) return [];
    return [
      {
        ruleId: this.id,
        severity: this.severity,
        message: `Accept button is ${ratio.toFixed(1)}x larger than the reject option.`,
        selector: reject.selector,
        snippet: `${accept.text} / ${reject.text}`,
      },
    ];
  },
};
