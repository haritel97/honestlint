import type { FrameHit } from "../types.js";

/** The selector shown in reports, prefixed with its iframe when it isn't in the top page. */
export function withFrame(hit: FrameHit<{ selector: string }>): string {
  return hit.frame ? `[${hit.frame}] ${hit.selector}` : hit.selector;
}

/** CSS selector for the clickable things rules inspect. */
export const CONTROLS = 'button, a, [role="button"], input[type="button"], input[type="submit"]';
