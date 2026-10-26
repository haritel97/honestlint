import type { Rule } from "../types.js";
import { CONTROLS, withFrame } from "./util.js";

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
  async check({ inFrames }) {
    const hits = await inFrames(
      ({ selector, sources }) => {
        const h = window.__honestlint;
        const patterns = sources.map((s) => new RegExp(s, "i"));
        return h
          .all(selector + ", label")
          .filter((el) => h.isVisible(el))
          .map((el) => ({ el, text: h.text(el) }))
          .filter(({ text }) => text.length > 0 && text.length < 160 && patterns.some((p) => p.test(text)))
          .map(({ el, text }) => ({ selector: h.cssPath(el), ref: h.mark(el), text }));
      },
      { selector: CONTROLS, sources: SHAMING_PATTERNS.map((p) => p.source) },
    );

    return hits.map((hit) => ({
      ruleId: this.id,
      severity: this.severity,
      message: "Opt-out text shames the user for declining.",
      selector: withFrame(hit),
      ref: hit.ref,
      snippet: hit.text,
    }));
  },
};
