import type { Page } from "playwright";
import type { Rule } from "../types.js";

/** How long to watch a timer to confirm it is counting down. */
const OBSERVE_MS = 1_500;

interface Timer {
  selector: string;
  text: string;
  seconds: number;
}

function readTimers(page: Page): Promise<Timer[]> {
  return page.evaluate(() => {
    const h = window.__honestlint;
    const timerText = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
    const timers: { selector: string; text: string; seconds: number }[] = [];
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      if (el.children.length > 0 || !h.isVisible(el)) continue;
      const text = h.text(el);
      const m = timerText.exec(text);
      if (!m) continue;
      const parts = m.slice(1).filter((p): p is string => p !== undefined).map(Number);
      const seconds = parts.reduce((total, part) => total * 60 + part, 0);
      timers.push({ selector: h.cssPath(el), text, seconds });
    }
    return timers;
  });
}

export const fakeCountdown: Rule = {
  id: "fake-countdown",
  description: "Urgency timers must not reset when the page is reloaded.",
  severity: "error",
  async check({ page }) {
    const before = await readTimers(page);
    if (before.length === 0) return [];

    await page.waitForTimeout(OBSERVE_MS);
    const later = await readTimers(page);
    const ticking = later.filter((t) => {
      const first = before.find((b) => b.selector === t.selector);
      return first !== undefined && t.seconds < first.seconds;
    });
    if (ticking.length === 0) return [];

    await page.reload({ waitUntil: "load" });
    const afterReload = await readTimers(page);

    return ticking.flatMap((t) => {
      const reloaded = afterReload.find((r) => r.selector === t.selector);
      // A real deadline keeps going down across reloads; a fake one jumps back up.
      if (!reloaded || reloaded.seconds <= t.seconds) return [];
      return [
        {
          ruleId: this.id,
          severity: this.severity,
          message: `Countdown reset from ${t.text} to ${reloaded.text} after a reload.`,
          selector: t.selector,
          snippet: reloaded.text,
        },
      ];
    });
  },
};
