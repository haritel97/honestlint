import { describe, expect, it } from "vitest";
import { matchesConfirmshaming } from "../src/rules/confirmshaming.js";

describe("matchesConfirmshaming", () => {
  it.each([
    "No thanks, I don't like saving money",
    "No thanks, I do not want free shipping",
    "I'd rather pay full price",
    "I'm not interested in saving",
    "I hate deals",
    "No, I'm fine paying more",
    "I'll pass on the discount",
  ])("flags %j", (text) => {
    expect(matchesConfirmshaming(text)).toBe(true);
  });

  it.each(["No thanks", "Not now", "Maybe later", "Close", "Decline", "Skip"])("allows %j", (text) => {
    expect(matchesConfirmshaming(text)).toBe(false);
  });
});
