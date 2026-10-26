import { chromium, type Browser, type Page } from "playwright";
import { helperScript } from "./browser-helpers.js";
import { allRules } from "./rules/index.js";
import type { Box, Finding, LintOptions, LintResult, Rule, Screenshot } from "./types.js";

/** Fixed viewport so reports look the same on every machine. */
const VIEWPORT = { width: 1280, height: 800 };

/** Very tall pages are cut off so the report stays a reasonable size. */
const MAX_SCREENSHOT_HEIGHT = 8_000;

export function selectRules(ids?: string[]): Rule[] {
  if (!ids || ids.length === 0) return allRules;
  const unknown = ids.filter((id) => !allRules.some((r) => r.id === id));
  if (unknown.length > 0) {
    throw new Error(`Unknown rule(s): ${unknown.join(", ")}. Known: ${allRules.map((r) => r.id).join(", ")}`);
  }
  return allRules.filter((r) => ids.includes(r.id));
}

/** Locate each finding's element and take a full-page screenshot to draw them on. */
async function capture(page: Page, findings: Finding[]): Promise<Screenshot> {
  await page.evaluate(() => window.scrollTo(0, 0));
  const selectors = findings.map((f) => f.selector ?? null);
  const { boxes, width, height } = await page.evaluate((sels) => {
    const boxes = sels.map((sel) => {
      if (!sel) return null;
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
    });
    const doc = document.documentElement;
    return { boxes, width: doc.scrollWidth, height: doc.scrollHeight };
  }, selectors);

  boxes.forEach((box: Box | null, i) => {
    if (box) findings[i].box = box;
  });

  const clippedHeight = Math.min(height, MAX_SCREENSHOT_HEIGHT);
  const image = await page.screenshot({
    type: "jpeg",
    quality: 80,
    fullPage: true,
    clip: { x: 0, y: 0, width, height: clippedHeight },
  });
  return { data: image.toString("base64"), width, height: clippedHeight };
}

async function lintPage(browser: Browser, url: string, rules: Rule[], options: LintOptions): Promise<LintResult> {
  const context = await browser.newContext({ viewport: VIEWPORT });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(options.timeout ?? 30_000);
    await page.addInitScript(helperScript);
    await page.goto(url, { waitUntil: "load" });

    const findings: Finding[] = [];
    for (const rule of rules) {
      findings.push(...(await rule.check({ page, url })));
    }
    if (!options.screenshot) return { url, findings };
    return { url, findings, screenshot: await capture(page, findings) };
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
      results.push(await lintPage(browser, url, rules, options));
    }
    return results;
  } finally {
    await browser.close();
  }
}
