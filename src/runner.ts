import { chromium, type Browser, type BrowserContext, type Frame, type Page } from "playwright";
import { helperScript } from "./browser-helpers.js";
import { allRules } from "./rules/index.js";
import type { Box, Finding, FrameHit, LintOptions, LintResult, Rule, RuleContext, Screenshot } from "./types.js";

/** Fixed viewport so reports look the same on every machine. */
const VIEWPORT = { width: 1280, height: 800 };

/** Very tall pages are cut off so the report stays a reasonable size. */
const MAX_SCREENSHOT_HEIGHT = 8_000;

/** How long to wait for the load event and for the network to go quiet before inspecting anyway. */
const LOAD_TIMEOUT = 15_000;
const NETWORK_IDLE_TIMEOUT = 5_000;

const DEFAULT_WAIT = 1_000;

export function selectRules(ids?: string[]): Rule[] {
  if (!ids || ids.length === 0) return allRules;
  const unknown = ids.filter((id) => !allRules.some((r) => r.id === id));
  if (unknown.length > 0) {
    throw new Error(`Unknown rule(s): ${unknown.join(", ")}. Known: ${allRules.map((r) => r.id).join(", ")}`);
  }
  return allRules.filter((r) => ids.includes(r.id));
}

/**
 * Load a URL and wait until it is ready to inspect. Only the HTML has to
 * arrive in time: ad-heavy sites can take a very long time to fire `load`,
 * so that and network idle are waited for with a cap. Single-page apps keep
 * rendering after load (cookie banners often arrive last), hence the extra wait.
 */
async function open(page: Page, url: string, wait: number): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load", { timeout: LOAD_TIMEOUT }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: NETWORK_IDLE_TIMEOUT }).catch(() => {});
  if (wait > 0) await page.waitForTimeout(wait);
}

const BLOCKED_TITLE =
  /^(access denied|error page|attention required|just a moment|are you a (robot|human)|robot check|forbidden|403\b|request blocked|you have been blocked|pardon our interruption|security check)/i;
const CHALLENGE_FRAME = /captcha-delivery\.com|challenges\.cloudflare\.com|hcaptcha\.com|px-captcha|perimeterx/i;

/**
 * Many large sites serve headless browsers a block or CAPTCHA page instead of
 * the real one. Linting that page would report "clean", which is worse than
 * reporting nothing, so treat it as a failure.
 */
async function blockedReason(page: Page): Promise<string | null> {
  const title = (await page.title()).trim();
  if (BLOCKED_TITLE.test(title)) return `title "${title.slice(0, 60)}"`;
  const challenge = page.frames().some((f) => CHALLENGE_FRAME.test(f.url()));
  if (challenge) {
    const textLength = await page.evaluate(() => document.body?.innerText.trim().length ?? 0);
    if (textLength < 300) return "CAPTCHA challenge";
  }
  return null;
}

function frameLabel(page: Page, frame: Frame): string | null {
  if (frame === page.mainFrame()) return null;
  const url = frame.url();
  return url && url !== "about:blank" && url !== "about:srcdoc" ? `iframe ${url.slice(0, 80)}` : "iframe";
}

async function inFrames<T, A>(page: Page, fn: (arg: A) => T[], arg: A): Promise<FrameHit<T>[]> {
  const hits: FrameHit<T>[] = [];
  for (const frame of page.frames()) {
    if (frame.isDetached()) continue;
    try {
      const ready = await frame.evaluate(() => typeof window.__honestlint === "object");
      if (!ready) continue;
      const results = (await frame.evaluate(fn as never, arg)) as T[];
      const label = frameLabel(page, frame);
      for (const r of results) hits.push({ ...r, frame: label });
    } catch {
      // Frames can detach or navigate mid-inspection; skip them.
    }
  }
  return hits;
}

