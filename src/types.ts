import type { Page } from "playwright";

export type Severity = "error" | "warn";

/** A rectangle in page coordinates (CSS pixels from the top-left of the document). */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  /** CSS path to the offending element, when there is one. */
  selector?: string;
  /** Short excerpt of the offending text, for the report. */
  snippet?: string;
  /** Where the element sits on the page. Only set when screenshots are captured. */
  box?: Box;
  /** Internal: the `data-honestlint-ref` put on the element, used to find it again. */
  ref?: string;
}

export interface Screenshot {
  /** Base64-encoded JPEG of the full page. */
  data: string;
  width: number;
  height: number;
}

/** A result from `inFrames`, tagged with the iframe it came from (null for the top page). */
export type FrameHit<T> = T & { frame: string | null };

export interface RuleContext {
  page: Page;
  url: string;
  /**
   * Run `fn` in the top page and in every iframe, and collect the results.
   * Frames where it throws (detached, navigating) are skipped.
   */
  inFrames<T, A>(fn: (arg: A) => T[], arg: A): Promise<FrameHit<T>[]>;
  /** Open the same URL in a fresh tab (new session storage), ready to inspect. Close it when done. */
  openFresh(): Promise<Page>;
}

export interface Rule {
  /** Kebab-case id, used in reports and in `--rule`. */
  id: string;
  description: string;
  severity: Severity;
  check(ctx: RuleContext): Promise<Finding[]>;
}

export interface LintResult {
  url: string;
  findings: Finding[];
  screenshot?: Screenshot;
  /** Set when the page could not be linted (unreachable, timed out, crashed). */
  error?: string;
}

export interface LintOptions {
  /** Only run these rule ids. Runs every rule when empty or unset. */
  rules?: string[];
  /** Navigation timeout in milliseconds. */
  timeout?: number;
  /**
   * Extra time to wait after the page settles, for banners and popups that
   * appear after a delay. Defaults to 1000ms.
   */
  wait?: number;
  headless?: boolean;
  /** Capture a full-page screenshot and the position of each finding, for the HTML report. */
  screenshot?: boolean;
}
