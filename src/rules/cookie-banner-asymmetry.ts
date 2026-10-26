import type { Rule } from "../types.js";
import { CONTROLS, withFrame } from "./util.js";

/**
 * Button text that accepts cookies, in English, German, French, Spanish,
 * Italian, Dutch, Portuguese and Malay. Matched against the whole (normalised)
 * label, so "Accept all" matches but "Accept terms and place order" does not.
 */
const ACCEPT_PATTERN = new RegExp(
  // "Alles akzeptieren" and "Tout accepter" put "all" first.
  "^(yes,? )?(i )?(alle |alles |tout |todo |todas )?(" +
    [
      "accept|agree|allow|ok|okay|got it",
      "akzeptieren|annehmen|zustimmen|erlauben|einverstanden|ich stimme zu",
      "accepter|j'accepte|autoriser|ok pour moi|d'accord",
      "aceptar|acepto|permitir",
      "accetta|accetto|accetta tutto|consenti",
      "accepteren|akkoord|toestaan",
      "aceitar|aceito|concordo|permitir",
      "terima|setuju|benarkan",
    ].join("|") +
    ")( all| alle| alles| tout| todo| todas| todos| tutti| semua)?( cookies?)?( and continue| und weiter| et continuer)?$",
  "i",
);

const REJECT_PATTERN = new RegExp(
  [
    "reject|decline|deny|refuse|necessary only|only necessary|essential only|continue without accepting",
    "ablehnen|nur notwendige|nur erforderliche|nicht einverstanden",
    "refuser|continuer sans accepter",
    "rechazar|rechazo",
    "rifiuta|rifiuto",
    "weigeren|afwijzen",
    "rejeitar|recusar",
    "tolak",
  ].join("|"),
  "i",
);

/** Text that marks a container as a cookie or consent notice. */
const NOTICE_PATTERN =
  /cookie|consent|tracking|datenschutz|einwilligung|consentement|traceurs|consentimiento|consenso|toestemming|consentimento|kuki|privasi/i;

const normalise = (text: string) => text.toLowerCase().replace(/[’]/g, "'").replace(/[!.]/g, "").trim();

/** Whether a button label reads as "accept cookies" (any supported language). */
export function isAcceptText(text: string): boolean {
  return ACCEPT_PATTERN.test(normalise(text));
}

/** Whether a button label reads as "reject cookies" (any supported language). */
export function isRejectText(text: string): boolean {
  return REJECT_PATTERN.test(text);
}

/** Accept may be this many times larger (by area) than reject before we flag it. */
const MAX_AREA_RATIO = 2;

export const cookieBannerAsymmetry: Rule = {
  id: "cookie-banner-asymmetry",
  description: "Rejecting cookies must be as easy and as visible as accepting them.",
  severity: "warn",
  async check({ inFrames }) {
    // Consent banners are often rendered in shadow DOM or a third-party iframe,
    // so look in every frame. Only buttons inside a cookie notice count: an
    // "OK" button elsewhere on a page with a cookie policy link is not a banner.
    const banners = await inFrames(
      ({ selector, accept, reject, notice }) => {
        const h = window.__honestlint;
        const acceptRe = new RegExp(accept, "i");
        const rejectRe = new RegExp(reject, "i");
        const noticeRe = new RegExp(notice, "i");
        const normalise = (t: string) => t.toLowerCase().replace(/[’]/g, "'").replace(/[!.]/g, "").trim();
        const parentOf = (el: Element) => el.parentElement ?? ((el.getRootNode() as ShadowRoot).host || null);

        /** The closest ancestor that reads like a cookie notice, if any. */
        const noticeOf = (el: Element): Element | null => {
          let node: Element | null = el;
          for (let depth = 0; node && depth < 10; depth++) {
            const text = (node as HTMLElement).innerText ?? "";
            if (text.length > 4000) return null;
            if (noticeRe.test(text)) return node;
            node = parentOf(node);
          }
          // A consent iframe is itself the notice, even if its text is all buttons.
          return window !== window.top && noticeRe.test(h.pageText()) ? document.body : null;
        };

        type Control = { text: string; selector: string; ref: string; area: number };
        const results: { accept: Control; reject: Control | null }[] = [];
        const seen = new Set<Element>();
        for (const el of h.all(selector)) {
          if (!h.isVisible(el) || !acceptRe.test(normalise(h.text(el)))) continue;
          const container = noticeOf(el);
          if (!container || seen.has(container)) continue;
          seen.add(container);

          const rejectEl = h
            .all(selector, container)
            .find((c) => h.isVisible(c) && rejectRe.test(h.text(c)) && h.text(c).length < 60);
          const area = (e: Element) => {
            const r = e.getBoundingClientRect();
            return r.width * r.height;
          };
          results.push({
            accept: { text: h.text(el), selector: h.cssPath(el), ref: h.mark(el), area: area(el) },
            reject: rejectEl
              ? { text: h.text(rejectEl), selector: h.cssPath(rejectEl), ref: h.mark(rejectEl), area: area(rejectEl) }
              : null,
          });
        }
        return results;
      },
      { selector: CONTROLS, accept: ACCEPT_PATTERN.source, reject: REJECT_PATTERN.source, notice: NOTICE_PATTERN.source },
    );

    return banners.flatMap(({ accept, reject, frame }) => {
      if (!reject) {
        return [
          {
            ruleId: this.id,
            severity: this.severity,
            message: "Cookie banner has an accept button but no visible reject option.",
            selector: withFrame({ selector: accept.selector, frame }),
            ref: accept.ref,
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
          selector: withFrame({ selector: reject.selector, frame }),
          ref: reject.ref,
          snippet: `${accept.text} / ${reject.text}`,
        },
      ];
    });
  },
};
