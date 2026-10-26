import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { lint } from "../src/runner.js";
import type { LintResult } from "../src/types.js";

// The public demo store doubles as a realistic end-to-end fixture.
const shadyshop = pathToFileURL(fileURLToPath(new URL("../demo/shadyshop/index.html", import.meta.url))).href;

describe("ShadyShop demo store", () => {
  let result: LintResult;
  beforeAll(async () => {
    [result] = await lint([shadyshop], { screenshot: true });
  });

  it("triggers every built-in rule", () => {
    expect(new Set(result.findings.map((f) => f.ruleId))).toEqual(
      new Set(["pre-checked-consent", "cookie-banner-asymmetry", "confirmshaming", "fake-countdown"]),
    );
  });

  it("does not flag the pre-checked protection plan as consent", () => {
    const consent = result.findings.filter((f) => f.ruleId === "pre-checked-consent");
    expect(consent).toHaveLength(1);
    expect(consent[0].selector).toBe("#marketing");
  });

  it("draws the fixed cookie banner at the bottom of the page, not over the first screen", () => {
    const cookie = result.findings.find((f) => f.ruleId === "cookie-banner-asymmetry")!;
    const shot = result.screenshot!;
    expect(shot.height).toBeGreaterThan(800);
    expect(cookie.box!.y).toBeGreaterThan(shot.height - 150);
  });
});
