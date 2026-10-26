import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { lint } from "../src/runner.js";
import type { LintResult } from "../src/types.js";

const fixture = (name: string) =>
  pathToFileURL(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))).href;

describe("deceptive page", () => {
  let result: LintResult;
  beforeAll(async () => {
    [result] = await lint([fixture("deceptive.html")]);
  });

  const ruleIds = () => result.findings.map((f) => f.ruleId);

  it("flags the pre-checked partner offers box", () => {
    expect(ruleIds()).toContain("pre-checked-consent");
  });

  it("flags the oversized accept button", () => {
    expect(ruleIds()).toContain("cookie-banner-asymmetry");
  });

  it("flags the shaming opt-out link", () => {
    expect(ruleIds()).toContain("confirmshaming");
  });

  it("flags the countdown that resets on reload", () => {
    expect(ruleIds()).toContain("fake-countdown");
  });
});

describe("honest page", () => {
  it("has no findings", async () => {
    const [result] = await lint([fixture("honest.html")]);
    expect(result.findings).toEqual([]);
  });
});

describe("rule selection", () => {
  it("only runs the requested rule", async () => {
    const [result] = await lint([fixture("deceptive.html")], { rules: ["confirmshaming"] });
    expect(new Set(result.findings.map((f) => f.ruleId))).toEqual(new Set(["confirmshaming"]));
  });

  it("rejects unknown rule ids", async () => {
    await expect(lint([fixture("deceptive.html")], { rules: ["nope"] })).rejects.toThrow(/Unknown rule/);
  });
});
