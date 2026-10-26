import type { Frame, Page } from "playwright";
import type { FrameHit, Rule } from "../types.js";
import { withFrame } from "./util.js";

/** How long to watch a timer to confirm it is counting down. */
const OBSERVE_MS = 1_500;

interface Timer {
  selector: string;
  text: string;
  seconds: number;
}

/**
 * Words that put a timer in a sales-urgency context, in several languages.
 * Without one nearby, "1:27" is more likely a video length or a clock.
 */
const URGENCY_PATTERN = new RegExp(
  [
    "ends?|ending|left|hurry|sale|deal|offer|expires?|remaining|limited|flash|reserved|only|today|countdown|last chance",
    "endet|nur noch|angebot|läuft ab",
    "termine|se termine|fin de|offre|plus que|expire",
    "termina|oferta|quedan|solo",
    "scade|offerta|solo",
    "eindigt|aanbieding|nog maar",
    "termina|oferta|restam",
    "tamat|berakhir|jualan|tawaran|kilat|hanya|tinggal",
  ].join("|"),
  "i",
);

/**
 * Find countdown-looking text ("09:59", "1:02:03"), including timers whose
 * digits are split across elements (<span>09</span>:<span>59</span>).
 * Returns the innermost element that holds the whole time. Skips media
 * players and times with no sales wording nearby.
 */
function findTimers(urgencySource: string): Timer[] {
  const h = window.__honestlint;
  const urgency = new RegExp(urgencySource, "i");
  const timerText = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
  const read = (el: HTMLElement) => (el.innerText || "").replace(/\s+/g, "");
  const parentOf = (el: Element) => el.parentElement ?? ((el.getRootNode() as ShadowRoot).host || null);

  const inMediaPlayer = (el: Element) => {
    let node: Element | null = el;
    for (let depth = 0; node && depth < 8; depth++) {
      const name = `${node.id} ${typeof node.className === "string" ? node.className : ""} ${node.getAttribute("aria-label") ?? ""}`;
      if (/player|video|media|audio|podcast|playback/i.test(name)) return true;
      // Only look for a <video> in close containers: a product video elsewhere
      // on the page must not hide a fake timer near the buy button.
      if (depth < 4 && node.querySelector("video, audio")) return true;
      node = parentOf(node);
    }
    return false;
  };

  /** Text around the timer: the first few ancestors that say more than the time itself. */
  const context = (el: Element) => {
    let node: Element | null = parentOf(el);
    for (let depth = 0; node && depth < 4; depth++) {
      const text = ((node as HTMLElement).innerText ?? "").trim();
      if (text.length > 400) break;
      if (urgency.test(text.replace(/[\d:\s]+/g, " "))) return true;
      node = parentOf(node);
    }
    return false;
  };
  const timers: Timer[] = [];
  for (const el of h.all("*")) {
    // Cheap pre-check before the expensive innerText and style reads.
    const raw = el.textContent ?? "";
    if (raw.length > 40 || !raw.includes(":")) continue;
    if (!h.isVisible(el)) continue;
    const m = timerText.exec(read(el));
    if (!m) continue;
    // Skip wrappers whose child already holds the full time.
    if (Array.from(el.children).some((c) => timerText.test(read(c as HTMLElement)))) continue;
    if (inMediaPlayer(el) || !context(el)) continue;
    const parts = m.slice(1).filter((p): p is string => p !== undefined).map(Number);
    const seconds = parts.reduce((total, part) => total * 60 + part, 0);
    timers.push({ selector: h.cssPath(el), text: m[0], seconds });
  }
  return timers;
}

async function readFrames(page: Page): Promise<FrameHit<Timer>[]> {
  const hits: FrameHit<Timer>[] = [];
  for (const frame of page.frames() as Frame[]) {
    try {
      const timers = await frame.evaluate(findTimers, URGENCY_PATTERN.source);
      const label = frame === page.mainFrame() ? null : "iframe";
      hits.push(...timers.map((t) => ({ ...t, frame: label })));
    } catch {
      // Frame went away; nothing to read.
    }
  }
  return hits;
}

const sameTimer = (a: FrameHit<Timer>, b: FrameHit<Timer>) => a.selector === b.selector && a.frame === b.frame;

export const fakeCountdown: Rule = {
  id: "fake-countdown",
  description: "Urgency timers must not reset when the page is opened again.",
  severity: "error",
  async check({ page, inFrames, openFresh }) {
    const before = await readFrames(page);
    if (before.length === 0) return [];

    await page.waitForTimeout(OBSERVE_MS);
    const later = await readFrames(page);
    const ticking = later.filter((t) => {
      const first = before.find((b) => sameTimer(b, t));
      return first !== undefined && t.seconds < first.seconds;
    });
    if (ticking.length === 0) return [];

    // Open the page again in a new tab: unlike a reload, this also starts a new
    // sessionStorage, so timers that only persist per session are caught too.
    const fresh = await openFresh();
    let again: FrameHit<Timer>[];
    try {
      again = await readFrames(fresh);
    } finally {
      await fresh.close();
    }

    const resets = ticking.flatMap((t) => {
      const reopened = again.find((r) => sameTimer(r, t));
      // A real deadline keeps going down; a fake one jumps back up.
      return reopened && reopened.seconds > t.seconds ? [{ timer: t, reopened }] : [];
    });
    if (resets.length === 0) return [];

    const marked = await inFrames(
      (selectors) => {
        const h = window.__honestlint;
        return h
          .all("*")
          .filter((el) => (el.textContent ?? "").includes(":") && selectors.includes(h.cssPath(el)))
          .map((el) => ({ selector: h.cssPath(el), ref: h.mark(el) }));
      },
      resets.map((r) => r.timer.selector),
    );

    return resets.map(({ timer, reopened }) => ({
      ruleId: this.id,
      severity: this.severity,
      message: `Countdown reset from ${timer.text} to ${reopened.text} when the page was opened again.`,
      selector: withFrame(timer),
      ref: marked.find((m) => m.selector === timer.selector)?.ref,
      snippet: reopened.text,
    }));
  },
};
