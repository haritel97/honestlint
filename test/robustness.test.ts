import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { lint } from "../src/runner.js";

const fixture = (name: string) =>
  pathToFileURL(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))).href;

const ruleIds = (findings: { ruleId: string }[]) => findings.map((f) => f.ruleId);

describe("per-page errors", () => {
  it("reports a page that fails to load and still lints the others", async () => {
    const [missing, ok] = await lint([fixture("does-not-exist.html"), fixture("deceptive.html")], {
      rules: ["confirmshaming"],
    });
    expect(missing.error).toBeTruthy();
    expect(missing.findings).toEqual([]);
    expect(ok.error).toBeUndefined();
    expect(ruleIds(ok.findings)).toContain("confirmshaming");
  });
});

describe("bot protection", () => {
  it("reports a block page as a failure instead of a clean result", async () => {
    const [result] = await lint([fixture("blocked.html")]);
    expect(result.error).toMatch(/blocked the automated browser/);
    expect(result.findings).toEqual([]);
  });
});

describe("shadow DOM", () => {
  it("finds a consent banner and checkbox inside an open shadow root", async () => {
    const [result] = await lint([fixture("shadow.html")], { screenshot: true });
    expect(ruleIds(result.findings)).toEqual(
      expect.arrayContaining(["cookie-banner-asymmetry", "pre-checked-consent"]),
    );
    const consent = result.findings.find((f) => f.ruleId === "pre-checked-consent")!;
    expect(consent.selector).toContain(">>>");
    for (const f of result.findings) expect(f.box, f.ruleId).toBeDefined();
  });
});

describe("iframes", () => {
  it("finds a consent banner and shaming link inside an iframe, positioned on the page", async () => {
    const [result] = await lint([fixture("iframe.html")], { screenshot: true });
    expect(ruleIds(result.findings)).toEqual(expect.arrayContaining(["cookie-banner-asymmetry", "confirmshaming"]));
    const cookie = result.findings.find((f) => f.ruleId === "cookie-banner-asymmetry")!;
    expect(cookie.selector).toMatch(/^\[iframe/);
    // The iframe sits 200px down the page, so its contents must too.
    expect(cookie.box!.y).toBeGreaterThan(200);
  });
});

describe("late-rendering pages", () => {
  it("waits for a banner that appears after the load event", async () => {
    const [result] = await lint([fixture("late.html")], { rules: ["cookie-banner-asymmetry"] });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].message).toMatch(/no visible reject/);
  });

  it("misses it when told not to wait (proves the wait matters)", async () => {
    const [result] = await lint([fixture("late.html")], { rules: ["cookie-banner-asymmetry"], wait: 0 });
    expect(result.findings).toEqual([]);
  });
});

describe("tricky timers", () => {
  it("catches split-digit timers and per-session timers that reset in a new tab", async () => {
    const [result] = await lint([fixture("timers.html")], { rules: ["fake-countdown"], screenshot: true });
    const selectors = result.findings.map((f) => f.selector);
    expect(selectors).toEqual(expect.arrayContaining(["#split", "#session"]));
    for (const f of result.findings) expect(f.box, f.selector).toBeDefined();
  });

  it("ignores video players and timers with no sales wording", async () => {
    const [result] = await lint([fixture("media.html")], { rules: ["fake-countdown"] });
    expect(result.findings).toEqual([]);
  });
});
