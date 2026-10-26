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
}

export interface Screenshot {
  /** Base64-encoded JPEG of the full page. */
  data: string;
  width: number;
  height: number;
}

export interface RuleContext {
  page: Page;
  url: string;
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
}

export interface LintOptions {
  /** Only run these rule ids. Runs every rule when empty or unset. */
  rules?: string[];
  /** Navigation timeout in milliseconds. */
  timeout?: number;
  headless?: boolean;
  /** Capture a full-page screenshot and the position of each finding, for the HTML report. */
  screenshot?: boolean;
}