/** Locate each marked element in every frame, in page coordinates. */
async function locate(page: Page): Promise<Map<string, Box>> {
  const boxes = new Map<string, Box>();
  for (const frame of page.frames()) {
    if (frame.isDetached()) continue;
    try {
      let offset = { x: 0, y: 0 };
      if (frame !== page.mainFrame()) {
        const frameBox = await (await frame.frameElement()).boundingBox();
        if (!frameBox) continue;
        offset = { x: frameBox.x, y: frameBox.y };
      }
      const rects = await frame.evaluate(() =>
        window.__honestlint.all("[data-honestlint-ref]").map((el) => {
          const r = el.getBoundingClientRect();
          return {
            ref: el.getAttribute("data-honestlint-ref")!,
            x: r.left + window.scrollX,
            y: r.top + window.scrollY,
            width: r.width,
            height: r.height,
          };
        }),
      );
      for (const { ref, ...box } of rects) {
        boxes.set(ref, { ...box, x: box.x + offset.x, y: box.y + offset.y });
      }
    } catch {
      // Same as above: a frame that went away has nothing to draw.
    }
  }
  return boxes;
}

/** Locate each finding's element and take a full-page screenshot to draw them on. */
async function capture(page: Page, findings: Finding[]): Promise<Screenshot> {
  // Grow the viewport to the whole page instead of using a stitched full-page
  // screenshot: otherwise position:fixed elements (cookie banners, chat
  // widgets) are drawn over the first screen and hide what is underneath.
  await page.evaluate(() => window.scrollTo(0, 0));
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const viewportHeight = Math.min(pageHeight, MAX_SCREENSHOT_HEIGHT);
  await page.setViewportSize({ width: VIEWPORT.width, height: viewportHeight });

  const boxes = await locate(page);
  for (const f of findings) {
    const box = f.ref ? boxes.get(f.ref) : undefined;
    if (box) f.box = box;
  }

  const { width, height } = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));
  // Pages with 100vh sections can grow after the resize; stay within the viewport.
  const clippedHeight = Math.min(height, viewportHeight);
  const image = await page.screenshot({
    type: "jpeg",
    quality: 80,
    clip: { x: 0, y: 0, width, height: clippedHeight },
  });
  return { data: image.toString("base64"), width, height: clippedHeight };
}

async function lintPage(context: BrowserContext, url: string, rules: Rule[], options: LintOptions): Promise<LintResult> {
  const wait = options.wait ?? DEFAULT_WAIT;
  const page = await context.newPage();
  await open(page, url, wait);
  const blocked = await blockedReason(page);
  if (blocked) {
    throw new Error(`The site blocked the automated browser (${blocked}), so the real page could not be checked.`);
  }

  const ctx: RuleContext = {
    page,
    url,
    inFrames: (fn, arg) => inFrames(page, fn, arg),
    async openFresh() {
      const fresh = await context.newPage();
      await open(fresh, url, wait);
      return fresh;
    },
  };

  const findings: Finding[] = [];
  for (const rule of rules) {
    findings.push(...(await rule.check(ctx)));
  }
  if (!options.screenshot) return { url, findings };
  return { url, findings, screenshot: await capture(page, findings) };
}

function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  // Playwright errors carry a long call log after the first line.
  return message.split("\n")[0].trim();
}

/**
 * Open each URL in a fresh browser context and run the selected rules against it.
 * A page that fails to load is reported with `error` instead of stopping the run.
 */
export async function lint(urls: string[], options: LintOptions = {}): Promise<LintResult[]> {
  const rules = selectRules(options.rules);
  const browser: Browser = await chromium.launch({ headless: options.headless ?? true });
  try {
    const results: LintResult[] = [];
    for (const url of urls) {
      const context = await browser.newContext({ viewport: VIEWPORT });
      context.setDefaultTimeout(options.timeout ?? 30_000);
      context.setDefaultNavigationTimeout(options.timeout ?? 30_000);
      await context.addInitScript(helperScript);
      try {
        results.push(await lintPage(context, url, rules, options));
      } catch (err) {
        results.push({ url, findings: [], error: describeError(err) });
      } finally {
        await context.close();
      }
    }
    return results;
  } finally {
    await browser.close();
  }
}
