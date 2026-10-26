import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { escapeHtml, formatHtml } from "../src/report-html.js";
import { lint } from "../src/runner.js";
import type { LintResult } from "../src/types.js";

const fixture = (name: string) =>
  pathToFileURL(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))).href;

describe("screenshot capture", () => {
  let result: LintResult;
  beforeAll(async () => {
    [result] = await lint([fixture("deceptive.html")], { screenshot: true });
  });

  it("captures a full-page screenshot", () => {
    expect(result.screenshot?.data.length).toBeGreaterThan(1000);
    expect(result.screenshot?.width).toBe(1280);
  });

  it("locates every finding on the page", () => {
    for (const f of result.findings) {
      expect(f.box, f.ruleId).toBeDefined();
      expect(f.box!.width).toBeGreaterThan(0);
    }
  });

  it("does not capture without the option", async () => {
    const [plain] = await lint([fixture("honest.html")], { rules: ["confirmshaming"] });
    expect(plain.screenshot).toBeUndefined();
  });
});

describe("formatHtml", () => {
  const result: LintResult = {
    url: "https://example.com/",
    findings: [
      {
        ruleId: "confirmshaming",
        severity: "warn",
        message: "Opt-out text shames the user for declining.",
        snippet: '<img src=x onerror="alert(1)">',
        selector: "#popup > a",
        box: { x: 10, y: 20, width: 100, height: 30 },
      },
    ],
    screenshot: { data: "AAAA", width: 1280, height: 800 },
  };

  it("escapes text that came from the page", () => {
    const html = formatHtml([result]);
    expect(html).not.toContain('<img src=x onerror="alert(1)">');
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("draws a numbered marker for each finding", () => {
    const html = formatHtml([result]);
    // The box is at (10, 20), so its number badge flips to the right and below.
    expect(html).toContain('class="marker warn edge-x edge-y" href="#f1"');
    expect(html).toContain('id="f1"');
  });

  it("shows a clean state when there are no findings", () => {
    const html = formatHtml([{ url: "https://example.com/", findings: [] }]);
    expect(html).toContain("No dark patterns found");
  });

  it("escapeHtml escapes all special characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});
