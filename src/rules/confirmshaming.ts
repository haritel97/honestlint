import type { Rule } from "../types.js";

/** Opt-out wording that guilt-trips the user ("No thanks, I hate saving money"). */
const SHAMING_PATTERNS = [
  /\bno,? thanks?,? i (don'?t|do not) (want|like|need|care)/i,
  /\bi('d| would)? (rather|prefer to) (pay full price|miss out|stay uninformed|keep losing)/i,
  /\bi('m| am) (not interested in|okay with|fine with) (saving|missing|losing|paying more)/i,
  /\bi (hate|don'?t like|do not like) (saving|money|deals|discounts|free)/i,
  /\bno,? i('m| am)? (fine|happy|ok|okay) (paying|losing|missing)/i,
  /\bi('ll| will) pass on (saving|free|the discount)/i,
];

export function matchesConfirmshaming(text: string): boolean {
  return SHAMING_PATTERNS.some((pattern) => pattern.test(text));
}

export const confirmshaming: Rule = {
  id: "confirmshaming",
  description: "Opt-out choices must not use wording that shames or guilt-trips the user.",
  severity: "warn",
  async check({ page }) {
    const controls = await page.evaluate(() => {
      const h = window.__honestlint;
      return Array.from(
        document.querySelectorAll<HTMLElement>('button, a, [role="button"], input[type="button"], input[type="submit"], label'),
      )
        .filter((el) => h.isVisible(el))
        .map((el) => ({ selector: h.cssPath(el), text: h.text(el) }))
        .filter((c) => c.text.length > 0 && c.text.length < 160);
    });

    return controls
      .filter((c) => matchesConfirmshaming(c.text))
      .map((c) => ({
        ruleId: this.id,
        severity: this.severity,
        message: "Opt-out text shames the user for declining.",
        selector: c.selector,
        snippet: c.text,
      }));
  },
};
