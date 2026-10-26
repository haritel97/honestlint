import type { Rule } from "../types.js";
import { confirmshaming } from "./confirmshaming.js";
import { cookieBannerAsymmetry } from "./cookie-banner-asymmetry.js";
import { fakeCountdown } from "./fake-countdown.js";
import { preCheckedConsent } from "./pre-checked-consent.js";

/** Every built-in rule. fake-countdown reloads the page, so it runs last. */
export const allRules: Rule[] = [preCheckedConsent, cookieBannerAsymmetry, confirmshaming, fakeCountdown];

export { confirmshaming, cookieBannerAsymmetry, fakeCountdown, preCheckedConsent };
