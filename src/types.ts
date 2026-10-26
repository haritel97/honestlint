import type { Page } from "playwright";

export type Severity = "error" | "warn";

export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  /** CSS path to the offending element, when there is one. */
  selector?: string;
  /** Short excerpt of the offending text, for the report. */
  snippet?: string;
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
}

export interface LintOptions {
  /** Only run these rule ids. Runs every rule when empty or unset. */
  rules?: string[];
  /** Navigation timeout in milliseconds. */
  timeout?: number;
  headless?: boolean;
}
