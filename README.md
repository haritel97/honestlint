# honestlint

[![CI](https://github.com/haritel97/honestlint/actions/workflows/ci.yml/badge.svg)](https://github.com/haritel97/honestlint/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/honestlint)](https://www.npmjs.com/package/honestlint)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**A linter for deceptive UX.** honestlint opens your web app in a real browser and flags dark patterns (pre-ticked consent boxes, fake countdown timers, lopsided cookie banners, guilt-trip opt-outs) so you can fix them before your users, or a regulator, notice.

Think ESLint, but for the honesty of your interface.

![honestlint report for the ShadyShop demo store: a screenshot with four dark patterns outlined and numbered, next to the list of findings](https://raw.githubusercontent.com/haritel97/honestlint/main/docs/report.png)

## Try it in 30 seconds

[**ShadyShop**](https://honestlint-shadyshop.vercel.app) is a fake store we built to be as shady as possible. Point honestlint at it:

```bash
npx playwright install chromium   # once
npx honestlint https://honestlint-shadyshop.vercel.app --report
```

```text
https://honestlint-shadyshop.vercel.app
  error  Consent checkbox is pre-checked. Users must opt in themselves.  pre-checked-consent
         "Email me exclusive offers and share my details with trusted partners"
  warn   Accept button is 14.8x larger than the reject option.  cookie-banner-asymmetry
  warn   Opt-out text shames the user for declining.  confirmshaming
         "No thanks, I'd rather pay full price"
  error  Countdown reset from 09:58 to 09:59 when the page was opened again.  fake-countdown

✖ 4 problem(s) (2 error(s), 2 warning(s))
Report written to honestlint-report.html
```

ShadyShop also hides a few patterns honestlint can't catch yet (fake scarcity, a pre-added protection plan, a "cancel by phone" subscription). Spotting them is a good first contribution.

> **Status:** early (v0.3), [tested on 30 real websites](#tested-on-real-websites). Rules are heuristic, so expect some false positives and misses. Feedback and new rules are very welcome.

## Why

Dark patterns are no longer just bad manners. Laws such as the EU Digital Services Act and consumer-protection rules in the US and India increasingly restrict them. Most teams don't ship them on purpose: a growth experiment here, a copied cookie banner there. honestlint catches them in CI, the same way you already catch accessibility and lint errors.

## Install

```bash
npm install --save-dev honestlint
npx playwright install chromium
```

Requires Node.js 20 or newer.

## Usage

```bash
# Lint one or more pages
npx honestlint http://localhost:3000 http://localhost:3000/pricing

# Only run some rules
npx honestlint http://localhost:3000 --rule fake-countdown --rule confirmshaming

# Fail CI on warnings too, and get machine-readable output
npx honestlint http://localhost:3000 --fail-on warn --json

# Write an HTML report with annotated screenshots
npx honestlint http://localhost:3000 --report
```

### HTML report

`--report` writes a single self-contained HTML file (default `honestlint-report.html`, change it with `--out`). Each page gets a full-page screenshot with every problem outlined and numbered, next to the list of findings. Hover a finding to highlight it on the screenshot, or click a marker to jump to its finding. The file has no external dependencies, so you can attach it to a PR, upload it as a CI artifact, or send it to a designer.

| Option | Description |
| --- | --- |
| `--rule <id>` | Only run this rule (repeatable) |
| `--fail-on <level>` | Exit non-zero on `error` (default) or `warn` |
| `--json` | Print results as JSON |
| `--report` | Also write an HTML report with annotated screenshots |
| `--out <file>` | Where to write the report (default `honestlint-report.html`) |
| `--timeout <ms>` | Navigation timeout (default 30000) |
| `--wait <ms>` | Extra wait after the page settles, for banners that appear late (default 1000) |
| `--headed` | Show the browser window |
| `--list-rules` | List the built-in rules |

Exit codes: `0` clean, `1` findings at or above `--fail-on`, `2` usage error or a page that could not be linted. A page that fails to load (timeout, DNS, crash) is reported on its own and does not stop the other pages.

### Programmatic API

```ts
import { lint, formatPretty } from "honestlint";

const results = await lint(["http://localhost:3000"], { rules: ["pre-checked-consent"] });
console.log(formatPretty(results));
```

## Rules

| Rule | Severity | What it catches |
| --- | --- | --- |
| `pre-checked-consent` | error | Marketing, newsletter or partner-sharing checkboxes that are ticked by default |
| `cookie-banner-asymmetry` | warn | Cookie banners with no reject option, or a reject option far smaller than accept |
| `confirmshaming` | warn | Opt-out wording that guilt-trips the user ("No thanks, I don't like saving money") |
| `fake-countdown` | error | Urgency timers that restart when the page is opened again in a new tab |

### How pages are inspected

- honestlint waits for the network to go quiet after load, then `--wait` ms more, so single-page apps and late cookie banners have time to render.
- Rules look inside **open shadow roots** and **iframes** (including third-party ones), where most consent platforms render their banners. Selectors show these boundaries as `>>>` (shadow root) and `[iframe …]`.
- Timers are watched for a moment to confirm they are counting down, then the page is opened again in a fresh tab. A timer that jumps back up is fake, even if it only persists per session. Times inside video and audio players, and times with no sales wording nearby ("ends", "offer", "tamat", "endet"…), are ignored.
- Cookie banners are recognised in English, German, French, Spanish, Italian, Dutch, Portuguese and Malay.
- Many large sites serve automated browsers a block page or CAPTCHA. honestlint reports these pages as **could not lint** rather than "clean", and does not try to get around bot protection. It works best on your own site: run it against a local, preview or staging build.

## Tested on real websites

Before v0.3.0 we ran honestlint against **30 popular websites** (online stores, news sites and travel sites in the US, Europe and Southeast Asia). The fixture pages were passing, but the real world was not. Here is what that run taught us, and what changed:

| What we found | What we changed |
| --- | --- |
| 5 of the 30 sites showed the headless browser a block page or CAPTCHA, and honestlint reported them as **clean** | Block pages are now detected and reported as *could not lint*. A clean result should mean we actually looked |
| A news site's video player produced **18 false "fake countdown" errors**: its remaining time restarts on every visit, like a fake timer would | Timers inside media players, or with no sales wording nearby, are ignored |
| Consent banners on two major news sites were missed: one was in French ("Accepter et continuer"), the other said "Yes, I accept" | Cookie banners are recognised in 8 languages and more phrasings, and only buttons inside a consent notice count |
| One site timed out. In v0.2, a single failing page aborted the whole run and lost every other result | Each page now succeeds or fails on its own (fixed just before the run, which confirmed it) |
| Ad-heavy pages timed out waiting for the `load` event | Only the HTML has to arrive in time; later waits are capped |

Things to keep in mind:

- **30 sites is a small sample.** It found real bugs, but it is not proof that every rule is accurate everywhere. Please [report false positives](https://github.com/haritel97/honestlint/issues/new?template=false_positive.yml).
- The run was made from Malaysia. Many European sites only show their cookie banner to visitors in the EU, so it says little about how those banners look to European users.
- We publish what we changed, not a list of sites and their results: honestlint is a heuristic tool, and a heuristic result is not an accusation.

## Roadmap

- [ ] `roach-motel`: compare clicks needed to sign up against clicks needed to cancel
- [ ] `hidden-costs`: detect prices that grow between the product page and checkout
- [ ] `sneak-into-basket`: items added to the cart without the user asking
- [ ] Multi-step flows (scripted journeys, not just single pages)
- [ ] Optional LLM-backed text rules for non-English pages
- [ ] GitHub Action with PR annotations
- [ ] Config file (`honestlint.config.ts`) for per-project rule settings

## Contributing

Each dark pattern is one small rule file, so adding a new one is a great first contribution. See [CONTRIBUTING.md](CONTRIBUTING.md), and look for issues labelled [`good first issue`](https://github.com/haritel97/honestlint/labels/good%20first%20issue).

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)
