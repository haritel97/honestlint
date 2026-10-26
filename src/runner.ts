import { chromium, type Browser } from "playwright";
import { helperScript } from "./browser-helpers.js";
import { allRules } from "./rules/index.js";
import type { Finding, LintOptions, LintResult, Rule } from "./types.js";

export function selectRules(ids?: string[]): Rule[] {
  if (!ids || ids.length === 0) return allRules;
  const unknown = ids.filter((id) => !allRules.some((r) => r.id === id));
  if (unknown.length > 0) {
    throw new Error(`Unknown rule(s): ${unknown.join(", ")}. Known: ${allRules.map((r) => r.id).join(", ")}`);
  }
  return allRules.filter((r) => ids.includes(r.id));
}

async function lintPage(browser: Browser, url: string, rules: Rule[], timeout: number): Promise<LintResult> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);
    await page.addInitScript(helperScript);
    await page.goto(url, { waitUntil: "load" });

    const findings: Finding[] = [];
    for (const rule of rules) {
      findings.push(...(await rule.check({ page, url })));
    }
    return { url, findings };
  } finally {
    await context.close();
  }
}

/** Open each URL in a fresh browser context and run the selected rules against it. */
export async function lint(urls: string[], options: LintOptions = {}): Promise<LintResult[]> {
  const rules = selectRules(options.rules);
  const browser = await chromium.launch({ headless: options.headless ?? true });
  try {
    const results: LintResult[] = [];
    for (const url of urls) {
      results.push(await lintPage(browser, url, rules, options.timeout ?? 30_000));
    }
    return results;
  } finally {
    await browser.close();
  }
}
