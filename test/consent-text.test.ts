import { describe, expect, it } from "vitest";
import { isAcceptText, isRejectText } from "../src/rules/cookie-banner-asymmetry.js";

describe("isAcceptText", () => {
  it.each([
    "Accept all",
    "Accept",
    "Yes, I accept",
    "I agree",
    "OK",
    "Allow all cookies",
    "Alles akzeptieren",
    "Alle akzeptieren",
    "Akzeptieren und weiter",
    "Accepter et continuer",
    "Tout accepter",
    "J’accepte",
    "Aceptar todo",
    "Accetta tutto",
    "Alles accepteren",
    "Aceitar todos",
    "Terima semua",
    "Setuju",
  ])("accepts %j", (text) => {
    expect(isAcceptText(text)).toBe(true);
  });

  it.each(["Accept terms and place order", "Manage cookies", "Einstellungen", "Gestion des cookies", "Sign in", "Okay Google"])(
    "ignores %j",
    (text) => {
      expect(isAcceptText(text)).toBe(false);
    },
  );
});

describe("isRejectText", () => {
  it.each(["Reject all", "Decline", "Only necessary", "Alle ablehnen", "Tout refuser", "Rechazar", "Rifiuta", "Tolak"])(
    "rejects %j",
    (text) => {
      expect(isRejectText(text)).toBe(true);
    },
  );

  it.each(["Manage cookies", "Einstellungen", "Accept all"])("ignores %j", (text) => {
    expect(isRejectText(text)).toBe(false);
  });
});
